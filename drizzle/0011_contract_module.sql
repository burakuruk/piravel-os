-- ══════════════════════════════════════════════════════════════════════════
-- Sprint 3 — Sözleşme modülü (plan REVİZE 4)
--
-- Şema v1.2'de `contracts` ve `contract_items` ZATEN VAR (0000). Bu migration
-- onları DEĞİŞTİRMEZ, yalnız eksik olanı ekler:
--   1) yaşam döngüsü alanları + çift yönlü CHECK'ler
--   2) tutar temeli (amount_basis) — DEFAULT YOK
--   3) faturalama sıklığı kolonları
--   4) yenileme: gerçek yenileme ile görüşme tarihi ayrımı
--   5) contract_no üretimi (sayaç tablosu) + değiştirilemezlik trigger'ı
--   6) FK sertleştirme, para birimi tutarlılığı, arama indeksleri
--
-- ⚠ Mevcut migration'lar DEĞİŞTİRİLMEZ; geçmiş dosyalar dokunulmaz kabul
-- edilir. Buradaki DROP'lar 0000'ın ürettiklerini kaldırıp yerlerine daha
-- güçlüsünü koyar.
--
-- ⚠ `contracts` ve `contract_items` bu migration yazılırken BOŞTUR (canlı
-- DB'de doğrulandı). `amount_basis` bu yüzden varsayılansız NOT NULL
-- eklenebiliyor; kalıcı bir DEFAULT, alanı göndermeyen bir çağrıyı sessizce
-- "dönemlik" saymak demek olurdu — tam da kaçınmak istediğimiz belirsizlik.
-- ══════════════════════════════════════════════════════════════════════════

-- ══ 1) Yaşam döngüsü alanları ══
--
-- `activated_at`, `ended_at`, `end_reason` ZATEN VAR. Eksik olan iptal tarafı.
ALTER TABLE "contracts" ADD COLUMN "cancelled_at" timestamptz;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cancel_reason" text;--> statement-breakpoint

-- Her durum için hem DOLU olması gerekenler hem BOŞ olması gerekenler.
-- Tek yönlü kontrol (yalnız "dolu mu") `ended` bir sözleşmede `cancelled_at`'in
-- de dolu kalmasına izin verirdi; o satır artık iki farklı hikâye anlatır.
--
-- Gerekçelerde btrim: yalnız boşluktan oluşan bir gerekçe kabul edilmez.
-- Taslak iptalinde `activated_at` NULL kalır — sözleşme hiç yürürlüğe
-- girmemiştir; `cancelled` CHECK'i bunu bilerek zorunlu tutmaz.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_lifecycle_draft"
  CHECK ("status" <> 'draft' OR (
    "activated_at" IS NULL AND "ended_at" IS NULL AND "end_reason" IS NULL
    AND "cancelled_at" IS NULL AND "cancel_reason" IS NULL));--> statement-breakpoint

ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_lifecycle_active"
  CHECK ("status" <> 'active' OR (
    "activated_at" IS NOT NULL AND "ended_at" IS NULL AND "end_reason" IS NULL
    AND "cancelled_at" IS NULL AND "cancel_reason" IS NULL));--> statement-breakpoint

-- ⚠ `IS NOT NULL` AÇIKÇA YAZILIR. `length(btrim(NULL))` NULL döner,
-- `NULL BETWEEN 3 AND 500` da NULL'dır ve Postgres CHECK kısıtı NULL sonucu
-- BAŞARILI sayar. Yalnız uzunluk kontrolü yazılsaydı gerekçesi NULL olan bir
-- `ended` satırı kısıttan geçerdi — üç değerli mantığın klasik tuzağı.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_lifecycle_ended"
  CHECK ("status" <> 'ended' OR (
    "activated_at" IS NOT NULL AND "ended_at" IS NOT NULL
    AND "end_reason" IS NOT NULL
    AND length(btrim("end_reason")) BETWEEN 3 AND 500
    AND "cancelled_at" IS NULL AND "cancel_reason" IS NULL));--> statement-breakpoint

ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_lifecycle_cancelled"
  CHECK ("status" <> 'cancelled' OR (
    "cancelled_at" IS NOT NULL
    AND "cancel_reason" IS NOT NULL
    AND length(btrim("cancel_reason")) BETWEEN 3 AND 500
    AND "ended_at" IS NULL AND "end_reason" IS NULL));--> statement-breakpoint

-- ══ 2) Tutar temeli ══
--
-- `amount_minor` tek başına belirsizdi: "45.000 ₺ aylık" sözleşmede her ayın
-- tutarı, "60.000 ₺ 3 taksit" sözleşmede toplam. Aynı kolona iki anlam
-- yüklenirse ödeme planı, CSV ve Sprint 4'ün receivable üreticisi aynı satırdan
-- farklı sonuç çıkarır — ve hata sessizdir.
CREATE TYPE "amount_basis" AS ENUM ('per_period', 'contract_total');--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "amount_basis" "amount_basis" NOT NULL;--> statement-breakpoint

