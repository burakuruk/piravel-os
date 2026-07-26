import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { newId } from "@/lib/ids";

/**
 * Hesap bazlı geçici kilit — IP rate limit'inden BAĞIMSIZ ikinci katman.
 *
 * Kurallar (PRD §6.3 / Sprint 1 kararı):
 *   · 15 dk içinde 5 başarısız PAROLA → 15 dk kilit
 *   · Aynı hesap aynı gün ikinci kez eşiğe ulaşırsa → 1 saat kilit
 *   · Başarılı giriş → parola sayacı sıfırlanır
 *   · Başarılı parola sıfırlama → parola kilidi ve sayacı sıfırlanır
 *   · TOTP/kurtarma kodu sayacı AYRI: 5 başarısız → 15 dk
 *   · Kalıcı otomatik kilit YOKTUR; kalıcı devre dışı bırakma yalnız SA işi
 *
 * ⚠ Sayaçlar tek bir atomik SQL ifadesiyle güncellenir. İki paralel istek
 * "oku → hesapla → yaz" yaparsa bir artış kaybolur ve limit delinir.
 */

export const KURALLAR = {
  parola: { esik: 5, pencereDk: 15, kilitDk: 15, tekrarKilitDk: 60 },
  totp: { esik: 5, pencereDk: 15, kilitDk: 15 },
} as const;

export type DenemeTuru = "password" | "totp" | "recovery_code";

/** Tek yönlü hash — pepper sunucu sırrından gelir, geri döndürülemez. */
function hashla(deger: string): string {
  const pepper = process.env.BETTER_AUTH_SECRET ?? "gelistirme-pepper";
  return createHash("sha256").update(`${pepper}:${deger}`).digest("hex");
}

export function kimlikHash(email: string): string {
  return hashla(email.trim().toLowerCase());
}

export function ipHash(ip: string | null | undefined): string | null {
  if (!ip) return null;
  // x-forwarded-for birden fazla adres içerebilir; ilki istemcidir
  return hashla(ip.split(",")[0].trim());
}

export interface KilitDurumu {
  kilitli: boolean;
  /** Kilidin bitişine kalan saniye — Retry-After başlığı için */
  kalanSaniye: number;
}

const ACIK: KilitDurumu = { kilitli: false, kalanSaniye: 0 };

/**
 * Ham SQL sonuçlarında timestamptz sürücüye göre Date veya string gelebilir;
 * her iki biçimi de kabul et.
 */
function kalan(until: Date | string | null | undefined): KilitDurumu {
  if (!until) return ACIK;
  const zaman = until instanceof Date ? until : new Date(until);
  const ms = zaman.getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return ACIK;
  return { kilitli: true, kalanSaniye: Math.ceil(ms / 1000) };
}

/** Kullanıcının parola kilidi durumu. Kayıt yoksa açık. */
export async function parolaKilidi(userId: string): Promise<KilitDurumu> {
  const { rows } = await db.execute(sql`
    SELECT password_locked_until FROM auth_security_state WHERE user_id = ${userId}
  `);
  const until = rows[0]?.password_locked_until as Date | string | null | undefined;
  return kalan(until ?? null);
}

export async function totpKilidi(userId: string): Promise<KilitDurumu> {
  const { rows } = await db.execute(sql`
    SELECT totp_locked_until FROM auth_security_state WHERE user_id = ${userId}
  `);
  const until = rows[0]?.totp_locked_until as Date | string | null | undefined;
  return kalan(until ?? null);
}

export interface BasarisizSonuc {
  yeniKilit: boolean;
  kalanSaniye: number;
  sayac: number;
}

/**
 * Başarısız parola denemesini ATOMİK olarak işler.
 *
 * Tek INSERT ... ON CONFLICT DO UPDATE ile:
 *   · pencere dolmuşsa sayaç 1'e sıfırlanır, dolmamışsa +1
 *   · eşiğe ulaşıldıysa kilit uygulanır (aynı gün ikinci kez ise daha uzun)
 * Böylece eşzamanlı iki istek sayacı kaybetmez (SERIALIZABLE gerekmeden).
 */
