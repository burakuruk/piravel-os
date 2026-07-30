/**
 * Mobil drawer erişilebilirlik doğrulaması — Sprint 1 §3.
 *
 * Gerçek tarayıcıda (Playwright) klavye ve odak davranışını sınar; DOM
 * incelemesiyle değil, kullanıcının yaptığı hareketlerle.
 *
 * ⚠ PRD §6.3: parola ekrana yazılmaz.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";
const PAROLA = "gelistirme-test-parolasi";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

// admin: marka detayındaki dokunma hedefi ölçümü için (tüm işlemler görünür)
const MAILS = ["finance@example.com", "member@example.com", "admin@example.com"];
async function fixtureSifirla() {
  await sql.query("DELETE FROM auth_rate_limit");
  /**
   * ⚠ HESAP KİLİDİ DE TEMİZLENİR. Bir önceki koşudan kalan başarısız TOTP
   * denemeleri hesabı 15 dakika kilitler; sonraki koşuda giriş 429 alır,
   * kullanıcı 2FA kurulum ekranına düşer ve testler "sayfa boş" gibi
   * görünen sahte hatalarla geçer.
   */
  await sql.query("DELETE FROM auth_security_state");
  await sql.query("DELETE FROM auth_login_attempts");
  await sql.query(
    "DELETE FROM auth_two_factor WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [MAILS],
  );
  await sql.query("UPDATE auth_user SET two_factor_enabled = false WHERE email = ANY($1)", [MAILS]);
  await sql.query("UPDATE users SET is_active = true WHERE email = ANY($1)", [MAILS]);
}
await fixtureSifirla();

const anahtarlar = new Map();

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

/** 2FA dahil gerçek giriş (fixture kullanıcıları). */
async function oturumAc(page, email, needs2fa) {
  await sql.query("DELETE FROM auth_rate_limit");
  await page.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
  const signIn = await apiPost(page, "/api/auth/sign-in/email", { email, password: PAROLA });
  if (!signIn.ok) throw new Error(`Giriş başarısız (${email}): ${signIn.status}`);

  if (signIn.json?.twoFactorRedirect) {
    const secret = anahtarlar.get(email);
    if (!secret) throw new Error(`${email} için anahtar yok`);
    await apiPost(page, "/api/auth/two-factor/verify-totp", { code: await tazeTotp(secret) });
    return;
  }
  if (!needs2fa) return;
  const enable = await apiPost(page, "/api/auth/two-factor/enable", { password: PAROLA });
  if (enable.ok) {
    const secret = new URL(enable.json.totpURI).searchParams.get("secret");
    anahtarlar.set(email, secret);
    await apiPost(page, "/api/auth/two-factor/verify-totp", { code: await tazeTotp(secret) });
  }
}

