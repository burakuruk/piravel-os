# Piravel OS — Veritabanı Şeması (MVP)

**Veritabanı:** PostgreSQL 16+
**Baz para birimi:** TRY (settings'te tutulur, MVP arayüzünden değiştirilemez)
**Sürüm:** 1.2

---

## A0. Değişiklik günlüğü — v1.1 → v1.2

| # | Değişiklik | Gerekçe |
|---|---|---|
| 1 | `transactions.brand_id` (nullable) eklendi | Eşleştirilmemiş tahsilatın (müşteri avansının) hangi markaya ait olduğu serbest metin `counterparty`'den değil, gerçek FK'den takip edilir. CSV içe aktarmada boş kalabilir; mutabakat ekranında atanır. (→ §10.2) |
| 2 | `transactions.refund_of_transaction_id` (nullable, self-FK) eklendi | Müşteriye iade **iç virman değildir**. `transfer_pair_id` yalnızca Piravel'in kendi hesapları arası virman için; iade orijinal tahsilata bu yeni alanla bağlanır. §18.2 buna göre düzeltildi. |
| 3 | §22 açık sorular **kapatıldı** | Tüm kararlar verildi; §22 karar kaydına dönüştürüldü. |

---

## A. Değişiklik günlüğü — v1.0 → v1.1

| # | İnceleme maddesi | Verilen karar |
|---|---|---|
| 1 | UUID v7 / `gen_random_uuid()` çelişkisi | **UUID v7 uygulama katmanında üretilir.** DB'deki `DEFAULT gen_random_uuid()` yalnızca manuel SQL için yedektir. (→ Karar 6) |
| 2 | Recurring gider şablonu eksik | **Yeni tablo: `recurring_templates`.** Motorun tek kaynağı budur; sözleşmeler de aktifleşince şablon üretir. `contracts.recurrence_rule_id` kaldırıldı. (→ Bölüm 8) |
| 3 | `tax_lines` yok | **Yeni tablo: `tax_lines`** (KDV, tevkifat, stopaj). Net/brüt tanımı kesinleştirildi. (→ Bölüm 9.4) |
| 4 | Allocation para birimi belirsiz | **Çift tutar modeli:** `tx_amount_minor` + `ob_amount_minor` + `fx_rate` + `amount_base_minor`. Çapraz kur tahsilatı destekleniyor. (→ Bölüm 10.3) |
| 5 | Hesap/transaction para birimi uyumsuzluğu | **Transaction para birimi = hesap para birimi, trigger ile zorlanır.** (→ Bölüm 10.2) |
| 6 | Kredi kartı borç hesabı sorunu | **v0.2'ye ertelendi.** MVP enum'u: `bank`, `cash`, `payment_gateway`. v0.2 tasarım taslağı dokümante edildi. (→ Bölüm 10.1) |
| 7 | `payment_overdue` marka durumu | **Kaldırıldı.** Marka yaşam döngüsü 5 durum; ödeme riski `v_brand_payment_risk` view'ından türetilir, statü otomatik değişmez. (→ Bölüm 5.1) |
| 8 | Allocation silme çelişkisi | **Reversal modeli:** `reversed_at` + `reversed_by_id` + `reversal_reason`. Allocation asla silinmez. (→ Bölüm 10.3) |
| 9 | Sözleşme toplamı kaynağı | **`contracts.amount_minor` tek doğruluk kaynağıdır.** `contract_items` kapsam açıklamasıdır; toplamlar uyuşmazsa yumuşak uyarı. İndirim → KDV sırası tanımlandı. (→ Bölüm 7) |
| 10 | Fazla ödeme / iade | **Avans modeli:** fazla kısım `transactions.unallocated_minor`'da müşteri avansı olarak bekler; iade ters yönlü transaction. `refunded` kullanım şartları tanımlandı. (→ Bölüm 18.2) |
| 11 | Auth.js / TOTP doğrulaması | **Karar: Better Auth.** Karşılaştırma ve gerekçe PRD §7'ye işlendi; özet bu dokümanın sonunda. (→ Bölüm 21) |

---

## 0. Temel tasarım kararları (güncellenmiş)

### Karar 1 — Para her zaman 4 kolondur *(değişmedi)*

```sql
amount_minor      bigint         -- kuruş cinsinden, integer. ASLA float/real.
currency_code     char(3)        -- 'TRY', 'USD', 'EUR'
fx_rate           numeric(18,8)  -- kaydın oluştuğu andaki, baz para birimine kur
amount_base_minor bigint         -- baz para biriminde karşılık (kuruş)
```

- Toplama/çıkarma yalnızca `amount_base_minor` üzerinde veya aynı para biriminde yapılır.
- Kur kayıt anında **kopyalanır**; rapor asla `exchange_rates`'e geri dönmez.
- TRY kayıtlarında `fx_rate = 1`, `amount_base_minor = amount_minor`.

### Karar 2 — Beklenen para ile gerçek para ayrı tablolardır *(değişmedi)*

```
BEKLENEN (plan)              GERÇEK (nakit)
─────────────────            ──────────────
receivables  (alacak)  ──┐
                         ├──► allocations ──► transactions
payables     (borç)    ──┘   (çift tutarlı,   (banka hareketi,
                              reversal'lı)     hesap para biriminde)
```

### Karar 3 — Recurrence motorunun tek kaynağı `recurring_templates`'tir *(güncellendi)*

`recurrence_rules` yalnızca **zamanlamayı** tutar (ne sıklıkta, hangi gün).
`recurring_templates` **içeriği** tutar (tutar, para birimi, kategori, tedarikçi, marka, hedef tablo).

Motor yalnızca şablonları okur:

- Aylık **sözleşme** aktifleştirildiğinde sistem otomatik bir şablon üretir (`target_type='receivable'`, `contract_id` dolu).
- **Bağımsız tekrarlayan gider** (Adobe, hosting, Bağ-Kur) doğrudan şablon olarak tanımlanır (`target_type='payable'`).

Tek motor, tek kaynak, tek idempotency kuralı.

### Karar 4 — Soft delete evrenseldir; allocation'da reversal kullanılır *(güncellendi)*

- İş tablolarında `deleted_at` + `deleted_by_id`; finansal kayıtlar asla fiziksel silinmez.
- **İstisna — `allocations`:** eşleştirme ne soft delete edilir ne fiziksel silinir; **ters kayıtla (reversal) etkisiz hale getirilir.** Hatalı eşleştirmenin izi, gerekçesiyle birlikte sonsuza kadar kalır.

### Karar 5 — Audit log append-only'dir *(değişmedi)*

DB seviyesinde `REVOKE UPDATE, DELETE` + koruma trigger'ı.

### Karar 6 — UUID v7, uygulama katmanında üretilir *(netleştirildi)*

- **Normal akışta** tüm ID'ler uygulama tarafından üretilir: TypeScript'te `uuidv7` paketi, Drizzle şemasında `.$defaultFn(() => uuidv7())`.
- Kolonlardaki `DEFAULT gen_random_uuid()` (v4) yalnızca **manuel SQL müdahaleleri için yedektir**; uygulama hiçbir zaman DB default'una güvenmez.
- Hiçbir iş mantığı veya sıralama ID düzenine dayanmaz — sıralama daima `created_at` iledir. v7'nin tek getirisi index lokalitesidir; araya v4 karışması sorun yaratmaz.

### Karar 7 — Bir hesabın tüm hareketleri hesabın para birimindedir *(yeni)*

`transactions.currency_code` daima bağlı olduğu `bank_accounts.currency_code` ile aynıdır (trigger ile zorlanır). Döviz bozdurma, iki hesap arasında iki ayrı hareket + virman bağı olarak kaydedilir. Bakiye sorgusu bu sayede güvenle `SUM(amount_minor)` alabilir.

---

## 1. ER ilişki haritası (güncellenmiş)

```
                          ┌──────────┐
                          │  users   │
                          └────┬─────┘
                               │
              ┌────────────────┼──────────────────┐
        ┌─────▼──────┐   ┌─────▼──────┐    ┌──────▼──────┐
        │brand_users │   │ audit_logs │    │notifications│
        └─────┬──────┘   └────────────┘    └─────────────┘
              │
        ┌─────▼──────┐        ┌────────────────┐
        │   brands   │◄───────┤ brand_contacts │
        └─────┬──────┘        └────────────────┘
              │
     ┌────────┼──────────┬──────────────┐
     │        │          │              │
┌────▼────┐ ┌─▼──────┐ ┌─▼─────────┐ ┌──▼──────┐
│contracts│ │ tasks  │ │receivables│ │payables │
└────┬────┘ └────────┘ └──┬───┬────┘ └──┬───┬──┘
     │                    │   │         │   │
┌────▼──────────┐         │ ┌─▼─────────▼─┐ │
│contract_items │         │ │  tax_lines  │ │
└────┬──────────┘         │ └─────────────┘ │
     │                    └──────┬──────────┘
┌────▼─────┐                     │
│ services │             ┌───────▼────────┐
└──────────┘             │  allocations   │ (reversal'lı)
                         └───────┬────────┘
┌──────────────────┐             │
│ recurrence_rules │     ┌───────▼────────┐
└────────┬─────────┘     │  transactions  │
         │               └───────┬────────┘
┌────────▼───────────┐           │
│recurring_templates │   ┌───────▼────────┐
│ (motorun kaynağı)  │   │ bank_accounts  │
└────────────────────┘   └────────────────┘
```

---

## 2. Enum tipleri (güncellenmiş)

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'finance', 'operations', 'member');

