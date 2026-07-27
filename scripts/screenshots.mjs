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
for (const line of readFileSync(join(here, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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

await fixtureSifirla();

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: shot.w, height: shot.h },
      deviceScaleFactor: 2, // retina netliği
      locale: "tr-TR",
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
