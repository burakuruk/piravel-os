/**
 * Görsel onay ekran görüntülerini üretir — docs/previews/
 *
 * Headless Chromium kullanır: tarayıcı çerçevesi, sekme, adres çubuğu veya
 * geliştirme paneli artefaktı YOKTUR. Yalnızca sayfanın kendisi.
 *
 * ⚠ GÜVENLİK (PRD §6.3): Görüntülenen ekranlar yalnız sahte fixture verisi
 * içerir (example.com kullanıcıları). 2FA kurulumu için üretilen TOTP anahtarı
 * yalnız bu koşu boyunca bellekte yaşar; hiçbir dosyaya yazılmaz. Kurtarma
 * kodlarının GÖRÜNDÜĞÜ hiçbir gerçek ekran görüntülenmez — kurulumun o adımı
 * yalnız wireframe olarak (sahte kodlarla) belgelenir.
 *
 * ⚠ PRODUCTION SUNUCUSUNA karşı çalışır (npm run screenshots bunu kendisi
 * ayağa kaldırır). Sebep: dev sunucusunda HMR WebSocket'i 127.0.0.1 üzerinden
 * kurulamıyor ve React hidrate olmuyor → drawer gibi etkileşimler ölü kalıyor.
 * Ayrıca görseller kullanıcının gerçekte göreceği üretim çıktısını gösterir.
 *
 * Kullanım: npm run screenshots
 */
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import pg from "pg";
import { tazeTotp } from "./_totp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// .env'i bağımlılıksız oku (Node 22 --env-file'a alternatif, cross-platform)
try {
  for (const line of readFileSync(join(here, "..", ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* .env yoksa ortam değişkenleri kullanılır (CI) */
}
const outDir = join(here, "..", "docs", "previews");
mkdirSync(outDir, { recursive: true });

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";

/** clip: sabit kırpma · section: n. bölümü (tam ekran adım) yakala */
/** Oturum gerektiren sayfalar için: giriş yapıp çerezi taşı. */
const OTURUM = {
  // needs2fa: rolü gereği 2FA zorunlu olanlar. Diğerleri için kurulum
  // YAPILMAZ — aksi hâlde fixture kirlenir ve doğrulama testleri bozulur.
  sa: { email: "admin@example.com", password: "gelistirme-test-parolasi", needs2fa: true },
  fin: { email: "finance@example.com", password: "gelistirme-test-parolasi", needs2fa: true },
  ops: { email: "operations@example.com", password: "gelistirme-test-parolasi", needs2fa: false },
  mem: { email: "member@example.com", password: "gelistirme-test-parolasi", needs2fa: false },
};

const shots = [
  { file: "01-kabuk-1440x900.png", path: "/", w: 1440, h: 900, auth: "fin", clip: { x: 0, y: 0, width: 760, height: 900 } },
  { file: "02-dashboard-1440x900.png", path: "/", w: 1440, h: 900, auth: "fin" },
  { file: "03-dashboard-1280.png", path: "/", w: 1280, h: 860, auth: "fin" },
  { file: "04-dashboard-mobil-375x812.png", path: "/", w: 375, h: 812, auth: "fin" },

  // ── Login / 2FA wireframe — masaüstü ──
  { file: "05-giris-1440x900.png", path: "/wireframe/giris", w: 1440, h: 900 },
  { file: "06-giris-durumlar-1440x1000.png", path: "/wireframe/giris-durumlar", w: 1440, h: 1000 },
  { file: "07-2fa-dogrulama-1440x900.png", path: "/wireframe/2fa-dogrulama", w: 1440, h: 900 },
  { file: "08-2fa-kurulum-1440x1000.png", path: "/wireframe/2fa-kurulum", w: 1440, h: 1000 },
  { file: "09-kurtarma-kodlari-1440x1100.png", path: "/wireframe/kurtarma-kodlari", w: 1440, h: 1100 },

  // ── Login / 2FA wireframe — mobil ──
  { file: "10-giris-mobil-375x812.png", path: "/wireframe/giris", w: 375, h: 812 },
  { file: "11-2fa-dogrulama-mobil-375x812.png", path: "/wireframe/2fa-dogrulama", w: 375, h: 812 },
  { file: "12-2fa-kurulum-mobil-375x950.png", path: "/wireframe/2fa-kurulum", w: 375, h: 950 },
  { file: "13-kurtarma-kodlari-mobil-375x1000.png", path: "/wireframe/kurtarma-kodlari", w: 375, h: 1000 },

  // ── Sprint 2 wireframe'leri (onay öncesi) ──
  // Oturum gerektirmez: /wireframe public prefix'te.
  { file: "60-w-marka-listesi-1440x900.png", path: "/wireframe/marka-listesi", w: 1440, h: 900 },
  { file: "61-w-marka-yeni-1440x1100.png", path: "/wireframe/marka-yeni", w: 1440, h: 1100 },
  { file: "62-w-marka-detay-1440x1000.png", path: "/wireframe/marka-detay", w: 1440, h: 1000 },
  { file: "63-w-marka-yetkili-1440x1100.png", path: "/wireframe/marka-yetkili", w: 1440, h: 1100 },
  { file: "64-w-hizmet-katalogu-1440x900.png", path: "/wireframe/hizmet-katalogu", w: 1440, h: 900 },
  { file: "65-w-marka-ekip-atama-1440x850.png", path: "/wireframe/marka-ekip-atama", w: 1440, h: 850 },
  // Mobil kareler kart düzenine geçtiği için daha uzun; kesilmesin diye
  // viewport yükseklikleri içerikten büyük tutuldu.
  { file: "70-w-marka-listesi-mobil-375x1350.png", path: "/wireframe/marka-listesi", w: 375, h: 1350 },
  { file: "71-w-marka-yeni-mobil-375x1100.png", path: "/wireframe/marka-yeni", w: 375, h: 1100 },
  { file: "72-w-marka-detay-mobil-375x1750.png", path: "/wireframe/marka-detay", w: 375, h: 1750 },
  { file: "73-w-marka-yetkili-mobil-375x1100.png", path: "/wireframe/marka-yetkili", w: 375, h: 1100 },
  { file: "74-w-hizmet-katalogu-mobil-375x950.png", path: "/wireframe/hizmet-katalogu", w: 375, h: 950 },
  { file: "75-w-marka-ekip-atama-mobil-375x1100.png", path: "/wireframe/marka-ekip-atama", w: 375, h: 1100 },

  /**
   * ── Sprint 3 wireframe'leri (onay öncesi) ──
   *
   * Ortak `w3` eki: `SCREENSHOT_FILTER=w3` ile yalnız bu 18 kare çekilir.
   * Oturum gerektirmez — /wireframe public prefix'te.
   *
   * Mobil yükseklikler içerikten bilerek büyük tutuldu: kare `fullPage`
   * değil viewport çekimidir, kısa viewport içeriği keser.
   */
  { file: "110-w3-sozlesme-listesi-1440x860.png", path: "/wireframe/sozlesme-listesi", w: 1440, h: 860 },
  { file: "111-w3-sozlesme-yeni-1440x2020.png", path: "/wireframe/sozlesme-yeni", w: 1440, h: 2020 },
  { file: "112-w3-sozlesme-detay-1440x1240.png", path: "/wireframe/sozlesme-detay", w: 1440, h: 1240 },
  { file: "113-w3-sozlesme-kalemler-1440x990.png", path: "/wireframe/sozlesme-kalemler", w: 1440, h: 990 },
  { file: "114-w3-aktivasyon-stepup-1440x1110.png", path: "/wireframe/sozlesme-aktivasyon", w: 1440, h: 1110 },
  { file: "115-w3-sonlandirma-iptal-1440x1200.png", path: "/wireframe/sozlesme-sonlandirma", w: 1440, h: 1200 },
  { file: "116-w3-odeme-plani-1440x2630.png", path: "/wireframe/odeme-plani", w: 1440, h: 2630 },
  { file: "117-w3-liste-durumlar-1440x1040.png", path: "/wireframe/sozlesme-liste-durumlar", w: 1440, h: 1040 },
  { file: "118-w3-sozlesme-ops-1440x960.png", path: "/wireframe/sozlesme-ops", w: 1440, h: 960 },
  // REVİZE 3 ile eklenen iki ekran
  { file: "119-w3-yenileme-karti-1440x930.png", path: "/wireframe/sozlesme-yenileme", w: 1440, h: 930 },
  { file: "120-w3-hizmet-baglama-1440x1710.png", path: "/wireframe/sozlesme-hizmet-baglama", w: 1440, h: 1710 },

  { file: "130-w3-sozlesme-listesi-mobil-375x1550.png", path: "/wireframe/sozlesme-listesi", w: 375, h: 1550 },
  { file: "131-w3-sozlesme-yeni-mobil-375x2860.png", path: "/wireframe/sozlesme-yeni", w: 375, h: 2860 },
  { file: "132-w3-sozlesme-detay-mobil-375x2680.png", path: "/wireframe/sozlesme-detay", w: 375, h: 2680 },
  { file: "133-w3-sozlesme-kalemler-mobil-375x1840.png", path: "/wireframe/sozlesme-kalemler", w: 375, h: 1840 },
  { file: "134-w3-aktivasyon-stepup-mobil-375x1940.png", path: "/wireframe/sozlesme-aktivasyon", w: 375, h: 1940 },
  { file: "135-w3-sonlandirma-iptal-mobil-375x2280.png", path: "/wireframe/sozlesme-sonlandirma", w: 375, h: 2280 },
  { file: "136-w3-odeme-plani-mobil-375x4200.png", path: "/wireframe/odeme-plani", w: 375, h: 4200 },
  { file: "137-w3-liste-durumlar-mobil-375x1180.png", path: "/wireframe/sozlesme-liste-durumlar", w: 375, h: 1180 },
  { file: "138-w3-sozlesme-ops-mobil-375x1660.png", path: "/wireframe/sozlesme-ops", w: 375, h: 1660 },
  { file: "139-w3-yenileme-karti-mobil-375x1730.png", path: "/wireframe/sozlesme-yenileme", w: 375, h: 1730 },
  { file: "140-w3-hizmet-baglama-mobil-375x2010.png", path: "/wireframe/sozlesme-hizmet-baglama", w: 375, h: 2010 },

  // ── Sprint 1: GERÇEK ekranlar (wireframe değil) ──
  { file: "20-giris-gercek-1440x900.png", path: "/giris", w: 1440, h: 900 },
  { file: "21-giris-gercek-mobil-375x812.png", path: "/giris", w: 375, h: 812 },
  { file: "22-2fa-kurulum-zorunlu-1440x900.png", path: "/guvenlik-kurulumu", w: 1440, h: 900, auth: "sa", setupOnly: true },
  { file: "23-mobil-drawer-acik-375x812.png", path: "/", w: 375, h: 812, auth: "fin", openDrawer: true },
  { file: "24-mobil-drawer-mem-rolu-375x812.png", path: "/", w: 375, h: 812, auth: "mem", openDrawer: true },
];

/**
 * Ekran görüntüsü için gerçek oturum açar.
 *
 * 2FA'sı zorunlu roller (SA/FIN) için kurulum akışı GERÇEKTEN tamamlanır:
 * enable → TOTP doğrulama. Anahtar yalnız bu koşu boyunca bellekte yaşar,
 * hiçbir yere yazılmaz (PRD §6.3).
 *
 * `setupOnly=true` ise 2FA tamamlanmaz — amaç zorunlu kurulum ekranını
 * görüntülemektir.
 */
/** Koşu boyunca kullanıcı başına TOTP anahtarı (yalnız bellekte, diske yazılmaz). */
const anahtarlar = new Map();

/**
 * İstekler SAYFANIN İÇİNDEN (fetch) yapılır, Playwright'ın API istemcisinden
 * değil. Böylece origin, çerez alanı ve IP sürümü tarayıcıyla birebir aynı olur
 * — Better Auth'un CSRF kontrolü gerçek kullanıcı akışıyla aynı yolu izler.
 */
async function apiPost(page, path, body) {
  return page.evaluate(
    async ([p, b]) => {
      const res = await fetch(p, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      let json = null;
      try {
        json = await res.json();
      } catch {
        /* gövdesiz */
      }
      return { ok: res.ok, status: res.status, json };
    },
    [path, body],
  );
}

async function oturumAc(page, { email, password, needs2fa }, setupOnly = false) {
  /**
   * IP rate limit sayacını temizle. Koruma KAPATILMAZ — yalnız test fixture
   * durumu sıfırlanır; aksi hâlde art arda çekilen görüntüler gerçek limite
   * (10sn/3 giriş, 60sn/5 TOTP) takılır. Limitin kendisi verify-lockout.mjs
   * tarafından ayrıca sınanır.
   */
  await rateLimitTemizle();

  // fetch'in doğru origin'den çıkması için önce uygulamayı yükle
  await page.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });

  const signIn = await apiPost(page, "/api/auth/sign-in/email", { email, password });
  if (!signIn.ok) throw new Error(`Giriş başarısız (${email}): ${signIn.status}`);
  if (setupOnly) return;

  // 2FA zaten kuruluysa (önceki çekimde kurulmuş) önbellekteki anahtarla doğrula
  if (signIn.json?.twoFactorRedirect) {
    const secret = anahtarlar.get(email);
    if (!secret) throw new Error(`${email} için anahtar önbellekte yok`);
    const res = await apiPost(page, "/api/auth/two-factor/verify-totp", { code: await tazeTotp(secret) });
    if (!res.ok) throw new Error(`TOTP doğrulanamadı (${email}): ${res.status}`);
    return;
  }

  // Yalnız 2FA'sı ZORUNLU roller için kurulum tamamlanır; aksi hâlde
  // isteğe bağlı rollerin fixture durumu bozulur.
  if (!needs2fa) return;

  const enable = await apiPost(page, "/api/auth/two-factor/enable", { password });
  if (enable.ok) {
    const secret = new URL(enable.json.totpURI).searchParams.get("secret");
    anahtarlar.set(email, secret);
    await apiPost(page, "/api/auth/two-factor/verify-totp", { code: await tazeTotp(secret) });
  }
}

async function rateLimitTemizle() {
  const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await sql.connect();
  await sql.query("DELETE FROM auth_rate_limit");
  await sql.end();
}

/** Fixture kullanıcılarının 2FA durumunu sıfırla — script tekrar çalıştırılabilir olmalı. */
async function fixtureSifirla() {
  const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await sql.connect();
  const mails = Object.values(OTURUM).map((o) => o.email);
  await sql.query(
    "DELETE FROM auth_two_factor WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [mails],
  );
  await sql.query("UPDATE auth_user SET two_factor_enabled = false WHERE email = ANY($1)", [mails]);
  /**
   * ⚠ TOTP KİLİT DURUMU DA SIFIRLANIR.
   *
   * Bu script her kare için yeniden giriş yapar; bir kare çökerse ya da kod
   * aynı 30 saniyelik pencerede iki kez gönderilirse başarısız TOTP sayacı
   * artar ve 5 denemede hesap 15 dakika kilitlenir (auth-lockout §totp).
   * Kilit sonraki koşuya devredildiğinde giriş sessizce yarım kalır: oturum
   * çerezi vardır ama 2FA doğrulanmamıştır, korumalı sayfa /giris'e yönlenir
   * ve kare "alan bulunamadı" diye patlar. Sebep görselde görünmediği için
   * yanıltıcıdır — durum bu yüzden baştan temizlenir.
   *
   * Korumanın KENDİSİ kapatılmaz; yalnız fixture durumu sıfırlanır
   * (limitin davranışı verify:lockout tarafından sınanır).
   */
  await sql.query("DELETE FROM auth_security_state");
  await sql.query("DELETE FROM auth_login_attempts");
  await sql.end();
}

/**
 * Kullanıcı ekranları için sahte kadro.
 *
 * ⚠ Yalnız `sahte-*@example.com` adresleri; gerçek kişi verisi kullanılmaz.
 * Doğrudan SQL ile kurulur — bu bir davranış testi değil, görsel fixture'ı;
 * amaç her koşuda AYNI ekranın üretilmesi.
 */
const SAHTE_KADRO = {
  bekleyen: "sahte-bekleyen@example.com",
  pasif: "sahte-pasif@example.com",
  // Davet bağlantısı ekranı için form üzerinden oluşturulur
  yeni: "sahte-yeni@example.com",
};

/**
 * Görselde gösterilen SAHTE token.
 *
 * ⚠ Gerçek token ekran görüntüsüne ASLA girmez: görseller repoya commit'lenir
 * ve token bir kimlik bilgisidir. Yakalamadan hemen önce DOM'daki değer bununla
 * değiştirilir; "SAHTE" ibaresi görselin kendisinde de okunur.
 */
const SAHTE_TOKEN_URL =
  "https://piravel.example/davet/SAHTE-ORNEK-TOKEN-ekran-goruntusu-icin";

async function kullaniciFixtureleri() {
  const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await sql.connect();
  // `yeni` dahil: bir önceki koşuda form üzerinden oluşturulmuş olabilir
  const mails = Object.values(SAHTE_KADRO);
  await sql.query("DELETE FROM auth_user WHERE email = ANY($1)", [mails]);
  await sql.query("DELETE FROM users WHERE email = ANY($1)", [mails]);

  /**
   * `verify-users.mjs`'in ürettiği geçici kullanıcılar (`du-*`). Çöken bir
   * doğrulama koşusu bunları bırakabilir ve liste görseline sızarlar —
   * görsellerde yalnız okunabilir, sınırlı bir sahte kadro bulunmalı.
   */
  await sql.query("DELETE FROM auth_user WHERE email LIKE 'du-%@example.com'");
  await sql.query("DELETE FROM users WHERE email LIKE 'du-%@example.com'");

  const kur = async (email, ad, rol, aktif, aktiflesmis) => {
    const { rows } = await sql.query("SELECT gen_random_uuid() AS id");
    const id = rows[0].id;
    await sql.query(
      `INSERT INTO auth_user (id, name, email, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, false, now(), now())`,
      [id, ad, email],
    );
    await sql.query(
      `INSERT INTO users (id, email, full_name, role, is_active, activated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
      [id, email, ad, rol, aktif, aktiflesmis ? new Date() : null],
    );
    return id;
  };

  const bekleyenId = await kur(SAHTE_KADRO.bekleyen, "Sahte Bekleyen", "operations", false, false);
  const pasifId = await kur(SAHTE_KADRO.pasif, "Sahte Pasif", "member", false, true);
  const { rows: ops } = await sql.query(
    "SELECT id FROM users WHERE email = 'operations@example.com'",
  );

  // Bekleyen kullanıcıya açık bir davet: ekranda "Davet bekliyor" görünsün.
  // token_hash gerçek bir token'a ait DEĞİL — sabit, anlamsız bir dize.
  await sql.query(
    `INSERT INTO user_invitations (user_id, token_hash, expires_at, created_at, updated_at)
     VALUES ($1, $2, now() + interval '48 hours', now(), now())`,
    [bekleyenId, "gorsel-fixture-icin-anlamsiz-hash-degeri"],
  );
  await sql.end();
  return { bekleyenId, pasifId, opsId: ops[0]?.id };
}

/**
 * Oturum ekranı için sahte cihazlar.
 *
 * Görselde birden çok cihaz görünmeli; tek oturumla "diğerlerini kapat" ve
 * cihaz çeşitliliği anlatılamaz. Satırlar doğrudan eklenir — token değerleri
 * anlamsız sabitlerdir ve hiçbir gerçek oturuma karşılık gelmez.
 */
async function oturumFixtureleri(email) {
  const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await sql.connect();
  const { rows } = await sql.query("SELECT id FROM auth_user WHERE email = $1", [email]);
  const userId = rows[0]?.id;
  if (!userId) {
    await sql.end();
    return;
  }
  /**
   * Her kare yeni bir giriş yapar ve yeni bir oturum satırı bırakır; birikince
   * liste onlarca aynı satırla dolar. Bu koşuda AZ ÖNCE açılan oturum (mevcut
   * oturum) korunur, öncekiler temizlenir.
   */
  await sql.query(
    `DELETE FROM auth_session
      WHERE user_id = $1
        AND id <> (SELECT id FROM auth_session WHERE user_id = $1
                    ORDER BY created_at DESC LIMIT 1)`,
    [userId],
  );
  await sql.query("DELETE FROM auth_session WHERE token LIKE 'sahte-oturum-%'", []);

  const cihazlar = [
    [
      "sahte-oturum-telefon",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "203.0.113.24",
      "3 hours",
    ],
    [
      "sahte-oturum-mac",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "198.51.100.77",
      "2 days",
    ],
  ];
  for (const [token, ua, ip, yas] of cihazlar) {
    await sql.query(
      `INSERT INTO auth_session (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, now() + interval '7 days', $3, $4,
               now() - interval '${yas}', now() - interval '${yas}')`,
      [userId, token, ip, ua],
    );
  }
  await sql.end();
}

/**
 * Marka modülünün GÖRSEL fixture'ı.
 *
 * ⚠ Yalnız sahte veri: kodlar `SVZ/TKL/SAJ/ORN`, adresler `example.com`.
 * Doğrudan SQL ile kurulur — bu bir davranış testi değil, görsel fixture'ı;
 * amaç her koşuda AYNI ekranın üretilmesi. Davranış `verify:brands`in işi.
 *
 * Denetim satırları da elle eklenir: "Son değişiklikler" kartı boş görünmesin
 * ve zaman damgaları koşudan koşuya oynamasın.
 */
async function markaFixtureleri() {
  const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await sql.connect();

  const kodlar = ["SVZ", "TKL", "SAJ", "ORN"];
  const hizmetKodlari = ["SM", "SEO", "PR", "PROD"];

  /**
   * `verify:brands`in bıraktığı `DGR*` markaları ve `DGH*` hizmetleri.
   *
   * Çöken bir doğrulama koşusu bunları geride bırakabilir ve görsellere sızar
   * — hatta formül enjeksiyonu denemesi için oluşturulan marka adı ekran
   * görüntüsünde belirir. Görsellerde yalnız okunabilir, sınırlı bir sahte
   * kadro bulunmalı.
   */
  for (const [tablo, kolon, desen] of [
    ["brand_assignments", "brand_id", "DGR%"],
    ["brand_services", "brand_id", "DGR%"],
    ["brand_contacts", "brand_id", "DGR%"],
  ]) {
    await sql.query(
      `DELETE FROM ${tablo} WHERE ${kolon} IN (SELECT id FROM brands WHERE code LIKE '${desen}')`,
    );
  }
  await sql.query("DELETE FROM brands WHERE code LIKE 'DGR%'");
  await sql.query(
    "DELETE FROM brand_services WHERE service_id IN (SELECT id FROM services WHERE code LIKE 'DGH%')",
  );
  await sql.query("DELETE FROM services WHERE code LIKE 'DGH%'");

  // FK'ler RESTRICT: çocuklar önce düşer
  await sql.query(
    "DELETE FROM brand_assignments WHERE brand_id IN (SELECT id FROM brands WHERE code = ANY($1))",
    [kodlar],
  );
  await sql.query(
    "DELETE FROM brand_services WHERE brand_id IN (SELECT id FROM brands WHERE code = ANY($1))",
    [kodlar],
  );
  await sql.query(
    "DELETE FROM brand_contacts WHERE brand_id IN (SELECT id FROM brands WHERE code = ANY($1))",
    [kodlar],
  );
  /**
   * ⚠ audit_logs TEMİZLENMEZ ve temizlenemez: append-only trigger DELETE'i
   * reddeder (şema Karar 5). Markalar her koşuda yeni kimlikle kurulduğu için
   * eski denetim satırları ölü kimlikleri işaret eder ve hiçbir ekrana
   * girmez — tarihçenin dokunulmazlığı da bozulmaz.
   */
  await sql.query("DELETE FROM brands WHERE code = ANY($1)", [kodlar]);
  await sql.query(
    "DELETE FROM brand_services WHERE service_id IN (SELECT id FROM services WHERE code = ANY($1))",
    [hizmetKodlari],
  );
  await sql.query("DELETE FROM services WHERE code = ANY($1)", [hizmetKodlari]);

  const marka = async (code, name, legalName, industry, status, tax, taxOffice, email, phone) => {
    const { rows } = await sql.query(
      `INSERT INTO brands (code, name, legal_name, industry, status, tax_number, tax_office,
                           email, phone, address, onboarded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [code, name, legalName, industry, status, tax, taxOffice, email, phone,
       "Örnek Mahallesi, Sahte Caddesi No:1, İstanbul", "2026-03-12"],
    );
    return rows[0].id;
  };

  const svz = await marka("SVZ", "Sahte Vize A.Ş.", "Sahte Vize Danışmanlık Ltd. Şti.",
    "Danışmanlık", "active", "1234567890", "Örnek VD", "info@example.com", "+90 555 000 0001");
  await marka("TKL", "Test Klinik", "Test Sağlık Hizmetleri A.Ş.", "Sağlık", "active",
    "2345678901", "Deneme VD", "iletisim@example.com", "+90 555 000 0002");
  await marka("SAJ", "Sahte Ajans", null, "Pazarlama", "lead", null, null,
    "merhaba@example.com", null);
  await marka("ORN", "Örnek Mimarlık", "Örnek Mimarlık Ltd.", "Mimarlık", "suspended",
    "3456789012", "Sahte VD", "ornek@example.com", "+90 555 000 0004");

  const hizmet = async (code, name, unit, aktif) => {
    const { rows } = await sql.query(
      `INSERT INTO services (code, name, category, default_unit, is_active)
       VALUES ($1,$2,'genel',$3,$4) RETURNING id`,
      [code, name, unit, aktif],
    );
    return rows[0].id;
  };
  const sm = await hizmet("SM", "Sosyal medya yönetimi", "Aylık", true);
  const seo = await hizmet("SEO", "Arama motoru optimizasyonu", "Aylık", true);
  const pr = await hizmet("PR", "Basın ilişkileri", "Aylık", true);
  await hizmet("PROD", "İçerik prodüksiyon", "Proje", false);

  for (const h of [sm, seo, pr]) {
    await sql.query("INSERT INTO brand_services (brand_id, service_id) VALUES ($1,$2)", [svz, h]);
  }

  await sql.query(
    `INSERT INTO brand_contacts (brand_id, full_name, title, email, phone, is_primary)
     VALUES ($1,'Sahte Yetkili','Pazarlama Müdürü','sahte.yetkili@example.com','+90 555 111 0001',true),
            ($1,'Örnek Kişi','Finans','ornek.kisi@example.com','+90 555 111 0002',false)`,
    [svz],
  );

  const { rows: ops } = await sql.query(
    "SELECT id FROM users WHERE email = 'operations@example.com'",
  );
  if (ops[0]) {
    await sql.query("INSERT INTO brand_assignments (brand_id, user_id) VALUES ($1,$2)", [
      svz,
      ops[0].id,
    ]);
  }

  /**
   * ATANMAMIŞ ikinci bir operasyon kullanıcısı.
   *
   * Tek OPS kullanıcısı zaten atanmış olduğu için aday araması boş çıkıyor ve
   * "ekip atama" görseli ekranın asıl işini göstermiyordu. Bu kadro yalnız
   * görsel içindir; parolası yoktur, giriş yapamaz.
   */
  const ikinciOps = "sahte-ops2@example.com";
  // FK RESTRICT: kullanıcı silinmeden önce atamaları düşmeli
  await sql.query(
    "DELETE FROM brand_assignments WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [ikinciOps],
  );
  await sql.query("DELETE FROM users WHERE email = $1", [ikinciOps]);
  await sql.query("DELETE FROM auth_user WHERE email = $1", [ikinciOps]);
  const { rows: yeniId } = await sql.query("SELECT gen_random_uuid() AS id");
  await sql.query(
    `INSERT INTO auth_user (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1,'Sahte Operasyon',$2,false,now(),now())`,
    [yeniId[0].id, ikinciOps],
  );
  await sql.query(
    `INSERT INTO users (id, email, full_name, role, is_active, activated_at, created_at, updated_at)
     VALUES ($1,$2,'Sahte Operasyon','operations',true,now(),now(),now())`,
    [yeniId[0].id, ikinciOps],
  );

  // "Son değişiklikler" kartı için sabit denetim satırları
  const olay = async (etiket, mail, gunOnce) => {
    await sql.query(
      `INSERT INTO audit_logs (actor_email, action, entity_type, entity_id, entity_label, created_at)
       VALUES ($1,'update','brand',$2,$3, now() - ($4 || ' days')::interval)`,
      [mail, svz, etiket, String(gunOnce)],
    );
  };
  await olay("Hizmet eklendi: SEO", "admin@example.com", 1);
  await olay("Yetkili güncellendi", "operations@example.com", 2);
  await olay("Marka oluşturuldu", "admin@example.com", 130);

  await sql.end();
  return { svz };
}

await fixtureSifirla();
const { bekleyenId, pasifId, opsId } = await kullaniciFixtureleri();
const { svz: markaSvzId } = await markaFixtureleri();

/** Kullanıcı yönetimi ekranları — fixture kimlikleri hazır olduktan sonra eklenir. */
shots.push(
  { file: "30-kullanicilar-liste-1440x900.png", path: "/kullanicilar", w: 1440, h: 900, auth: "sa" },
  { file: "31-kullanici-yeni-1440x900.png", path: "/kullanicilar/yeni", w: 1440, h: 900, auth: "sa",
    async hazirla(page) {
      await page.fill("#yk-ad", "Sahte Yeni Kullanıcı");
      await page.fill("#yk-eposta", SAHTE_KADRO.yeni);
      await page.selectOption("#yk-rol", "operations");
    } },
  { file: "32-davet-baglantisi-1440x900.png", path: "/kullanicilar/yeni", w: 1440, h: 900, auth: "sa",
    async hazirla(page) {
      await page.fill("#yk-ad", "Sahte Yeni Kullanıcı");
      await page.fill("#yk-eposta", SAHTE_KADRO.yeni);
      await page.selectOption("#yk-rol", "operations");
      await page.getByRole("button", { name: /Oluştur ve davet üret/ }).click();
      await page.waitForSelector("#davet-url");
      /**
       * ⚠ Gerçek token'ı SAHTE bir değerle değiştir. Görsel repoya girdiği için
       * gerçek bir davet bağlantısı burada kalamaz.
       */
      await page.evaluate((sahte) => {
        const alan = document.querySelector("#davet-url");
        if (alan) alan.value = sahte;
      }, SAHTE_TOKEN_URL);
    } },
  { file: "33-kullanici-detay-1440x1000.png", path: `/kullanicilar/${opsId}`, w: 1440, h: 1000, auth: "sa" },
  { file: "34-rol-stepup-1440x1000.png", path: `/kullanicilar/${opsId}`, w: 1440, h: 1000, auth: "sa",
    async hazirla(page) {
      await page.selectOption('select[aria-label="Rol"]', "member");
      await page.getByRole("button", { name: "Rolü değiştir" }).click();
      await page.waitForSelector('[role="dialog"]');
    } },
  { file: "35-davet-bekleyen-1440x1000.png", path: `/kullanicilar/${bekleyenId}`, w: 1440, h: 1000, auth: "sa" },
  { file: "36-pasif-kullanici-1440x1000.png", path: `/kullanicilar/${pasifId}`, w: 1440, h: 1000, auth: "sa" },
  { file: "37-kullanicilar-fin-gorunum-1440x900.png", path: "/kullanicilar", w: 1440, h: 900, auth: "fin" },
  { file: "38-kullanicilar-mobil-375x812.png", path: "/kullanicilar", w: 375, h: 812, auth: "sa" },
  { file: "39-kullanici-detay-mobil-375x950.png", path: `/kullanicilar/${opsId}`, w: 375, h: 950, auth: "sa" },
);

/** Oturum yönetimi ekranları (Sprint 1 §2). */
const OTURUM_YOLU = "/ayarlar/oturumlar";
const GERCEKCI_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
shots.push(
  { file: "40-oturumlar-1440x900.png", path: OTURUM_YOLU, w: 1440, h: 900, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await oturumFixtureleri(OTURUM.sa.email);
      // Fixture DB'de değişti; sayfa sunucudan yeniden çizilmeli
      await page.reload({ waitUntil: "domcontentloaded" });
    } },
  { file: "41-oturumlar-mobil-375x900.png", path: OTURUM_YOLU, w: 375, h: 900, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await oturumFixtureleri(OTURUM.sa.email);
      await page.reload({ waitUntil: "domcontentloaded" });
    } },
  { file: "42-oturum-kapat-onayi-1440x900.png", path: OTURUM_YOLU, w: 1440, h: 900, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await oturumFixtureleri(OTURUM.sa.email);
      await page.reload({ waitUntil: "domcontentloaded" });
      // "Bu oturum" olmayan ilk satırın Kapat düğmesi
      await page.locator("table").getByRole("button", { name: "Kapat", exact: true }).first().click();
      await page.waitForSelector('[role="dialog"]');
    } },
  { file: "43-digerlerini-kapat-onayi-1440x900.png", path: OTURUM_YOLU, w: 1440, h: 900, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await oturumFixtureleri(OTURUM.sa.email);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Diğerlerini kapat" }).click();
      await page.waitForSelector('[role="dialog"]');
    } },
  { file: "44-mevcut-oturum-uyarisi-1440x900.png", path: OTURUM_YOLU, w: 1440, h: 900, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await oturumFixtureleri(OTURUM.sa.email);
      await page.reload({ waitUntil: "domcontentloaded" });
      // Sidebar'da da "Çıkış yap" var; locator TABLOYLA sınırlanır
      await page.locator("table").getByRole("button", { name: "Çıkış yap" }).first().click();
      await page.waitForSelector('[role="dialog"]');
    } },
  /**
   * Styleguide — `devOnly`: üretim sunucusunda 404 döner, kare atlanır.
   * Oturum gerekir (middleware public listeye almaz).
   */
  { file: "50-styleguide-1440x2400.png", path: "/styleguide", w: 1440, h: 2400, auth: "mem", devOnly: true },
  { file: "51-styleguide-mobil-375x2400.png", path: "/styleguide", w: 375, h: 2400, auth: "mem", devOnly: true },
  { file: "45-oturum-iptali-stepup-1440x1000.png", path: `/kullanicilar/${opsId}`, w: 1440, h: 1000, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await page.getByRole("button", { name: "Tüm oturumları kapat" }).click();
      await page.waitForSelector('[role="dialog"]');
    } },
);

