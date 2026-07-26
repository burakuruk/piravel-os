# Piravel OS — UI/UX Tasarım Sistemi

**Sürüm:** 1.1
**Kapsam:** MVP'nin tüm ekranları. Bu doküman koddan önce gelir; her modül sprintindeki wireframe onayı bu dokümana göre yapılır.
**Görsel kayıt:** Onaylanan ekranların görüntüleri `docs/previews/` altında commit edilir.

---

## 1. Ürün tasarım vizyonu

Piravel OS bir **finansal kayıt sistemi**dir. Ekranda görünen her sayı bir alacak, bir borç, bir taahhüttür. Tasarımın işi bu ağırlığı taşımaktır: **sakin, kesin, güven veren.**

Üç cümlelik vizyon:

> Piravel OS, bir bankanın iç aracı kadar ciddi, iyi bir muhasebe defteri kadar okunaklı, gerçek bir ürün ekibinden çıkmış kadar rafine görünür. Süsleme yoktur; karakter, disiplinden gelir. Kullanıcı her sabah dashboard'a baktığında "şirketim kontrol altında" hisseder.

**Tasarımın hizalandığı üç ölçüt:**

| Ölçüt | Anlamı |
|---|---|
| **Yoğunluk, dağınıklık olmadan** | Finans kullanıcısı tek ekranda çok satır görmek ister. Boşluk bilgiyi seyreltmek için değil, gruplamak için kullanılır. |
| **Hiyerarşi, dekorasyon olmadan** | Önem; renkle değil, tipografik ağırlık ve konumla kurulur. Renk yalnızca anlam taşıdığında kullanılır. |
| **Karakter, gürültü olmadan** | Kimlik; lacivert zemin, altın vurgu ve tipografik detaydan gelir — gradient, glow veya illüstrasyondan değil. |

---

## 2. Görsel yön alternatifleri ve karar

### A. Premium Corporate

| Boyut | Tanım |
|---|---|
| Karakter | Özel bankacılık / hukuk bürosu ciddiyeti. Koyu lacivert kabuk, açık zemin içerik, altın yalnızca imza detaylarında |
| Renk | Lacivert + sıcak beyaz + çok kısıtlı altın; işlevsel renkler soluk ve azınlıkta |
| Tipografi | Tek güçlü sans aile; başlıklarda ağırlık farkı, gövdede yüksek okunabilirlik |
| Yoğunluk | Orta-yüksek; geniş tablolar, dar kartlar |
| Avantaj | Güven hissi en yüksek seçenek; markayla birebir örtüşür; eskimez |
| Dezavantaj | Fazla temkinli uygulanırsa "kuru" kalabilir |
| Uygunluk | **9/10** |

### B. Editorial Finance

| Boyut | Tanım |
|---|---|
| Karakter | Financial Times / iyi bir yıllık rapor estetiği. Tipografi başrolde; serif display başlıklar, cetvel çizgileri, rakam disiplini |
| Renk | Sıcak kâğıt zemini, mürekkep laciverti, tek vurgu rengi |
| Tipografi | Serif display + sans gövde ikilisi; tabular rakamlar kimliğin parçası |
| Yoğunluk | Yüksek; gazete gibi sütunlu, çizgiyle bölünmüş |
| Avantaj | AI-dashboard görünümünden en uzak seçenek; raporlar olağanüstü görünür |
| Dezavantaj | Form/işlem ekranlarında (eşleştirme, CRUD) editorial dil zorlanır; disiplinsiz uygulanırsa "dergi" olur |
| Uygunluk | 7/10 |

### C. Modern Operational

| Boyut | Tanım |
|---|---|
| Karakter | Linear/Stripe iç araç estetiği. Nötr, hızlı, klavye odaklı, kompakt |
| Renk | Gri skala + tek accent; marka rengi minimal |
| Tipografi | Tek sans, küçük punto, sıkı satır aralığı |
| Yoğunluk | Çok yüksek |
| Avantaj | Uygulaması en hızlı; operasyon ekranlarında çok verimli |
| Dezavantaj | Piravel kimliği kaybolur; "her yerde görülen iyi iç araç" olur — premium his zayıf |
| Uygunluk | 6/10 |

### Karar: **A liderliğinde A+B dengesi** ✅

Kullanıcı tercihiyle uyumlu: **Premium Corporate temel, Editorial Finance dokunuşu.**

- **A'dan:** lacivert kabuk + açık içerik mimarisi, kısıtlı altın kuralı, kurumsal ağırbaşlılık — *tüm işlem ekranlarının dili*
- **B'den:** tipografik hiyerarşi, tabular rakam disiplini, ince cetvel çizgileri, sayfa başlıklarında serif display — *dashboard ve rapor ekranlarının dili*
- **C'den yalnızca:** klavye kısayolları ve yoğun tablo pragmatizmi (görsel dili değil)

**Neden:** Bu bir finans aracı — güven birincil duygu (A). Ama Piravel bir *yaratıcı ajans* — tamamen bankacı gibi görünmek kimliği eksik anlatır; editorial tipografi o karakteri katmanın gürültüsüz yoludur (B). C'nin nötrlüğü ise "jenerik iç araç" riskinin ta kendisidir.

---

## 3. Piravel marka kimliğinin sisteme uygulanması

Logo: geometrik, iç içe geçmiş, kendinden emin harfler — lacivert zemin üzerinde altın. Bu iki ilke doğurur:

1. **Lacivert zemindir, altın imzadır.** Uygulama kabuğu (sidebar) lacivert; altın yalnızca "burası önemli / burası seçili / burası Piravel" dediğimiz yerlerde.
2. **Geometri sadeliği:** logo köşeli ve nettir → arayüz de az radius, net kenar, güçlü hizalama kullanır.

### Altın kullanım sözleşmesi (kesin kural)