/** Drawer'ı aç ve hazır olmasını bekle. */
async function drawerAc(page) {
  const btn = page.getByLabel("Menüyü aç");
  await btn.waitFor({ state: "visible" });
  // Hidrasyon bitmeden yapılan tıklama kaybolur; açılana kadar dene
  for (let i = 0; i < 10; i++) {
    await btn.click();
    try {
      await page.waitForSelector("#mobil-menu", { state: "visible", timeout: 1000 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  await page.waitForSelector("#mobil-menu", { state: "visible" });
}

const browser = await chromium.launch();
const MOBIL = { width: 375, height: 812 };

try {
  // ═══════════════════════════════════════════════════════════════════
  console.log("═══ 1. Açılış: odak ve etiketler ═══");
  // ═══════════════════════════════════════════════════════════════════
  const page = await browser.newPage({ viewport: MOBIL, locale: "tr-TR" });
  await oturumAc(page, "finance@example.com", true);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await drawerAc(page);

  check(
    "Açılışta odak panelin KENDİSİNDE (ilk bağlantıda değil)",
    (await page.evaluate(() => document.activeElement?.id)) === "mobil-menu",
    await page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName),
  );
  check(
    "Panel role=dialog ve aria-modal taşıyor",
    (await page.getAttribute("#mobil-menu", "role")) === "dialog" &&
      (await page.getAttribute("#mobil-menu", "aria-modal")) === "true",
  );
  check(
    "Panelin erişilebilir adı var",
    ((await page.getAttribute("#mobil-menu", "aria-label")) ?? "").length > 0,
    await page.getAttribute("#mobil-menu", "aria-label"),
  );
  check(
    "Hamburger aria-expanded=true oluyor",
    (await page.getAttribute('[aria-label="Menüyü aç"]', "aria-expanded")) === "true",
  );
  check(
    "Panel içinde gezinme bölgesi (nav) var",
    (await page.locator("#mobil-menu nav").count()) > 0,
  );

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 2. Arka plan erişilemez (inert) ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    const durum = await page.evaluate(() => {
      const kapsayici = document.getElementById("mobil-menu")?.closest("body > *");
      const digerleri = Array.from(document.body.children).filter((c) => c !== kapsayici);
      return {
        drawerBodyAltinda: Boolean(kapsayici),
        digerSayisi: digerleri.length,
        hepsiInert: digerleri.every((c) => c.inert === true),
        drawerInertDegil: kapsayici ? kapsayici.inert !== true : false,
      };
    });
    check("Drawer body'nin doğrudan çocuğu (portal)", durum.drawerBodyAltinda);
    check("Arka plandaki tüm kardeşler inert", durum.hepsiInert, `${durum.digerSayisi} kardeş`);
    check("Drawer'ın KENDİSİ inert değil", durum.drawerInertDegil);

    // Arka plandaki bir bağlantıya odaklanmaya çalış — başarısız olmalı
    const odaklanabildi = await page.evaluate(() => {
      const disaridaki = document.querySelector('body > *:not([data-drawer]) a[href="/"]');
      if (!disaridaki) return null;
      disaridaki.focus();
      return document.activeElement === disaridaki;
    });
    check(
      "Arka plandaki bağlantı programatik olarak da odaklanamıyor",
      odaklanabildi === false || odaklanabildi === null,
      String(odaklanabildi),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 3. Tab odak tuzağı ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    const icerdekiSayi = await page.evaluate(
      () =>
        document.querySelectorAll(
          '#mobil-menu a[href], #mobil-menu button:not([disabled])',
        ).length,
    );
    check("Panelde odaklanabilir öğe var", icerdekiSayi > 0, `${icerdekiSayi} öğe`);

    // Panel içinde tam tur at; odak hiç dışarı çıkmamalı
    let disariKacti = false;
    for (let i = 0; i < icerdekiSayi + 3; i++) {
      await page.keyboard.press("Tab");
      const icerideMi = await page.evaluate(() =>
        Boolean(document.activeElement?.closest("#mobil-menu")),
      );
      if (!icerideMi) {
        disariKacti = true;
        break;
      }
    }
    check("Tab ile odak panelden ÇIKMIYOR", !disariKacti);

    // Shift+Tab ters yönde de tuzakta kalmalı
    let tersKacti = false;
    for (let i = 0; i < icerdekiSayi + 3; i++) {
      await page.keyboard.press("Shift+Tab");
      const icerideMi = await page.evaluate(() =>
        Boolean(document.activeElement?.closest("#mobil-menu")),
      );
      if (!icerideMi) {
        tersKacti = true;
        break;
      }
    }
    check("Shift+Tab ile de odak panelden ÇIKMIYOR", !tersKacti);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 4. Kapatma düğmesinin odak halkası ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    /**
     * ⚠ `outlineWidth` TEK BAŞINA yeterli değil: `outline-style: none` iken de
     * tarayıcı bir genişlik raporlar. Halkanın gerçekten çizilip çizilmediği
     * stil + genişlik birlikte okunarak anlaşılır.
     */
    const cerceve = async () =>
      page.evaluate(() => {
        const btn = document.querySelector('#mobil-menu button[aria-label="Menüyü kapat"]');
        if (!btn) return null;
        const s = getComputedStyle(btn);
        const genislik = Number.parseFloat(s.outlineWidth) || 0;
        return {
          stil: s.outlineStyle,
          genislik,
          shadow: s.boxShadow,
          gorunur: (s.outlineStyle !== "none" && genislik > 0) || s.boxShadow !== "none",
        };
      });

    // Fareyle açıldığında görünür halka olmamalı
    const fareyle = await cerceve();
    check(
      "Fareyle açıldığında kapatma düğmesinde görünür çerçeve yok",
      fareyle !== null && fareyle.gorunur === false,
      JSON.stringify(fareyle),
    );

    // Klavyeyle odaklanınca halka belirmeli
    await page.evaluate(() => document.getElementById("mobil-menu")?.focus());
    await page.keyboard.press("Tab");
    let denemeler = 0;
    while (denemeler < 12) {
      const kapatmadaMi = await page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") === "Menüyü kapat",
      );
      if (kapatmadaMi) break;
      await page.keyboard.press("Tab");
      denemeler++;
    }
    const klavyeyle = await cerceve();
    check(
      "Klavyeyle odaklanınca görünür çerçeve BELİRİYOR",
      klavyeyle !== null && klavyeyle.gorunur === true,
      JSON.stringify(klavyeyle),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 5. Escape ile kapanma ve odak dönüşü ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    await page.keyboard.press("Escape");
    await page.waitForSelector("#mobil-menu", { state: "detached" });
    check("Escape drawer'ı kapatıyor", true);
    check(
      "Odak açan düğmeye GERİ DÖNÜYOR",
      (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ===
        "Menüyü aç",
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    );
    check(
      "Hamburger aria-expanded=false oluyor",
      (await page.getAttribute('[aria-label="Menüyü aç"]', "aria-expanded")) === "false",
    );

    const inertKalmadi = await page.evaluate(() =>
      Array.from(document.body.children).every((c) => c.inert !== true),
    );
    check("Kapanışta inert işaretleri KALDIRILIYOR", inertKalmadi);

    const kaydirma = await page.evaluate(() => document.body.style.overflow);
    check("Kapanışta sayfa kaydırma geri açılıyor", kaydirma === "", `overflow="${kaydirma}"`);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 6. Dışarı tıklama ile kapanma ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    await drawerAc(page);
    // Panelin sağındaki karartma alanına tıkla
    await page.mouse.click(360, 400);
    await page.waitForSelector("#mobil-menu", { state: "detached" });
    check("Dışarı tıklama drawer'ı kapatıyor", true);
    check(
      "Dış tıklamadan sonra da odak düğmeye dönüyor",
      (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ===
        "Menüyü aç",
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 7. Rol bazlı menü: görünmeyen modül DOM'DA YOK ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    await drawerAc(page);
    const finLinkleri = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#mobil-menu a")).map((a) => a.getAttribute("href")),
    );
    check(
      "FIN finans modüllerini görüyor",
      finLinkleri.includes("/alacaklar") && finLinkleri.includes("/banka"),
      finLinkleri.join(","),
    );
    check("FIN kullanıcı yönetimini GÖRMÜYOR", !finLinkleri.includes("/kullanicilar"));

    const mem = await browser.newPage({ viewport: MOBIL, locale: "tr-TR" });
    await oturumAc(mem, "member@example.com", false);
    await mem.goto(BASE, { waitUntil: "domcontentloaded" });
    await drawerAc(mem);
    const memLinkleri = await mem.evaluate(() =>
      Array.from(document.querySelectorAll("#mobil-menu a")).map((a) => a.getAttribute("href")),
    );
    const yasakli = ["/alacaklar", "/giderler", "/banka", "/eslestirme", "/avanslar", "/kullanicilar", "/ayarlar", "/denetim"];
    const sizanlar = yasakli.filter((y) => memLinkleri.includes(y));
    check(
      "MEM'e kapalı modüller DOM'da hiç yok (gizli değil, YOK)",
      sizanlar.length === 0,
      sizanlar.join(",") || memLinkleri.join(","),
    );
    check("MEM kendi oturumlarını görebiliyor", memLinkleri.includes("/ayarlar/oturumlar"));
    await mem.close();
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 5. Mobil dokunma hedefleri (marka detayı) ═══");
  // ═══════════════════════════════════════════════════════════════════
  {
    /**
     * ⚠ ÖLÇÜLEN ŞEY SINIF ADI DEĞİL, GERÇEK KUTU.
     *
     * "max-sm:min-h-11 yazdım" demek yetmez: sınıf başka bir kuralla
     * ezilebilir, bileşen başka bir `size` ile çağrılmış olabilir ya da
     * Tailwind sürümü varyantı üretmemiş olabilir. Bu yüzden gerçek
     * tarayıcıda `getBoundingClientRect()` okunur.
     *
     * Eşik 44 px (WCAG 2.5.5 / mobil dokunma hedefi). Yükseklik ölçütü
     * belirleyicidir; genişlik metin uzunluğuyla zaten büyür.
     */
    const sa = await browser.newPage({ viewport: MOBIL, locale: "tr-TR" });
    await oturumAc(sa, "admin@example.com", true);

    const { rows: marka } = await sql.query(
      "SELECT id FROM brands WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1",
    );
    if (!marka[0]) {
      check("Ölçüm için marka bulundu", false, "brands tablosu boş");
    } else {
      await sa.goto(`${BASE}/markalar/${marka[0].id}`, { waitUntil: "domcontentloaded" });
      await sa.waitForSelector("h1");

      /**
       * ⚠ ÖNCE SAYFADA OLDUĞUMUZU KANITLA.
       *
       * Giriş sessizce başarısız olursa `/giris`e yönlenir; oradaki birkaç
       * öğe eşiği zaten geçer ve ölçüm testi HİÇBİR ŞEY ÖLÇMEDEN "geçti"
       * der. Boş bir taramanın yeşil görünmesi, testin en tehlikeli hâli.
       */
      const sayfaTamam = await sa.evaluate(() => ({
        yol: location.pathname,
        duzenle: document.querySelectorAll("main button").length,
      }));
      check(
        "Marka detay sayfası SA olarak açıldı (ölçüm boşa düşmüyor)",
        sayfaTamam.yol.startsWith("/markalar/") && sayfaTamam.duzenle >= 3,
        `${sayfaTamam.yol} · ${sayfaTamam.duzenle} düğme`,
      );

      const kucukler = await sa.evaluate(() => {
        const ESIK = 44;
        const hedefler = document.querySelectorAll(
          "main button, main select, main input:not([type=hidden]), main a",
        );
        const kucuk = [];
        for (const el of hedefler) {
          const k = el.getBoundingClientRect();
          // Görünmeyen öğeler dokunma hedefi değildir
          if (k.width === 0 || k.height === 0) continue;
          if (k.height < ESIK) {
            kucuk.push(`${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 18)}=${Math.round(k.height)}`);
          }
        }
        return kucuk;
      });

      check(
        "Marka detayındaki tüm dokunma hedefleri ≥44 px yüksekliğinde",
        kucukler.length === 0,
        kucukler.slice(0, 6).join(" · ") || "hepsi geçti",
      );

      // Adı geçen işlemler ayrı ayrı ölçülür: genel tarama bir gün gevşerse
      // bu kontroller yine de düşer.
      for (const etiket of ["Düzenle", "Kaldır", "Çıkar", "Birincil yap", "Ekle", "Ara"]) {
        const dugme = sa.getByRole("button", { name: etiket, exact: true }).first();
        const sayi = await dugme.count();
        if (sayi === 0) continue;
        const kutu = await dugme.boundingBox();
        check(
          `"${etiket}" dokunma hedefi ≥44 px`,
          Boolean(kutu) && kutu.height >= 44,
          `${Math.round(kutu?.height ?? 0)} px`,
        );
      }

      const yatay = await sa.evaluate(() => ({
        belge: document.documentElement.scrollWidth,
        pencere: window.innerWidth,
      }));
      check(
        "Marka detayında yatay taşma yok",
        yatay.belge <= yatay.pencere,
        `belge ${yatay.belge} px / pencere ${yatay.pencere} px`,
      );

      // Odak görünürlüğü: klavye kullanıcısı nerede olduğunu görmeli
      await sa.keyboard.press("Tab");
      const odakGorunur = await sa.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        const s = getComputedStyle(el);
        return s.outlineStyle !== "none" || s.boxShadow !== "none";
      });
      check("İlk Tab'da odak görünür bir hâlka bırakıyor", odakGorunur);
    }
    await sa.close();
  }

  await page.close();
} finally {
  await browser.close();
  await fixtureSifirla();
  await sql.end();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(" | ")}`);
  process.exit(1);
}