/**
 * Sprint 2 — GERÇEK marka ekranları (wireframe değil).
 *
 * Roller bilerek karıştırılır: aynı ekranın SA ve OPS görünümü yan yana
 * konabilsin ve vergi alanlarının OPS'ta BULUNMADIĞI görselden de okunabilsin.
 */
const MARKA = `/markalar/${markaSvzId}`;
shots.push(
  // ── Liste ──
  { file: "80-markalar-1440x900.png", path: "/markalar", w: 1440, h: 900, auth: "sa" },
  { file: "81-markalar-mobil-375x1350.png", path: "/markalar", w: 375, h: 1350, auth: "sa" },
  { file: "82-markalar-filtreli-1440x800.png", path: "/markalar?durum=active&sektor=Sağlık", w: 1440, h: 800, auth: "sa" },
  { file: "83-markalar-bos-1440x700.png", path: "/markalar?q=bulunmayan-marka", w: 1440, h: 700, auth: "sa" },
  { file: "84-markalar-ops-kapsam-1440x800.png", path: "/markalar", w: 1440, h: 800, auth: "ops" },

  // ── Yeni marka ──
  { file: "85-marka-yeni-1440x1150.png", path: "/markalar/yeni", w: 1440, h: 1150, auth: "sa",
    async hazirla(page) {
      await page.fill("#ym-kod", "dnm");
      await page.fill("#ym-ad", "Deneme Marka");
      await page.fill("#ym-unvan", "Deneme Marka Ltd. Şti.");
      await page.fill("#ym-sektor", "Danışmanlık");
      await page.fill("#ym-eposta", "deneme@example.com");
      await page.fill("#ym-vergino", "9876543210");
    } },
  { file: "86-marka-yeni-mobil-375x1500.png", path: "/markalar/yeni", w: 375, h: 1500, auth: "sa" },
  { file: "87-marka-yeni-dogrulama-1440x900.png", path: "/markalar/yeni", w: 1440, h: 900, auth: "sa",
    async hazirla(page) {
      // Geçersiz kod: satır içi doğrulama mesajı görünsün
      await page.fill("#ym-kod", "A B");
      await page.fill("#ym-ad", "X");
      await page.click("#ym-unvan");
    } },

  // ── Detay ──
  { file: "88-marka-detay-1440x1500.png", path: MARKA, w: 1440, h: 1500, auth: "sa" },
  { file: "89-marka-detay-mobil-375x2350.png", path: MARKA, w: 375, h: 2350, auth: "sa" },
  { file: "90-marka-detay-ops-1440x1450.png", path: MARKA, w: 1440, h: 1450, auth: "ops" },
  { file: "91-marka-duzenleme-1440x1500.png", path: MARKA, w: 1440, h: 1500, auth: "sa",
    async hazirla(page) {
      await page.getByRole("button", { name: "Düzenle" }).first().click();
      await page.waitForSelector("#mk-ad");
    } },
  { file: "92-yetkili-ekleme-1440x1550.png", path: MARKA, w: 1440, h: 1550, auth: "sa",
    async hazirla(page) {
      await page.getByRole("button", { name: "+ Yetkili ekle" }).click();
      await page.waitForSelector("#myk-ad");
      await page.fill("#myk-ad", "Yeni Sahte Yetkili");
      await page.fill("#myk-unvan", "Operasyon Müdürü");
      await page.fill("#myk-eposta", "yeni.yetkili@example.com");
    } },
  { file: "93-marka-hizmet-ekleme-1440x1500.png", path: MARKA, w: 1440, h: 1500, auth: "sa",
    async hazirla(page) {
      await page.selectOption("#mh-secim", { label: "PROD · İçerik prodüksiyon" }).catch(async () => {
        // PROD pasif olduğu için listede yok; aktif olan ilk seçeneği seç
        const secenekler = await page.locator("#mh-secim option").allTextContents();
        const ilk = secenekler.find((s) => s.includes("·"));
        if (ilk) await page.selectOption("#mh-secim", { label: ilk });
      });
    } },

  // ── Ekip atama ──
  { file: "94-ekip-atama-1440x1500.png", path: MARKA, w: 1440, h: 1500, auth: "sa",
    async hazirla(page) {
      await page.fill("#ekip-ara", "");
      await page.getByRole("button", { name: "Ara", exact: true }).click();
      await page.waitForSelector("text=ARAMA SONUCU");
    } },
  { file: "95-atama-kaldirma-onayi-1440x1000.png", path: MARKA, w: 1440, h: 1000, auth: "sa",
    async hazirla(page) {
      await ekipKaldirTikla(page);
      await page.waitForSelector('[role="dialog"]');
    } },
  { file: "96-atama-stepup-1440x1000.png", path: MARKA, w: 1440, h: 1000, auth: "sa",
    async hazirla(page) {
      /**
       * Step-up penceresini GERÇEKTEN tetikler: SA'nın yükseltmesi silinir,
       * onay verilir ve uç SESSION_STALE döner. Pencere sahte değildir.
       */
      await stepUpSifirla(OTURUM.sa.email);
      await ekipKaldirTikla(page);
      await page.waitForSelector('[role="dialog"]');
      await page.getByRole("button", { name: "Atamayı kaldır" }).click();
      await page.waitForSelector("#stepup-parola");
    } },
  { file: "97-ekip-atama-fin-salt-okuma-1440x1400.png", path: MARKA, w: 1440, h: 1400, auth: "fin" },

  // ── Hizmet kataloğu ──
  { file: "98-hizmet-katalogu-sa-1440x900.png", path: "/hizmetler", w: 1440, h: 900, auth: "sa" },
  { file: "99-hizmet-katalogu-ops-1440x900.png", path: "/hizmetler", w: 1440, h: 900, auth: "ops" },
  { file: "100-hizmet-katalogu-mobil-375x1200.png", path: "/hizmetler", w: 375, h: 1200, auth: "sa" },
  { file: "101-hizmet-pasiflestirme-onayi-1440x900.png", path: "/hizmetler", w: 1440, h: 900, auth: "sa",
    async hazirla(page) {
      await page.getByRole("button", { name: "Pasifleştir" }).first().click();
      await page.waitForSelector('[role="dialog"]');
    } },
);