-- ══ 3) Faturalama sıklığı ══
--
-- Mevcut şemada karşılığı YOK: `pricing_model` bir FİYATLANDIRMA modelidir
-- (fixed_monthly, installment, hourly…), takvim değil; `payment_day` yalnız
-- ayın gününü söyler; `recurrence_rules` bağı bilerek kaldırılmıştı (Karar 3).
CREATE TYPE "billing_frequency" AS ENUM ('one_time', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint

ALTER TABLE "contracts"
  ADD COLUMN "billing_frequency" "billing_frequency" NOT NULL DEFAULT 'monthly',
  ADD COLUMN "billing_interval"  smallint NOT NULL DEFAULT 1,
  ADD COLUMN "first_due_date"    date,
  ADD COLUMN "installment_count" integer;--> statement-breakpoint

ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_billing_interval"
  CHECK ("billing_interval" BETWEEN 1 AND 12);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_installment_count"
  CHECK ("installment_count" IS NULL OR "installment_count" > 0);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_one_time_installments"
  CHECK ("billing_frequency" <> 'one_time'
         OR "installment_count" IS NULL OR "installment_count" = 1);--> statement-breakpoint
-- Tek seferlik sözleşmede "her 3 dönemde bir" anlamsızdır.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_one_time_interval"
  CHECK ("billing_frequency" <> 'one_time' OR "billing_interval" = 1);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_first_due_date"
  CHECK ("first_due_date" IS NULL OR "first_due_date" >= "start_date");--> statement-breakpoint

-- Tek seferlik sözleşmede "dönemlik" ayrımı anlamsız; toplam olarak yazılır.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_one_time_basis"
  CHECK ("billing_frequency" <> 'one_time' OR "amount_basis" = 'contract_total');--> statement-breakpoint

-- Toplam bir SINIR olmadan bölünemez: taksit sayısı ya da bitiş tarihi şart.
-- ⚠ one_time BU KURALIN DIŞINDADIR: tek seferlik sözleşmenin sınırı zaten
--   kendisidir (tam 1 satır), taksit sayısı da bitiş tarihi de aranmaz.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_total_needs_bound"
  CHECK ("amount_basis" <> 'contract_total'
         OR "billing_frequency" = 'one_time'
         OR "installment_count" IS NOT NULL
         OR "end_date" IS NOT NULL);--> statement-breakpoint

-- ══ 4) Yenileme: iki ayrı tarih ══
--
-- 31.03.2027'de biten bir sözleşmede 15.09.2026 "yenileme tarihi" olamaz —
-- o gün yenileme GÖRÜŞMESİNİN yapılacağı gündür. Tek kolon iki kavramı
-- taşıyınca hem rozet metni hem Sprint 6'daki bildirim yanlış konuşur.
--   renewal_date        → yeni dönemin başladığı gün
--   renewal_review_date → görüşme / hatırlatma günü
ALTER TABLE "contracts" ADD COLUMN "renewal_review_date" date;--> statement-breakpoint

-- Eşitlik kabul edilmez: aynı gün hem biten hem yenilenen sözleşme o güne
-- iki dönem yazar.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_renewal_after_end"
  CHECK ("renewal_date" IS NULL OR "renewal_date" > "end_date");--> statement-breakpoint

-- ⚠ Ayrı ve açık kısıt gerekiyor: yukarıdaki CHECK `end_date` NULL iken NULL
-- döner ve satırı GEÇİRİR. Süresiz sözleşmenin "yeni dönem başlangıcı"
-- tanımsızdır — neyin bittiği belli değilse ne yenileniyor?
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_renewal_needs_end"
  CHECK ("renewal_date" IS NULL OR "end_date" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_review_after_start"
  CHECK ("renewal_review_date" IS NULL OR "renewal_review_date" >= "start_date");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_review_before_renewal"
  CHECK ("renewal_review_date" IS NULL OR "renewal_date" IS NULL
         OR "renewal_review_date" <= "renewal_date");--> statement-breakpoint
-- Otomatik yenileme bayrağı GERÇEK yenileme tarihi olmadan işaretlenemez.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_auto_renew_needs_date"
  CHECK (NOT "auto_renew" OR "renewal_date" IS NOT NULL);--> statement-breakpoint

-- ══ 5) contract_no — üretim, değiştirilemezlik, yeniden kullanılmama ══
--
-- Yıl kaynağı: sözleşmenin OLUŞTURULDUĞU andaki Europe/Istanbul tarihi.
-- `start_date`'ten üretilseydi kullanıcı tarihi değiştirerek numara yılını
-- etkileyebilirdi.
--
-- Yarış koruması: sayaç tablosu + ON CONFLICT DO UPDATE (satır kilidi).
-- `max(no)+1` deseni iki eşzamanlı istekte aynı numarayı üretirdi.
CREATE TABLE "contract_no_seq" (
  "year"    integer PRIMARY KEY,
  "last_no" integer NOT NULL
);--> statement-breakpoint