export async function parolaBasarisiz(userId: string): Promise<BasarisizSonuc> {
  const { esik, pencereDk, kilitDk, tekrarKilitDk } = KURALLAR.parola;

  const { rows } = await db.execute(sql`
    INSERT INTO auth_security_state (
      user_id, password_failed_count, password_window_started_at, updated_at
    )
    VALUES (${userId}, 1, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      -- Pencere dolduysa yeniden başlat, dolmadıysa artır
      password_failed_count = CASE
        WHEN auth_security_state.password_window_started_at IS NULL
          OR auth_security_state.password_window_started_at
             < now() - (${pencereDk} || ' minutes')::interval
        THEN 1
        ELSE auth_security_state.password_failed_count + 1
      END,
      password_window_started_at = CASE
        WHEN auth_security_state.password_window_started_at IS NULL
          OR auth_security_state.password_window_started_at
             < now() - (${pencereDk} || ' minutes')::interval
        THEN now()
        ELSE auth_security_state.password_window_started_at
      END,
      -- Eşiğe ulaşıldıysa kilitle: aynı gün ikinci kilit daha uzun sürer
      password_locked_until = CASE
        WHEN (CASE
                WHEN auth_security_state.password_window_started_at IS NULL
                  OR auth_security_state.password_window_started_at
                     < now() - (${pencereDk} || ' minutes')::interval
                THEN 1
                ELSE auth_security_state.password_failed_count + 1
              END) >= ${esik}
        THEN now() + (CASE
               WHEN auth_security_state.password_lock_day = CURRENT_DATE
                 AND auth_security_state.password_lock_count_today >= 1
               THEN ${tekrarKilitDk} || ' minutes'
               ELSE ${kilitDk} || ' minutes'
             END)::interval
        ELSE auth_security_state.password_locked_until
      END,
      password_lock_count_today = CASE
        WHEN (CASE
                WHEN auth_security_state.password_window_started_at IS NULL
                  OR auth_security_state.password_window_started_at
                     < now() - (${pencereDk} || ' minutes')::interval
                THEN 1
                ELSE auth_security_state.password_failed_count + 1
              END) >= ${esik}
        THEN CASE
               WHEN auth_security_state.password_lock_day = CURRENT_DATE
               THEN auth_security_state.password_lock_count_today + 1
               ELSE 1
             END
        ELSE auth_security_state.password_lock_count_today
      END,
      password_lock_day = CASE
        WHEN (CASE
                WHEN auth_security_state.password_window_started_at IS NULL
                  OR auth_security_state.password_window_started_at
                     < now() - (${pencereDk} || ' minutes')::interval
                THEN 1
                ELSE auth_security_state.password_failed_count + 1
              END) >= ${esik}
        THEN CURRENT_DATE
        ELSE auth_security_state.password_lock_day
      END,
      updated_at = now()
    RETURNING password_failed_count, password_locked_until
  `);

  const satir = rows[0] as
    | { password_failed_count: number; password_locked_until: Date | string | null }
    | undefined;
  const durum = kalan(satir?.password_locked_until ?? null);
  return {
    yeniKilit: durum.kilitli && (satir?.password_failed_count ?? 0) >= esik,
    kalanSaniye: durum.kalanSaniye,
    sayac: satir?.password_failed_count ?? 1,
  };
}

/** Başarısız TOTP/kurtarma kodu denemesi — parola sayacından bağımsız. */
export async function totpBasarisiz(userId: string): Promise<BasarisizSonuc> {
  const { esik, pencereDk, kilitDk } = KURALLAR.totp;

  const { rows } = await db.execute(sql`
    INSERT INTO auth_security_state (
      user_id, totp_failed_count, totp_window_started_at, updated_at
    )
    VALUES (${userId}, 1, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      totp_failed_count = CASE
        WHEN auth_security_state.totp_window_started_at IS NULL
          OR auth_security_state.totp_window_started_at
             < now() - (${pencereDk} || ' minutes')::interval
        THEN 1
        ELSE auth_security_state.totp_failed_count + 1
      END,
      totp_window_started_at = CASE
        WHEN auth_security_state.totp_window_started_at IS NULL
          OR auth_security_state.totp_window_started_at
             < now() - (${pencereDk} || ' minutes')::interval
        THEN now()
        ELSE auth_security_state.totp_window_started_at
      END,
      totp_locked_until = CASE
        WHEN (CASE
                WHEN auth_security_state.totp_window_started_at IS NULL
                  OR auth_security_state.totp_window_started_at
                     < now() - (${pencereDk} || ' minutes')::interval
                THEN 1
                ELSE auth_security_state.totp_failed_count + 1
              END) >= ${esik}
        THEN now() + (${kilitDk} || ' minutes')::interval
        ELSE auth_security_state.totp_locked_until
      END,
      updated_at = now()
    RETURNING totp_failed_count, totp_locked_until
  `);

  const satir = rows[0] as
    | { totp_failed_count: number; totp_locked_until: Date | string | null }
    | undefined;
  const durum = kalan(satir?.totp_locked_until ?? null);
  return {
    yeniKilit: durum.kilitli && (satir?.totp_failed_count ?? 0) >= esik,
    kalanSaniye: durum.kalanSaniye,
    sayac: satir?.totp_failed_count ?? 1,
  };
}

