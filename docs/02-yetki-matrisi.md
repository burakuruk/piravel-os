# Piravel OS — Yetki Matrisi (MVP)

**Sürüm:** 1.0 · Şema v1.2 ile uyumlu
**Roller:** `super_admin` (SA) · `finance` (FIN) · `operations` (OPS) · `member` (MEM)

---

## 1. İlkeler

1. **Yetki API katmanında zorlanır.** UI'da butonu gizlemek yetki değildir; her endpoint kendi kontrolünü yapar.
2. **Finansal tutarlar varsayılan kapalıdır.** OPS ve MEM rollerine tutar alanları API yanıtından **çıkarılarak** gönderilir (maskeleme değil, hiç gönderilmeme — bkz. §5).
3. **Kapsam daraltması yetkiden ayrıdır.** OPS "brands: read" yetkisine sahiptir ama yalnızca `brand_users` ile atandığı markalar için (bkz. §4).
4. **Silme daima soft delete'tir**; `restore` ayrı bir işlemdir. Allocation'da ikisi de yok — yalnızca `reverse`.
5. Her tablo için ayrı CRUD endpoint gerekmez; kaynaklar **yönetim sınıfına** göre ayrılır (§2).

---

## 2. Kaynakların yönetim sınıfları

Şema v1.2'deki **tüm** tablolar sınıflandırılmıştır — matris dışında kaynak kalmaz:

| Sınıf | Kaynaklar | Açıklama |
|---|---|---|
| **A. Kullanıcı-CRUD** | brands, brand_contacts, services, contracts, contract_items, recurring_templates, receivables, payables, transactions, allocations, bank_accounts, vendors, tasks, attachments | Normal API kaynakları; §3 matrisi uygulanır. `allocations` özel: update/delete yok — yalnızca create + reverse |
| **B. Salt okunur / seed** | currencies, expense_categories | Seed ile gelir. `currencies`: yalnızca SA aktif/pasif yapar, yeni ekleme yok. `expense_categories`: SA ekleyebilir/düzenler, diğerleri okur |
| **C. Sistem yönetimli** | recurrence_rules, tax_lines, notifications, audit_logs | Doğrudan CRUD **yok**. `recurrence_rules` şablon/sözleşme kaydı içinde dolaylı yönetilir; `tax_lines` üretimde otomatik yazılır (FIN düzeltebilir); `notifications` job üretir (kullanıcı yalnızca okur/okundu işaretler); `audit_logs` append-only, API'den yalnızca okunur |
| **D. Yarı-sistem** | exchange_rates, settings, brand_users, users | `exchange_rates`: günlük besleme + FIN/SA manuel giriş; geçmiş kayıt değiştirilemez. `settings`: yalnızca SA; `base_currency` MVP UI'ından değiştirilemez. `brand_users`: SA + FIN atar. `users`: SA yönetir |
| **E. Better Auth sınırı** | sessions, 2FA kayıtları (twoFactor), account | **Bizim API'mizde CRUD tanımlanmaz.** Better Auth'un kendi uçları yönetir; sınırlar §6'da. Tek istisna: kullanıcı kendi oturum listesini görür ve iptal eder; SA herkesinkini iptal edebilir |

---

## 3. Ana yetki matrisi (Sınıf A + D kaynakları)

**Gösterim:** ✅ tam · 🔷 kapsamlı (yalnızca atandığı marka / kendi kaydı) · 👁 salt okuma · 💰 salt okuma ama tutar alanları çıkarılmış · ❌ yok

### 3.1 Marka ve müşteri

| Kaynak · İşlem | SA | FIN | OPS | MEM |
|---|---|---|---|---|
| brands · list/read | ✅ | ✅ | 🔷 | ❌ |
| brands · create | ✅ | ✅ | ❌ | ❌ |
| brands · update | ✅ | ✅ | 🔷 (finansal olmayan alanlar) | ❌ |
| brands · status değişimi | ✅ | ✅ | ❌ | ❌ |
| brands · delete/restore | ✅ | ❌ | ❌ | ❌ |
| brand_contacts · list/read | ✅ | ✅ | 🔷 | ❌ |
| brand_contacts · create/update | ✅ | ✅ | 🔷 | ❌ |
| brand_contacts · delete/restore | ✅ | ✅ | ❌ | ❌ |
| brand_users · list | ✅ | ✅ | 🔷 (kendi atamaları) | ❌ |
| brand_users · atama/kaldırma | ✅ | ✅ | ❌ | ❌ |

### 3.2 Hizmet ve sözleşme