CREATE OR REPLACE FUNCTION next_contract_no() RETURNS text AS $$
DECLARE
  v_year integer;
  v_no   integer;
BEGIN
  v_year := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Istanbul'))::int;

  INSERT INTO "contract_no_seq" ("year", "last_no")
  VALUES (v_year, 1)
  ON CONFLICT ("year") DO UPDATE
    SET "last_no" = "contract_no_seq"."last_no" + 1
  RETURNING "last_no" INTO v_no;

  RETURN 'PRV-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Numara YENİDEN KULLANILMAZ: sayaç yalnız ileri gider ve benzersizlik TÜM
-- satırları kapsar — soft delete edilmiş bir sözleşmenin numarası da rezerve
-- kalır. 0000'daki kısmi index bunu sağlamıyordu.
DROP INDEX IF EXISTS "uq_contracts_no";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contracts_no" ON "contracts" ("contract_no");--> statement-breakpoint

ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_no_normalized"
  CHECK ("contract_no" = upper(btrim("contract_no")));--> statement-breakpoint

-- INSERT SONRASI HER UPDATE'te reddedilir — yalnız `active` durumunda değil,
-- `draft` dâhil. Numara verilmiş bir belge, taslakken bile başka bir numaraya
-- taşınamaz.
CREATE OR REPLACE FUNCTION prevent_contract_no_change() RETURNS trigger AS $$
BEGIN
  IF NEW."contract_no" IS DISTINCT FROM OLD."contract_no" THEN
    RAISE EXCEPTION 'Sözleşme numarası değiştirilemez (% → %)',
      OLD."contract_no", NEW."contract_no"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_contracts_no_immutable"
  BEFORE UPDATE OF "contract_no" ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION prevent_contract_no_change();--> statement-breakpoint

-- ══ 6) FK sertleştirme ve tutarlılık ══
--
-- Marka fiziksel silinince sözleşme kaybolmasın; geçmiş sessizce silinmesin.
ALTER TABLE "contracts" DROP CONSTRAINT IF EXISTS "contracts_brand_id_brands_id_fk";--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_brand_id_brands_id_fk"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "contract_items" DROP CONSTRAINT IF EXISTS "contract_items_contract_id_contracts_id_fk";--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_contract_id_contracts_id_fk"
  FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "contract_items" DROP CONSTRAINT IF EXISTS "contract_items_service_id_services_id_fk";--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_service_id_services_id_fk"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- Kur tutarlılığı: TRY'de kur 1 olmalı, kur her durumda pozitif.
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_fx_rate_positive"
  CHECK ("fx_rate" > 0);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_try_fx_rate"
  CHECK ("currency_code" <> 'TRY' OR "fx_rate" = 1);--> statement-breakpoint

-- Kalem para birimi sözleşmeyle AYNI olmalı (Karar 7'nin sözleşme karşılığı).
-- Farklı birimdeki kalemler toplanamaz; toplam uyuşmazlık uyarısı anlamsızlaşır.
CREATE OR REPLACE FUNCTION enforce_contract_item_currency() RETURNS trigger AS $$
DECLARE
  v_currency char(3);
BEGIN
  SELECT "currency_code" INTO v_currency FROM "contracts" WHERE "id" = NEW."contract_id";
  IF v_currency IS NOT NULL AND NEW."currency_code" IS DISTINCT FROM v_currency THEN
    RAISE EXCEPTION 'Kalem para birimi sözleşmeyle aynı olmalı (% <> %)',
      NEW."currency_code", v_currency
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_contract_items_currency"
  BEFORE INSERT OR UPDATE OF "currency_code", "contract_id" ON "contract_items"
  FOR EACH ROW EXECUTE FUNCTION enforce_contract_item_currency();--> statement-breakpoint

-- ══ 7) İndeksler ══
--
-- "60 gün içinde yenilenecek/görüşülecek" sorguları — iki ayrı kısmi indeks,
-- çünkü rozet hangi tarih doluysa ona dayanır.
CREATE INDEX "idx_contracts_renewal" ON "contracts" ("renewal_date")
  WHERE "status" = 'active' AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_contracts_renewal_review" ON "contracts" ("renewal_review_date")
  WHERE "status" = 'active' AND "deleted_at" IS NULL;--> statement-breakpoint

-- Arama: marka modülüyle aynı desen (trigram).
CREATE INDEX "idx_contracts_no_trgm" ON "contracts"
  USING gin ("contract_no" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_contracts_title_trgm" ON "contracts"
  USING gin ("title" gin_trgm_ops);