-- v1.1: 'payment_overdue' KALDIRILDI — ödeme riski receivable'lardan türetilir,
-- marka yaşam döngüsüne karıştırılmaz.
CREATE TYPE brand_status AS ENUM (
  'lead',              -- potansiyel müşteri
  'proposal_sent',     -- teklif verildi
  'active',            -- aktif müşteri
  'suspended',         -- askıya alındı (hizmet durduruldu)
  'churned'            -- ayrıldı
);

CREATE TYPE contract_status AS ENUM ('draft', 'active', 'ended', 'cancelled');

CREATE TYPE billing_type AS ENUM ('one_time', 'recurring');

CREATE TYPE pricing_model AS ENUM (
  'fixed_monthly', 'one_time_project', 'hourly', 'per_service',
  'ad_budget_commission', 'revenue_commission', 'package_plus_extra', 'installment'
);

CREATE TYPE obligation_status AS ENUM (
  'draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded'
);

-- v1.1: recurrence motorunun hedef tablosu
CREATE TYPE obligation_target AS ENUM ('receivable', 'payable');

CREATE TYPE transaction_direction AS ENUM ('in', 'out');

-- v1.1: 'credit_card' ve 'virtual_card' KALDIRILDI (v0.2'ye ertelendi —
-- kredi kartı bir borç hesabıdır, varlık hesabıyla aynı mantıkla çalışamaz)
CREATE TYPE account_type AS ENUM ('bank', 'cash', 'payment_gateway');

CREATE TYPE recurrence_frequency AS ENUM (
  'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'
);

-- v1.1: vergi satırı türleri
CREATE TYPE tax_type AS ENUM (
  'kdv',            -- katma değer vergisi (+)
  'kdv_tevkifat',   -- KDV tevkifatı (−, alıcı öder)
  'stopaj',         -- gelir vergisi stopajı (−)
  'other'
);

CREATE TYPE task_status AS ENUM (
  'todo', 'in_progress', 'in_review', 'client_approval', 'revision', 'done', 'cancelled'
);

CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE audit_action AS ENUM (
  'create', 'update', 'delete', 'restore', 'reverse',
  'login', 'login_failed', 'logout',
  'export', 'download', 'view_sensitive'
);

CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
```

---

## 3. Sistem ve para birimi tabloları *(v1.0 ile aynı)*

`currencies`, `exchange_rates`, `settings` — değişiklik yok. (Tam DDL v1.0 bölüm 3'teki gibidir; kurun kayıt anında kopyalanması kuralı geçerlidir.)

```sql
CREATE TABLE currencies (
  code        char(3) PRIMARY KEY,
  name        text        NOT NULL,
  symbol      text        NOT NULL,
  minor_units smallint    NOT NULL DEFAULT 2,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code char(3)       NOT NULL REFERENCES currencies(code),
  base_code     char(3)       NOT NULL REFERENCES currencies(code),
  rate          numeric(18,8) NOT NULL CHECK (rate > 0),
  rate_date     date          NOT NULL,
  source        text          NOT NULL DEFAULT 'manual',
  created_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (currency_code, base_code, rate_date)
);
CREATE INDEX idx_fx_lookup ON exchange_rates (currency_code, base_code, rate_date DESC);

CREATE TABLE settings (
  key           text PRIMARY KEY,
  value         jsonb       NOT NULL,
  description   text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by_id uuid REFERENCES users(id)
);
```

---

## 4. Kimlik ve yetki *(v1.0 ile aynı)*

`users`, `sessions`, `brand_users` — yapısal değişiklik yok. Tek not: oturum/2FA kolonlarının ne kadarının kullanılacağı Better Auth kararına göre netleşir (Bölüm 21); Better Auth kendi `session` / `account` / `twoFactor` tablolarını getirir, bizim `users` tablomuz onun şemasıyla birleşik kurulur. `brand_id` (v3 müşteri paneli kancası) ve `role` kolonu bizim tarafımızda kalır.

---

## 5. Marka ve yetkili kişiler

### 5.1 `brands` *(güncellendi — madde 7)*

DDL v1.0 ile aynı; yalnızca `status` yeni `brand_status` enum'unu kullanır.

**Yeni kural:** Ödeme gecikmesi bir marka statüsü **değildir**. Marka `active` kalır; risk aşağıdaki view'dan okunur ve marka kartında kırmızı rozet olarak gösterilir. Statüyü (`suspended` dahil) yalnızca insan değiştirir — sistem asla otomatik statü değiştirmez, sadece uyarır.

```sql
CREATE VIEW v_brand_payment_risk AS
SELECT
  r.brand_id,
  COUNT(*)                                        AS overdue_count,
  SUM(r.amount_base_minor - r.paid_base_minor)    AS overdue_base_minor,
  MAX(CURRENT_DATE - r.due_date)                  AS max_overdue_days,
  CASE
    WHEN MAX(CURRENT_DATE - r.due_date) > 60 THEN 'critical'
    WHEN MAX(CURRENT_DATE - r.due_date) > 30 THEN 'high'
    ELSE 'warning'
  END AS risk_level
FROM receivables r
WHERE r.due_date < CURRENT_DATE
  AND r.status IN ('pending', 'partially_paid', 'overdue')
  AND r.deleted_at IS NULL
GROUP BY r.brand_id;
```

### 5.2 `brand_contacts` *(v1.0 ile aynı)*

---

## 6. Hizmet kataloğu *(v1.0 ile aynı)*

`services` — değişiklik yok.

---

## 7. Sözleşme ve kapsam *(güncellendi — madde 9)*

### 7.1 Tutarın tek doğruluk kaynağı

| Soru | Karar |
|---|---|
| Sözleşme toplamı nereden gelir? | **`contracts.amount_minor` tek doğruluk kaynağıdır.** Faturalama ve receivable üretimi yalnızca bu tutarı kullanır. |
| `contract_items` ne işe yarar? | **Kapsam sözleşmesidir** ("ayda 12 post, 8 story"). Kalem fiyatları bilgilendirme amaçlıdır; teklif hazırlarken toplamı önerir. |
| İki toplam uyuşmazsa? | Kaydetme **engellenmez**; UI'da yumuşak uyarı gösterilir: "Kalem toplamı (32.000) sözleşme tutarından (30.000) farklı." |
| İndirim ne zaman uygulanır? | `amount_minor` **indirim uygulanmış net tutardır**. `discount_minor` yalnızca "liste fiyatından ne kadar indik" bilgisini raporlamak içindir; hesaba tekrar girmez. |
| KDV ne zaman uygulanır? | Sözleşme tutarları **KDV hariç** girilir (`vat_included=false` varsayılan). KDV, receivable üretilirken `tax_lines` ile eklenir. `vat_included=true` girilirse sistem önce net'i ayrıştırır, yine net saklar. **DB'de saklanan tutar daima KDV hariç nettir.** |

```sql
-- contracts tablosu v1.0 ile aynıdır, İKİ değişiklikle:
--   1) recurrence_rule_id KALDIRILDI
--      (bağ artık recurring_templates.contract_id üzerinden kurulur)
--   2) amount_minor açıklaması: "dönem başına, KDV hariç, indirim sonrası
--      net faturalama tutarı — TEK DOĞRULUK KAYNAĞI"
ALTER TABLE contracts DROP COLUMN recurrence_rule_id;  -- (v1.0'dan farkı)
```

### 7.2 `contract_items` *(v1.0 ile aynı)*

Rolü netleşti: kapsam tanımı + teklif yardımcısı. Faturalamaya girmez.

---

## 8. Recurrence motoru *(yeniden tasarlandı — madde 2)*

### 8.1 `recurrence_rules` — yalnızca zamanlama *(v1.0 ile aynı)*

Tutar, kategori, tedarikçi gibi **hiçbir içerik bilgisi taşımaz.**

### 8.2 `recurring_templates` — motorun tek kaynağı *(YENİ)*

```sql
CREATE TABLE recurring_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_rule_id  uuid              NOT NULL REFERENCES recurrence_rules(id),
  target_type         obligation_target NOT NULL,   -- 'receivable' | 'payable'

  name                text              NOT NULL,   -- "Adobe CC aboneliği"
  description         text              NOT NULL,   -- üretilen satıra kopyalanır

  -- Üretilen satıra kopyalanacak bağlar
  brand_id            uuid REFERENCES brands(id),
  contract_id         uuid REFERENCES contracts(id),         -- sözleşme kaynaklıysa dolu
  service_id          uuid REFERENCES services(id),          -- receivable için
  category_id         uuid REFERENCES expense_categories(id),-- payable için (app: zorunlu)
  vendor_id           uuid REFERENCES vendors(id),           -- payable için
  default_account_id  uuid REFERENCES bank_accounts(id),     -- beklenen ödeme hesabı

  -- ── PARA (4 kolon kuralı; baz tutar üretim anında hesaplanır) ──
  amount_minor        bigint            NOT NULL CHECK (amount_minor > 0),
  currency_code       char(3)           NOT NULL REFERENCES currencies(code),
  vat_rate            numeric(5,2)      NOT NULL DEFAULT 20.00,

  is_active           boolean           NOT NULL DEFAULT true,
  notes               text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by_id uuid REFERENCES users(id),
  deleted_at    timestamptz,
  deleted_by_id uuid REFERENCES users(id),

  -- receivable şablonu marka ister; payable şablonu kategori ister (app katmanında da doğrulanır)
  CONSTRAINT chk_receivable_needs_brand CHECK (
    target_type <> 'receivable' OR brand_id IS NOT NULL
  ),
  CONSTRAINT chk_payable_needs_category CHECK (
    target_type <> 'payable' OR category_id IS NOT NULL
  )
);