| Kaynak · İşlem | SA | FIN | OPS | MEM |
|---|---|---|---|---|
| services · list/read | ✅ | ✅ | 💰 (fiyat/maliyet alanları çıkarılır) | ❌ |
| services · create/update/delete | ✅ | ✅ | ❌ | ❌ |
| contracts · list/read | ✅ | ✅ | 🔷💰 (kapsam görünür, tutarlar çıkarılır) | ❌ |
| contracts · create/update (draft) | ✅ | ✅ | ❌ | ❌ |
| contracts · **activate** | ✅ | ✅ | ❌ | ❌ |
| contracts · sonlandırma/iptal | ✅ | ✅ | ❌ | ❌ |
| contracts · delete/restore (yalnız draft) | ✅ | ❌ | ❌ | ❌ |
| contract_items · read | ✅ | ✅ | 🔷💰 | ❌ |
| contract_items · create/update/delete | ✅ | ✅ | ❌ | ❌ |
| recurring_templates · list/read | ✅ | ✅ | ❌ | ❌ |
| recurring_templates · create/update/deactivate | ✅ | ✅ | ❌ | ❌ |

### 3.3 Finans

| Kaynak · İşlem | SA | FIN | OPS | MEM |
|---|---|---|---|---|
| receivables · list/read | ✅ | ✅ | ❌ | ❌ |
| receivables · create (manuel) /update | ✅ | ✅ | ❌ | ❌ |
| receivables · cancel / **refund** | ✅ | ✅ | ❌ | ❌ |
| receivables · delete/restore | ✅ | ❌ | ❌ | ❌ |
| payables · list/read/create/update | ✅ | ✅ | ❌ | ❌ |
| payables · **approve** | ✅ | ✅ | ❌ | ❌ |
| payables · delete/restore | ✅ | ❌ | ❌ | ❌ |
| tax_lines · read | ✅ | ✅ | ❌ | ❌ |
| tax_lines · düzeltme (satır ekle/değiştir) | ✅ | ✅ | ❌ | ❌ |
| transactions · list/read/create/update | ✅ | ✅ | ❌ | ❌ |
| transactions · **link-brand** (avans-marka eşleme) | ✅ | ✅ | ❌ | ❌ |
| transactions · delete/restore | ✅ | ❌ | ❌ | ❌ |
| allocations · list/read | ✅ | ✅ | ❌ | ❌ |
| allocations · **create (allocate)** | ✅ | ✅ | ❌ | ❌ |
| allocations · **reverse** | ✅ | ✅ | ❌ | ❌ |
| bank_accounts · list/read | ✅ | ✅ | ❌ | ❌ |
| bank_accounts · create/update/deactivate | ✅ | ✅ | ❌ | ❌ |
| bank_accounts · **view_sensitive** (maskesiz IBAN) | ✅ | ✅ (audit'e yazılır) | ❌ | ❌ |
| vendors · list/read/create/update/delete | ✅ | ✅ | ❌ | ❌ |
| exchange_rates · read | ✅ | ✅ | ❌ | ❌ |
| exchange_rates · manuel giriş (yalnız bugün/geçmiş boş gün) | ✅ | ✅ | ❌ | ❌ |
| expense_categories · read | ✅ | ✅ | ❌ | ❌ |
| expense_categories · create/update | ✅ | ❌ | ❌ | ❌ |

### 3.4 Operasyon ve sistem

| Kaynak · İşlem | SA | FIN | OPS | MEM |
|---|---|---|---|---|
| tasks · list/read | ✅ | ✅ | 🔷 (atandığı markalar) | 🔷 (assignee=kendisi) |
| tasks · create | ✅ | ✅ | 🔷 | ❌ |
| tasks · update | ✅ | ✅ | 🔷 | 🔷 (yalnız durum değişimi) |
| tasks · delete/restore | ✅ | ❌ | 🔷 | ❌ |
| attachments · upload/read | ✅ | ✅ | 🔷 (finansal olmayan entity'ler) | 🔷 (kendi task'ları) |
| attachments · delete | ✅ | ✅ | 🔷 (kendi yükledikleri) | ❌ |
| notifications · kendi listesi/okundu | ✅ | ✅ | ✅ | ✅ |
| audit_logs · read | ✅ | 👁 (yalnız finans entity'leri) | ❌ | ❌ |
| users · list/read | ✅ | 👁 | 👁 (ad/rol, iletişim) | ❌ |
| users · create/update/rol/deactivate | ✅ | ❌ | ❌ | ❌ |
| settings · read | ✅ | 👁 | ❌ | ❌ |
| settings · update | ✅ | ❌ | ❌ | ❌ |
| currencies · read | ✅ | ✅ | ✅ | ✅ |
| currencies · aktif/pasif | ✅ | ❌ | ❌ | ❌ |
| dashboard · finans kartları | ✅ | ✅ | ❌ | ❌ |
| dashboard · iş/görev kartları | ✅ | ✅ | 🔷 | 🔷 |
| **export** (CSV, herhangi bir liste) | ✅ | ✅ (finans) | 🔷 (görev/marka, tutarsız) | ❌ |

---

## 4. Kapsam kuralları (satır seviyesi)

| Rol | Kural | Uygulama |
|---|---|---|
| OPS | Yalnızca `brand_users` tablosunda atandığı markaların kayıtlarını görür (brands, contacts, contracts-kapsam, tasks, attachments) | Her sorguya zorunlu `WHERE brand_id IN (SELECT brand_id FROM brand_users WHERE user_id = :me)` — ortak bir `scopeToBrands()` yardımcı fonksiyonuyla, elle değil |
| MEM | Yalnızca `assignee_id = kendisi` olan tasks + bu task'ların ekleri | `WHERE assignee_id = :me` |
| FIN | Marka kapsaması yok (tüm finans), ama kullanıcı/ayar yönetimi yok | — |
| SA | Kapsamsız | — |

---

## 5. Alan seviyesi çıkarma listesi (OPS/MEM yanıtlarından silinen alanlar)

Tutar içeren alanlar OPS ve MEM'e **hiç gönderilmez** (null/maskeli değil — JSON'dan çıkarılır; ayrı serializer profili):

| Kaynak | Çıkarılan alanlar |
|---|---|
| brands | `v_brand_payment_risk` alanları (risk rozeti OPS'a **tutarsız** gösterilir: yalnızca seviye, tutar yok) |
| services | `list_price_minor`, `min_price_minor`, `est_cost_minor` |
| contracts | `amount_minor`, `amount_base_minor`, `discount_minor`, `fx_rate`, `vat_included`, ödeme koşulları |
| contract_items | `unit_price_minor`, `total_minor`, `est_cost_minor` (miktar/kapsam kalır — OPS'un işi kapsam) |
| tasks | maliyet/süre tahmini alanları MEM'den çıkarılmaz (finansal değil) |

> Test zorunluluğu: sprint planındaki 12 kritik testten biri (rol ve alan seviyesi maskeleme) bu listeyi otomatik doğrular.

---

## 6. Kimlik doğrulama sınırı (Better Auth)

Bu akışlar **bizim API'mizde yeniden yazılmaz**; Better Auth uçları + bizim eklediğimiz kontroller:

| Akış | Kim yönetir | Bizim eklediğimiz |
|---|---|---|
| Giriş / çıkış | Better Auth | Başarılı/başarısız girişin `audit_logs`'a köprülenmesi |
| Şifre sıfırlama | Better Auth (e-posta akışı) | Audit kaydı |
| TOTP kurulumu + recovery code | Better Auth `twoFactor` eklentisi | SA + FIN için **zorunlu 2FA**: middleware, 2FA'sız SA/FIN oturumunu yalnızca 2FA kurulum sayfasına yönlendirir |
| Oturum listesi / iptal | Better Auth | Kullanıcı kendi oturumlarını görür/iptal eder; SA herkesin oturumunu iptal edebilir (audit'e yazılır) |
| Hassas işlem öncesi yeniden doğrulama | Better Auth `freshAge` (oturum tazeliği) | Kritik uçlarda (allocation reverse, refund, kullanıcı rolü değişimi, maskesiz IBAN, settings) taze oturum + gerekirse TOTP yeniden istenir |
| Rol saklama | Bizim `users.role` kolonumuz | Better Auth session'ına custom claim olarak eklenir; **her istekte DB'den doğrulanır** (session'daki role güvenilmez) |

---

## 7. Özel işlem → yetki eşlemesi (API dokümanıyla çapraz kontrol)

API'de tanımlı her özel işlemin matristeki karşılığı:

| Özel işlem | Matris satırı | İzinli roller |
|---|---|---|
| `contracts/:id/activate` | 3.2 activate | SA, FIN |
| `allocations` (create) | 3.3 allocate | SA, FIN |
| `allocations/:id/reverse` | 3.3 reverse | SA, FIN |
| `receivables/:id/refund` | 3.3 refund | SA, FIN |
| `transactions/:id/link-brand` | 3.3 link-brand | SA, FIN |
| `transactions/transfer` (iç virman) | 3.3 transactions create kapsamında | SA, FIN |
| `payables/:id/approve` | 3.3 approve | SA, FIN |
| `bank-accounts/:id/iban` (maskesiz) | 3.3 view_sensitive | SA, FIN (audit) |
| `*/export` | 3.4 export | rol bazlı, audit'e yazılır |
| `*/restore` | ilgili kaynağın restore satırı | çoğunlukla yalnız SA |