| Altın KULLANILIR ✅ | Altın KULLANILMAZ ❌ |
|---|---|
| Aktif navigasyon göstergesi (sol çubuk + metin) | Başarı durumu (o yeşildir) |
| Sayfa başlığı altı ince vurgu çizgisi (yalnız 1. seviye) | Hata/uyarı (kırmızı/amber) |
| ↳ **Kural:** 1px yükseklik, **32–48px genişlik** (uygulama: 40px). Başlık metni boyunca **asla uzanmaz** — kısa bir imza detayıdır | Başlık genişliğinde tam çizgi |
| Seçili sekme/segment göstergesi | Buton zeminlerinde yaygın kullanım (primary buton lacivert) |
| "Premium" detay: logo, giriş ekranı vurgusu, boş durum aksanı | Tablo satır zeminleri, kart kenarlıkları |
| Dashboard'da tek bir kilit metrik altı çizgisi | Grafiklerde ana seri rengi olarak her yerde |
| Odak halkası (yalnız koyu zemin üzerinde) | Link rengi (linkler lacivert/alt çizgi) |

**Ölçü:** Herhangi bir ekranda altın, görünür alanın **%5'inden azını** kaplar. Daha fazlası "altın kaplama" hissi verir ve değerini öldürür.

---

## 4. Renk sistemi

### 4.1 Marka tonları

```
--navy-950: #10142A   (en koyu — sidebar hover zemin)
--navy-900: #191E38   (MARKA — sidebar, primary buton, başlık metni)
--navy-800: #232A4D   (sidebar aktif zemin, koyu yüzey)
--navy-700: #2F3763   (koyu zemin ikincil)
--navy-500: #4A5490   (link, interaktif metin)
--navy-100: #E3E5F0   (seçili satır zemini, açık vurgu)

--gold-600: #8C733F   (altın hover / koyu varyant)
--gold-500: #A58950   (MARKA — vurgu)
--gold-200: #DCCCA8   (koyu zeminde altın metin)
--gold-100: #F1EADA   (altın zemin tonu — çok seyrek)

--paper:    #FAF9F6   (MARKA sıcak beyaz — ana içerik zemini)
--surface:  #FFFFFF   (kart/tablo zemini)
```

### 4.2 Nötrler (sıcak gri — mavi gri DEĞİL)

```
--ink-900: #21242E  (ana metin)      --line-200: #E9E6DE  (cetvel/çizgi)
--ink-600: #565A66  (ikincil metin)  --line-300: #DBD7CC  (belirgin kenarlık)
--ink-400: #8B8E96  (sönük metin)    --fill-100: #F3F1EB  (soluk zemin, tablo başlığı)
```

### 4.3 İşlevsel renkler (markadan bağımsız, azaltılmış doygunluk)

| Anlam | Metin/ikon | Zemin | Kullanım |
|---|---|---|---|
| Başarı | `#2E7D4F` | `#EAF3EC` | ödendi, aktif, tamamlandı |
| Uyarı | `#9A6700` | `#F9F0DC` | vade yaklaşıyor, kısmen ödendi, sözleşme bitiyor |
| Tehlike | `#B3382E` | `#F9E9E7` | gecikti, iptal, silme, negatif tutar |
| Bilgi | `#3B5B8C` | `#E9EEF6` | nötr bilgilendirme, taslak |

Kural: işlevsel renk **yalnızca durum bildirir** — dekorasyon için asla. Bir ekranda kırmızı görülüyorsa bir şey gerçekten gecikmiştir.

### 4.4 Koyu zemin (sidebar) paleti

Metin `#C9CCDA`, sönük `#8A8FA8`, aktif metin `#FFFFFF`, aktif gösterge `--gold-500`, ayraç `#2A3050`.

> MVP **tek temadır (açık içerik + koyu kabuk)**. Ayrı gece modu backlog'dadır; renkler CSS değişkeni olarak kurulduğu için kapı açıktır.

---

## 5. Tipografi sistemi

| Rol | Font | Gerekçe |
|---|---|---|
| UI / gövde | **Instrument Sans** (Google Fonts, değişken) | Karakterli ama yorulmayan; Inter'in "her AI ürünü" hissinden uzak; Türkçe diyakritik desteği tam |
| Display (seyrek) | **Fraunces** (Google Fonts, değişken) | Editorial imza: yalnızca sayfa başlıkları (h1) ve dashboard bölüm başlıkları; opsiyonel optik boyut ekseniyle rafine |
| Rakam/kod | **JetBrains Mono** | Sözleşme no, IBAN, ID alanları |

**Yükleme kuralı:** Üç font da **Next.js `next/font/google` üzerinden** projeye dahil edilir (build sırasında self-host edilir, runtime'da Google Fonts'a harici istek gitmez). CSS `@import` veya `<link>` ile font çekmek yasaktır — performans, gizlilik ve offline tutarlılık için.

**Rakam kuralı (pazarlıksız):** Tüm parasal değerler ve tablo rakamları `font-variant-numeric: tabular-nums lining-nums` ile dizilir. Fraunces rakamları tutarda **kullanılmaz** — tutarlar daima Instrument Sans tabular.

### Ölçek (1.2 oran, px)

| Token | Boyut/satır | Kullanım |
|---|---|---|
| `display` | 28/34, Fraunces 500 | Sayfa başlığı (h1) — sayfada en fazla 1 |
| `title` | 20/28, Sans 600 | Bölüm/kart başlığı |
| `subtitle` | 16/24, Sans 600 | Alt bölüm, drawer başlığı |
| `body` | 14/20, Sans 400 | Varsayılan gövde/tablo |
| `body-strong` | 14/20, Sans 600 | Vurgulu hücre, etiketli değer |
| `small` | 13/18, Sans 400 | Yardım metni, meta |
| `caption` | 12/16, Sans 500, +0.02em, büyük harf | Tablo başlığı, grup etiketi |
| `num-lg` | 22/28, Sans 600 tabular | Dashboard metrikleri (dev KPI yok — 22px yeter) |

---

## 6. Spacing sistemi (4/8 px)

```
--s-1: 4   --s-2: 8   --s-3: 12   --s-4: 16   --s-5: 20
--s-6: 24  --s-8: 32  --s-10: 40  --s-12: 48  --s-16: 64
```