CREATE INDEX idx_templates_active ON recurring_templates (target_type)
  WHERE is_active AND deleted_at IS NULL;
```

### 8.3 Şablonlar nasıl doğar

| Kaynak | Akış |
|---|---|
| **Aylık sözleşme** | Sözleşme aktifleştirilince sistem otomatik şablon üretir: `target_type='receivable'`, `contract_id` dolu, `amount_minor = contracts.amount_minor`, kural = sözleşmenin ödeme günü. Sözleşme sonlanınca şablon `is_active=false` yapılır. |
| **Tek seferlik / taksitli sözleşme** | Şablon üretilmez; aktivasyon anında N adet receivable **doğrudan** üretilir (`source_type='contract'`). |
| **Bağımsız tekrarlayan gider** | Kullanıcı doğrudan şablon tanımlar: `target_type='payable'`, kategori + tedarikçi + tutar + kural. |
| **Tekrarlayan hizmet geliri (sözleşmesiz)** | Kullanıcı doğrudan şablon tanımlar: `target_type='receivable'`, marka + tutar + kural. |

### 8.4 Motor algoritması (güncellenmiş)

```
Günlük job (08:00):
  ufuk = bugün + settings.recurrence_horizon_days   (varsayılan 90)

  Her aktif recurring_template için:
    kural = template.recurrence_rule
    kural.last_generated_on'dan ufuk'a kadar her vade tarihi için:
      IF max_occurrences dolmadıysa AND ends_on aşılmadıysa:
        hedef tablo = template.target_type'a göre receivables | payables
        satır üret:
          source_type = 'recurrence'
          source_id   = template.id          ← idempotency anahtarı
          due_date    = vade
          tutar/para/KDV/bağlar template'ten kopyalanır
          fx_rate + amount_base_minor ÜRETİM ANINDAKİ kurdan hesaplanır
          KDV tax_lines satırı olarak eklenir
    kural.last_generated_on = ufuk
```

- **İdempotency:** hedef tablolardaki `(source_type, source_id, due_date)` benzersiz index'i. `source_id` artık **her zaman `recurring_templates.id`'dir** (`'recurrence'` için) veya `contracts.id`'dir (`'contract'` için).
- **Şablon güncellenirse:** yalnızca **henüz üretilmemiş** satırlar yeni tutarı alır. Üretilmiş satırlar değişmez (gerekirse elle düzeltilir — fatura kesilmiş olabilir).
- Ay sonu kuralı ve ufuk penceresi v1.0 ile aynı.

---

## 9. Finans çekirdeği ⭐

### 9.1 `receivables` *(net/brüt tanımı netleştirildi)*

DDL v1.0 ile aynıdır; **anlam** kesinleştirildi:

```
net_minor     (= amount_minor)         : KDV HARİÇ hizmet bedeli
tax_lines     : + KDV, − tevkifat, − stopaj satırları
collectible   : net + SUM(tax_lines.tax_minor)  → TAHSİL EDİLECEK NAKİT
```

**Kesin tanım:** `amount_minor` = **KDV hariç net tutar**. Tahsil edilecek nakit tutar (brüt) saklanmaz, `v_receivable_totals` view'ından okunur. `paid_minor` tahsil edilecek tutarla (brüt) karşılaştırılır.

> v1.0'daki `vat_rate` / `vat_minor` kolonları **kaldırıldı** — tek kaynak `tax_lines`. MVP'de her receivable üretiminde otomatik tek KDV satırı yazılır; tevkifat/stopaj alanı boş kalır ama yapı hazırdır.

```sql
-- v1.0'dan farklar:
--   - vat_rate, vat_minor kolonları YOK (tax_lines'a taşındı)
--   - CHECK (paid_minor <= amount_minor) yerine brüt karşılaştırma view/app'te
--     (paid_minor artık brüt tahsilatla karşılaştırılır; DB CHECK'i kaldırıldı,
--      aşırı tahsis engeli allocation transaction bloğunda uygulanır)

CREATE VIEW v_receivable_totals AS
SELECT
  r.id,
  r.amount_minor                                        AS net_minor,
  COALESCE(SUM(t.tax_minor), 0)                         AS tax_total_minor,
  r.amount_minor + COALESCE(SUM(t.tax_minor), 0)        AS collectible_minor,  -- brüt
  r.paid_minor,
  r.amount_minor + COALESCE(SUM(t.tax_minor), 0) - r.paid_minor AS balance_minor
FROM receivables r
LEFT JOIN tax_lines t ON t.receivable_id = r.id
WHERE r.deleted_at IS NULL
GROUP BY r.id;
```

### 9.2 `payables` *(aynı değişiklik — simetri korunur)*

`vat_rate`/`vat_minor` kaldırıldı; `tax_lines` kullanılır. Diğer her şey v1.0 ile aynı (onay akışı dahil).

### 9.3 `expense_categories`, `vendors` *(v1.0 ile aynı)*

### 9.4 `tax_lines` *(YENİ — madde 3)*

```sql
CREATE TABLE tax_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polimorfik sahip: tam olarak biri dolu
  receivable_id uuid REFERENCES receivables(id),
  payable_id    uuid REFERENCES payables(id),

  tax_type      tax_type      NOT NULL,
  rate          numeric(5,2)  NOT NULL,          -- yüzde: 20.00, 10.00
  base_minor    bigint        NOT NULL,          -- matrah (genelde net tutar)

  -- İŞARETLİ: tahsil edilecek/ödenecek tutara etkisi
  --   kdv          → pozitif  (nakdi artırır)
  --   kdv_tevkifat → negatif  (alıcı vergi dairesine öder, bizden eksilir)
  --   stopaj       → negatif
  tax_minor     bigint        NOT NULL,

  external_code text,                            -- GİB tevkifat kodu (örn. '9/10'), v3
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT chk_tax_one_target CHECK (
    (receivable_id IS NOT NULL AND payable_id IS NULL) OR
    (receivable_id IS NULL     AND payable_id IS NOT NULL)
  )
);

