# Piravel OS — MVP Dışı Backlog

**Sürüm:** 1.0
**Kural:** Bu listedekiler hiçbir MVP sprintine alınmaz. Her madde, **tetikleyici koşulu** gerçekleşince değerlendirmeye açılır. Yeni fikirler bu dosyanın sonuna eklenir, sprinte sızmaz.

**Boyut:** S ≈ birkaç gün · M ≈ 1-2 hafta · L ≈ 1 ay+ · XL ≈ çeyrek

---

## v0.2 adayları (MVP yayınından sonraki ilk dalga)

| Özellik | Tetikleyici | Şemadaki hazır kanca | Boyut |
|---|---|---|---|
| **Kredi kartı modülü** | MVP'deki "ödendiği dönemde payable" geçici çözümü aylık kapanışta yetersiz kalırsa | Tasarım taslağı şema §10.1: `is_liability`, negatif bakiye akışı, ekstre ödemesi=virman, dashboard'da ayrı "Kart borcu" kartı; `credit_limit_minor`/`statement_day`/`payment_due_day` alanları geri gelir | M |
| **Banka CSV içe aktarma otomasyonu** | Manuel hareket girişi haftada >1 saat almaya başlayınca | `transactions.import_batch_id`, `external_id`, `uq_tx_external` mükerrer engeli, `/api/v1/import/transactions` ucu zaten var — eksik olan banka formatı eşleyicileri + otomatik eşleştirme önerisi | M |
| **Tevkifat / stopaj UI'ı** | İlk tevkifatlı fatura kesildiğinde veya ilk gider pusulalı freelancer ödemesinde | `tax_lines` tablosu (`kdv_tevkifat`, `stopaj`, `external_code`) hazır; yalnızca form + hesaplama yardımcısı gerekir | S |
| **Çapraz kur iyileştirmeleri** | Döviz sözleşme sayısı artınca | **Otomatik TCMB kur beslemesi** (`exchange_rates.source='tcmb'` — MVP'de yalnız manuel giriş), kur farkı raporu ekranı (`v_fx_differences` hazır) | S |
| **Görev yorum sistemi** | Görev üzerinde yazışma ihtiyacı WhatsApp'a taşmaya başlayınca | Yeni `task_comments` tablosu gerekir (şemada yok — bilinçli); MEM rolü MVP'de yalnız durum değiştirebilir | S |
| **Gelişmiş raporlar** | MVP'de 3 ay veri birikince | Marka kârlılığı (§17.2 sorgusu hazır), hizmet bazlı kârlılık, tahsilat performansı, düzenli gelir (MRR) trendi | M |

## v2 — Operasyon yönetimi

| Özellik | Tetikleyici | Hazır kanca | Boyut |
|---|---|---|---|
| Gelişmiş proje yönetimi | Basit iş takibi yetmez hâle gelince (alt görev/proje ihtiyacı dile gelince) | `tasks.parent_id`, `project_id`, `estimated_minutes`, `spent_minutes` | M |
| İçerik takvimi | Sosyal medya operasyonu sistematik takip istediğinde | `tasks` genişletmesi veya ayrı `content_items`; durum enum'u PRD'de tanımlı | L |
| Kapsam aşımı uyarısı | İçerik/görev sayıları sistemde tutulmaya başlayınca | `contract_items.quantity` ↔ dönemdeki görev sayısı karşılaştırması | S |
| Doküman versiyonlama | Aynı dosyanın 3. kez "final_v2" diye yüklendiği gün | `attachments.version`, `replaces_id`, `checksum` | S |
| Domain/hosting/lisans takibi | İlk kaçan yenileme veya SSL süprizi | `recurring_templates` (yıllık payable) bugün de kullanılabilir; özel varlık tablosu (domain, SSL bitişi, DNS notları) v2'de | M |
| Ekip iş yükü raporu | Ekip 3+ kişi olunca | `tasks.assignee_id` + süre alanları | S |
| E-posta hesap envanteri | Hesap sayısı 10'u geçince | Basit envanter tablosu; şifreler asla tutulmaz (PRD NON-GOAL) | S |

## v3 — Otomasyon ve dış erişim

| Özellik | Tetikleyici | Hazır kanca | Boyut |
|---|---|---|---|
| **Müşteri paneli** | İç kullanım oturup ilk müşteri "durumu görebilir miyim" dediğinde | `users.brand_id`, rol altyapısı, kapsam mekanizması (`scopeToBrands` mantığı müşteriye daraltılır) | L |
| **e-Fatura / e-Arşiv** | Aylık fatura adedi manuel kesimi anlamsız kılınca; entegratör seçilince | `receivables.invoice_no/invoice_date/invoice_uuid` (ETTN), `tax_lines`; Laravel değil Next.js olduğumuz için entegratör REST API'si doğrudan kullanılır | L |
| Meta/Google Ads raporlama | Reklam müşterisi sayısı raporlamayı otomatikleştirmeye değecek seviyeye gelince (API onayları aylar sürer — erken başvur) | `brands.external_refs` (hesap ID'leri) | XL |
| WhatsApp/Telegram bildirim | E-posta özetleri okunmamaya başlayınca | `notifications.channel` enum genişletilebilir; `dedupe_key` kanaldan bağımsız | M |
| Banka API entegrasyonu | CSV içe aktarma bile yetmez olunca (açık bankacılık erişimi netleşince) | `transactions.external_id` + mutabakat ekranı | XL |
| Teklif (CRM) modülü | Aylık gelen talep sayısı takip edilemez olunca | `brands.status='lead'/'proposal_sent'` bugün de kaba takip sağlar; tam pipeline (aşamalar, kazanma ihtimali, tek tıkla müşteriye dönüştürme) v3 | L |
| AI özellikleri | Temiz veri 6+ ay birikince | Tüm finans normalize — yönetici özeti, anomali tespiti, gecikme riski tahmini doğrudan mevcut şemadan beslenir | L |
| Mobil / PWA | Saha kullanım talebi doğunca | API zaten ayrık; PWA manifest + responsive yeterli başlangıç | M |

## Bilinçli olarak asla yapılmayacaklar (PRD NON-GOALS hatırlatması)

- Şifre kasası (Bitwarden/1Password kullanılır)
- Resmî muhasebe defteri (mali müşavir ikamesi değil)
- Otomatik para transferi
- Multi-tenant / SaaS'laştırma (ancak ayrı bir stratejik karar olarak yeniden açılabilir)

---

## Yeni fikir kutusu

*Sprint sırasında doğan fikirler tarihle buraya eklenir; sprint kapsamına alınmaz.*

| Tarih | Fikir | Not |
|---|---|---|
| 26.07.2026 | **Gece modu (koyu içerik teması)** | Sprint 0'da tüm renkler CSS değişkeni olarak kuruldu; kapı açık. MVP tek tema (açık içerik + koyu kabuk). Tetikleyici: kullanıcı talebi |
| 26.07.2026 | **Tablo yoğunluk tercihi (40px/32px) kullanıcı ayarı** | 06 §9'da tanımlı; localStorage ile saklanacak. Sprint 4 tablo işiyle birlikte değerlendirilir, ayrı iş değil |