| Kural | Değer |
|---|---|
| Bileşen içi (input padding, hücre) | 8–12 |
| İlişkili öğeler arası (label–input) | 4–8 |
| Bileşenler arası (form alanları) | 16 |
| Bölümler arası | 24–32 |
| Sayfa kenar boşluğu | 24 (masaüstü), 16 (mobil) |

Ara değer (10, 14, 18…) **yasak** — tüm boşluklar bu skaladan.

### Radius ve gölge

```
--r-sm: 4px  (input, badge, buton)     --r-md: 6px  (kart, tablo, modal)
--r-lg: 8px  (drawer — üst sınır)       Daha büyük radius YOK.
--shadow-sm: 0 1px 2px rgb(25 30 56 / 0.06)          (kart — neredeyse görünmez)
--shadow-md: 0 4px 16px rgb(25 30 56 / 0.10)         (dropdown, popover)
--shadow-lg: 0 8px 32px rgb(25 30 56 / 0.16)         (modal, drawer)
```

Ayrım aracı **gölge değil, 1px çizgidir** (`--line-200`). Gölge yalnızca havada duran katmanlara.

---

## 7. Grid ve sayfa yerleşimi

```
┌──────────┬─────────────────────────────────────────────┐
│          │ Topbar (56px, yapışkan)                     │
│ Sidebar  ├─────────────────────────────────────────────┤
│ 248px    │ İçerik: max 1320px, ortalanmış, 24px kenar  │
│ sabit    │ 12 kolon, 24px gutter                       │
│ (lacivert│ Form sayfaları: max 720px tek kolon         │
│  zemin)  │ Detay sayfaları: 8 + 4 kolon (ana + yan)    │
└──────────┴─────────────────────────────────────────────┘
```

- Sidebar 1280px altında ikon moduna (64px) daralır; mobilde overlay drawer olur.
- Tablolar konteynerin tam genişliğini kullanır; kart ızgaraları 12 kolona oturur (metrik şeridi: 4×3 kolon).
- Dikey ritim: tüm bölüm aralıkları 24'ün katı.

---

## 8. Navigasyon: sidebar + topbar

### Sidebar (lacivert `--navy-900`)

- Üstte Piravel logosu (altın, 32px yükseklik alanı), altında ince ayraç.
- Gruplu menü (caption etiketli): **GENEL** Dashboard · **MÜŞTERİ** Markalar, Sözleşmeler · **FİNANS** Alacaklar, Giderler, Banka & Kasa, Eşleştirme, Avanslar · **OPERASYON** Görevler · **SİSTEM** Bildirimler, Ayarlar, Denetim, Çöp Kutusu.
- Menü öğesi: 36px yükseklik, 16px ikon (yalnızca burada — içerikte ikon cimriliği), 8px radius **yok** — tam genişlik zemin + **solda 2px altın çubuk** aktif göstergesi, aktif zemin `--navy-800`, aktif metin beyaz.
- Rol filtresi: kullanıcının görmediği modül menüde **hiç görünmez** (soluk/kilitli gösterilmez).
- Altta: kullanıcı bloğu (ad, rol etiketi) + çıkış.

### Topbar (56px, `--surface`, altta 1px çizgi)

Sol: sayfa breadcrumb'ı (`Markalar / Vis Vize`). Orta-sağ: **global arama** (⌘K / Ctrl+K — marka, sözleşme no, tutar arar). Arama **rol ve kapsam bazlıdır ve API seviyesinde filtrelenir** (`GET /api/v1/search`): SA/FIN tüm kayıtları ve tutarları; OPS yalnız atandığı markaları, sözleşme kapsamını ve görevleri; MEM yalnız kendi görevlerini görür — UI gizlemesi yeterli değildir. Sağ: bildirim zili (kırmızı nokta = kritik var) + tarih aralığı seçici (yalnız finans ekranlarında).

---

## 9. Çekirdek bileşenler

### Kart
Beyaz zemin, 1px `--line-200` kenar, `--r-md`, `--shadow-sm`, 16–20px iç boşluk. Başlık `title` + sağda opsiyonel tek aksiyon. **Kart, kutu koleksiyonu değildir** — bir ekranda birbirine bakan 6+ küçük kart varsa tablo/liste olmalıydı.

### Tablo (sistemin atıdır — en çok emek buraya)
- Satır 40px (yoğun mod 32px — kullanıcı tercihi, localStorage).
- Başlık: `caption` stili, `--fill-100` zemin, yapışkan.
- Rakam kolonları **sağa hizalı, tabular**; metin sola; durum rozeti kendi kolonunda.
- Zebra yok; ayrım 1px satır çizgisi; hover `--fill-100`; seçili `--navy-100`.
- Satır tıklaması detay drawer'ı açar; satır sonu "⋯" menüsü ikincil işlemler.
- Toplam/altbilgi satırı: üstte 2px `--ink-900` çizgi (muhasebe geleneği), `body-strong`.
- Sayfalama altta sağda; toplam kayıt sayısı solda.

### Form
- Etiket üstte (`small`, `--ink-600`), input 36px, `--r-sm`, 1px `--line-300` kenar; odakta 2px `--navy-500` halka.
- Tutar girişi: sağa hizalı, para birimi seçici bitişik solda; yazarken binlik ayracı canlı.
- Hata: alan altı `small` kırmızı metin + kenarlık kırmızı; asla yalnız renkle değil, daima metinle.
- Zorunlu alan: etiket sonunda `*`; "opsiyonel" yazılmaz.

### Modal ve Drawer
| | Modal (merkez) | Drawer (sağdan, 480–640px) |
|---|---|---|
| Kullanım | Onay, tehlikeli işlem, tek karar | Kayıt detayı, oluştur/düzenle, eşleştirme paneli |
| Kural | Tek birincil aksiyon; tehlikelide buton kırmızı + işlem adı yazılır ("Ters kaydı oluştur") | Başlık + kapat; altta yapışkan aksiyon çubuğu; içerik kaydırılır |

