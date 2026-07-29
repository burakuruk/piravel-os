-- ══════════════════════════════════════════════════════════════════════════
-- Sprint 2 — Marka modülü
--
-- Şema v1.2'de `brands`, `brand_contacts` ve `services` ZATEN VAR (0000).
-- Bu migration onlara dokunmaz, yalnız eksik olanı ekler:
--   1) kod normalizasyonu + case-insensitive benzersizlik + marka kodu kilidi
--   2) marka arama indeksi
--   3) brand_services  — markanın aldığı hizmetler
--   4) brand_assignments — OPS kapsamının TEK kaynağı
--
-- ⚠ Mevcut migration'lar DEĞİŞTİRİLMEZ; geçmiş dosyalar dokunulmaz kabul
-- edilir. Buradaki DROP INDEX'ler 0000'ın ürettiği indeksleri değiştirmez,
-- yerlerine daha güçlüsünü koyar.
-- ══════════════════════════════════════════════════════════════════════════

-- ══ 1) Kod normalizasyonu ══
--
-- Kod trim'lenmiş ve BÜYÜK HARF saklanır; benzersizlik büyük/küçük harf
-- duyarsızdır. "svz", "SVZ " ve "Svz" aynı markadır — üçü de kayıt olabilseydi
-- sözleşme ve fatura numaraları hangi koda dayandığı belirsiz hâle gelirdi.
--
-- Normalizasyon hem uygulamada (tek giriş noktası) hem burada zorlanır:
-- elle atılan bir INSERT de kuralın dışına çıkamaz.
UPDATE "brands"   SET "code" = upper(btrim("code")) WHERE "code" <> upper(btrim("code"));--> statement-breakpoint
UPDATE "services" SET "code" = upper(btrim("code")) WHERE "code" <> upper(btrim("code"));--> statement-breakpoint

ALTER TABLE "brands" ADD CONSTRAINT "chk_brands_code_normalized"
  CHECK ("code" = upper(btrim("code")) AND length("code") BETWEEN 2 AND 16);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "chk_services_code_normalized"
  CHECK ("code" = upper(btrim("code")) AND length("code") BETWEEN 2 AND 16);--> statement-breakpoint

-- Benzersizlik upper(code) üzerinde: CHECK bir gün gevşetilse bile iki kayıt
-- yalnız harf büyüklüğüyle ayrışamaz.
DROP INDEX IF EXISTS "uq_brands_code";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_brands_code" ON "brands" (upper("code"))
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "uq_services_code";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_services_code" ON "services" (upper("code"))
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- ══ 2) Marka kodu OLUŞTURULDUKTAN SONRA DEĞİŞTİRİLEMEZ ══
--
-- Sözleşme ve fatura numaraları koda dayanacak; kod değişirse geçmiş belgeler
-- var olmayan bir markayı işaret eder. Kural uygulamada da var, ama tek
-- savunma orada olsaydı bir script veya elle UPDATE onu delip geçerdi.
--
-- Hizmet kodu bilerek DEĞİŞTİRİLEBİLİR: katalog kodu bir belge numarasının
-- parçası değildir.
CREATE OR REPLACE FUNCTION prevent_brand_code_change() RETURNS trigger AS $$
BEGIN
  IF NEW."code" IS DISTINCT FROM OLD."code" THEN
    RAISE EXCEPTION 'Marka kodu değiştirilemez (% → %)', OLD."code", NEW."code"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_brands_code_immutable"
  BEFORE UPDATE OF "code" ON "brands"
  FOR EACH ROW EXECUTE FUNCTION prevent_brand_code_change();--> statement-breakpoint

