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
  /** Aynı gün kaçıncı kilit — ikincisi daha uzun sürer */
  passwordLockCountToday: integer("password_lock_count_today").notNull().default(0),
  passwordLockDay: date("password_lock_day"),

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
    requestId: text("request_id"),
  },
  (t) => [
    index("idx_attempts_identifier").on(t.identifierHash, t.attemptedAt),
    index("idx_attempts_user").on(t.userId, t.attemptedAt),
    index("idx_attempts_recent").on(t.attemptedAt).where(sql`${t.succeeded} = false`),
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