### Rozet (badge)
20px yükseklik, `--r-sm`, `caption` metin, işlevsel zemin+metin çifti. `obligation_status` eşlemesi: draft→bilgi, pending→nötr (çizgili kenar), partially_paid→uyarı, paid→başarı, overdue→tehlike, cancelled→sönük, refunded→bilgi.

### Filtre çubuğu
Tablonun üstünde tek satır: arama inputu + 2–4 hızlı filtre (durum, marka, tarih aralığı) + "Filtreler" düğmesiyle geri kalanı popover'da. Aktif filtreler kaldırılabilir chip olarak çubukta görünür. Filtre durumu URL'e yazılır (paylaşılabilir).

### Buton
| Tür | Görünüm | Kullanım |
|---|---|---|
| Primary | `--navy-900` zemin, beyaz metin | Sayfada en fazla 1 |
| Secondary | Beyaz zemin, 1px kenar, lacivert metin | Yaygın |
| Ghost | Zeminsiz, lacivert metin | Tablo içi, üçüncül |
| Destructive | Kırmızı zemin | Yalnız onay modalında |
36px yükseklik (tablolarda 28px), `--r-sm`, ikonlu buton yalnız evrensel eylemlerde (＋, indir).

---

## 10. Finans verisi sunum kuralları

1. **Tutar formatı:** `36.500,00 ₺` — sembol sonda (TR geleneği), USD/EUR'da `1.200,00 $` + kolon başlığında para birimi. Kuruş daima gösterilir (finans aracıdır, yuvarlama güven bozar).
2. **Baz karşılık:** Dövizli tutarın altında `small --ink-400` ile TL karşılığı: `1.200,00 $` / `42.036,00 ₺`.
3. **Negatif/alacak yönü:** `−` işaretiyle ve `--danger` metinle; parantez kullanılmaz. Gelen para asla yeşil boyanmaz — renk durum içindir, yön için `+/−` yeter.
4. **Gecikme yaşı:** rozet yanında gün: `Gecikti · 12 g`. Yaş grupları (1-30/31-60/60+) tabloda kolon değil, filtredir.
5. **Sıfır ve boş ayrımı:** `0,00 ₺` gerçek sıfırdır; veri yoksa `—` (em dash). İkisi asla karışmaz.
6. **Rol maskeleme:** OPS/MEM için tutar kolonları **hiç render edilmez** (boş kolon veya `***` gösterilmez — layout tutarsız kolonsuz da dengeli olmalı; tablo tanımları rol bazlı kolon setiyle kurulur).
7. **Kilit satırlar:** toplam satırı ve "kalan bakiye" her finans tablosunda görünür; kullanıcı asla toplamı kendisi hesaplamaz.
8. **IBAN:** daima maskeli `TR** **** 1234`; maskesiz görüntüleme ayrı tıklama + audit uyarısı tooltip'i.

---

## 11. Durum, uyarı ve risk renkleri

- Marka riski (`v_brand_payment_risk`): warning/high/critical → marka adı yanında **nokta** (8px) + tooltip; kırmızı zemin boyaması yok. OPS bu noktayı görür ama tutarı görmez.
- Bildirim önem düzeyi: info nötr, warning amber sol çizgili, critical kırmızı sol çizgili — zil menüsünde kritikler üstte.
- Sistem geneli kural: **bir ekranda aynı anda en fazla iki işlevsel renk ailesi** baskın olabilir; üçüncüsü görünüyorsa bilgi mimarisi yanlıştır.

---

## 12. Grafik ve veri görselleştirme

| Kural | Detay |
|---|---|
| Kütüphane | Recharts (shadcn chart uyumu); tema token'lardan beslenir |
| Palet | Ana seri `--navy-700`; ikincil `--gold-500` (tek seri vurgusu); üçüncül `--ink-400`; işlevsel renkler yalnız anlamlıysa (gecikmiş=kırmızı) |
| Yasak | 3D, gradient dolgu, glow, pasta grafik (oran için yatay çubuk kullan), çift y-ekseni |
| Türler | Zaman serisi → çizgi/alan (alan dolgusu %6 opak); karşılaştırma → yatay çubuk; tablo içi eğilim → sparkline (tek renk, 32×80px) |
| Eksen | `small` gri; ızgara yalnız yatay, `--line-200`; tutar eksenleri kısaltılmış (`120K ₺`) ama tooltip tam değer |
| Boş grafik | "Henüz veri yok" + dönem bilgisi; iskelet çubuk gösterilmez |

Dashboard'da grafik sayısı ≤ 2 (nakit akışı çizgisi + gecikmiş yaş çubuğu). Grafik süs değil, cevaptır.

---

## 13. Boş, yükleme, hata ve başarı durumları

| Durum | Desen |
|---|---|
| **Boş (ilk kullanım)** | Ortalanmış, illüstrasyonsuz: `subtitle` başlık + 1 cümle açıklama + primary aksiyon. Altın yalnızca minik bir tipografik aksan olabilir. Örn: "Henüz sözleşme yok — İlk sözleşmeyi oluştur" |
| **Boş (filtre sonucu)** | Tablo gövdesinde tek satır: "Bu filtrelerle kayıt bulunamadı · Filtreleri temizle" |
| **Skeleton** | Yalnız tablo satırları ve metrik şeridi için; gerçek layout'un gölgesi (`--fill-100`, hafif nabız); spinner tam sayfa asla |
| **Satır içi yükleme** | Buton içinde 14px spinner + etiket korunur ("Kaydediliyor…") |
| **Hata (form)** | Alan altı mesaj + sayfa üstü özet (çok alanlıysa) |
| **Hata (sayfa/istek)** | İçerik alanında kart: ne oldu + `request_id` + "Tekrar dene". Teknik jargon yok |
| **Başarı** | Sağ altta toast, 4sn, tek satır + opsiyonel bağlantı ("Tahsilat eşleştirildi · Alacağı gör"). Konfeti/animasyon yok |
| **Tehlikeli işlem sonrası** | Toast + geri alma yoksa açık ifade ("Ters kayıt oluşturuldu — bu işlem kalıcıdır") |

