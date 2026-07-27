import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts, authUsers, users } from "@/db/schema";
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
import { buildRequestContext, type RequestContext } from "@/lib/request-context";

/**
 * Giriş güvenliği kancaları — hesap bazlı kilit katmanı.
 *
 * ⚠ KULLANICI MESAJLARI SABİTTİR:
 * Hangi alanın yanlış olduğu, hesabın var olup olmadığı veya kaç deneme
 * kaldığı ASLA söylenmez. Bilinmeyen hesap ile kayıtlı hesap aynı yanıtı,
 * aynı biçimde alır — kullanıcı enumeration'ı bu şekilde engellenir.
 */

export { MESAJ };

/** Denetim kayıtlarına giden ortak izleme alanları. */
function iz(rc: RequestContext) {
  return {
    ipAddress: rc.ipAddress,
    userAgent: rc.userAgent,
    requestId: rc.requestId,
    upstreamRequestId: rc.upstreamRequestId,
    testRunId: rc.testRunId,
  };
}

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
    .select({
      id: authUsers.id,
      email: authUsers.email,
      /**
       * `users` tablosundan okunur — `auth_user`'da böyle bir alan yok ve
       * Better Auth aktiflik kavramını hiç bilmez. LEFT JOIN: `users` satırı
       * bir sebeple yoksa kullanıcı aktif SAYILMAZ (güvenli taraf).
       */
      isActive: users.isActive,
    })
    .from(authUsers)
    .leftJoin(users, eq(users.id, sql`${authUsers.id}::uuid`))
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

/**
 * Parola girişi ÖNCESİ.
 *
 * ⚠ ENUMERATION KURALI:
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

  /**
   * ⚠ AKTİF OLMAYAN HESAP HİÇ OTURUM AÇAMAZ.
   *
   * Better Auth aktiflik kavramını bilmez; `getCurrentUser()` pasif kullanıcıya
   * null döndürse de bu YETMEZ, çünkü Better Auth'un kendi uçları (parola
   * değiştirme, 2FA aç/kapat, oturum listesi) bizim kapımızdan geçmez. Kapı
   * burada, oturum HİÇ oluşmadan önce kapatılır. Aksi hâlde pasifleştirilen
   * kullanıcı oturumları silinse bile yeniden giriş yapıp yenisini alırdı.
   *
   * Bu aynı zamanda davet bekleyen kullanıcıyı da kapsar (is_active=false) —
   * credential satırının hiç yazılmaması ile birlikte ikinci katman.
   *
   * Yanıt, yanlış parolayla AYNI olur: "hesabınız pasif" demek, geçerli bir
   * e-postayı doğrulayan bir enumeration oracle'ı üretirdi.
   */
  if (!user.isActive) {
    const hash = await parolaHashi(user.id);
    // Zamanlama farkını kapat: parola yine de doğrulanır, sonuç kullanılmaz
    if (hash) await kripto.verify({ hash, password: parola }).catch(() => false);
    else await sahteParolaDogrulamasi(kripto.verify, kripto.hash, parola);

    const rcPasif = buildRequestContext(headers);
    await denemeKaydet({
      userId: user.id,
      email,
      ip: rcPasif.ipAddress,
      attemptType: "password",
      succeeded: false,
      requestId: rcPasif.requestId,
      upstreamRequestId: rcPasif.upstreamRequestId,
      testRunId: rcPasif.testRunId,
    });
    await writeAuthAudit({
      action: "login_failed",
      actorId: user.id,
      actorEmail: user.email,
      ...iz(rcPasif),
      context: { neden: "hesap_aktif_degil" },
    });
    throw gecersizKimlikHatasi();
  }

  const kilit = await parolaKilidi(user.id);
  if (!kilit.kilitli) return; // Kilit yok: normal akış

  // Hesap kilitli. Kararı vermek için parolanın doğru olup olmadığını
  // BİZ kontrol ederiz; Better Auth'a hiç ulaşmadan yanıt şekillenir.
  const hash = await parolaHashi(user.id);
  const parolaDogru = hash
    ? await kripto.verify({ hash, password: parola }).catch(() => false)
    : false;

  const rc = buildRequestContext(headers);

  if (!parolaDogru) {
    // Kilitliyken yanlış parola: bilinmeyen hesapla AYNI yanıt (401).
    // Sayaç artırılmaz ve kilit uzatılmaz — kilit süresi öngörülebilir kalır.
    await denemeKaydet({
      userId: user.id,
      email,
      ip: rc.ipAddress,
      attemptType: "password",
      succeeded: false,
      requestId: rc.requestId,
      upstreamRequestId: rc.upstreamRequestId,
      testRunId: rc.testRunId,
    });
    await writeAuthAudit({
      action: "login_failed",
      actorId: user.id,
      actorEmail: user.email,
      ...iz(rc),
      context: { kilitliyken: true },
    });
    throw gecersizKimlikHatasi();
  }

  // Parola doğru ama hesap kilitli → gerçek durumu bildir
  await writeAuthAudit({
    action: "login_rate_limited",
    actorId: user.id,
    actorEmail: user.email,
    ...iz(rc),
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
  const rc = buildRequestContext(headers);
  const user = userId ? { id: userId, email } : await kullaniciBul(email);

  await denemeKaydet({
    userId: user?.id ?? null,
    email,
    ip: rc.ipAddress,
    attemptType: "password",
    succeeded: basarili,
    requestId: rc.requestId,
    upstreamRequestId: rc.upstreamRequestId,
    testRunId: rc.testRunId,
  });

  if (basarili && user) {
    const sifirlandi = await parolaSayaciSifirla(user.id);
    await writeAuthAudit({
      action: "login",
      actorId: user.id,
      actorEmail: user.email ?? email,
      ...iz(rc),
    });
    if (sifirlandi) {
      // Kilit/sayaç temizlendi — denetim izinde görünmeli
      await writeAuthAudit({
        action: "security_counter_reset",
        actorId: user.id,
        actorEmail: user.email ?? email,
        ...iz(rc),
        context: { sayac: "giris" },
      });
    }
    return;
  }

  await writeAuthAudit({
    action: "login_failed",
    actorId: user?.id ?? null,
    actorEmail: email || null,
    ...iz(rc),
  });

  if (!user) return; // Bilinmeyen hesapta kilitlenecek bir şey yok

  const sonuc = await parolaBasarisiz(user.id);
  if (sonuc.yeniKilit) {
    await writeAuthAudit({
      action: "account_temporarily_locked",
      actorId: user.id,
      actorEmail: user.email ?? email,
      ...iz(rc),
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

  const rc = buildRequestContext(headers);
  await writeAuthAudit({
    action: "login_rate_limited",
    actorId: userId,
    ...iz(rc),
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
  const rc = buildRequestContext(headers);
  await denemeKaydet({
    userId,
    email,
    ip: rc.ipAddress,
    attemptType: tur,
    succeeded: basarili,
    requestId: rc.requestId,
    upstreamRequestId: rc.upstreamRequestId,
    testRunId: rc.testRunId,
  });
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
      ...iz(rc),
      context: { sayac: "ikinci_adim", kilitSaniye: sonuc.kalanSaniye },
    });
  }
}