/**
 * SORUMLU EKİP kartındaki "Kaldır" düğmesine basar.
 *
 * ⚠ Sayfada birden çok "Kaldır" var (yetkili kişiler kartı da içeriyor) ve DOM
 * sırasında yetkililer önce gelir. `.first()` ile aramak yanlış pencereyi
 * açar; locator bu yüzden başlığıyla o bölüme sabitlenir.
 */
async function ekipKaldirTikla(page) {
  const ekip = page.locator("section", {
    has: page.getByRole("heading", { name: "Sorumlu ekip" }),
  });
  await ekip.getByRole("button", { name: "Kaldır" }).first().click();
}

/** Kullanıcının step-up kaydını siler — kapının kapalı hâli görüntülenebilsin. */
async function stepUpSifirla(email) {
  const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await sql.connect();
  await sql.query(
    "DELETE FROM auth_reauthentication WHERE user_id = (SELECT id::text FROM users WHERE email = $1)",
    [email],
  );
  await sql.end();
}

/**
 * Styleguide ÜRETİMDE 404 döner (bilerek). Görselleri bu yüzden yalnız
 * geliştirme sunucusuna karşı üretilebilir:
 *
 *   npm run dev
 *   SCREENSHOT_FILTER=styleguide PREVIEW_URL=http://localhost:3000 npm run screenshots
 *
 * Filtre verilmediğinde ve sunucu üretim modundaysa bu kareler atlanır —
 * script yarıda düşmesin, ama sessizce de geçmesin.
 */
