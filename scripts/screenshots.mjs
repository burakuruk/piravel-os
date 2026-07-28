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
import { totp } from "./_totp.mjs";

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
    const res = await apiPost(page, "/api/auth/two-factor/verify-totp", { code: totp(secret) });
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
    await apiPost(page, "/api/auth/two-factor/verify-totp", { code: totp(secret) });
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

await fixtureSifirla();
const { bekleyenId, pasifId, opsId } = await kullaniciFixtureleri();

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
  { file: "45-oturum-iptali-stepup-1440x1000.png", path: `/kullanicilar/${opsId}`, w: 1440, h: 1000, auth: "sa", ua: GERCEKCI_UA,
    async hazirla(page) {
      await page.getByRole("button", { name: "Tüm oturumları kapat" }).click();
      await page.waitForSelector('[role="dialog"]');
    } },
);

const browser = await chromium.launch();
try {
  for (const shot of shots) {
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
    await page.goto(BASE + shot.path, { waitUntil: "domcontentloaded" });
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
