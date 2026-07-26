/**
 * Better Auth tabloları (v1.6) — Drizzle şeması.
 *
 * Kimlik doğrulama kayıtları Better Auth'a aittir; bizim iş tablomuz `users`
 * (core.ts) rol ve marka kapsamını taşır. İkisi 1:1 eşlenir: bu dosyadaki
 * `authUsers.id` = `users.id` (aynı UUID).
 *
 * Neden ayrı tablo? Better Auth kendi şemasını yönetir ve sürüm yükseltmelerinde
 * kolon ekleyebilir. İş alanlarımızı (role, brand_id, audit sütunları) onun
 * tablosuna karıştırmak, her yükseltmede çakışma riski yaratırdı.
 *
 * ⚠ GÜVENLİK (PRD §6.3): twoFactor.secret ve backupCodes hassastır —
 * loglara, Sentry'ye, analytics'e veya audit_logs'a ASLA yazılmaz.
 */
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const authUsers = pgTable(
  "auth_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** Better Auth twoFactor eklentisi: kullanıcıda 2FA etkin mi */
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_auth_user_email").on(t.email)],
);

export const authSessions = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_auth_session_token").on(t.token),
    index("idx_auth_session_user").on(t.userId),
  ],
);

export const authAccounts = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** Argon2id/scrypt hash — düz metin parola ASLA saklanmaz */
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_auth_account_user").on(t.userId)],
);

export const authVerifications = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_auth_verification_identifier").on(t.identifier)],
);

/**
 * twoFactor eklentisi tablosu.
 * `secret`  : şifreli TOTP anahtarı
 * `backupCodes`: Better Auth tarafından şifrelenmiş kurtarma kodları
 * Her ikisi de PRD §6.3 kapsamında en yüksek hassasiyettedir.
 */
export const authTwoFactors = pgTable(
  "auth_two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    /** TOTP kurulumu doğrulandı mı — kod girilene kadar 2FA etkin sayılmaz */
    verified: boolean("verified").default(true),
    /** Ardışık başarısız doğrulama sayacı — kaba kuvvet koruması */
    failedVerificationCount: integer("failed_verification_count").default(0),
  },
  (t) => [index("idx_auth_two_factor_user").on(t.userId)],
);
