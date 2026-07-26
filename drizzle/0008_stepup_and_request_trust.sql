-- ══════════════════════════════════════════════════════════════════
-- 1) İstek kimliği güveni
--
-- request_id artık SUNUCU tarafından üretilen kanonik değerdir. İstemcinin
-- gönderdiği x-request-id yalnız korelasyon için ayrı bir sütunda tutulur;
-- güvenilir kabul edilmez. Test izolasyonu ayrı bir sütundadır ve üretimde
-- daima NULL kalır.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE "audit_logs" ADD COLUMN "upstream_request_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "test_run_id" text;--> statement-breakpoint
ALTER TABLE "auth_login_attempts" ADD COLUMN "upstream_request_id" text;--> statement-breakpoint
ALTER TABLE "auth_login_attempts" ADD COLUMN "test_run_id" text;--> statement-breakpoint

-- Test sorguları bu sütunlar üzerinden koşar
CREATE INDEX "idx_audit_test_run" ON "audit_logs" ("test_run_id")
  WHERE "test_run_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_attempts_test_run" ON "auth_login_attempts" ("test_run_id")
  WHERE "test_run_id" IS NOT NULL;--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
-- 2) Step-up (adım yükseltme) kimlik doğrulaması
--
-- Kritik işlemler, kullanıcının O AN parolasını (2FA açıksa TOTP'sini de)
-- yeniden girdiğini kanıtlayan taze bir kayıt ister. Better Auth'un
-- freshAge'i temel koruma olarak kalır; bu kayıt onun üstüne biner.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE "auth_reauthentication" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id"         text NOT NULL,
  "user_id"            text NOT NULL,
  "verified_at"        timestamptz NOT NULL DEFAULT now(),
  "expires_at"         timestamptz NOT NULL,
  "method"             text NOT NULL,
  "created_request_id" text
);--> statement-breakpoint

-- Oturum silinince yükseltme de silinir: yükseltme oturuma bağlıdır,
-- oturumdan uzun yaşayamaz.
ALTER TABLE "auth_reauthentication"
  ADD CONSTRAINT "fk_reauth_session"
  FOREIGN KEY ("session_id") REFERENCES "auth_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_reauthentication"
  ADD CONSTRAINT "fk_reauth_user"
  FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "auth_reauthentication"
  ADD CONSTRAINT "chk_reauth_method"
  CHECK ("method" IN ('password', 'password_totp'));--> statement-breakpoint
ALTER TABLE "auth_reauthentication"
  ADD CONSTRAINT "chk_reauth_window"
  CHECK ("expires_at" > "verified_at");--> statement-breakpoint

CREATE INDEX "idx_reauth_session" ON "auth_reauthentication" ("session_id", "expires_at");--> statement-breakpoint
CREATE INDEX "idx_reauth_user" ON "auth_reauthentication" ("user_id");
