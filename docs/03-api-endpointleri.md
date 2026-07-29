# Piravel OS — API Endpoint Listesi (MVP)

**Sürüm:** 1.0 · Şema v1.2 + Yetki Matrisi 1.0 ile uyumlu
**Taban:** Next.js App Router route handlers — `/api/v1/...`
**Kimlik:** Better Auth oturum çerezi; her handler'da oturum + rol + kapsam kontrolü

---

## 1. Genel standartlar

### 1.1 Hata sözleşmesi (tüm uçlar)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",        // makine-okur sabit
    "message": "Vade tarihi zorunludur", // kullanıcıya gösterilebilir (TR)
    "details": [{ "field": "due_date", "issue": "required" }],
    "request_id": "..."
  }
}
```

| HTTP | code örnekleri |
|---|---|
| 400 | `VALIDATION_ERROR`, `CURRENCY_MISMATCH`, `OVER_ALLOCATION` |
| 401 | `UNAUTHENTICATED`, `SESSION_STALE` (yeniden doğrulama gerekli) |
| 403 | `FORBIDDEN`, `BRAND_SCOPE`, `TWO_FA_REQUIRED` |
| 404 | `NOT_FOUND` (kapsam dışı kayıtlar da 404 döner — varlık sızdırılmaz) |
| 409 | `CONFLICT` (örn. aktif sözleşme silme, mükerrer kod) |
| 422 | `BUSINESS_RULE` (örn. aktif sözleşmesi olan marka silinemez) |

### 1.2 Liste standardı

- Sayfalama: `?page=1&per_page=50` (max 200); yanıt: `{ data: [...], meta: { page, per_page, total } }`
- Sıralama: `?sort=-due_date` (— öneki desc)
- Filtre: kaynak bazlı belgelenen query paramlar; ortak: `?q=` (arama), `?include_deleted=true` (yalnız SA, geri dönüşüm kutusu)
- Tüm tutarlar yanıtta minor unit (kuruş) integer; alan çıkarma kuralları yetki matrisi §5

### 1.3 Yazma standardı

- Gövde JSON; `Idempotency-Key` başlığı finansal POST'larda zorunlu (çift tıklama koruması)
- Her yazma, audit ile aynı DB transaction'ında
- Soft delete: `DELETE /{kaynak}/:id` → `deleted_at` set; `POST /{kaynak}/:id/restore`

---

## 2. Kimlik doğrulama sınırı (Better Auth — yeniden yazılmaz)

Better Auth kendi uçlarını `/api/auth/*` altında sunar. **Bu uçlar bizim API listemize dahil değildir**; aşağıdaki tablo hangi akışın nerede yaşadığını sabitler:

| Akış | Uç (Better Auth) | Bizim katkımız |
|---|---|---|
| Giriş (e-posta+şifre) | `POST /api/auth/sign-in/email` | Audit köprüsü (`login` / `login_failed`) |
| Çıkış | `POST /api/auth/sign-out` | Audit (`logout`) |
| Şifre sıfırlama | `POST /api/auth/forget-password` + reset akışı | Audit |
| TOTP kurulum / doğrulama | `POST /api/auth/two-factor/enable`, `.../verify-totp` | SA+FIN için zorunluluk middleware'i |
| Recovery code | `POST /api/auth/two-factor/generate-backup-codes` | — |
| Oturum listesi / iptal | `GET/POST /api/auth/list-sessions`, `revoke-session` | SA'nın başkasının oturumunu iptali: kendi ucumuz `POST /api/v1/users/:id/revoke-sessions` |
| Hassas işlem yeniden doğrulama | oturum `freshAge` kontrolü | Kritik uçlar `SESSION_STALE` (401) döner; UI TOTP/şifre yeniden doğrulatıp tekrar dener |

**Zorunlu 2FA middleware kuralı:** rolü SA/FIN olan ve `totp_enabled_at IS NULL` olan oturum, yalnızca 2FA kurulum uçlarına erişebilir; diğer tüm `/api/v1/*` istekleri `TWO_FA_REQUIRED` (403) alır.

---

## 3. Endpoint listesi

**Rol kısaltmaları:** SA, FIN, OPS, MEM — 🔷 = kapsamlı erişim (yetki matrisi §4), 💰 = tutar alanları çıkarılır

### 3.1 Markalar

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/brands` | Liste (filtre: `status`, `q`) | SA, FIN, OPS🔷 |
| POST | `/api/v1/brands` | Marka oluştur | SA, FIN |
| GET | `/api/v1/brands/:id` | Detay (+risk rozeti: `v_brand_payment_risk`) | SA, FIN, OPS🔷💰 |
| PATCH | `/api/v1/brands/:id` | Güncelle (OPS: finansal olmayan alanlar) | SA, FIN, OPS🔷 |
| POST | `/api/v1/brands/:id/status` | Yaşam döngüsü değişimi (gövde: `status`, `reason`) | SA, FIN |
| DELETE | `/api/v1/brands/:id` | Soft delete (aktif sözleşme varsa 422) | SA |
| POST | `/api/v1/brands/:id/restore` | Geri yükle | SA |
| GET | `/api/v1/brands/:id/contacts` | Yetkili kişiler | SA, FIN, OPS🔷 |
| POST | `/api/v1/brands/:id/contacts` | Yetkili ekle | SA, FIN, OPS🔷 |
| PATCH | `/api/v1/contacts/:id` | Yetkili güncelle | SA, FIN, OPS🔷 |
| DELETE | `/api/v1/contacts/:id` | Soft delete | SA, FIN |
| GET | `/api/v1/brands/:id/assignments` | Sorumlu ekip (yalnız atanmış OPS) | SA, FIN, OPS🔷 |
| POST | `/api/v1/brands/:id/assignments` | Kullanıcı ata (gövde: `userId`) | SA, FIN |
| DELETE | `/api/v1/brands/:id/assignments` | Atamayı kaldır (soft delete) | SA, FIN |
| GET | `/api/v1/brands/:id/assignments/candidates` | Atanabilir kullanıcılar (`q=`) — **yalnız aktif OPS** | SA, FIN |
| GET | `/api/v1/brands/:id/services` | Markanın aldığı hizmetler | SA, FIN, OPS🔷💰 |
| POST | `/api/v1/brands/:id/services` | Hizmet ekle (gövde: `serviceId`) | SA, FIN |
| DELETE | `/api/v1/brands/:id/services` | Hizmeti çıkar (soft delete) | SA, FIN |
| GET | `/api/v1/brands/export` | Filtreli CSV — audit `export`; OPS kapsam + vergi sütunları çıkarılmış | SA, FIN, OPS🔷 |

> **Sprint 2 notu.** Atama ucu `:id/users` değil `:id/assignments`'tır ve
> `brand_assignments` tablosuna yazar (0010). `PUT` ile liste değiştirme yerine
> tek tek `POST`/`DELETE` kullanılır: her atama ayrı bir yetki olayıdır ve
> denetim izinde tek tek görünmelidir. `DELETE /api/v1/services/:id` **yoktur**
> — hizmet silinmez, `PATCH … {isActive:false}` ile pasifleştirilir.

### 3.2 Hizmetler ve sözleşmeler

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/services` | Katalog | SA, FIN, OPS💰 |
| POST | `/api/v1/services` | Hizmet tanımla | SA, FIN |
| PATCH | `/api/v1/services/:id` | Güncelle | SA, FIN |
| DELETE | `/api/v1/services/:id` | Soft delete | SA, FIN |
| GET | `/api/v1/contracts` | Liste (filtre: `brand_id`, `status`, `expiring_within`) | SA, FIN, OPS🔷💰 |
| POST | `/api/v1/contracts` | Taslak oluştur (no otomatik: `PRV-YYYY-NNNN`) | SA, FIN |
| GET | `/api/v1/contracts/:id` | Detay + kalemler + (SA/FIN) üretilmiş receivable özeti | SA, FIN, OPS🔷💰 |
| PATCH | `/api/v1/contracts/:id` | Güncelle (yalnız draft serbest; aktif sözleşmede sınırlı alanlar) | SA, FIN |
| **POST** | `/api/v1/contracts/:id/activate` | **Aktivasyon:** statü + şablon üretimi + (taksitliyse) receivable üretimi — tek DB tx | SA, FIN |
| POST | `/api/v1/contracts/:id/end` | Sonlandır (gövde: `end_reason`; şablon deaktive edilir, vadesiz satırlar onayla iptal) | SA, FIN |
| DELETE | `/api/v1/contracts/:id` | Soft delete (yalnız draft; 422 aksi hâlde) | SA |
| PUT | `/api/v1/contracts/:id/items` | Kapsam kalemlerini topluca güncelle (toplam ≠ tutar → yanıtta `warnings[]`) | SA, FIN |

### 3.3 Tekrarlayan şablonlar

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/recurring-templates` | Liste (filtre: `target_type`, `is_active`) | SA, FIN |
| POST | `/api/v1/recurring-templates` | Bağımsız şablon (tekrarlayan gider/gelir) — kural + şablon tek gövdede | SA, FIN |
| PATCH | `/api/v1/recurring-templates/:id` | Güncelle (yalnız gelecekteki üretimi etkiler) | SA, FIN |
| POST | `/api/v1/recurring-templates/:id/deactivate` | Durdur | SA, FIN |

> `recurrence_rules` için ayrı uç yoktur — kural, şablon/sözleşme gövdesinin `recurrence` alt nesnesi olarak yönetilir (sistem yönetimli sınıf C).

### 3.4 Alacaklar ve borçlar

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/receivables` | Liste (filtre: `brand_id`, `status`, `due_from/to`, `overdue=true`) — yanıt `v_receivable_totals` alanlarıyla (net, vergi, brüt, kalan) | SA, FIN |
| POST | `/api/v1/receivables` | Manuel alacak (KDV satırı otomatik; `tax_lines` override edilebilir) | SA, FIN |
| GET | `/api/v1/receivables/:id` | Detay + tax_lines + allocation geçmişi | SA, FIN |
| PATCH | `/api/v1/receivables/:id` | Güncelle (tahsilatı olan kayıtta tutar değişimi 422) | SA, FIN |
| POST | `/api/v1/receivables/:id/cancel` | İptal | SA, FIN |
| **POST** | `/api/v1/receivables/:id/refund` | **İade akışı:** allocation'ları reverse et + `refund_of_transaction_id` bağlı çıkış hareketi + statü `refunded` — tek DB tx; taze oturum ister | SA, FIN |
| DELETE / POST restore | `/api/v1/receivables/:id` / `.../restore` | Soft delete / geri yükle (tahsilatlıysa 422) | SA |
| GET | `/api/v1/payables` | Liste (filtreler simetrik + `approval=pending`) | SA, FIN |
| POST | `/api/v1/payables` | Gider kaydı | SA, FIN |
| GET / PATCH | `/api/v1/payables/:id` | Detay / güncelle | SA, FIN |
| POST | `/api/v1/payables/:id/approve` | Onay | SA, FIN |
| POST | `/api/v1/payables/:id/cancel` | İptal | SA, FIN |
| DELETE / restore | `/api/v1/payables/:id` | Soft delete / geri yükle | SA |
| POST | `/api/v1/receivables/:id/tax-lines` · `/api/v1/payables/:id/tax-lines` | Vergi satırı düzeltme (kdv oranı değişimi, ileride tevkifat) | SA, FIN |

### 3.5 Banka, hareketler, eşleştirme

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/bank-accounts` | Liste + hesaplanmış güncel bakiye | SA, FIN |
| POST | `/api/v1/bank-accounts` | Hesap tanımla | SA, FIN |
| PATCH | `/api/v1/bank-accounts/:id` | Güncelle / pasife al | SA, FIN |
| GET | `/api/v1/bank-accounts/:id/iban` | **Maskesiz IBAN** — audit'e `view_sensitive`; taze oturum ister | SA, FIN |
| GET | `/api/v1/transactions` | Liste (filtre: `account_id`, `direction`, `date_from/to`, `unallocated=true`, `brand_id`) | SA, FIN |
| POST | `/api/v1/transactions` | Manuel hareket (para birimi hesapla uyuşmazsa 400 `CURRENCY_MISMATCH`) | SA, FIN |
| POST | `/api/v1/transactions/transfer` | **İç virman:** iki hareket + `transfer_pair_id`, tek tx (döviz bozdurma dahil) | SA, FIN |
| PATCH | `/api/v1/transactions/:id` | Güncelle (allocation'lıysa tutar değişimi 422) | SA, FIN |
| **POST** | `/api/v1/transactions/:id/link-brand` | Sahipsiz tahsilatı markaya bağla (gövde: `brand_id`) | SA, FIN |
| DELETE / restore | `/api/v1/transactions/:id` | Soft delete (aktif allocation varsa 422 → önce reverse) | SA |
| GET | `/api/v1/advances` | **Müşteri avansları:** `direction='in' AND unallocated>0`, marka bazlı gruplu; `brand_id IS NULL` olanlar "sahipsiz" bölümünde | SA, FIN |
| **POST** | `/api/v1/allocations` | **Eşleştirme:** gövde `{ transaction_id, receivable_id|payable_id, tx_amount_minor, ob_amount_minor, fx_rate }`; çapraz kurda öneri `exchange_rates`'ten gelir, elle düzeltilebilir; FOR UPDATE'li tek tx; aşırı tahsis 400 `OVER_ALLOCATION` | SA, FIN |
| **POST** | `/api/v1/allocations/:id/reverse` | Ters kayıt (gövde: `reversal_reason` zorunlu); taze oturum ister | SA, FIN |
| GET | `/api/v1/exchange-rates?date=&currency=` | Kur sorgula (eşleştirme ekranı önerisi) | SA, FIN |
| POST | `/api/v1/exchange-rates` | Manuel kur girişi (var olan gün 409) | SA, FIN |

### 3.6 İşler (tasks)

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/tasks` | Liste (filtre: `brand_id`, `assignee_id`, `status`, `overdue=true`) | SA, FIN, OPS🔷, MEM🔷 |
| POST | `/api/v1/tasks` | İş oluştur | SA, FIN, OPS🔷 |
| GET / PATCH | `/api/v1/tasks/:id` | Detay / güncelle (MEM: **yalnız `status`** — yorum sistemi MVP dışıdır, backlog v0.2) | SA, FIN, OPS🔷, MEM🔷 |
| DELETE / restore | `/api/v1/tasks/:id` | Soft delete / geri yükle | SA, OPS🔷 |

### 3.7 Dosyalar

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| POST | `/api/v1/attachments` | Yükleme başlat (gövde: entity_type/id, dosya meta) → imzalı PUT URL | matris 3.4 |
| GET | `/api/v1/attachments/:id/url` | 15 dk imzalı indirme URL'i — audit `download` | matris 3.4 |
| DELETE | `/api/v1/attachments/:id` | Soft delete | matris 3.4 |

### 3.8 Dashboard, bildirim, denetim, yönetim

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/dashboard` | Tek uçta tüm kartlar; rol bazlı bölümler — OPS/MEM yanıtında finans kartları **hiç yoktur** | tümü (rol filtreli) |
| GET | `/api/v1/search?q=` | **Global arama (⌘K).** Sonuçlar **API seviyesinde** rol+kapsam filtrelidir (UI gizlemesi değil): SA/FIN → tüm kayıtlar + finansal tutarlar; OPS → yalnız atandığı markalar, sözleşme kapsamı (tutarsız) ve görevler; MEM → yalnız kendi görevleri. Tutar araması (`36.500`) yalnız SA/FIN'de çalışır | tümü (rol filtreli) |
| GET | `/api/v1/notifications` | Kendi bildirimleri (`unread=true`) | tümü |
| POST | `/api/v1/notifications/read` | Okundu işaretle (gövde: id listesi) | tümü |
| GET | `/api/v1/audit-logs` | Filtreli okuma (`entity_type`, `entity_id`, `actor_id`, tarih) | SA, FIN👁 (yalnız finans entity'leri) |
| GET | `/api/v1/users` | Kullanıcı listesi | SA (FIN/OPS: kısıtlı okunur alanlar) |
| POST / PATCH | `/api/v1/users`, `/api/v1/users/:id` | Kullanıcı oluştur/güncelle/rol | SA |
| POST | `/api/v1/users/:id/revoke-sessions` | Kullanıcının tüm oturumlarını iptal et — audit | SA |
| GET / PATCH | `/api/v1/settings` | Ayarlar (`base_currency` PATCH gövdesinde kabul edilmez — 400) | SA (FIN👁) |
| GET | `/api/v1/expense-categories` | Kategori listesi | SA, FIN |
| POST / PATCH | `/api/v1/expense-categories` | Kategori yönetimi | SA |
| GET | `/api/v1/vendors` + CRUD | Tedarikçiler | SA, FIN |
| GET | `/api/v1/currencies` | Para birimleri | tümü |
| GET | `/api/v1/trash?entity_type=` | Geri dönüşüm kutusu | SA |

### 3.9 Dışa/içe aktarma

| Metot | Yol | Amaç | Roller |
|---|---|---|---|
| GET | `/api/v1/{kaynak}/export?format=csv` | Filtreli CSV — audit `export`; OPS yalnız görev/marka ve tutarsız | matris 3.4 |
| POST | `/api/v1/import/transactions` | CSV içe aktarma — **yalnızca 6 aylık kontrollü veri göçü için**: `import_batch_id`, `external_id` mükerrer engeli; `brand_id` eşleşmeyenler sahipsiz kalır → mutabakat ekranı. Sürekli banka ekstresi aktarımı ve banka formatı eşleyicileri MVP dışıdır (backlog) | SA, FIN |
| POST | `/api/v1/import/receivables` · `/payables` | 6 aylık geçmiş veri göçü uçları (göç scripti bunları kullanır) | SA |

### 3.10 Zamanlanmış görev

| Metot | Yol | Amaç | Güvenlik |
|---|---|---|---|
| POST | `/api/cron/daily` | Günlük job: overdue işaretleme → recurrence üretimi → bildirim üretimi → özet e-posta | `CRON_SECRET` bearer; **idempotent** — aynı gün ikinci çağrı mükerrer satır/bildirim üretmez (`uq_*_source` + `dedupe_key` garantisi); yanıtta üretilen kayıt sayıları |

---

## 4. Çapraz kontrol notları

- §3'teki her özel işlem (`activate`, `allocate`, `reverse`, `refund`, `link-brand`, `approve`, `view_sensitive`/iban, `export`, `restore`) yetki matrisi §7 tablosuyla birebir eşleşir.
- `transfer` ucu yalnızca iç virman üretir (`transfer_pair_id`); `refund` ucu yalnızca `refund_of_transaction_id` üretir — iki bağ alanı asla aynı uçta yazılmaz.
- Kapsam dışı kayıtlara 404 dönülür (403 değil) — varlık bilgisi sızdırılmaz.
- Taze oturum isteyen uçlar: `refund`, `reverse`, `iban`, `users` yazma, `settings` yazma.
