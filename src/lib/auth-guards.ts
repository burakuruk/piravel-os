import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts, authUsers } from "@/db/schema";
import { writeAuthAudit } from "@/lib/auth-audit";
import { MESAJ } from "@/lib/auth-messages";
import {
  denemeKaydet,
  parolaBasarisiz,
  parolaKilidi,
  parolaSayaciSifirla,
  sahteParolaDogrulamasi,
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

/** Better Auth'un standart geçersiz-kimlik yanıtı ile birebir aynı hata. */
function gecersizKimlikHatasi(): APIError {
  return new APIError("UNAUTHORIZED", {
    message: "Invalid email or password",
    code: "INVALID_EMAIL_OR_PASSWORD",
  });
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

/** Kullanıcının parola hash'i (credential sağlayıcısı). */
async function parolaHashi(userId: string): Promise<string | null> {
  const rows = await db
    .select({ password: authAccounts.password })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
    .limit(1);
  return rows[0]?.password ?? null;
}

function istemciIp(headers: Headers | undefined): string | null {
  return headers?.get("x-forwarded-for") ?? headers?.get("x-real-ip") ?? null;
}

function istekId(headers: Headers | undefined): string | null {
  return headers?.get("x-request-id") ?? null;
}

/**
 * Parola girişi ÖNCESİ.
 *
 * ⚠ ENUMERATION KURALI (Sprint 1 kararı):
 * Kilit durumu, parola DOĞRU olmadıkça asla ele verilmez. Aksi hâlde
 * "kilitli hesap 429, bilinmeyen hesap 401" farkı bir oracle olur ve
 * saldırgan hangi e-postaların kayıtlı olduğunu öğrenir.
 *
 *   parola yanlış  → 401 (hesap kilitli olsa bile, standart mesaj)
 *   parola doğru + kilitli → 429 + Retry-After
 *   bilinmeyen hesap → sahte hash doğrulaması + normal akış (401)
 */
export async function parolaGirisiOncesi(
  email: string,
  parola: string,
  headers: Headers | undefined,
  kripto: {
    hash: (password: string) => Promise<string>;
    verify: (data: { hash: string; password: string }) => Promise<boolean>;
  },
): Promise<void> {
  const user = await kullaniciBul(email);

  // Bilinmeyen hesap: zamanlama farkını azaltmak için yine de hash doğrula,
  // sonra normal akışa bırak (Better Auth kendi 401'ini üretir).
  if (!user) {
    await sahteParolaDogrulamasi(kripto.verify, kripto.hash, parola);
    return;
  }

  const kilit = await parolaKilidi(user.id);
  if (!kilit.kilitli) return; // Kilit yok: normal akış

  // Hesap kilitli. Kararı vermek için parolanın doğru olup olmadığını
  // BİZ kontrol ederiz; Better Auth'a hiç ulaşmadan yanıt şekillenir.
  const hash = await parolaHashi(user.id);
  const parolaDogru = hash ? await kripto.verify({ hash, password: parola }).catch(() => false) : false;

  const ip = istemciIp(headers);
  const rid = istekId(headers);

  if (!parolaDogru) {
    // Kilitliyken yanlış parola: bilinmeyen hesapla AYNI yanıt (401).
    // Sayaç artırılmaz ve kilit uzatılmaz — kilit süresi öngörülebilir kalır.
    await denemeKaydet({
      userId: user.id,
      email,
      ip,
      attemptType: "password",
      succeeded: false,
      requestId: rid,
    });
    await writeAuthAudit({
      action: "login_failed",
      actorId: user.id,
      actorEmail: user.email,
      ipAddress: ip,
      userAgent: headers?.get("user-agent") ?? null,
      requestId: rid,
      context: { kilitliyken: true },
    });
    throw gecersizKimlikHatasi();
  }

  // Parola doğru ama hesap kilitli → gerçek durumu bildir
  await writeAuthAudit({
    action: "login_rate_limited",
    actorId: user.id,
    actorEmail: user.email,
    ipAddress: ip,
    userAgent: headers?.get("user-agent") ?? null,
    requestId: rid,
    context: { neden: "hesap_kilitli", yenidenDeneSaniye: kilit.kalanSaniye },
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
  const rid = istekId(headers);
  const user = userId ? { id: userId, email } : await kullaniciBul(email);

  await denemeKaydet({
    userId: user?.id ?? null,
    email,
    ip,
    attemptType: "password",
    succeeded: basarili,
    requestId: rid,
  });

  if (basarili && user) {
    const sifirlandi = await parolaSayaciSifirla(user.id);
    await writeAuthAudit({
      action: "login",
      actorId: user.id,
      actorEmail: user.email ?? email,
      ipAddress: ip,
      userAgent: ua,
      requestId: rid,
    });
    if (sifirlandi) {
      // Kilit/sayaç temizlendi — denetim izinde görünmeli
      await writeAuthAudit({
        action: "security_counter_reset",
        actorId: user.id,
        actorEmail: user.email ?? email,
        ipAddress: ip,
        requestId: rid,
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
    requestId: rid,
  });

  if (!user) return; // Bilinmeyen hesapta kilitlenecek bir şey yok

  const sonuc = await parolaBasarisiz(user.id);
  if (sonuc.yeniKilit) {
    await writeAuthAudit({
      action: "account_temporarily_locked",
      actorId: user.id,
      actorEmail: user.email ?? email,
      ipAddress: ip,
      requestId: rid,
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
    requestId: istekId(headers),
    context: { neden: "ikinci_adim_kilitli", yenidenDeneSaniye: kilit.kalanSaniye },
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
  const rid = istekId(headers);
  await denemeKaydet({ userId, email, ip, attemptType: tur, succeeded: basarili, requestId: rid });
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
      requestId: rid,
      context: { sayac: "ikinci_adim", kilitSaniye: sonuc.kalanSaniye },
    });
  }
}
