-- ══════════════════════════════════════════════════════════════════
-- 1) Aktivasyon anı
--
-- activated_at, "davet bekleyen" ile "yönetici pasifleştirdi" durumlarını
-- birbirinden ayırır — is_active tek başına ikisini de false gösterir:
--   NULL        + is_active=false → hiç aktifleşmemiş, daveti bekliyor
--   dolu        + is_active=false → aktifti, yönetici pasifleştirdi
--   dolu        + is_active=true  → normal aktif kullanıcı
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE "users" ADD COLUMN "activated_at" timestamptz;--> statement-breakpoint

-- Mevcut kullanıcılar davet akışından ÖNCE oluşturuldu ve parolaları var;
-- geriye dönük doldurulmazsa hepsi "davet bekliyor" görünür ve giriş
-- yapabildikleri hâlde listede bekleyen olarak listelenirlerdi.
UPDATE "users"
   SET "activated_at" = COALESCE("last_login_at", "created_at")
 WHERE "activated_at" IS NULL;--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════
-- 2) Davetler
--
-- ⚠ HAM TOKEN BURAYA YAZILMAZ. Yalnız HMAC-SHA256(token, INVITE_TOKEN_PEPPER)
-- saklanır: veritabanı sızsa bile davet bağlantıları üretilemez. Pepper
-- oturum sırrından AYRIDIR (INVITE_TOKEN_PEPPER); biri sızarsa diğeri düşmez.
--
-- Çerez eşlemesi de aynı ilkeye tabidir: çerezdeki rastgele davet oturum
-- kimliği ham hâliyle değil, HMAC'i ile tutulur.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE "user_invitations" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"             text NOT NULL,
  "token_hash"          text NOT NULL,
  "expires_at"          timestamptz NOT NULL,
  "accepted_at"         timestamptz,
  "revoked_at"          timestamptz,
  "revoked_by_id"       uuid,
  -- Kabul ekranının çerezi: ham token URL'den düşürüldükten sonra formu bu
  -- kimlik taşır. Ömrü davetin kendisinden çok daha kısadır (10 dk).
  "cookie_hash"         text,
  "cookie_expires_at"   timestamptz,
  "created_by_id"       uuid,
  "created_request_id"  text,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Kullanıcı silinirse daveti de silinir: davet kullanıcıdan uzun yaşayamaz.
ALTER TABLE "user_invitations"
  ADD CONSTRAINT "fk_invitation_user"
  FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Aynı ham token iki kayda denk gelemez.
CREATE UNIQUE INDEX "uq_invitation_token_hash"
  ON "user_invitations" ("token_hash");--> statement-breakpoint

-- Çerez kimliği de tekildir; iki davet aynı çereze eşlenemez.
CREATE UNIQUE INDEX "uq_invitation_cookie_hash"
  ON "user_invitations" ("cookie_hash")
  WHERE "cookie_hash" IS NOT NULL;--> statement-breakpoint

-- ⚠ Bu index TEK BAŞINA "tek aktif davet" kuralını uygulamaz: süresi dolmuş
-- bir davet de burada "aktif" sayılır, çünkü now() bir partial index
-- predicate'inde kullanılamaz (immutable olmayan ifade). Asıl çözüm uygulama
-- mantığındadır — yeni davet üreten transaction, kullanıcının kabul
-- edilmemiş ve iptal edilmemiş TÜM davetlerini (süresi dolmuş olanlar dahil)
-- önce revoke eder. Bu index yalnız eşzamanlı iki isteğe karşı son perdedir.
CREATE UNIQUE INDEX "uq_invitation_one_open_per_user"
  ON "user_invitations" ("user_id")
  WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;--> statement-breakpoint

CREATE INDEX "idx_invitation_user" ON "user_invitations" ("user_id");--> statement-breakpoint

-- Bir davet hem kabul edilmiş hem iptal edilmiş olamaz. Kabul akışı zaten
-- revoked_at dolu kayıtları reddeder; bu kısıt o mantık bozulursa veriyi korur.
ALTER TABLE "user_invitations"
  ADD CONSTRAINT "chk_invitation_not_both_states"
  CHECK (NOT ("accepted_at" IS NOT NULL AND "revoked_at" IS NOT NULL));--> statement-breakpoint

ALTER TABLE "user_invitations"
  ADD CONSTRAINT "chk_invitation_window"
  CHECK ("expires_at" > "created_at");--> statement-breakpoint

-- Çerez kimliği ve son kullanma tarihi birlikte anlam taşır; biri olmadan
-- diğeri süresi belirsiz ya da sahipsiz bir eşleme bırakırdı.
ALTER TABLE "user_invitations"
  ADD CONSTRAINT "chk_invitation_cookie_pair"
  CHECK (("cookie_hash" IS NULL) = ("cookie_expires_at" IS NULL));