CREATE INDEX idx_tax_receivable ON tax_lines (receivable_id) WHERE receivable_id IS NOT NULL;
CREATE INDEX idx_tax_payable    ON tax_lines (payable_id)    WHERE payable_id    IS NOT NULL;
```

**Örnek — tevkifatlı danışmanlık faturası (v2+ senaryosu, yapı bugünden hazır):**

```
Net hizmet bedeli:          10.000,00 TL   → receivables.amount_minor = 1.000.000
KDV %20:                    +2.000,00 TL   → tax_lines (kdv, 20, +200.000)
KDV tevkifatı 9/10:         −1.800,00 TL   → tax_lines (kdv_tevkifat, 90, −180.000)
─────────────────────────────────────────
Tahsil edilecek (brüt):     10.200,00 TL   → v_receivable_totals.collectible_minor
```

MVP'de otomatik üretilen tek satır: `(kdv, %20, net, +net×0.20)`.

---

## 10. Banka hesapları ve gerçek para hareketi

### 10.1 `bank_accounts` *(güncellendi — madde 6)*

```sql
CREATE TABLE bank_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text         NOT NULL,
  bank_name             text,
  account_type          account_type NOT NULL DEFAULT 'bank',  -- bank|cash|payment_gateway
  account_holder        text,

  iban_encrypted        text,
  iban_last4            text,

  currency_code         char(3)      NOT NULL REFERENCES currencies(code),

  opening_balance_minor bigint       NOT NULL DEFAULT 0,
  opening_balance_date  date         NOT NULL DEFAULT CURRENT_DATE,

  is_active             boolean      NOT NULL DEFAULT true,
  sort_order            smallint     NOT NULL DEFAULT 0,
  notes                 text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by_id uuid REFERENCES users(id),
  deleted_at    timestamptz,
  deleted_by_id uuid REFERENCES users(id)
);
```

**Kredi kartı — v0.2'ye ertelendi.** MVP'de kredi kartı harcamaları, ödendiği ay tek bir payable + banka hesabından ödeme olarak kaydedilir (pratik geçici çözüm). v0.2 tasarım taslağı:

| Konu | v0.2 kararı |
|---|---|
| Modelleme | `is_liability boolean` kolonu; borç hesabında bakiye **negatif** akar |
| Harcama | Kart hesabına `out` hareketi → borç büyür (bakiye eksiye gider) |
| Ekstre ödemesi | Banka hesabından karta **virman** (`transfer_pair_id` ile bağlı iki hareket) → borç küçülür |
| Dashboard toplam bakiye | `SUM(varlık hesapları) − SUM(borç hesapları borcu)`; kartlar "Toplam nakit"e katılmaz, ayrı "Kart borcu" kartında gösterilir |
| Ekstre alanları | `credit_limit_minor`, `statement_day`, `payment_due_day` v0.2'de geri gelir |

### 10.2 `transactions` *(güncellendi — madde 5 + v1.2)*

DDL v1.0 tabanına göre **v1.2'de eklenen kolonlar:**

```sql
-- v1.2: Hareketin ait olduğu marka (nullable).
-- Kritik kullanım: eşleştirilmemiş tahsilat (unallocated_minor > 0) müşteri
-- AVANSIDIR — hangi müşterinin avansı olduğu bu FK'den bilinir.
-- CSV içe aktarmada otomatik bulunamazsa NULL kalır; mutabakat ekranında atanır.
-- Allocation yapılırken app doğrular: transaction.brand_id (doluysa)
-- eşleştirilen receivable.brand_id ile aynı olmalıdır.
brand_id                 uuid REFERENCES brands(id),

-- v1.2: İade bağı. Müşteriye yapılan fazla ödeme/tahsilat iadesi İÇ VİRMAN
-- DEĞİLDİR — transfer_pair_id kullanılmaz. İade hareketi (direction='out')
-- orijinal tahsilat hareketine bu alanla bağlanır.
refund_of_transaction_id uuid REFERENCES transactions(id),
```

```sql
-- Müşteri avansları ekranının sorgusu:
CREATE INDEX idx_tx_advances ON transactions (brand_id)
  WHERE direction = 'in' AND unallocated_minor > 0 AND deleted_at IS NULL;
```

**Bağ alanlarının kesin ayrımı:**

| Alan | Ne için | Ne için DEĞİL |
|---|---|---|
| `transfer_pair_id` | Piravel'in **kendi hesapları arası** virman (TL→USD bozdurma, kasaya nakit çekme) | Müşteri/tedarikçiyle para alışverişi |
| `refund_of_transaction_id` | Müşteriye **iade** (fazla ödeme iadesi, tahsilat iadesi) | İç virman |

**İki ek kural (v1.1'den):**

```sql
-- KURAL: hareket para birimi = hesap para birimi (trigger ile zorlanır)
CREATE OR REPLACE FUNCTION enforce_tx_currency() RETURNS trigger AS $$
DECLARE acct_currency char(3);
BEGIN
  SELECT currency_code INTO acct_currency
    FROM bank_accounts WHERE id = NEW.bank_account_id;
  IF NEW.currency_code <> acct_currency THEN
    RAISE EXCEPTION 'Hareket para birimi (%) hesap para birimiyle (%) uyuşmuyor',
      NEW.currency_code, acct_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tx_currency
  BEFORE INSERT OR UPDATE OF currency_code, bank_account_id ON transactions
  FOR EACH ROW EXECUTE FUNCTION enforce_tx_currency();
