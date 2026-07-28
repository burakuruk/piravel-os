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

## 4. Yerel veritabanı container'ı

Geliştirme veritabanı **yalnız Docker Compose ile** yönetilir:

```bash
docker compose up -d      # başlat
docker compose ps         # durum
docker compose stop       # durdur (veri kalır)
```

⚠ **`docker run` ile elle container başlatmayın.** Öyle başlatılan bir container
compose etiketleri taşımaz ve verisini **anonim** bir volume'da tutar; o volume
`docker volume prune` veya `docker volume ls` çıktısında rastgele bir hash
olarak görünür ve yanlışlıkla silinmesi çok kolaydır. Compose ise verileri
isimli `piravel_yonetim_sistemi_piravel-pgdata` volume'unda tutar.

Doğrulama:

```bash
docker inspect piravel-pg --format '{{index .Config.Labels "com.docker.compose.project"}}'
# → piravel_yonetim_sistemi   (boş çıkıyorsa container compose yönetiminde DEĞİL)
```

### Yedek alma ve geri yükleme

Container değiştirmeden veya sileceğiniz her durumdan önce:

```bash
# 1. Yedek — roller cluster seviyesindedir, ayrı alınır
docker exec piravel-pg pg_dumpall -U piravel --roles-only > roller.sql
docker exec piravel-pg pg_dump -U piravel -d piravel_os --clean --if-exists > piravel_os.sql

# 2. Sayımları kaydet (KESİN sayım; pg_stat_user_tables TAHMİNDİR, kullanmayın)
docker exec piravel-pg psql -U piravel -d piravel_os -c \
  "SELECT 'users', count(*) FROM users UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;"

# 3. Yedeği ÖNCE tek kullanımlık bir container'da aç — asıl veriye dokunmadan
docker run -d --name pg-deneme -e POSTGRES_USER=piravel -e POSTGRES_PASSWORD=piravel \
  -e POSTGRES_DB=piravel_os postgres:16
docker exec -i pg-deneme psql -U piravel -d postgres < roller.sql
docker exec -i pg-deneme psql -U piravel -d piravel_os < piravel_os.sql
# sayımları karşılaştır, sonra: docker rm -f pg-deneme

# 4. Geri yükleme sırası: ÖNCE roller, SONRA veritabanı
#    (dump, piravel_app rolüne GRANT verir; rol yoksa yükleme hata verir)
```

Eski container **doğrulama bitene kadar silinmez**; adı çakışıyorsa
`docker rename piravel-pg piravel-pg-eski` ile serbest bırakılır. Silme, yalnız
yeni veritabanı tam doğrulandıktan sonra yapılır.

## 5. Bakım işleri

| İş | Durum |
|---|---|
| `auth_rate_limit` temizliği | `eskiSayaclariTemizle()` yazıldı, **henüz zamanlanmadı**. Tablo kendiliğinden küçülmez: her yeni IP hash'i kalıcı bir satır bırakır. Sprint 6'daki günlük job'a bağlanacak |

Temizlik istek yolunda çalıştırılmaz — orada her istek bir tablo taramasının
bedelini öderdi.