-- ══ 3) Marka arama indeksi ══
--
-- Arama tek kutuda ad VEYA kod üzerinde çalışır ve baştan değil İÇERİDEN
-- eşleşir ("klinik" → "Test Klinik"). B-tree bir `ILIKE '%…%'` sorgusunu
-- kullanamaz; trigram indeksi kullanabilir.
--
-- pg_trgm standart contrib eklentisidir (postgres:16 imajında ve yaygın
-- yönetilen servislerde mevcut). Migration owner ile koşar; uygulama rolünün
-- eklenti kurma yetkisi yoktur ve gerekmez.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "idx_brands_name_trgm" ON "brands" USING gin (lower("name") gin_trgm_ops)
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_brands_code_trgm" ON "brands" USING gin (lower("code") gin_trgm_ops)
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- ══ 4) brand_services — markanın aldığı hizmetler ══
--
-- BAĞIMSIZ UUID id: bileşik anahtar (brand_id, service_id) kullanılsaydı aynı
-- çift soft delete sonrası yeniden eklendiğinde eski satırla çakışırdı ve
-- denetim izi hangi kaydı işaret ettiğini söyleyemezdi.
--
-- FK'ler RESTRICT: marka veya hizmet FİZİKSEL silinmeye çalışılırsa işlem
-- reddedilir. CASCADE, geçmişi sessizce yok ederdi — bu tablo "bu marka şu
-- hizmeti alıyordu" bilgisinin tek kaydı.
CREATE TABLE "brand_services" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_id"      uuid NOT NULL,
  "service_id"    uuid NOT NULL,
  "notes"         text,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "created_by_id" uuid,
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_by_id" uuid,
  "deleted_at"    timestamptz,
  "deleted_by_id" uuid
);--> statement-breakpoint

ALTER TABLE "brand_services" ADD CONSTRAINT "fk_brand_services_brand"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "brand_services" ADD CONSTRAINT "fk_brand_services_service"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint

-- Benzersizlik YALNIZ canlı kayıtlar için: bir hizmet markadan çıkarılıp
-- (soft delete) sonra yeniden eklenebilmeli. Koşulsuz bir unique index bunu
-- imkânsız kılar ve kullanıcı "zaten ekli" hatası alırdı.
CREATE UNIQUE INDEX "uq_brand_service_live"
  ON "brand_services" ("brand_id", "service_id")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_brand_services_brand" ON "brand_services" ("brand_id")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
-- "Bu hizmeti kaç marka kullanıyor" sorgusu — pasifleştirmeden önceki etki
CREATE INDEX "idx_brand_services_service" ON "brand_services" ("service_id")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- ══ 5) brand_assignments — OPS kapsamının TEK kaynağı ══
--
-- Atama bir YETKİ SINIRIDIR: kaldırıldığı anda OPS kullanıcısı markayı ve ona
-- bağlı kayıtları göremez. Bu yüzden kayıt soft delete ile tarihçesini korur —
-- "bu kullanıcı o tarihte bu markayı görebiliyor muydu" sorusu denetimde
-- cevaplanabilir olmalı.
--
-- ⚠ 0000'daki `brand_users` ile karıştırılmamalı: o tablo v3 müşteri paneli
-- kancasıdır (marka tarafındaki kullanıcı), soft delete'i ve denetim
-- sütunları yoktur. İç ekip ataması bu tablodur.
CREATE TABLE "brand_assignments" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand_id"      uuid NOT NULL,
  "user_id"       uuid NOT NULL,
  "assigned_at"   timestamptz NOT NULL DEFAULT now(),
  "notes"         text,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "created_by_id" uuid,
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_by_id" uuid,
  "deleted_at"    timestamptz,
  "deleted_by_id" uuid
);--> statement-breakpoint

ALTER TABLE "brand_assignments" ADD CONSTRAINT "fk_brand_assignments_brand"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "brand_assignments" ADD CONSTRAINT "fk_brand_assignments_user"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint

CREATE UNIQUE INDEX "uq_brand_assignment_live"
  ON "brand_assignments" ("brand_id", "user_id")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
-- OPS kapsam sorgusunun sıcak yolu: "bu kullanıcı hangi markalara atanmış"
CREATE INDEX "idx_brand_assignments_user" ON "brand_assignments" ("user_id")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_brand_assignments_brand" ON "brand_assignments" ("brand_id")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- ══ 6) updated_at trigger'ı (0001'deki kalıp) ══
CREATE TRIGGER "trg_touch_brand_services"
  BEFORE UPDATE ON "brand_services"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
CREATE TRIGGER "trg_touch_brand_assignments"
  BEFORE UPDATE ON "brand_assignments"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