---

## 14. Responsive davranış

Masaüstü birincildir (finans işi masada yapılır); mobil **okuma ve onay** içindir.

| Kırılım | Davranış |
|---|---|
| ≥1280 | Tam sidebar + tam tablo |
| 1024–1279 | Sidebar ikon modu; tablolar yatay kaydırır (ilk kolon yapışkan) |
| <1024 (mobil/tablet) | Sidebar → hamburger drawer; tablolar **öncelikli kolon** setine iner (örn. alacaklar: marka, tutar, vade, durum) — kalan bilgi satır detay sayfasında; metrik şeridi 2×2; drawer'lar tam ekran olur |

Mobilde birincil aksiyonlar korunur (tahsilat kaydı girilebilir); eşleştirme ekranı gibi karmaşık işlemler "masaüstünde daha rahat" notuyla basitleştirilmiş akış sunar.

---

## 15. Klavye ve erişilebilirlik

- **⌘K / Ctrl+K** global arama; **/** liste sayfasında filtre aramasına odak; **Esc** drawer/modal kapatır; tablolarda ↑↓ satır gezinme, **Enter** detay açar.
- Odak halkası her interaktif öğede görünür: açık zeminde 2px `--navy-500`, koyu zeminde 2px `--gold-500`.
- Kontrast: tüm metinler WCAG AA (gövde ≥4.5:1, `--ink-400` yalnız 18px+ veya ikincil metinde). İşlevsel renk çiftleri AA doğrulamalı.
- Durum asla yalnız renkle verilmez (rozet metni, `−` işareti, gün sayısı).
- Tüm form kontrolleri etiketli (`label for`); tablolar `<th scope>`; drawer/modal odak tuzağı + `aria-modal`.
- Dokunma hedefi mobilde ≥44px.

---

## 16. Sayfa bazlı wireframe açıklamaları

Ortak format — **Amaç · Hiyerarşi · Üst · İçerik · 1° aksiyon · 2° aksiyon · Tablo/kart · Mobil · Hata/boş**

### 16.1 Giriş ve 2FA

- **Amaç:** hızlı, güven veren giriş. **Hiyerarşi:** logo → form → yardım.
- **Üst:** yok (kabuksuz). **İçerik:** tam ekran lacivert zemin; ortada 400px beyaz kart; altın yalnızca logoda.
- **1°:** Giriş / Doğrula. **2°:** şifre sıfırlama. **Mobil:** aynı, tam genişlik.

#### Akış ve adım göstergesi

2FA **her kullanıcı için zorunlu değildir** (SA/FIN zorunlu, OPS/MEM opsiyonel). Bu yüzden:

- **Giriş ekranında adım göstergesi YOKTUR** — "ADIM 1 / 2" gibi bir vaat verilmez.
- Kimlik bilgileri doğrulandıktan **sonra** 2FA gerekiyorsa ikinci ekran açılır ve başlığı **"Güvenlik doğrulaması"**, göstergesi **"2. ADIM"** olur.

#### Giriş formu gereksinimleri

| Gereksinim | Detay |
|---|---|
| Autocomplete | E-posta `autocomplete="username"`, şifre `autocomplete="current-password"` — parola yöneticisi uyumu |
| Şifre göster/gizle | Alan içinde sağda göz düğmesi; `aria-pressed` + değişen `aria-label` |
| Caps Lock uyarısı | Şifre alanı odaktayken Caps Lock açıksa alan altında amber satır, `role="status"` |
| Gönderim | Enter ile gönderilir |
| Yükleniyor | Buton içinde spinner + "Giriş yapılıyor…"; işlem sırasında alanlar kilitlenir |
| Hata | Kart üstünde tek satır: "E-posta veya şifre hatalı" — **hangisinin yanlış olduğu söylenmez** (kullanıcı numaralandırma engeli). Kalan deneme sayısı gösterilir; 5. denemede geçici kilit |

#### TOTP girişi — davranış sözleşmesi

Görsel olarak 6 kutu, **teknik olarak tek erişilebilir alan** gibi davranır:

| Davranış | Uygulama |
|---|---|
| Toplu yapıştırma | 6 haneli kod tek `paste` ile kutulara dağıtılır |
| Otomatik doldurma | İlk alanda `autocomplete="one-time-code"` → iOS/Android SMS-TOTP autofill |
| Mobil klavye | `inputmode="numeric"` + `pattern="[0-9]*"` → rakam tuş takımı |
| Backspace | Dolu kutuda siler; **boş kutuda bir öncekine atlar ve onu siler** |
| İleri gitme | Rakam girilince otomatik sonraki kutuya |
| Ekran okuyucu | `role="group"` + `aria-label="6 haneli doğrulama kodu"`; her kutuda `aria-label="n. hane"` |
| Odak | Aktif kutuda 2px lacivert halka |

#### Zorunlu 2FA kurulumu — iki adım

**1/2 — Uygulamayı bağlama**
- QR alanı masaüstünde **150×150px** (kabul aralığı 140–160)
- Yanında: elle giriş anahtarı (mono font), **"Anahtarı kopyala"**, **"QR kodu yenile"**
- Amber uyarı: *"Bu anahtarı kimseyle paylaşmayın. Piravel OS ekibi dahil hiç kimse sizden bu anahtarı istemez."*
- Altında TOTP alanı ile doğrulama
- **Mobil:** QR **üstte ortalanmış**, açıklama ve düğmeler **altında**

**2/2 — Kurtarma kodları** (üç kapı, üçü de geçilmeden tamamlanamaz)
1. Kullanıcı **"Kodları kopyala" VEYA "Dosya olarak indir"** işlemlerinden **en az birini** yapar (yalnız indirme zorunlu değildir)
2. **"Kurtarma kodlarını güvenli bir yere kaydettim"** onayını verir
3. **SA ve FIN rolleri için:** rastgele seçilen bir kurtarma kodu (örn. "3. kodu girin") tekrar girilir
- Kodlar masaüstünde 2 kolon, **mobilde tek kolon**
- Kart altında kalıcı not: *"Bu kodlar bir daha gösterilmez. Yeni kod üretilirse eskiler geçersiz olur."*

### 16.2 Ana dashboard
- **Amaç:** "Şirketin bugünkü durumu nedir?" — 5 saniyede cevap. **Hiyerarşi:** metrikler → dikkat isteyenler → eğilim.
- **Üst:** `display` başlık "Genel Bakış" + dönem seçici (bu ay varsayılan).
- **İçerik (SA/FIN):** (1) Metrik şeridi — 4 sade sayı bloğu (kart değil, çizgiyle ayrılmış): Beklenen, Tahsil edilen, Gecikmiş (kırmızı), Net nakit. `num-lg`, altında `small` karşılaştırma. (2) İki kolon: solda "Dikkat gerektirenler" listesi (geciken alacaklar, süresi dolacak sözleşmeler, yaklaşan ödemeler — tek birleşik, önem sıralı liste); sağda toplam banka bakiyesi + hesap dökümü mini tablosu. (3) Nakit akışı çizgi grafiği (90 gün: gerçekleşen + beklenen kesikli). **(OPS/MEM):** yalnız görev kartları ve kendi işleri — finans bölümleri render edilmez.
- **1°:** yok (dashboard okunur). **2°:** her listeden ilgili modüle geçiş.
- **Tablo/kart:** metrik şeridi + listeler; büyük KPI kartı yok. **Mobil:** metrikler 2×2, listeler alt alta, grafik en sonda.
- **Boş:** ilk kurulumda metrikler `—` + "Başlamak için bir marka ve sözleşme ekleyin" yönlendirme kartı.

### 16.3 Marka listesi
- **Amaç:** markaya hızlı ulaşım + portföy görünümü. **Üst:** başlık + "Yeni Marka" (primary).
- **İçerik:** filtre çubuğu (arama, durum, sorumlu) + tablo: Marka (logo damgası 24px + ad + risk noktası), Durum rozeti, Sorumlu, Aktif sözleşme sayısı, [SA/FIN: Aylık tutar, Açık bakiye], Son işlem.
- **1°:** Yeni Marka. **2°:** satır ⋯ (düzenle, durum değiştir). **Tablo/kart:** tablo (kart ızgarası değil — 50+ markada kartlar dağılır). **Mobil:** öncelikli kolonlar: ad, durum, [bakiye]. **Boş:** ilk kullanım deseni.

### 16.4 Marka detay sayfası
- **Amaç:** "bu müşteriyle her şey" tek yerde. **Hiyerarşi:** kimlik → finans özeti → sekmeli detay.
- **Üst:** marka adı (`display`) + durum rozeti + risk noktası; sağda ⋯ (durum değiştir, düzenle, sil).
- **İçerik:** 8+4 kolon. Ana: sekmeler — Genel Bakış / Yetkililer / Sözleşmeler / Alacaklar / Giderler / Görevler / Dosyalar / Geçmiş(audit). Genel Bakış: özet çizgi-ayrılmış metrikler (toplam gelir, açık bakiye, gecikme) + son hareketler listesi. Yan kolon: iletişim kartı (birincil yetkili, tel/e-posta tıklanabilir), marka bilgi kartı (vergi no, sektör, site).
- **1°:** sekmeye göre değişir (Sözleşmeler → "Yeni Sözleşme"). **2°:** sekme içi satır işlemleri. **Mobil:** yan kolon üste daralır, sekmeler yatay kaydırılır. **Boş:** her sekmenin kendi boş durumu ("Bu markaya henüz görev yok").

### 16.5 Sözleşme detay sayfası
- **Amaç:** "ne söz verdik, ne alacağız, nerede duruyoruz". **Üst:** `PRV-2026-0001` (mono) + başlık + durum rozeti; sağda ⋯.
- **İçerik:** 8+4. Ana: (1) Kapsam kalemleri tablosu (miktar/birim/dönem; toplam-tutar uyuşmazlığında amber satır içi uyarı), (2) Üretilen alacaklar tablosu (dönem, vade, brüt, ödenen, durum). Yan: künye kartı (tarihler, ödeme günü, para birimi, KDV, fiyat artış dönemi — geri sayımlar: "yenilemeye 22 gün"), imzalı dosya bağlantısı.
- **1°:** taslakta **"Aktifleştir"** (onay modalı: üretilecek satır özeti gösterilir — "3 tahsilat satırı oluşturulacak"). Aktifte: "Sonlandır" (⋯ altında). **2°:** kalem düzenle (yalnız taslak). **Mobil:** künye üste. **Hata:** aktifleştirme çakışması 409 → açıklamalı modal.

### 16.6 Alacaklar ve tahsilatlar
- **Amaç:** kimden ne bekliyoruz, ne geldi. **Üst:** başlık + görünüm sekmesi: **Alacaklar | Tahsilat geçmişi** + "Manuel Alacak" (secondary), "Tahsilat Gir" (primary).
- **İçerik:** filtre (marka, durum, vade aralığı, `overdue` hızlı filtresi) + tablo: Marka, Açıklama/dönem, Vade, Brüt, Ödenen, **Kalan** (body-strong), Durum, Gecikme. Altta toplam satırı. Gecikenler varsayılan sıralamada üstte.
- **1°:** Tahsilat Gir (transaction formu açar → kaydet sonrası eşleştirme drawer'ına akar). **2°:** satır → detay drawer (tax_lines dökümü, allocation geçmişi, iade başlat).
- **Tablo/kart:** tablo. **Mobil:** marka+kalan+vade+durum. **Boş:** "Aktif sözleşme yok ya da pencere henüz üretmedi" ayrımı yapılır.

### 16.7 Giderler
- **Amaç:** ne ödeyeceğiz, ne ödedik; onay akışı. **Üst:** sekme: **Bekleyen | Ödenen | Tekrarlayanlar** + "Gider Ekle".
- **İçerik:** filtre (kategori, tedarikçi, marka, onay) + tablo: Kategori, Açıklama, Tedarikçi, [Marka], Vade, Tutar, Onay, Durum. Tekrarlayanlar sekmesi: şablon listesi (Adobe CC · aylık · 15'i · 2.400₺ · aktif) + "Tekrarlayan Gider Ekle".
- **1°:** Gider Ekle. **2°:** onayla (satır içi, FIN), şablon durdur. **Mobil:** kategori+tutar+vade+durum. **Boş:** sekme bazlı.

### 16.8 Banka hesapları
- **Amaç:** para nerede, ne kadar. **Üst:** başlık + "Hesap Ekle" + toplam bakiye (baz TL, `num-lg`).
- **İçerik:** hesap kartları tek sıra yatay özet (istisna olarak kart uygundur — hesap sayısı ≤8): banka adı, maskeli IBAN, para birimi, bakiye; tıklayınca altta o hesabın hareket tablosu: Tarih, Açıklama, Karşı taraf, [Marka], Yön/Tutar (− kırmızı), Eşleşmemiş kalan, Mutabakat. "Virman" butonu iki hesap seçtiren modal.
- **1°:** Hareket Ekle. **2°:** Virman, maskesiz IBAN (audit tooltip'li). **Mobil:** kartlar dikey, tablo öncelikli kolon. **Boş:** "Hesap tanımlayın — açılış bakiyesiyle başlar".

### 16.9 Tahsilat eşleştirme ekranı ⭐ (en kritik özel ekran)
- **Amaç:** gelen parayı doğru alacağa, doğru kurla bağlamak — hatasız. **Hiyerarşi:** hareket → aday alacaklar → eşleştirme özeti.
- **Üst:** başlık "Eşleştirme" + yalnız `unallocated>0` filtresi açık gelir.
- **İçerik:** iki panel. **Sol:** eşleşmemiş hareketler listesi (tarih, marka?, tutar, kalan). Birini seçince **sağ panel:** o markanın (markasızsa tümü + "önce marka bağla" uyarısı) açık alacakları — vade sıralı, kalan bakiyeli; her satırda tahsis inputu (varsayılan: kalanın tamamı, FIFO önerisi). Çapraz kurda: kur alanı `exchange_rates` önerisiyle dolu, düzenlenebilir; canlı çeviri gösterilir ("42.500₺ ÷ 35,42 = 1.200,00$"). Altta **özet çubuğu:** hareket toplamı − tahsis edilen = kalan (avans) — canlı, `body-strong`.
- **1°:** "Eşleştir" (özet doğruysa aktif; `OVER_ALLOCATION` engeli inputta anlık). **2°:** "marka bağla", satır kaydır/temizle.
- **Tablo/kart:** çift panel liste. **Mobil:** adım adım sihirbaza döner (hareket seç → alacak seç → onayla). **Hata:** kilitlenme/yarış 409 → "Kayıt başka işlemle değişti, yenilendi" yumuşak yenileme. **Boş:** "Eşleşmemiş tahsilat yok 🎉 değil — sade: 'Tüm tahsilatlar eşleşmiş durumda.'"

### 16.10 Müşteri avansları
- **Amaç:** kimin parası bizde bekliyor. **Üst:** başlık + toplam avans tutarı.
- **İçerik:** iki bölüm: (1) marka bazlı gruplu tablo: Marka, Hareket tarihi, Tutar, Bekleyen kısım, Yaş — satır aksiyonu "Alacağa uygula" (eşleştirme ekranına o hareketle gider) / "İade et" (onay modalı: `refund_of` bağıyla çıkış hareketi). (2) **Sahipsiz tahsilatlar** ayrı başlıkla altta, amber sol çizgili; aksiyon "Marka bağla".
- **1°:** Alacağa uygula. **2°:** İade, marka bağla. **Mobil:** öncelikli kolonlar. **Boş:** "Bekleyen avans yok."

### 16.11 Görevler
- **Amaç:** kim ne yapıyor, ne gecikti. **Üst:** görünüm: **Liste | Pano** + "Görev Ekle" + hızlı filtre (Benim işlerim / Gecikenler).
- **İçerik:** liste varsayılan: Başlık, Marka, Sorumlu (avatar+ad), Teslim (geçmişse kırmızı), Öncelik, Durum. Pano: durum kolonlu kanban, kart = başlık+marka+teslim+avatar (sürükle-bırak durum değiştirir). MEM yalnız kendi işlerini görür; durum değişimi dışında alanlar salt okunur.
- **1°:** Görev Ekle (OPS kendi markalarına). **2°:** satır/kart → drawer. **Mobil:** liste (pano gizlenir). **Boş:** rol bazlı metin ("Sana atanmış iş yok").

### 16.12 Bildirim merkezi
- **Amaç:** kaçırmamak. **Üst:** sekme: Tümü | Okunmamış + "tümünü okundu say".
- **İçerik:** gün başlıklı gruplu liste; satır: önem çizgisi + başlık + `small` açıklama + zaman + `action_url` oku; kritikler (gecikme, sözleşme bitişi) grupta üstte. Zil menüsü son 5 + "tümünü gör".
- **1°:** satıra tıkla → ilgili kayıt. **Mobil:** aynı. **Boş:** "Her şey yolunda — bildirim yok."

### 16.13 Ayarlar
- **Amaç:** sistem parametreleri (yalnız SA; FIN okur). **İçerik:** sol ikincil menü: Şirket bilgileri / Kullanıcılar / Parametreler (bildirim günleri, ufuk — baz para birimi **salt okunur gösterilir**, "değiştirilemez" notu) / Kur girişi / Güvenlik (oturumlar). Kullanıcılar: tablo + rol rozetleri + davet/pasifleştir + "oturumları iptal et". Formlar 720px tek kolon.
- **1°:** bölüme göre kaydet. **Hata:** `base_currency` değişim denemesi diye bir yol UI'da yoktur.

### 16.14 Audit log
- **Amaç:** "kim, neyi, ne zaman" — şüpheye kesin cevap. **Üst:** filtre: kullanıcı, işlem türü, kayıt türü, tarih.
- **İçerik:** salt okunur yoğun tablo (32px satır): Zaman (mono), Kullanıcı, İşlem rozeti, Kayıt (`entity_label` tıklanabilir), Özet. Satır genişletme: `changes` diff'i — eski değer üstü çizili kırmızı, yeni yeşil, alan adları Türkçe eşlenmiş. Dışa aktarım yok (görüntüleme yeri burasıdır).
- **Mobil:** okunur, filtre daralır. **Boş:** filtre sonucu boş metni.

### 16.15 Geri dönüşüm kutusu
- **Amaç:** yanlış silmeyi geri almak. **Üst:** kayıt türü sekmeleri.
- **İçerik:** tablo: Kayıt, Türü, Silen, Silinme tarihi, Kalan süre (90 günden geri sayım — son 7 gün amber). Aksiyon: "Geri yükle" (üst kayıt silinmişse pasif + neden tooltip'i).
- **1°:** Geri yükle (onay modalı). **Mobil:** öncelikli kolon. **Boş:** "Çöp kutusu boş."

---

## 17. Anti-pattern listesi (uygulanmaz)

1. Mor/mavi gradient zeminler, "AI dashboard" estetiği
2. Her veri parçasını ayrı yuvarlak karta koymak (kart enflasyonu)
3. 12px+ border-radius, hap şeklinde konteynerler
4. Glassmorphism, blur zeminler, neon/glow
5. Dev KPI kartları (72px rakamlar) — metrik şeridi 22px'tir
6. Her satırda/başlıkta ikon; anlamsız dekoratif ikonlar
7. Bootstrap/AdminLTE/shadcn-template görünümü (varsayılan tema izleri)
8. Renkli gölgeler, çok katmanlı gölge yığınları
9. Aşırı beyaz boşlukla 5 satırlık tablo gösterip kaydırtmak
10. Pasta grafik, 3D grafik, gradient dolgulu alan grafikleri
11. Altını başarı/CTA rengi olarak kullanmak
12. Konfeti, zıplayan animasyon, oyunlaştırılmış geri bildirim
13. Skeleton yerine tam sayfa spinner
14. Yalnız renkle durum anlatmak
15. "Güzel ama kullanışsız": ekran görüntüsü için tasarlanmış, gerçek 200 satırla test edilmemiş layout

---

## 18. Tasarım kalite kontrol listesi (her ekran, kod incelemesi gibi)

- [ ] Sayfada tek `display` başlık, tek primary buton var
- [ ] Altın kullanımı §3 sözleşmesine uygun (<%5, yalnız izinli yerler)
- [ ] Tüm boşluklar 4/8 skalasından; radius ≤8px
- [ ] Tutarlar tabular, sağa hizalı, kuruşlu, doğru sembol konumu
- [ ] Rakam kolonlarında toplam/altbilgi satırı var (finans tablolarında)
- [ ] Durum yalnız renkle değil metin/işaretle de veriliyor
- [ ] Boş, yükleme (skeleton), hata durumları tanımlı ve uygulanmış
- [ ] OPS/MEM görünümü kontrol edildi — tutar sızıntısı yok, layout bozulmuyor
- [ ] Klavye: odak halkası görünür, Esc/Enter/⌘K çalışıyor
- [ ] Kontrast AA doğrulandı (özellikle rozet çiftleri, koyu zemin metinleri)
- [ ] Mobil öncelikli kolon seti tanımlı; yatay taşma yok
- [ ] 200+ satır gerçek veriyle denendi (performans + görsel yoğunluk)
- [ ] Ekran, "hazır admin template'ten mi çıkmış?" testini geçiyor — geçmiyorsa neden farklı olduğunu söyleyemiyorsak yeniden bakılır

---

## 19. shadcn/ui özelleştirme sözleşmesi

shadcn/ui **yalnızca erişilebilir davranış altyapısıdır** (Radix tabanı: odak yönetimi, aria, klavye). Görsel kimlik tamamen bizim token'larımızdan gelir; varsayılan görünüm hiçbir bileşende olduğu gibi kalmaz.

| Bileşen alanı | Varsayılan shadcn | Piravel OS |
|---|---|---|
| radius | `0.5rem` genel | `--r-sm` 4px (kontroller), `--r-md` 6px (yüzeyler) |
| border | `hsl` gri | `--line-200/300` sıcak çizgiler; ayrım gölge değil çizgi |
| shadow | katmanlı varsayılan | §6'daki 3 seviye; kartta neredeyse görünmez |
| spacing | bileşen içi varsayılan | 4/8 skalası; input 36px, tablo satırı 40/32px |
| typography | Inter/Geist varsayımı | Instrument Sans + Fraunces + JetBrains Mono; tabular-nums globali |
| table | `Table` gevşek | yoğun mod, yapışkan başlık, sağ hizalı rakam, altbilgi toplam satırı, satır-drawer deseni |
| form controls | varsayılan | üst etiket standardı, tutar inputu (para birimi ekli, canlı binlik), hata deseni |
| dialog/drawer | ikisi de merkezde eğilimli | modal=karar, drawer=kayıt kuralı (§9); drawer 480–640, yapışkan aksiyon çubuğu |
| badge | dolgun, yuvarlak | 20px, `--r-sm`, işlevsel çiftler, `caption` metin |
| button | `default` siyah | primary lacivert; 4 tür sözleşmesi; sayfa başına tek primary |
| focus | `ring` mavi | açıkta `--navy-500`, koyuda `--gold-500` |

**Uygulama:** tüm değerler `globals.css` CSS değişkenleri + Tailwind theme eşlemesiyle tanımlanır (Sprint 0 "design token altyapısı" işi). Bileşen varyantları `cva` ile Piravel türlerine bağlanır. Yeni bileşen eklerken varsayılan stiliyle commit'lenemez — token'lara bağlanmadan `/styleguide` sayfasına eklenir, orada onaylanır.