```

- `currency_code` kolonu **tutulur** (rapor sorgularında JOIN tasarrufu) ama hesapla uyumu trigger garantisindedir. Bakiye sorgusu artık güvenle aynı para biriminde toplar.
- **Döviz bozdurma:** USD hesabından TL hesabına geçiş = USD hesabında `out` + TL hesabında `in`, `transfer_pair_id` ile bağlanır. İki tutar farklı para birimindedir; kur, iki hareketin `amount_base_minor` farkından raporlanır.

### 10.3 `allocations` — çift tutarlı eşleştirme + reversal *(yeniden tasarlandı — madde 4 ve 8)*

```sql
CREATE TABLE allocations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid          NOT NULL REFERENCES transactions(id),

  -- Polimorfik hedef: tam olarak biri dolu
  receivable_id     uuid          REFERENCES receivables(id),
  payable_id        uuid          REFERENCES payables(id),

  -- ── ÇİFT TUTAR MODELİ ──
  -- Hareketin para biriminde: transactions.unallocated_minor'dan DÜŞÜLEN tutar
  tx_amount_minor   bigint        NOT NULL CHECK (tx_amount_minor > 0),
  -- Yükümlülüğün para biriminde: receivable/payable.paid_minor'a EKLENEN tutar
  ob_amount_minor   bigint        NOT NULL CHECK (ob_amount_minor > 0),
  -- Eşleştirmede uygulanan kur (yükümlülük birimi → hareket birimi)
  -- Aynı para biriminde: 1 ve tx_amount = ob_amount (app doğrular)
  fx_rate           numeric(18,8) NOT NULL DEFAULT 1 CHECK (fx_rate > 0),
  -- Baz para karşılığı — HAREKET tarafından hesaplanır (gerçek nakit değeri)
  amount_base_minor bigint        NOT NULL,

  notes             text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  created_by_id     uuid REFERENCES users(id),

  -- ── REVERSAL (madde 8: silme yok, soft delete yok, ters kayıt var) ──
  reversed_at       timestamptz,
  reversed_by_id    uuid REFERENCES users(id),
  reversal_reason   text,

  CONSTRAINT chk_one_target CHECK (
    (receivable_id IS NOT NULL AND payable_id IS NULL) OR
    (receivable_id IS NULL     AND payable_id IS NOT NULL)
  ),
  -- Reversal alanları birlikte dolu/boş olur
  CONSTRAINT chk_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by_id IS NULL) OR
    (reversed_at IS NOT NULL AND reversed_by_id IS NOT NULL AND reversal_reason IS NOT NULL)
  )
);

CREATE INDEX idx_alloc_tx         ON allocations (transaction_id) WHERE reversed_at IS NULL;
CREATE INDEX idx_alloc_receivable ON allocations (receivable_id)
  WHERE receivable_id IS NOT NULL AND reversed_at IS NULL;
CREATE INDEX idx_alloc_payable    ON allocations (payable_id)
  WHERE payable_id IS NOT NULL AND reversed_at IS NULL;
```

**Kurallar:**

1. **Aynı para birimi:** `fx_rate = 1`, `tx_amount_minor = ob_amount_minor` (uygulama doğrular).
2. **Çapraz para birimi** (tipik: USD alacak, TL tahsilat): kullanıcı eşleştirme ekranında kuru görür/düzeltir; `ob_amount = tx_amount / fx_rate`.
3. `transactions.unallocated_minor` daima **kendi para biriminde** ve yalnızca `tx_amount_minor` ile azalır → madde 5'teki hata kökten çözülür.
4. `receivable.paid_minor` daima **kendi para biriminde** ve yalnızca `ob_amount_minor` ile artar.
5. **Reversal:** allocation asla UPDATE ile değiştirilmez (tutar düzeltmesi = reversal + yeni allocation). Reversal tek DB transaction'ında şunları yapar: `reversed_*` alanlarını doldurur, `paid_minor`/`paid_base_minor`'ı geri düşer, `unallocated_minor`'ı geri artırır, statüyü yeniden hesaplar, audit'e `reverse` yazar.
6. Tüm toplamlar `WHERE reversed_at IS NULL` filtresiyle alınır (index'ler zaten partial).

#### Eşleştirme transaction bloğu (güncellenmiş)

```sql
BEGIN;
  -- 1) Yükümlülüğü VE hareketi kilitle
  SELECT r.amount_minor, r.paid_minor, vt.collectible_minor
    FROM receivables r JOIN v_receivable_totals vt ON vt.id = r.id
    WHERE r.id = :rid FOR UPDATE OF r;
  SELECT unallocated_minor FROM transactions WHERE id = :tid FOR UPDATE;

  -- 2) Doğrulamalar (aşılırsa HATA):
  --    ob_amount  ≤ collectible_minor − paid_minor   (aşırı tahsis engeli, brüt üzerinden)
  --    tx_amount  ≤ unallocated_minor                 (hareketten fazlasını dağıtma engeli)

  -- 3) INSERT allocations (tx_amount, ob_amount, fx_rate, base)

  -- 4) UPDATE receivables:
  --      paid_minor += ob_amount, paid_base_minor += base,
  --      status = paid | partially_paid | overdue (vade + kalan bakiyeye göre)
  --    UPDATE transactions: unallocated_minor -= tx_amount

  -- 5) INSERT audit_logs (aynı transaction içinde)
