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

const shots = [
  { file: "01-kabuk-1440x900.png", w: 1440, h: 900, clip: "shell" },
  { file: "02-dashboard-1440x900.png", w: 1440, h: 900 },
  { file: "03-dashboard-1280.png", w: 1280, h: 860 },
  { file: "04-dashboard-mobil-375x812.png", w: 375, h: 812 },
];

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: shot.w, height: shot.h },
      deviceScaleFactor: 2, // retina netliği
      locale: "tr-TR",
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluateHandle("document.fonts.ready");

    if (shot.clip === "shell") {
      // Uygulama kabuğu: sidebar + topbar odaklı kırpma (sol 760px)
      await page.screenshot({
        path: join(outDir, shot.file),
        clip: { x: 0, y: 0, width: 760, height: shot.h },
      });
    } else {
      await page.screenshot({ path: join(outDir, shot.file), fullPage: false });
    }
    console.log(`✓ ${shot.file}  (${shot.w}×${shot.h})`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\nGörseller: docs/previews/`);
