import { APIError } from "better-auth/api";
import { MESAJ } from "@/lib/auth-messages";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUsers } from "@/db/schema";
import { writeAuthAudit } from "@/lib/auth-audit";
import {
  denemeKaydet,
  parolaBasarisiz,
  parolaKilidi,
  parolaSayaciSifirla,
  totpBasarisiz,
  totpKilidi,
  totpSayaciSifirla,
  type DenemeTuru,
} from "@/lib/auth-lockout";

/**
 * Giriş güvenliği kancaları — hesap bazlı kilit katmanı.
 *
 * ⚠ KULLANICI MESAJLARI SABİTTİR (Sprint 1 kararı, C maddesi):
 * Hangi alanın yanlış olduğu, hesabın var olup olmadığı veya kaç deneme
 * kaldığı ASLA söylenmez. Bilinmeyen hesap ile kayıtlı hesap aynı yanıtı,
 * aynı biçimde alır — kullanıcı enumeration'ı bu şekilde engellenir.
 */

export { MESAJ };

/** Kilitli hesap için tek tip yanıt (Retry-After ile). */
function kilitliHatasi(kalanSaniye: number): APIError {
  const saniye = String(Math.max(1, kalanSaniye));
  return new APIError(
    "TOO_MANY_REQUESTS",
    { message: MESAJ.cokFazlaDeneme, code: "ACCOUNT_TEMPORARILY_LOCKED" },
    // Retry-After ÜÇÜNCÜ argümandır (gövdenin içinde değil).
    // İstemciye ne kadar bekleyeceğini söyler; sayaç değeri sızdırmaz.
    { "Retry-After": saniye },
  );
}

async function kullaniciBul(email: string) {
  if (!email) return null;
  const rows = await db
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

function istemciIp(headers: Headers | undefined): string | null {
  return headers?.get("x-forwarded-for") ?? headers?.get("x-real-ip") ?? null;
}

/**
 * Parola girişi ÖNCESİ: hesap kilitliyse akış hiç başlamaz.
 * Bilinmeyen hesapta da aynı süre ve yanıt biçimi korunur (enumeration engeli).
 */
export async function parolaGirisiOncesi(
  email: string,
  headers: Headers | undefined,
): Promise<void> {
  const user = await kullaniciBul(email);
  if (!user) return; // Bilinmeyen hesap normal akışa girer, aynı hatayı alır

  const kilit = await parolaKilidi(user.id);
  if (!kilit.kilitli) return;

  await writeAuthAudit({
    action: "login_rate_limited",
    actorId: user.id,
    actorEmail: user.email,
    ipAddress: istemciIp(headers),
    userAgent: headers?.get("user-agent") ?? null,
    context: { reason: "account_locked", retryAfterSeconds: kilit.kalanSaniye },
  });

  throw kilitliHatasi(kilit.kalanSaniye);
}

/** Parola girişi SONRASI: sayaç güncellenir, gerekiyorsa kilit uygulanır. */
export async function parolaGirisiSonrasi(
  email: string,
  basarili: boolean,
  userId: string | null,
  headers: Headers | undefined,
): Promise<void> {
  const ip = istemciIp(headers);
  const ua = headers?.get("user-agent") ?? null;
  const user = userId ? { id: userId, email } : await kullaniciBul(email);

  await denemeKaydet({
    userId: user?.id ?? null,
    email,
    ip,
    attemptType: "password",
    succeeded: basarili,
  });

  if (basarili && user) {
    const sifirlandi = await parolaSayaciSifirla(user.id);
    await writeAuthAudit({
      action: "login",
      actorId: user.id,
      actorEmail: user.email ?? email,
      ipAddress: ip,
      userAgent: ua,
    });
    if (sifirlandi) {
      // Kilit/sayaç temizlendi — denetim izinde görünmeli
      await writeAuthAudit({
        action: "security_counter_reset",
        actorId: user.id,
        actorEmail: user.email ?? email,
        ipAddress: ip,
        context: { sayac: "giris" },
      });
    }
    return;
  }

  await writeAuthAudit({
    action: "login_failed",
    actorId: user?.id ?? null,
    actorEmail: email || null,
    ipAddress: ip,
    userAgent: ua,
  });

  if (!user) return; // Bilinmeyen hesapta kilitlenecek bir şey yok

  const sonuc = await parolaBasarisiz(user.id);
  if (sonuc.yeniKilit) {
    await writeAuthAudit({
      action: "account_temporarily_locked",
      actorId: user.id,
      actorEmail: user.email ?? email,
      ipAddress: ip,
      context: { sayac: "giris", kilitSaniye: sonuc.kalanSaniye },
    });
  }
}

/** TOTP / kurtarma kodu doğrulaması ÖNCESİ. */
export async function ikinciAdimOncesi(
  userId: string | null,
  headers: Headers | undefined,
): Promise<void> {
  if (!userId) return;
  const kilit = await totpKilidi(userId);
  if (!kilit.kilitli) return;

  await writeAuthAudit({
    action: "login_rate_limited",
    actorId: userId,
    ipAddress: istemciIp(headers),
    context: { reason: "totp_locked", retryAfterSeconds: kilit.kalanSaniye },
  });

  throw kilitliHatasi(kilit.kalanSaniye);
}

/** TOTP / kurtarma kodu doğrulaması SONRASI. */
export async function ikinciAdimSonrasi(
  userId: string | null,
  email: string,
  tur: DenemeTuru,
  basarili: boolean,
  headers: Headers | undefined,
): Promise<void> {
  const ip = istemciIp(headers);
  await denemeKaydet({ userId, email, ip, attemptType: tur, succeeded: basarili });
  if (!userId) return;

  if (basarili) {
    await totpSayaciSifirla(userId);
    return;
  }

  const sonuc = await totpBasarisiz(userId);
  if (sonuc.yeniKilit) {
    await writeAuthAudit({
      action: "account_temporarily_locked",
      actorId: userId,
      actorEmail: email || null,
      ipAddress: ip,
      context: { sayac: "ikinci_adim", kilitSaniye: sonuc.kalanSaniye },
    });
  }
}
