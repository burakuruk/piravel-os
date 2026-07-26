/**
 * Kimlik doğrulama güvenlik durumu — hesap bazlı geçici kilit ve deneme izi.
 *
 * IP bazlı rate limit (Better Auth) ile hesap bazlı kilit BİRBİRİNDEN
 * BAĞIMSIZ çalışır: biri IP'yi, diğeri hesabı korur. Tek başına hiçbiri
 * yeterli değildir — IP limiti dağıtık denemeyi, hesap kilidi tek IP'den
 * yapılan hedefli denemeyi durdurur.
 *
 * ⚠ PRD §6.3: Bu tablolarda ham parola, TOTP kodu, kurtarma kodu, tam IP
 * adresi veya oturum token'ı BULUNMAZ. Kimlik ve IP yalnız hash olarak.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { idCol } from "./helpers";

export const authSecurityState = pgTable("auth_security_state", {
  /** auth_user.id (= users.id) — 1:1 */
  userId: text("user_id").primaryKey(),

  // ── Parola denemeleri ──
  passwordFailedCount: integer("password_failed_count").notNull().default(0),
  passwordWindowStartedAt: timestamp("password_window_started_at", { withTimezone: true }),
  passwordLockedUntil: timestamp("password_locked_until", { withTimezone: true }),

  /**
   * Kilit yükseltmesi — "aynı gün ikinci eşik daha uzun kilitler" kuralının
   * veri modeli. İkisi birlikte anlam taşır:
   *   · passwordLockCountDate : sayacın ait olduğu takvim günü
   *   · passwordLockCountToday: o gün uygulanan kilit sayısı
   *
   * Gün değiştiğinde sayaç 1'e döner, yani seviye kendiliğinden sıfırlanır;
   * ayrı bir temizlik işine gerek yoktur.
   *   1. kilit → 15 dk · aynı gün 2. kilit → 60 dk · ertesi gün → yine 15 dk
   */
  passwordLockCountToday: integer("password_lock_count_today").notNull().default(0),
  passwordLockCountDate: date("password_lock_count_date"),

  // ── TOTP / kurtarma kodu denemeleri (parola sayacından AYRI) ──
  totpFailedCount: integer("totp_failed_count").notNull().default(0),
  totpWindowStartedAt: timestamp("totp_window_started_at", { withTimezone: true }),
  totpLockedUntil: timestamp("totp_locked_until", { withTimezone: true }),

  lastSuccessfulLoginAt: timestamp("last_successful_login_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Deneme günlüğü — kullanıcı bulunamasa bile kaydedilir (enumeration analizi
 * ve saldırı tespiti için). Kimlik ve IP tek yönlü hash'lidir.
 */
export const authLoginAttempts = pgTable(
  "auth_login_attempts",
  {
    id: idCol(),
    /** Kullanıcı bilinmiyorsa NULL — bilinmeyen hesap denemesi de izlenir */
    userId: uuid("user_id"),
    /** sha256(pepper + normalize(email)) — geri döndürülemez */
    identifierHash: text("identifier_hash").notNull(),
    /** sha256(pepper + ip) — tam IP saklanmaz */
    ipHash: text("ip_hash"),
    /** 'password' | 'totp' | 'recovery_code' */
    attemptType: text("attempt_type").notNull(),
    succeeded: boolean("succeeded").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    /** Sunucu tarafından üretilen kanonik kimlik (istemci seçemez) */
    requestId: text("request_id"),
    /** İstemcinin gönderdiği x-request-id — yalnız korelasyon, güvenilmez */
    upstreamRequestId: text("upstream_request_id"),
    /** Test izolasyonu; üretimde daima NULL */
    testRunId: text("test_run_id"),
  },
  (t) => [
    index("idx_attempts_identifier").on(t.identifierHash, t.attemptedAt),
    index("idx_attempts_user").on(t.userId, t.attemptedAt),
    index("idx_attempts_recent").on(t.attemptedAt).where(sql`${t.succeeded} = false`),
  ],
);

/**
 * Adım yükseltme (step-up) kimlik doğrulaması — kritik işlemler için.
 *
 * ⚠ Neden Better Auth'un `freshAge`'i tek başına yetmez:
 * freshAge yalnız "oturum ne zaman oluşturuldu/yenilendi" sorusuna bakar.
 * Kullanıcı 4 dakika önce giriş yaptıysa oturum "taze" sayılır ve kritik
 * işlem AÇIK BİR DOĞRULAMA OLMADAN geçer. Oysa bilgisayarını açık bırakmış
 * bir kullanıcının başında duran biri de o tazelikten yararlanır.
 *
 * Bu tablo, kullanıcının o an parolasını (ve 2FA açıksa TOTP'sini) gerçekten
 * yeniden girdiğini kanıtlar. freshAge temel koruma olarak kalır; bu kayıt
 * onun yerine değil, üstüne biner.
 *
 * Geçersizleşme yolları:
 *   · 5 dakikada süre dolar
 *   · Oturum silinince (FK CASCADE)
 *   · Kullanıcı devre dışı bırakılınca (uygulama katmanı siler)
 *   · Parola veya 2FA sıfırlanınca (uygulama katmanı siler)
 */
export const authReauthentication = pgTable(
  "auth_reauthentication",
  {
    id: idCol(),
    /** Yükseltme BU oturuma bağlıdır; başka oturuma taşınamaz */
    sessionId: text("session_id").notNull(),
    userId: text("user_id").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 'password' | 'password_totp' — 2FA açıksa ikincisi zorunludur */
    method: text("method").notNull(),
    createdRequestId: text("created_request_id"),
  },
  (t) => [
    index("idx_reauth_session").on(t.sessionId, t.expiresAt),
    index("idx_reauth_user").on(t.userId),
  ],
);

/**
 * Better Auth'un IP bazlı rate limit deposu.
 * Bellek yerine DB kullanılır: çok instance'lı üretimde sayaç ortak ve
 * atomik olmalıdır; bellek deposu her instance'ta ayrı sayar ve limiti
 * fiilen instance sayısı kadar çarpar.
 */
export const authRateLimit = pgTable(
  "auth_rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key"),
    count: integer("count"),
    /** Epoch milisaniye — Better Auth burada sayı tutar, timestamp değil */
    lastRequest: bigint("last_request", { mode: "number" }),
  },
  (t) => [index("idx_rate_limit_key").on(t.key)],
);
