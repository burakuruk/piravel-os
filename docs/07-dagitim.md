# 07 — Dağıtım notları

Bu belge yalnız **çalıştırma ortamının** doğru kurulmasını anlatır. Mimari
kararlar için PRD (`00`), yetki için `02`, uçlar için `03`.

---

## 1. Zorunlu ortam değişkenleri

Aşağıdakiler eksik veya geçersizse uygulama **bilerek başlamaz**
(`src/lib/env.ts`). Sessiz bir varsayılana düşmek, güvenlik ayarının
kapalı olduğunu gizlerdi.

| Değişken | Kural | Neden |
|---|---|---|
| `BETTER_AUTH_SECRET` | ≥32 bayt, placeholder olamaz | Oturum imzalama sırrı. Kodda varsayılanı YOK; olsaydı repoyu okuyan herkes oturum üretebilirdi |
| `INVITE_TOKEN_PEPPER` | ≥32 bayt, `BETTER_AUTH_SECRET`'ten **farklı** | Davet token'larının HMAC pepper'ı. Ortak sır kullanılsaydı birinin rotasyonu diğerini sessizce bozardı |
| `TRUSTED_PROXY_HOPS` | üretimde **zorunlu**, tam sayı, `1..8` | Aşağıya bakın |
| `DATABASE_URL` | kısıtlı `piravel_app` rolü | Runtime; `audit_logs`'ta yalnız INSERT + SELECT |
| `DATABASE_ADMIN_URL` | owner rolü | Yalnız migration ve rol kurulumu |

Sır üretimi:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**`AUDIT_TEST_RUN_ID_ENABLED` üretimde ASLA set edilmez.** Açık kalırsa herhangi
bir istemci audit kayıtlarını kendi seçtiği etiketle işaretleyip denetim
sorgularını yanıltabilir.

---

## 2. `TRUSTED_PROXY_HOPS` — hosting ortamına göre belirlenir

Bu değer **uygulamanın önündeki ters proxy sayısıdır**. Tahmin edilmez,
altyapıya bakılarak yazılır.

### Neden zorunlu

`x-forwarded-for` istemci tarafından yazılabilir. Yanlış yapılandırma iki
yönde de zarar verir:

| Hata | Sonuç |
|---|---|
| Fazla güven (gerçekten olandan büyük) | Saldırgan sahte adres yazıp hız sınırını ve hesap kilidini atlar |
| Hiç güvenme (`0`) | İstemci IP'si çözülemez; **tüm kullanıcılar tek hız sınırı kovasına düşer** ve bir kişinin denemeleri herkesi kilitler |

Bu yüzden üretimde eksik, `0`, negatif veya sayı olmayan değer bir **başlatma
hatasıdır**.

### Nasıl sayılır

Zincir **sağdan** okunur. Her ters proxy gördüğü eşi listenin sonuna ekler:

```
x-forwarded-for: <istemcinin uydurduğu>, …, <proxy'nin eklediği gerçek>
                  └─ saldırgan buraya yazar ─┘   └──── güvenilir ────┘
```

| Ortam | Değer |
|---|---|
| Tek nginx / Caddy / HAProxy | `1` |
| Tek bulut yük dengeleyici (ALB, GCLB) | `1` |
| CDN (Cloudflare vb.) + arkasında yük dengeleyici | `2` |
| Doğrudan Node'a bağlanan kurulum (proxy yok) | Bu senaryo **desteklenmiyor** — IP tabanlı korumalar anlamsız olur; önüne bir proxy koyun |
| Geliştirme / CI | `1` (doğrulama script'leri istemcileri `x-forwarded-for` ile simüle eder) |

**Doğrulama:** dağıtımdan sonra iki farklı ağdan istek yapın ve
`audit_logs.ip_address` alanında **farklı** ağ önekleri (`/24`) göründüğünü
kontrol edin. Hepsi aynı görünüyorsa değer yanlıştır.

> Hosting altyapısı henüz seçilmedi. Seçildiğinde bu tablodan doğru satır
> uygulanır; ara değer olarak rastgele bir sayı yazılmaz.

---

## 3. `INVITE_TOKEN_PEPPER` rotasyonu

Pepper değişince mevcut bekleyen davetler **doğrulanamaz** hâle gelir (token
hash'leri artık eşleşmez). Sıra:

1. Tüm `pending` davetleri iptal et
2. Pepper'ı değiştir ve uygulamayı yeniden başlat
3. Kullanıcılara yeni davet üret

Adım 1 atlanırsa kullanıcılar sessizce çalışmayan bağlantılarla kalır.

---

## 4. Bakım işleri

| İş | Durum |
|---|---|
| `auth_rate_limit` temizliği | `eskiSayaclariTemizle()` yazıldı, **henüz zamanlanmadı**. Tablo kendiliğinden küçülmez: her yeni IP hash'i kalıcı bir satır bırakır. Sprint 6'daki günlük job'a bağlanacak |

Temizlik istek yolunda çalıştırılmaz — orada her istek bir tablo taramasının
bedelini öderdi.