COMMIT;
```

#### Kur farkı view'ı (güncellenmiş)

```sql
CREATE VIEW v_fx_differences AS
SELECT
  r.id AS receivable_id,
  r.brand_id,
  r.currency_code,
  r.paid_base_minor
    - ROUND(r.fx_rate * r.paid_minor) AS fx_diff_base_minor
  -- paid_base: tahsilat anındaki gerçek kurlarla birikir (allocation'lardan)
  -- r.fx_rate * paid_minor: alacağın oluştuğu kurla beklenen karşılık
FROM receivables r
WHERE r.currency_code <> (SELECT value->>'code' FROM settings WHERE key='base_currency')
  AND r.paid_minor > 0
  AND r.deleted_at IS NULL;
```

---

## 11–14. Görevler, ekler, bildirimler, audit *(v1.0 ile aynı)*

`tasks`, `attachments`, `notifications`, `audit_logs` — değişiklik yok. Tek ek: `audit_action` enum'una `reverse` değeri eklendi (allocation reversal'ı için).

---

## 15. Soft delete kuralları *(güncellendi — madde 8 çelişkisi giderildi)*

| Kayıt tipi | Davranış |
|---|---|
| Finansal belgeler (receivable, payable, transaction, contract) | Soft delete; **asla fiziksel silinmez** |
| **`allocations`** | **Ne silinir ne soft delete edilir — yalnızca reversal** (`reversed_at`) |
| `tax_lines` | Sahibiyle yaşar; sahibi soft delete olunca erişilmez olur |
| Diğer (task, contact, attachment, template) | Soft delete; 90 gün sonra fiziksel silinebilir |

Silme öncesi bütünlük kontrolleri v1.0 ile aynı; bir ek:

- Aktif (reverse edilmemiş) allocation'ı olan **transaction** silinemez → önce allocation'lar reverse edilir.

---

## 16. Ortak sütun standardı *(v1.0 ile aynı)*

---

## 17. Kritik rapor sorguları

v1.0'daki 4 sorgu geçerli; iki uyarlama:

- Gecikmiş alacak ve tahsilat oranı sorguları artık **brüt** tutarı `v_receivable_totals.collectible_minor` üzerinden okur (KDV dahil alacak takibi).
- Banka bakiyesi sorgusu değişmedi — Karar 7 sayesinde artık matematiksel olarak da doğru.

---

## 18. Uçtan uca senaryolar (YENİ)

### 18.1 Çapraz para birimli tahsilat (madde 4 örneği)

```
1 Ağustos — USD sözleşmeden receivable üretilir:
  receivables: amount=100.000 (1.000,00 USD, net), fx_rate=34,20, base=3.420.000
  tax_lines:   (kdv, 20, +20.000)  → collectible = 120.000 (1.200,00 USD)

10 Ağustos — müşteri TL hesabına 42.500,00 TL gönderir:
  transactions: TL hesabı, in, amount=4.250.000 (TRY), fx=1, base=4.250.000
                unallocated=4.250.000

Eşleştirme (kullanıcı kuru onaylar: 35,42):
  allocations:
    tx_amount_minor = 4.250.000   (TRY — hareketten düşülür)
    ob_amount_minor =   120.000   (USD — alacağa sayılır: 4.250.000/35,42 ≈ 1.200 USD)
    fx_rate         = 35,42
    amount_base     = 4.250.000   (gerçek nakit değeri)

Sonuç:
  receivable: paid=120.000/120.000 → PAID, paid_base=4.250.000
  transaction: unallocated=0
  Kur farkı = 4.250.000 − (34,20 × 120.000 = 4.104.000) = +146.000  → +1.460 TL kur GELİRİ
```

### 18.2 Fazla ödeme → avans → iade (madde 10)

```
Alacak: 30.000 TL (brüt). Müşteri 35.000 TL gönderdi.

Adım 1 — Tahsilat:
  transaction: in, 3.500.000, brand_id=VISVIZE, unallocated=3.500.000

Adım 2 — Eşleştirme:
  allocation: tx=3.000.000, ob=3.000.000 → receivable PAID
  transaction.unallocated = 500.000  ← MÜŞTERİ AVANSI burada yaşar

  "Müşteri avansları" ekranı bu 5.000 TL'yi transaction.brand_id üzerinden
  Vis Vize'nin avansı olarak listeler. (Ayrı bir 'advance' tablosu YOK —
  avans, brand_id'li bir hareketin unallocated bakiyesinin kendisidir.
  brand_id boşsa hareket "sahipsiz tahsilat" olarak mutabakat ekranına düşer,
  kullanıcı markayı atar.)

Adım 3a — Avans sonraki aya sayılır:
  Eylül receivable'ı üretilince aynı transaction'dan ikinci allocation:
  allocation: tx=500.000, ob=500.000 → Eylül alacağı partially_paid

Adım 3b — VEYA iade edilir:
  Ters yönlü transaction: out, 500.000, "Fazla ödeme iadesi",
  brand_id=VISVIZE, refund_of_transaction_id=orijinal_tahsilat_id
  → orijinaldeki unallocated, iade tutarı kadar düşülür.
  DİKKAT: transfer_pair_id KULLANILMAZ — bu bir iç virman değil,
  müşteriye para çıkışıdır.