const FILTRE = process.env.SCREENSHOT_FILTER;
const secilen = FILTRE ? shots.filter((s) => s.file.includes(FILTRE)) : shots;
if (FILTRE) console.log(`· Filtre: "${FILTRE}" → ${secilen.length} kare\n`);

const browser = await chromium.launch();
try {
  for (const shot of secilen) {
    const page = await browser.newPage({
      viewport: { width: shot.w, height: shot.h },
      deviceScaleFactor: 2, // retina netliği
      locale: "tr-TR",
      /**
       * Playwright varsayılan olarak `HeadlessChrome/…` gönderir; cihaz özeti
       * bunu Chrome olarak tanımaz ve görselde yanıltıcı bir satır çıkar.
       * Oturum ekranları gerçekçi bir UA ile alınır.
       */
      ...(shot.ua ? { userAgent: shot.ua } : {}),
    });
    // Oturum gerekiyorsa gerçek akışla giriş yap (2FA dahil)
    if (shot.auth) {
      await oturumAc(page, OTURUM[shot.auth], shot.setupOnly);
    }

    /**
     * ⚠ `networkidle` KULLANILMAZ. Sidebar, henüz var olmayan Sprint 2+
     * rotalarına (`/markalar`, `/alacaklar`, …) Link veriyor; Next bunları
     * düşük öncelikli RSC prefetch'i olarak istiyor ve Chromium bu istekleri
     * askıda tutuyor. "Sıfır bağlantı" durumu hiç oluşmadığından `networkidle`
     * 30 sn'de zaman aşımına düşer — sunucu aynı rotaları ~36 ms'de yanıtlasa
     * bile. Playwright de bu koşulu önermiyor.
     *
     * Yerine deterministik kapılar: DOM + yazı tipleri + bir düzen karesi.
     */
    const yanit = await page.goto(BASE + shot.path, { waitUntil: "domcontentloaded" });

    /**
     * `devOnly` kareler yalnız geliştirme sunucusunda anlamlı. Kontrol GİRİŞTEN
     * SONRA ve sayfanın kendi yanıtı üzerinden yapılır — oturumsuz bir yoklama
     * middleware'e takılır ve üretim/geliştirme ayrımını göstermez.
     */
    if (shot.devOnly && yanit && yanit.status() !== 200) {
      console.log(
        `· ${shot.file} ATLANDI — ${shot.path} bu sunucuda kapalı (HTTP ${yanit.status()})`,
      );
      await page.close();
      continue;
    }

    await page.evaluateHandle("document.fonts.ready");
    // Hidrasyon sonrası ilk boyamayı garantiler; sabit `waitForTimeout` değil.
    await page.evaluate(
      () => new Promise((c) => requestAnimationFrame(() => requestAnimationFrame(c))),
    );

    // Ekran görüntüsünden önce sayfayı istenen duruma getir (form doldurma,
    // pencere açma, sahte token yerleştirme…)
    if (shot.hazirla) await shot.hazirla(page);

    if (shot.openDrawer) {
      // React hidrasyonu bitmeden yapılan tıklama kaybolur; açılana kadar dene.
      const btn = page.getByLabel("Menüyü aç");
      await btn.waitFor({ state: "visible" });
      for (let deneme = 0; deneme < 10; deneme++) {
        await btn.click();
        try {
          await page.waitForSelector("#mobil-menu", { state: "visible", timeout: 1000 });
          break;
        } catch {
          await page.waitForTimeout(400);
        }
      }
      await page.waitForSelector("#mobil-menu", { state: "visible" });
      await page.waitForTimeout(200);
    }

    const opts = { path: join(outDir, shot.file) };
    if (shot.clip) {
      await page.screenshot({ ...opts, clip: shot.clip });
    } else if (shot.section !== undefined) {
      // Wireframe sayfasındaki n. tam-ekran bölümü yakala
      const y = shot.section * shot.h;
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.screenshot(opts);
    } else {
      await page.screenshot(opts);
    }
    console.log(`✓ ${shot.file}  (${shot.w}×${shot.h})`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\nGörseller: docs/previews/`);
