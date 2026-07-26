# Piravel OS — MVP Ürün Gereksinim Dokümanı (PRD)

**Sürüm:** 1.1 (MVP)
**Tarih:** 2026-07-22 · **Onay tarihi:** 26.07.2026
**Sahip:** Ahmet Burak
**Durum:** Onaylandı — Sprint 0 geliştirmesine hazır

---

## 1. Özet

Piravel OS, Piravel'in müşteri, sözleşme, finans ve operasyon takibini tek merkezden yöneten iç kullanıma yönelik bir web uygulamasıdır.

MVP'nin tek bir net amacı vardır:

> **"Kime ne söz verdik, kimden ne kadar alacağız, ne kadarını tahsil ettik, bu ay elimizde ne kalıyor?"** sorularını 5 saniyede cevaplamak.

Bu sorulara cevap veremeyen hiçbir özellik MVP'ye girmez.

### Ürün konumlandırma

- **Tek kiracı (single-tenant).** Sadece Piravel kullanır. SaaS planı yok.
- **İç araç.** Müşteri erişimi yoktur (v3'e ertelendi).
- **Kayıt sistemi (system of record).** Excel ve WhatsApp'taki dağınık finans bilgisinin yerini alır.

---

## 2. Problem tanımı

Bugün Piravel'de aşağıdaki bilgiler farklı yerlerde (Excel, WhatsApp, e-posta, akıl) duruyor:

| Problem | Sonucu |
|---|---|
| Beklenen tahsilat listesi merkezi değil | Gecikmiş alacak fark edilmiyor, tahsilat geç yapılıyor |
| Sözleşme kapsamı yazılı takip edilmiyor | Kapsam dışı iş bedelsiz yapılıyor (scope creep) |
| Sözleşme bitiş/yenileme tarihi takip edilmiyor | Zamsız devam eden sözleşmeler, kaçan yenileme |
| Gider ve gelir aynı yerde toplanmıyor | Aylık net kâr ancak dönem sonunda tahminen biliniyor |
| Döviz bazlı işlerde kur farkı hesaplanmıyor | Kârlılık raporu yanlış |
| Domain/hosting/abonelik yenilemesi hatırlanmıyor | Site kapanması, müşteri kaybı riski |

### Başarı kriterleri (MVP çıktıktan 60 gün sonra ölçülecek)

| Metrik | Hedef |
|---|---|
| Finans kayıtlarının sistemde tutulma oranı | %100 (Excel tamamen kapanır) |
| Ortalama tahsilat gecikmesi | Mevcut duruma göre **%30 azalma** |
| Gözden kaçan sözleşme yenilemesi | **0** |
| Aylık kâr/zarar raporunu çıkarma süresi | < 1 dakika (bugün: saatler) |
| Yeni gelir/gider kaydı girme süresi | < 30 saniye |

---

## 3. Kullanıcılar ve roller

MVP'de 4 rol vardır. Rol sayısı bilinçli olarak düşük tutulmuştur; ihtiyaç doğdukça bölünür.

| Rol | Kim | Temel ihtiyacı |
|---|---|---|
| **Süper Yönetici** | Ahmet Burak | Her şeyi görür ve değiştirir. Sistem ayarları, kullanıcı yönetimi, denetim günlüğü. |
| **Finans** | Muhasebe/finans sorumlusu | Gelir, gider, tahsilat, banka hesapları. Marka ve sözleşmeleri görür ama silemez. |
| **Operasyon** | Müşteri/proje yöneticisi | Atandığı markalar, sözleşme kapsamı, işler. **Tutarları göremez.** |
| **Ekip Üyesi** | Tasarımcı, yazılımcı, freelancer | Sadece kendisine atanan işler. Finans tamamen kapalı. |

> **Tasarım ilkesi:** Finansal tutarlar varsayılan olarak **kapalıdır**. Bir rol tutar görecekse bu açıkça verilmiş bir yetkidir, kapalı olması istisna değildir.

---

## 4. MVP kapsamı

### 4.1 Kapsam içi (IN)

| # | Modül | Kapsam |
|---|---|---|
| 1 | **Kimlik & Yetki** | E-posta+şifre girişi, 2FA (TOTP), oturum yönetimi, 4 rol, marka bazlı atama |
| 2 | **Marka & Yetkili** | Marka CRUD, durum takibi, çoklu yetkili kişi, marka-kullanıcı ataması |
| 3 | **Hizmet Kataloğu** | Hizmet tanımları, liste fiyatı, min. fiyat, tahmini maliyet, tek seferlik/aylık |
| 4 | **Sözleşme** | Sözleşme CRUD, kapsam kalemleri (miktar dahil), fiyatlandırma modeli, dosya eki |
| 5 | **Beklenen Ödeme Planı** | Sözleşmeden otomatik taksit/ay üretimi, recurring motoru |
| 6 | **Tahsilat** | Gerçek para girişi, kısmi ödeme, çoklu eşleştirme, gecikmiş alacak |
| 7 | **Gider** | Gider kaydı, kategori, tedarikçi, tekrarlayan gider, marka ilişkisi |
| 8 | **Banka & Kasa** | Hesap tanımı, bakiye takibi, manuel hareket girişi, mutabakat |
| 9 | **Çoklu Para Birimi** | TRY/USD/EUR, kur tablosu, kur farkı hesabı |
| 10 | **Bildirim** | Yaklaşan tahsilat/ödeme/sözleşme, panel içi + e-posta, günlük job |
| 11 | **Basit İş Takibi** | Marka, başlık, sorumlu, teslim tarihi, durum, öncelik |
| 12 | **Dashboard** | Beklenen gelir, tahsil edilen, gecikmiş alacak, gider, net nakit, yaklaşan ödemeler, geciken işler |
| 13 | **Denetim & Kurtarma** | Audit log, soft delete, geri dönüşüm kutusu |

### 4.2 Kapsam dışı (OUT) — ama veri modeli hazır olacak

| Özellik | Neden ertelendi | Şemada bırakılan kanca |
|---|---|---|
| Müşteri paneli | Önce iç kullanım oturmalı | `users.brand_id` (nullable), `is_client_visible` bayrakları |
| Meta/Google Ads API | Onay süreci aylar sürer | `brands.external_refs` (JSONB) |
| e-Fatura / e-Arşiv | Entegratör seçimi yapılmadı | `receivables` üzerinde fatura alanları + `invoice_no` |
| Tevkifat / stopaj | Vergi kuralları netleşmeli | `tax_lines` tablosu şemada var, MVP'de tek satır KDV kullanılır |
| İçerik takvimi | Operasyon v2 | `tasks` tablosu genişletilebilir |
| Gelişmiş proje yönetimi | Basit iş takibi yeterli | `tasks.parent_id`, `project_id` (nullable) |
| AI özetler | Önce temiz veri birikmeli | Tüm veri normalize; ek şema gerekmez |
| Banka entegrasyonu | Manuel/CSV yeterli | `transactions.import_batch_id`, `external_id` |
| WhatsApp/Telegram bildirim | E-posta yeterli | `notifications.channel` enum genişletilebilir |
| Doküman versiyonlama | Basit ek yeterli | `attachments.version`, `replaces_id` |

### 4.3 Açıkça yapılmayacaklar (NON-GOALS)

- ❌ **Şifre kasası.** Banka/e-posta şifreleri sistemde **hiçbir biçimde** tutulmaz. Bitwarden/1Password kullanılır. Sistemde en fazla "şifre kasada" notu bulunur.
- ❌ **Resmî muhasebe defteri.** Bu bir ön muhasebe/yönetim aracıdır, mali müşavirin yerine geçmez.
- ❌ **Otomatik para transferi.** Sistem para göndermez, sadece kayıt tutar.
- ❌ **Multi-tenant mimari.** Tek şirket. Gerekirse sonra refactor edilir.

---

## 5. Modüller ve kullanıcı akışları

### 5.1 Ana akış: Tekliften tahsilata

```
Marka oluştur (durum: lead)
        ↓
Hizmetleri seç → Sözleşme oluştur (draft)
        ↓
Sözleşme kapsam kalemleri gir (12 post, 8 story, 4 reels…)
        ↓
Fiyatlandırma + tekrarlama kuralı tanımla (aylık 30.000 TL, her ayın 5'i)
        ↓
Sözleşmeyi AKTİFLEŞTİR
        ↓
  ┌──────────────────────────────────────────────────────┐
  │ Sistem OTOMATİK üretir:                              │
  │ • 12 aylık recurrence kuralı + tekrarlama şablonu    │
  │ • Önümüzdeki 90 GÜNLÜK pencerenin beklenen tahsilat  │
  │   satırları (günlük job pencereyi sürekli ileri taşır)│
  │ • Marka durumu → active                              │
  │ • Yenileme hatırlatması (bitiş - 30 gün)             │
  └──────────────────────────────────────────────────────┘
        ↓
Her ay: vade yaklaşınca bildirim → Para gelince tahsilat kaydı
        ↓
Tahsilat, beklenen ödeme satırıyla EŞLEŞTİRİLİR (tam / kısmi / çoklu)
        ↓
Kalan bakiye 0 → satır "ödendi"; vade geçti ve bakiye var → "gecikti"
```

**Kritik kural:** Beklenen ödeme (`receivable`) ile gerçek para hareketi (`transaction`) **asla aynı kayıt değildir**. Aralarındaki bağ `allocation` tablosuyla kurulur. Bu ayrım tahsilat oranı, gecikme analizi ve nakit akışı raporlarının tamamının temelidir.

### 5.2 Akış: Kısmi ödeme

```
Beklenen: 30.000 TL (vade 5 Ağustos)
  → 10 Ağustos: 18.000 TL geldi
      Tahsilat kaydı oluştur → beklenen satıra eşleştir
      Durum: "kısmen ödendi", kalan 12.000 TL, gecikme 5 gün
  → 20 Ağustos: 12.000 TL geldi
      Aynı satıra ikinci eşleştirme
      Durum: "ödendi", ortalama gecikme kaydedilir
```

### 5.3 Akış: Tek ödeme, çok fatura

```
Müşteri 90.000 TL gönderdi (3 aylık borcunu kapattı)
  → Tek transaction kaydı
  → 3 farklı receivable satırına 30.000'er TL eşleştirilir
```

### 5.4 Akış: Döviz bazlı sözleşme + kur farkı

```
Sözleşme: aylık 1.000 USD
Beklenen satır üretilirken   → kur 34,20 → base 34.200 TL kaydedilir
Para geldiğinde (1.000 USD)  → kur 35,10 → base 35.100 TL kaydedilir
                    KUR FARKI = +900 TL (kur geliri)
```

Kur farkı ayrı bir tablo değildir; `receivable.amount_base_minor` ile eşleşen `allocation.amount_base_minor` arasındaki fark olarak **türetilir** ve raporda "kur farkı geliri/gideri" satırı olarak gösterilir. Bu sayede marka kârlılığı gerçeği yansıtır.

### 5.5 Akış: Tekrarlayan gider

```
Adobe CC — aylık 2.400 TL, her ayın 15'i, süresiz
  → recurrence_rule tanımlanır
  → Günlük job, ufuk penceresi (90 gün) içindeki payable satırlarını üretir
  → Vade - 3 gün: bildirim
  → Ödeme yapılınca transaction (out) → payable'a eşleştirilir
```

### 5.6 Akış: Günlük bildirim job'ı

Her sabah 08:00'de tek bir zamanlanmış görev çalışır ve şunları yapar:

1. Vadesi geçmiş `receivable`/`payable` satırlarını **overdue** olarak işaretler
2. Recurring kurallardan ufuk penceresindeki eksik satırları üretir
3. Bildirim üretir:
   - Tahsilat vadesine 7 / 3 / 1 gün kaldı
   - Tahsilat 1 / 7 / 15 / 30 gün gecikti
   - Ödeme vadesine 3 / 1 gün kaldı
   - Sözleşme bitişine 60 / 30 / 7 gün kaldı
   - İş teslim tarihi geçti
4. Aynı gün aynı olay için **tekrar bildirim üretmez** (idempotency anahtarı)
5. Panel içi bildirim + günlük tek özet e-posta gönderir

> **Tasarım ilkesi:** Job **idempotent** olmalıdır. İki kez çalışırsa mükerrer kayıt veya mükerrer bildirim üretmemelidir.

### 5.7 Dashboard içeriği

| Kart | Hesaplama |
|---|---|
| Bu ay beklenen gelir | Vadesi bu ay olan receivable toplamı (base) |
| Tahsil edilen | Bu ay gerçekleşen `in` yönlü transaction toplamı |
| Gecikmiş alacak | Vadesi geçmiş, bakiyesi > 0 receivable toplamı (yaş grupları: 1-30 / 31-60 / 60+) |
| Bu ay gider | Bu ay gerçekleşen `out` yönlü transaction toplamı |
| Net nakit hareketi | Tahsil edilen − gider |
| Toplam bakiye | Aktif hesapların güncel bakiye toplamı (base) |
| Yaklaşan ödemeler | Önümüzdeki 30 gün payable listesi |
| Yaklaşan tahsilatlar | Önümüzdeki 30 gün receivable listesi |
| Süresi dolacak sözleşmeler | 60 gün içinde bitecekler |
| Geciken işler | Teslim tarihi geçmiş, tamamlanmamış tasks |

Operasyon ve Ekip Üyesi rollerinde finans kartları **hiç render edilmez** (sadece gizlenmez — API de veri döndürmez).

---

## 6. Fonksiyonel olmayan gereksinimler

### 6.1 Para ve hesaplama

| Kural | Gerekçe |
|---|---|
| Tüm tutarlar **integer, minor unit (kuruş)** olarak saklanır | Float yuvarlama hatası finansal sistemde kabul edilemez |
| Her tutarın yanında **para birimi + kur + baz tutar** saklanır | Geçmişe dönük rapor, o günkü kuru yansıtmalı |
| Baz para birimi **TRY**; `settings`'te tutulur, MVP arayüzünden **değiştirilemez** | Tek yerden yönetim, yanlışlıkla değişme riski yok |
| Kur, kaydın **oluştuğu andaki** kurdur; geriye dönük değişmez | Muhasebe ilkesi |
| Toplama/çıkarma yalnızca **baz para biriminde** yapılır | Farklı kurlar toplanamaz |

### 6.2 Veri bütünlüğü

- **Soft delete zorunlu.** Finansal kayıtlar asla fiziksel silinmez. `deleted_at` + `deleted_by_id`.
- **Geri dönüşüm kutusu.** Silinen kayıt 90 gün geri yüklenebilir.
- **Audit log değiştirilemez.** Append-only; uygulama kullanıcısında UPDATE/DELETE yetkisi yoktur.
- **Tahsilat eşleştirmesi aşırı olamaz.** Bir receivable'a tahsis edilen toplam, tutarını aşamaz (DB kısıtı + uygulama kontrolü).
- **Aktif sözleşme silinemez.** Önce sonlandırılır.

### 6.3 Güvenlik

| Gereksinim | MVP'de nasıl |
|---|---|
| 2FA | **Zorunlu:** super_admin, finance · **İsteğe bağlı:** operations, member.<br>Rol yalnızca *zorunluluğu* belirler: 2FA kuran **her** kullanıcı aynı güvenli kurulum akışını (kopyala/indir → onay → rastgele kurtarma kodu doğrulaması) tamamlar. Rol bazında zayıf kurulum yolu yoktur |
| Şifre saklama | Argon2id hash. Düz metin **asla** |
| IBAN | Uygulama katmanında şifreli saklanır, UI'da maskeli (`TR** **** **** 1234`), tam görüntüleme audit'e yazılır |
| Oturum | 12 saat, hassas işlemde yeniden doğrulama |
| Yetki | API katmanında zorunlu — UI gizleme yeterli değildir |
| Dosya erişimi | İmzalı, süreli URL (15 dk) |
| Yedek | Günlük otomatik DB yedeği + **aylık geri yükleme testi** |
| Şifre kasası | **Yok.** Harici parola yöneticisi kullanılır |

#### 2FA sırlarının ele alınması — pazarlıksız kurallar

TOTP secret, QR içeriği (`otpauth://` URI) ve kurtarma kodları **en yüksek hassasiyetteki verilerdir**. Aşağıdakiler ihlal kabul edilir:

| Kural | Gerekçe |
|---|---|
| **Loglara yazılmaz** — uygulama logu, erişim logu, DB sorgu logu dahil | Log dosyaları çoğu ihlalde ilk sızan yerdir |
| **Sentry'ye gönderilmez** — hata mesajı, breadcrumb, extra context veya request gövdesinde | Hata izleme servisi üçüncü taraftır |
| **Analytics'e gönderilmez** — hiçbir olay, özellik veya sayfa parametresinde | — |
| **Ekran görüntüsü otomasyonuna girmez** — `scripts/screenshots.mjs` ve benzeri araçlar yalnız sahte/placeholder değer görür | Görseller repoda commit edilir |
| **`audit_logs`'a yazılmaz** — 2FA kurulumu olay olarak kaydedilir, **sırrın kendisi asla** | Audit log kalıcı ve silinemezdir |
| **Kurtarma kodları hash'li saklanır** (Argon2id), düz metin tutulmaz | Şifreyle aynı hassasiyet |
| **Kurulumdan sonra yeniden açık gösterilmez** — yalnız üretim anında bir kez | Ekranda kalan sır ekran paylaşımında sızar |
| **Yenilenirse eski kodlar geçersiz olur** — tamamı iptal, tek işlemde | Kısmi geçerlilik kafa karışıklığı ve açık bırakır |
| **Wireframe ve `docs/previews/` yalnız sahte değer içerir** — e-posta `example.com`, parola/anahtar/kod `sahte`/`test` ön ekli, tek kaynaktan (`SAHTE` sabiti) | Görseller ve wireframe kodu repoda kalıcıdır; gerçek bir değer sızarsa geri alınamaz |
| TOTP secret DB'de **şifreli** saklanır (`users.totp_secret`) | Veritabanı yedeği sızsa bile kullanılamaz |

Uygulamada: sır taşıyan alanlar için ortak bir `redact()` yardımcı fonksiyonu kullanılır ve Sentry `beforeSend` kancasında bu alanlar temizlenir. Bu, Sprint 1'in kabul kriterlerindendir.

### 6.4 Performans ve ölçek

Gerçekçi hedef ölçek (3 yıl sonrası tahmini):

| Varlık | Beklenen adet |
|---|---|
| Kullanıcı | < 20 |
| Marka | < 300 |
| Sözleşme | < 1.000 |
| Beklenen ödeme satırı | < 50.000 |
| Para hareketi | < 100.000 |

> Bu ölçekte tek bir PostgreSQL örneği fazlasıyla yeterlidir. **Erken optimizasyon, cache katmanı, mikroservis, event sourcing gerekmez.** Doğru index'li normalize şema yeterlidir.

Hedefler: sayfa yükleme < 1s, dashboard < 500ms, günlük job < 30s.

**Kesinleşen operasyonel parametreler:**
- Recurrence ufku: **90 gün**
- Geçmiş veri: yayına geçişte **son 6 ayın** gelir/gider kayıtları detaylı aktarılır (Excel/CSV içe aktarma scripti)
- Kredi kartı: MVP'de modellenmiyor (v0.2); kart harcamaları ödendiği dönemde payable olarak kaydedilir

### 6.5 Kullanılabilirlik

- Türkçe arayüz (i18n altyapısı kurulu, tek dil)
- Tarih formatı `GG.AA.YYYY`, tutar `1.234.567,89 ₺`
- Masaüstü öncelikli, mobilde okunabilir (responsive)
- Görsel kimlik ve tüm ekran tasarım kuralları: `06-ui-ux-tasarim-sistemi.md` (Premium Corporate + Editorial Finance; lacivert `#191E38`, altın `#A58950`, sıcak beyaz `#FAF9F6`; shadcn/ui yalnız davranış altyapısı olarak, tamamen özelleştirilmiş)
- Her liste: arama + filtre + CSV dışa aktarım (dışa aktarım audit'e yazılır)

---

## 7. Teknoloji önerisi

| Katman | Öneri | Gerekçe |
|---|---|---|
| Veritabanı | **PostgreSQL 16** | `numeric`, güçlü transaction, JSONB, partial index. Finans için tartışmasız. |
| Backend | **Next.js (App Router) + TypeScript** — API Route/Server Actions | Tek dil, tek repo, tek deploy. Solo geliştirici için en düşük sürtünme. |
| ORM | **Drizzle ORM** | Tip güvenli migration; Better Auth adaptörüyle doğal uyum |
| Frontend | React + Tailwind + shadcn/ui | Hızlı, kurumsal görünüm |
| Auth | **Better Auth** (e-posta+şifre, `twoFactor` eklentisi: TOTP + recovery code) | 2FA'yı kendin yazma; Drizzle adaptörüyle aynı PostgreSQL'de yaşar. Karşılaştırma: şema dokümanı §21 |
| Job | Günlük cron (Vercel Cron / systemd timer) | Kuyruk altyapısı gereksiz |
| Dosya | S3 uyumlu depolama (R2/Spaces) | İmzalı URL desteği |
| Hata takibi | Sentry | Tek kişilik ekipte şart |

> **Alternatif:** Laravel + PostgreSQL. Türkiye'de e-fatura entegratör paketleri Laravel ekosisteminde daha olgun. Eğer 12 ay içinde e-fatura kesinse Laravel'i tercih et. **Veritabanı şeması her iki seçenekte de aynıdır** — bu karar şemayı etkilemez.

---

## 8. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Kapsam şişmesi | Proje bitmez | Bu PRD'nin "OUT" listesi kilittir. Yeni istek → backlog, MVP'ye girmez |
| Tek geliştirici, tek nokta | Proje durur | Her sprint sonunda çalışan sürüm; dokümantasyon güncel |
| Yanlış para modeli | Tüm finans çürür | Sprint 0'da para modülü + testleri önce yazılır |
| Excel'den geçiş yapılmaz | Sistem boş kalır | Son sprintte veri göçü ayrı iş kalemi: **son 6 ay** detaylı aktarım (CSV içe aktarma scripti); Excel kapatma tarihi belirlenir |
| Yedek geri yüklenemez | Veri kaybı | Aylık geri yükleme tatbikatı takvime alınır |

---

## 9. Kabul kriterleri (MVP "bitti" tanımı)

MVP ancak aşağıdakilerin tamamı sağlandığında yayına alınır:

- [ ] 4 rol tanımlı, yetki matrisi **API seviyesinde** test edilmiş
- [ ] Bir sözleşme aktifleştirildiğinde 12 aylık recurrence kuralı + şablon oluşuyor; 90 günlük pencere içindeki beklenen tahsilatlar otomatik üretiliyor ve günlük job pencereyi ileri taşıyor
- [ ] Kısmi ödeme, çoklu eşleştirme ve fazla ödeme senaryoları test edilmiş
- [ ] USD sözleşmede kur farkı doğru hesaplanıyor
- [ ] Gecikmiş alacak, yaş gruplarıyla birlikte doğru listeleniyor
- [ ] Banka bakiyesi = açılış + hareketler, mutabakat ekranı çalışıyor
- [ ] Günlük job idempotent; iki kez çalıştırıldığında mükerrer kayıt üretmiyor
- [ ] Her yazma işlemi audit log'a düşüyor; audit log uygulama kullanıcısı tarafından değiştirilemiyor
- [ ] Silinen kayıt geri dönüşüm kutusundan geri yükleniyor
- [ ] Yedek alınıp **farklı bir ortama geri yüklenmiş** ve doğrulanmış
- [ ] Gerçek Piravel verisi (en az 3 marka, 3 sözleşme, 6 ay geçmiş finans) sisteme girilmiş

---

## 10. İlgili dokümanlar

- `01-veritabani-semasi.md` — Tablolar, ilişkiler, DDL (v1.2)
- `02-yetki-matrisi.md` — Rol × kaynak × işlem
- `03-api-endpointleri.md` — Endpoint listesi
- `04-sprint-plani.md` — Geliştirme sırası (tasarım aşaması dahil)
- `05-backlog.md` — MVP dışı özellikler
- `06-ui-ux-tasarim-sistemi.md` — Görsel yön, tasarım token'ları, bileşen ve ekran tasarım kuralları