'refunded' statüsü NE ZAMAN kullanılır:
  YALNIZCA tahsil edilmiş bir alacağın kendisi iade edildiğinde:
  1) Alacağın allocation'ları reverse edilir (para "serbest kalır")
  2) Serbest kalan tutar, refund_of_transaction_id ile orijinale bağlı
     ters yönlü transaction ile iade edilir
  3) Receivable statüsü elle 'refunded' yapılır (audit'e gerekçeyle yazılır)
  Fazla ödeme iadesi receivable statüsünü ETKİLEMEZ (alacak zaten paid).
```

### 18.3 Recurring sözleşme (gelir)

```
Vis Vize — aylık 30.000 TL + KDV, her ayın 5'i, 12 ay (1 Eyl 2026 – 31 Ağu 2027)

Aktivasyonda sistem üretir:
  recurrence_rules:     monthly, day_of_month=5, starts 2026-09-05,
                        ends 2027-08-31, max_occurrences=12
  recurring_templates:  target=receivable, brand=VISVIZE, contract=PRV-2026-0001,
                        amount=3.000.000, TRY, kdv %20

Günlük job (ufuk 90 gün) ilk çalışmada 3 satır üretir:
  receivable  5 Eyl: net 3.000.000 + tax_line(kdv +600.000) → brüt 3.600.000
  receivable  5 Eki: aynı
  receivable  5 Kas: aynı
  (source_type='recurrence', source_id=template.id → benzersiz index mükerrer engeller)

Sözleşme feshedilirse: template.is_active=false; üretilmiş ama vadesi gelmemiş
satırlar kullanıcı onayıyla 'cancelled' yapılır.
```

### 18.4 Recurring gider

```
Adobe CC — aylık 2.400 TL, her ayın 15'i, süresiz, markasız genel gider

Kullanıcı tek form doldurur, sistem üretir:
  recurrence_rules:     monthly, day_of_month=15, starts 2026-08-15, ends NULL
  recurring_templates:  target=payable, category=yazilim_abonelik,
                        vendor=Adobe, amount=240.000, TRY, kdv %20,
                        default_account=Garanti TL

Job her satırı payables'a yazar; vade−3 gün bildirimi düşer;
ödeme yapılınca transaction (out) → allocation ile kapatılır.
Zam gelirse: template.amount güncellenir → sadece YENİ üretilecek satırlar etkilenir.
```

---

## 19. Migration sırası (güncellenmiş)

```
01  extensions (pgcrypto, citext, pg_trgm)
02  enum tipleri (v1.1 setiyle)
03  currencies, exchange_rates
04  users (Better Auth tablolarıyla birlikte; brands FK'i sonra)
05  brands → ALTER users.brand_id FK
06  brand_contacts, brand_users
07  services
08  recurrence_rules
09  contracts, contract_items          (recurrence_rule_id YOK)
10  expense_categories, vendors
11  bank_accounts                       (kredi kartı alanları YOK)
12  recurring_templates                 ← YENİ (bank_accounts'tan sonra: FK)
13  receivables, payables               (vat kolonları YOK)
14  tax_lines                           ← YENİ
15  transactions + trg_tx_currency      ← YENİ trigger
16  allocations                         (çift tutar + reversal)
17  tasks
18  attachments
19  notifications
20  audit_logs + trigger + GRANT/REVOKE
21  settings
22  view'lar (v_receivable_totals, v_fx_differences, v_brand_payment_risk)
23  seed (para birimleri, gider kategorileri, ilk süper yönetici)
```

---

## 20. Uygulama katmanında zorunlu kurallar (güncellenmiş)

v1.0'daki 8 kural geçerli; eklenenler:

9. **ID üretimi:** Tüm insert'ler uygulamadan `uuidv7()` ile gelir; DB default'una güvenilmez.
10. **Allocation değişmezdir:** UPDATE yasak; düzeltme = reversal + yeni allocation.
11. **Aynı para birimi eşleştirmesinde** `fx_rate=1` ve `tx_amount=ob_amount` uygulama tarafından zorlanır.
12. **KDV satırı** her receivable/payable üretiminde otomatik yazılır; brüt tutar daima `v_receivable_totals`'tan okunur, elde hesaplanmaz.
13. **Sözleşme aktivasyonu** tek DB transaction'ında: statü değişimi + template üretimi + (taksitliyse) receivable üretimi + audit.

---

## 21. Auth kararı: Better Auth (madde 11)

| Seçenek | 2FA/TOTP | Recovery code | Zorunlu 2FA | Yeniden doğrulama | Maliyet | Değerlendirme |
|---|---|---|---|---|---|---|
| **Auth.js (NextAuth)** | ❌ kendin yazarsın | ❌ kendin | ❌ kendin | ❌ kendin | Ücretsiz | Credentials akışı resmî olarak önerilmiyor; TOTP+recovery+zorunluluk ≈ 1-2 haftalık özel geliştirme ve güvenlik riski |
| **Better Auth** ✅ | ✅ `twoFactor` eklentisi hazır | ✅ hazır | ✅ eklenti ayarı | ⚠️ `freshAge` oturum tazeliği ile; hassas uçlarda ek kontrol bizde | Ücretsiz, self-host | TypeScript-first, Drizzle adaptörü var, kendi session/2FA tablolarını getirir |
| Clerk | ✅ hazır | ✅ | ✅ | ✅ | MAU başına ücretli | Finans verisi olan iç araçta kimliği dış SaaS'a bağlamak gereksiz bağımlılık |
| Supabase Auth | ✅ | ⚠️ | ⚠️ | ⚠️ | Ücretsiz katman | Supabase altyapısına bağlar; DB'yi kendimiz yönetiyoruz, uyumsuz |

**Karar: Better Auth** — e-posta+şifre, TOTP, recovery code ve oturum yönetimi hazır; Drizzle ile aynı PostgreSQL'de yaşar; dışa bağımlılık yok.

**Yine de bizde kalan özel geliştirme (bilinçli kabul):**
1. Rol bazlı yetki katmanı (Better Auth'un `admin` eklentisi basit; bizim marka-bazlı yetkiyi kendimiz yazacağız — zaten plandaydı)
2. "Süper Yönetici + Finans için 2FA zorunlu" kuralı: giriş sonrası middleware kontrolü (~yarım gün)
3. Hassas işlemde yeniden doğrulama: `freshAge` + kritik endpoint'lerde TOTP yeniden isteme (~1 gün)
4. Audit entegrasyonu: login/logout/failed olaylarını `audit_logs`'a köprüleme (~yarım gün)

---

## 22. Karar kaydı (v1.2'de KAPANDI)

Tüm açık sorular karara bağlanmıştır:

| # | Konu | Karar |
|---|---|---|
| 1 | Baz para birimi | **TRY.** `settings`'te tutulur ancak MVP arayüzünden değiştirilemez. |
| 2 | KDV | Varsayılan **%20**; hizmet veya işlem bazında değiştirilebilir. |
| 3 | Sözleşme no formatı | **`PRV-YYYY-0001`** onaylı. |
| 4 | Recurrence ufku | **90 gün.** |
| 5 | Geçmiş veri | **Son 6 ay** detaylı aktarılacak (Excel/CSV içe aktarma scripti sprint planında). |
| 6 | Çapraz kur önerisi | `exchange_rates` tablosundan önerilir, kullanıcı elle düzeltebilir. |
| 7 | Kredi kartı geçici çözümü | v0.2'ye ertelendi; MVP'de kart harcaması **ödendiği dönemde payable** olarak kaydedilir. |