/** Başarılı giriş: parola sayacı ve kilidi sıfırlanır. */
export async function parolaSayaciSifirla(userId: string): Promise<boolean> {
  /**
   * RETURNING, UPDATE sonrası YENİ satırı verir — sıfırlanmış değerleri.
   * "Gerçekten sıfırlanacak bir şey var mıydı?" sorusunu cevaplamak için
   * önceki durum bir CTE ile okunur; CTE, UPDATE'ten önceki anlık görüntüyü
   * görür (Postgres tek ifade içinde tutarlı snapshot kullanır).
   */
  const { rows } = await db.execute(sql`
    WITH onceki AS (
      SELECT password_failed_count AS sayac, password_locked_until AS kilit
      FROM auth_security_state WHERE user_id = ${userId}
    ), guncelleme AS (
      INSERT INTO auth_security_state (user_id, last_successful_login_at, updated_at)
      VALUES (${userId}, now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        password_failed_count = 0,
        password_window_started_at = NULL,
        password_locked_until = NULL,
        last_successful_login_at = now(),
        updated_at = now()
      RETURNING 1
    )
    SELECT COALESCE(
      (SELECT sayac > 0 OR kilit IS NOT NULL FROM onceki), false
    ) AS sifirlandi
    FROM guncelleme
  `);
  return Boolean((rows[0] as { sifirlandi?: boolean } | undefined)?.sifirlandi);
}

/** Başarılı TOTP doğrulaması: TOTP sayacı sıfırlanır. */
export async function totpSayaciSifirla(userId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO auth_security_state (user_id, updated_at)
    VALUES (${userId}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      totp_failed_count = 0,
      totp_window_started_at = NULL,
      totp_locked_until = NULL,
      updated_at = now()
  `);
}

/**
 * Başarılı parola sıfırlama: parola kilidi ve sayacı temizlenir.
 * Kullanıcı parolasını gerçekten değiştirebildiyse hesabın sahibidir;
 * kilidin sürmesi yalnız meşru kullanıcıyı cezalandırır.
 */
export async function parolaSifirlamaSonrasiTemizle(userId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO auth_security_state (user_id, updated_at)
    VALUES (${userId}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      password_failed_count = 0,
      password_window_started_at = NULL,
      password_locked_until = NULL,
      updated_at = now()
  `);
}

/** Deneme günlüğü — kullanıcı bilinmese de yazılır. */
export async function denemeKaydet(input: {
  userId: string | null;
  email: string;
  ip: string | null;
  attemptType: DenemeTuru;
  succeeded: boolean;
  requestId?: string | null;
}): Promise<void> {
  try {
    // ID uygulamada üretilir (UUID v7 standardı, şema Karar 6)
    await db.execute(sql`
      INSERT INTO auth_login_attempts
        (id, user_id, identifier_hash, ip_hash, attempt_type, succeeded, request_id)
      VALUES (
        ${newId()}, ${input.userId}, ${kimlikHash(input.email)}, ${ipHash(input.ip)},
        ${input.attemptType}, ${input.succeeded}, ${input.requestId ?? null}
      )
    `);
  } catch (err) {
    // Günlük yazımı giriş akışını bloke etmez ama sessizce de kaybolmaz
    console.error("Deneme günlüğü yazılamadı:", err instanceof Error ? err.message : err);
  }
}
