/**
 * Görsel onay ekran görüntülerini üretir — docs/previews/
 *
 * Headless Chromium kullanır: tarayıcı çerçevesi, sekme, adres çubuğu veya
 * geliştirme paneli artefaktı YOKTUR. Yalnızca sayfanın kendisi.
 *
 * Kullanım: npm run dev  (ayrı terminalde)  →  npm run screenshots
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "docs", "previews");
mkdirSync(outDir, { recursive: true });

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";

/** clip: sabit kırpma · section: n. bölümü (tam ekran adım) yakala */
const shots = [
  { file: "01-kabuk-1440x900.png", path: "/", w: 1440, h: 900, clip: { x: 0, y: 0, width: 760, height: 900 } },
  { file: "02-dashboard-1440x900.png", path: "/", w: 1440, h: 900 },
  { file: "03-dashboard-1280.png", path: "/", w: 1280, h: 860 },
  { file: "04-dashboard-mobil-375x812.png", path: "/", w: 375, h: 812 },

  // Login / 2FA wireframe — her adım kendi tam ekranı
  { file: "05-giris-1440x900.png", path: "/wireframe/giris", w: 1440, h: 900, section: 0 },
  { file: "06-giris-hata-1440x900.png", path: "/wireframe/giris", w: 1440, h: 900, section: 1 },
  { file: "07-2fa-dogrulama-1440x900.png", path: "/wireframe/giris", w: 1440, h: 900, section: 2 },
  { file: "08-2fa-kurulum-1440x900.png", path: "/wireframe/giris", w: 1440, h: 1100, section: 3 },
  { file: "09-giris-mobil-375x812.png", path: "/wireframe/giris", w: 375, h: 812, section: 0 },
];

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: shot.w, height: shot.h },
      deviceScaleFactor: 2, // retina netliği
      locale: "tr-TR",
    });
    await page.goto(BASE + shot.path, { waitUntil: "networkidle" });
    await page.evaluateHandle("document.fonts.ready");

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
