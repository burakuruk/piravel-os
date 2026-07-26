# Piravel OS — Geliştirme Sırası ve Sprint Planı (MVP)

**Sürüm:** 1.1 · Tek geliştirici, 2 haftalık sprintler
**İlke:** Her sprint sonunda **çalışan, deploy edilmiş** bir sürüm vardır. Sprint bitmeden yeni özelliğe geçilmez.
**Toplam:** 8 sprint ≈ 16 hafta (tampon dahil)

---

## Tasarım aşaması kuralları (tüm sprintlere yayılır)

UI/UX rastgele, kodlama sırasında oluşmaz. Referans: [06-ui-ux-tasarim-sistemi.md](06-ui-ux-tasarim-sistemi.md).

**Her modül sprintinde zorunlu tasarım adımları:**
1. Ekran wireframe'i (düşük/orta detay) — kodlamadan **önce**
2. Boş / loading / error durumlarının tanımı
3. Masaüstü + mobil davranış kontrolü
4. Görsel tutarlılık kontrolü (06 §18 kalite listesiyle)

**Wireframe onay kapısı:** Aşağıdaki ekranların wireframe'i, ilgili modül kodlanmadan önce onaylanmış olmalıdır:

| Ekran | En geç |
|---|---|
| Uygulama kabuğu (sidebar+topbar) | Sprint 0 sonu |
| Login / 2FA | Sprint 1 başı |
| Dashboard | Sprint 6 başı (taslağı Sprint 0'da) |
| Marka detayı | Sprint 2 başı |
| Sözleşme detayı | Sprint 3 başı |
| Alacak listesi | Sprint 4 başı |
| Tahsilat eşleştirme ekranı | Sprint 4 başı |

---

## Sprint 0 — Temel ve para çekirdeği (2 hafta)

En riskli kısım en önce: para modeli yanlışsa her şey çöker.

| İş | İçerik |
|---|---|
| Proje iskeleti | Next.js (App Router) + TypeScript strict + Drizzle + PostgreSQL 16; Sentry; ESLint/Prettier; CI (typecheck + test) |
| Migration seti | Şema v1.2'nin 23 adımlık migration sırası; seed (para birimleri, gider kategorileri, ilk SA) |
| **Money modülü** | Minor-unit aritmetik, para birimi eşitliği kontrolü, kur uygulama, formatlama (`1.234,56 ₺`); **tutar aritmetiği yalnızca burada** |
| Audit altyapısı | `withAudit()` sarmalayıcı: iş işlemi + audit aynı DB tx; append-only GRANT/trigger testi |
| Soft delete altyapısı | Drizzle global filtre yardımcıları (`notDeleted()`), restore yardımcısı |
| UUID v7 | `uuidv7` + `$defaultFn` standardı |
| **Design token altyapısı** | 06 dokümanındaki renk/tipografi/spacing/radius kararlarının CSS değişkenleri + Tailwind config olarak kurulması; shadcn/ui kurulumu ve Piravel özelleştirmesi (06 §19) |
| **Kabuk wireframe'i** | Sidebar+topbar uygulama kabuğunun wireframe onayı + ilk implementasyonu; dashboard taslak wireframe'i |

**Sprint 0 otomatik testleri (kritik listeden):**
- ✅ **(11) Hesap/transaction para birimi uyuşmazlığı** — trigger testi (migration doğrulaması)
- Money modülü birim testleri: yuvarlama, kur, farklı birim toplama hatası

**Bitti tanımı:** migration'lar boş DB'ye ve tekrar (idempotent) koşuyor; CI yeşil.

---

## Sprint 1 — Auth, roller, kullanıcılar (2 hafta)

| İş | İçerik |
|---|---|
| Better Auth kurulumu | E-posta+şifre, Drizzle adaptörü, `twoFactor` (TOTP + recovery code) |
| Zorunlu 2FA | SA+FIN middleware'i; 2FA'sızları kurulum sayfasına yönlendirme |
| Rol/yetki katmanı | `requireRole()`, `scopeToBrands()` yardımcıları; her istekte rolün DB'den doğrulanması |
| Taze oturum | `freshAge` + `SESSION_STALE` akışı (refund/reverse/iban/settings uçları için hazır altyapı) |
| Kullanıcı yönetimi | users CRUD (SA), oturum listesi/iptal, audit köprüsü (login/logout/failed) |
| Uygulama kabuğu | Layout, navigasyon, oturum durumu, TR yerelleştirme altyapısı |
| **Navigasyon sistemi** | 06 §8'e göre sidebar/topbar'ın nihai görsel hali; aktif durum (altın vurgu), daraltma davranışı |
| **Mobil navigasyon drawer'ı** | Lacivert overlay drawer; **rol bazlı menü filtresi** (görülmeyen modül hiç render edilmez); aktif menüde altın gösterge; dışarı tıklama + Escape ile kapanma; odak tuzağı ve klavye kontrolü (06 §15). Topbar hamburger'ı bu drawer'a bağlanır |
| **Login/2FA ekranları** | 06 §16.1 wireframe'ine göre (onaylı); giriş formu gereksinimleri: göster/gizle, Caps Lock uyarısı, loading, autocomplete, Enter ile gönderim |
| **OTP input bileşeni** | Görsel 6 kutu / teknik tek alan: toplu yapıştırma, `one-time-code`, `inputmode=numeric`, backspace geri atlama, `role="group"` + aria etiketleri (06 §16.1 davranış sözleşmesi) |
| **Kurtarma kodu akışı** | Kopyala **veya** indir → onay kutusu → SA/FIN için rastgele kod doğrulaması; kodlar Argon2id ile hash'lenir, bir daha gösterilmez, yenileme eskileri iptal eder |
| **Sır sızıntısı koruması** | `redact()` yardımcısı + Sentry `beforeSend` temizliği; TOTP secret / QR URI / kurtarma kodları log, Sentry, analytics, audit ve ekran görüntüsü otomasyonuna **girmez** (PRD §6.3) |
| **Bileşen görsel standardı** | Buton, form, tablo, badge temel bileşenlerinin Piravel görünümüyle Storybook'suz basit bir `/styleguide` sayfasında sabitlenmesi |

**Testler:**
- ✅ **(12) Rol ve alan seviyesinde finans maskeleme** — serializer profilleri + endpoint yetki testleri (matris §3'ün otomasyonu; kaynaklar geldikçe genişler)
- Zorunlu 2FA yönlendirme testi; kapsam dışına 404 testi

**Bitti tanımı:** 4 rolle giriş yapılabiliyor; SA/FIN 2FA'sız içeri giremiyor.

---

## Sprint 2 — Marka, yetkili, hizmet kataloğu (2 hafta)

| İş | İçerik |
|---|---|
| Brands CRUD | Liste/detay/oluştur/güncelle/statü değişimi/soft delete/restore; trigram arama |
| Brand contacts | CRUD, birincil kişi kuralı |
| Brand users | Atama ekranı; OPS kapsamının uçtan uca çalışması |
| Services | Katalog CRUD; OPS'a fiyatsız görünüm |
| Geri dönüşüm kutusu | `/trash` ekranı (ilk kaynaklarla) |

**Testler:** OPS'un atanmadığı markayı görememesi (404); alan çıkarma (services fiyatları); statüyü yalnız insanın değiştirdiği (otomatik değişim olmadığı).

**Bitti tanımı:** Gerçek Piravel markaları sisteme girilebilir durumda.

---

## Sprint 3 — Sözleşme + recurrence motoru (2 hafta)

MVP'nin kalbi — 1. bölüm.

| İş | İçerik |
|---|---|
| Contracts CRUD | Taslak akışı, `PRV-YYYY-NNNN` üretici, kapsam kalemleri, toplam uyuşmazlık uyarısı |
| **Aktivasyon** | Tek tx: statü + `recurring_templates` üretimi + (taksitli/tek seferlikte) receivable üretimi |
| Recurrence motoru | 90 gün ufuk; şablondan receivable/payable üretimi; ay sonu kuralı; `last_generated_on` ilerletme |
| Recurring templates | Bağımsız şablon CRUD (tekrarlayan gider formu dahil) |
| Sözleşme sonlandırma | Şablon deaktivasyonu + vadesiz satır iptali onay akışı |

**Testler:**
- ✅ **(10) Recurrence job idempotency** — job'ı aynı gün iki kez çalıştır; satır sayısı değişmemeli (`uq_*_source` doğrulaması)
- Ay sonu kuralı (31 → Şubat); max_occurrences; şablon güncellemesinin yalnız yeni satırları etkilemesi
- ✅ **(9) KDV satırı ve brüt alacak** — üretilen her receivable'da otomatik KDV satırı; `v_receivable_totals` net+KDV=brüt doğrulaması

**Bitti tanımı:** Vis Vize senaryosu (§18.3) uçtan uca: sözleşme aktifleştir → 3 aylık satır otomatik üretilmiş.

---

## Sprint 4 — Finans çekirdeği: tahsilat ve eşleştirme (2 hafta)

MVP'nin kalbi — 2. bölüm. En yoğun test sprint'i.

| İş | İçerik |
|---|---|
| Receivables/Payables ekranları | Liste (brüt/kalan/yaş), detay, manuel kayıt, iptal, tax-lines düzeltme |
| Payable onay akışı | `approve` |
| Transactions | Manuel hareket girişi, `brand_id`, hesap-para birimi doğrulaması |
| **Allocation motoru** | FOR UPDATE'li tek tx; aynı birim + çapraz kur (öneri `exchange_rates`'ten); `OVER_ALLOCATION` koruması |
| **Reversal** | Gerekçeli ters kayıt; paid/unallocated geri alma; taze oturum |
| **Refund akışı** | `refund_of_transaction_id` bağlı çıkış + statü `refunded` |
| Avans ekranı | `/advances`: marka bazlı + sahipsizler; `link-brand` |

**Testler (kritik listenin çekirdeği — bu sprint bitmeden çıkılmaz):**
- ✅ **(1) Aynı para biriminde allocation**
- ✅ **(2) Çapraz para biriminde allocation** (§18.1 senaryosu: kur farkı dahil)
- ✅ **(3) Allocation reversal** (paid/unallocated/status geri dönüşü)
- ✅ **(4) Kısmi ödeme** (partially_paid → paid geçişi, gecikme günü)
- ✅ **(5) Tek tahsilatın birden fazla alacağa dağıtılması**
- ✅ **(6) Fazla ödeme ve müşteri avansı** (unallocated + brand_id)
- ✅ **(7) Avansın sonraki alacağa aktarılması**
- ✅ **(8) Tahsilat iadesi** (`refund_of_transaction_id` bağı; `transfer_pair_id`'nin kullanılMAdığı)
- Eşzamanlılık: iki paralel allocation isteğinin aşırı tahsis üretememesi (FOR UPDATE testi)

**Bitti tanımı:** §18.1 ve §18.2 senaryoları uçtan uca testle kanıtlı.

---

## Sprint 5 — Banka, kasa, giderler, virman (2 hafta)

| İş | İçerik |
|---|---|
| Bank accounts | CRUD, hesaplanan bakiye, maskesiz IBAN ucu (audit + taze oturum) |
| İç virman | `transfer` ucu; döviz bozdurma senaryosu |
| Gider yönetimi ekranları | Kategori bazlı listeler, tekrarlayan gider görünümü, vendors CRUD |
| Exchange rates | Manuel kur girişi ekranı + eşleştirmede `exchange_rates`'ten kur önerisi. **Otomatik TCMB beslemesi MVP dışıdır (backlog)** |
| Mutabakat ekranı | Hesap bazlı hareket listesi, eşleşmemişler, `reconciled_at` |

**Testler:** bakiye = açılış + hareketler (virman dahil); virmanın `transfer_pair_id` ile ve refund'ın ondan ayrı olduğu; IBAN görüntülemenin audit'e düştüğü.

**Bitti tanımı:** Gerçek banka hesapları tanımlı, bakiye doğru.

---

## Sprint 6 — Dashboard, bildirimler, günlük job (2 hafta)

| İş | İçerik |
|---|---|
| Günlük job (tam) | `/api/cron/daily`: overdue işaretleme → recurrence → bildirim üretimi (`dedupe_key`) → özet e-posta |
| Bildirim merkezi | Panel içi liste, okundu, `action_url` yönlendirmeleri |
| E-posta | Günlük özet şablonu (yaklaşan/geciken tahsilat-ödeme-sözleşme) |
| **Dashboard** | Tüm kartlar: beklenen/tahsil edilen/gecikmiş (yaş gruplu)/gider/net nakit/toplam bakiye/yaklaşanlar/süresi dolacak sözleşmeler/geciken işler; rol bazlı bölümler |
| **Grafik placeholder'ının kaldırılması** | Sprint 0'daki kesikli çerçeveli yer tutucu **silinir**; yerine gerçek Recharts grafiği gelir ve 06 §12'deki düşük doygunluklu finans kurallarına uyar (ana seri `--navy-700`, alan dolgusu %6, gradient/glow/3D yok, yatay ızgara) |
| Tasks modülü | Basit iş takibi CRUD + MEM kısıtlı güncelleme + geciken işler |

**Testler:** job'ın gün içi ikinci çalıştırmada bildirim üretmemesi (dedupe); dashboard agregasyonlarının test verisiyle birebir doğruluğu; OPS/MEM dashboard yanıtında finans alanının hiç olmaması.

**Bitti tanımı:** Sabah 08:00 job'ı çalışıyor, bildirimler düşüyor, dashboard gerçeği söylüyor.

---

## Sprint 7 — Veri göçü, sertleştirme, yayın (2 hafta)

| İş | İçerik |
|---|---|
| **Göç scripti** | Excel/CSV → `import/receivables`, `import/payables`, `import/transactions`; **son 6 ayın** detaylı verisi + açılış bakiyeleri; `import_batch_id` ile geri alınabilir deneme |
| Göç mutabakatı | İçe aktarılan tahsilatların alacaklara eşleştirilmesi; sahipsizlerin `link-brand` ile temizlenmesi |
| CSV export | Liste uçlarına export (audit'li) |
| Yedekleme | Günlük otomatik yedek + **farklı ortama geri yükleme tatbikatı** (kabul kriteri) |
| Güvenlik turu | Taze oturum uçlarının son kontrolü, rate limit, başlıklar; Sentry alarm ayarları |
| Kabul kriterleri turu | PRD §9'un 11 maddesinin tek tek işaretlenmesi |
| Yayın | Prod ortam, gerçek veriyle 1 hafta paralel kullanım (Excel + sistem), sonra Excel kapatma kararı |

**Bitti tanımı:** PRD §9 tamamı ✅; 6 aylık gerçek veri içeride; sistem tek doğruluk kaynağı ilan edilmiş.

---

## Kabul kriterlerinin sprint eşlemesi (PRD §9)

| Kabul kriteri | Sprint |
|---|---|
| 4 rol + API seviyesinde yetki testi | 1 (altyapı) → 4-6 (kaynak testleri) |
| Aktivasyonda kural + şablon + 90 günlük pencere üretimi | 3 |
| Kısmi/çoklu/fazla ödeme senaryoları | 4 |
| USD kur farkı | 4 |
| Gecikmiş alacak yaş grupları | 6 (dashboard) |
| Banka bakiyesi + mutabakat | 5 |
| Job idempotency | 3 (recurrence) + 6 (bildirim) |
| Audit her yazmada + değiştirilemez | 0 (altyapı) → tüm sprintler |
| Geri dönüşüm kutusu | 2 |
| Yedek geri yükleme tatbikatı | 7 |
| Gerçek veri (3 marka, 3 sözleşme, 6 ay) | 7 |

## Kritik test listesinin sprint eşlemesi

| # | Test | Sprint |
|---|---|---|
| 1 | Aynı para biriminde allocation | 4 |
| 2 | Çapraz para biriminde allocation | 4 |
| 3 | Allocation reversal | 4 |
| 4 | Kısmi ödeme | 4 |
| 5 | Tek tahsilat → çok alacak | 4 |
| 6 | Fazla ödeme + müşteri avansı | 4 |
| 7 | Avansın sonraki alacağa aktarımı | 4 |
| 8 | Tahsilat iadesi (refund bağı) | 4 |
| 9 | KDV satırı + brüt hesap | 3 |
| 10 | Recurrence job idempotency | 3 |
| 11 | Hesap/TX para birimi uyuşmazlığı | 0 |
| 12 | Rol + alan seviyesi maskeleme | 1 → 6 (kaynak geldikçe genişler) |

## Kapsam koruması

Bu plana **yalnızca** PRD §4.1 (IN) listesi girmiştir. OUT listesindekiler (müşteri paneli, reklam API, e-fatura, içerik takvimi, AI, kredi kartı modülü, WhatsApp, banka entegrasyonu, doküman versiyonlama) hiçbir sprintte yer almaz — hepsi [05-backlog.md](05-backlog.md)'dedir. Sprint sırasında doğan her yeni fikir backlog'a yazılır, sprinte alınmaz.
