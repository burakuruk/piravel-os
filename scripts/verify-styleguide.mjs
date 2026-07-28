/**
 * Styleguide erişim doğrulaması — Sprint 1 §4.
 *
 * Tek ama kritik kural: styleguide ÜRETİMDE erişilemez. Sayfa uygulamanın iç
 * yapısını (token adları, bileşen varyantları, hata metinleri) tek yerde
 * sergiler; üretimde açık kalması gereksiz bir keşif yüzeyi olurdu.
 *
 * Script sunucunun hangi modda çalıştığını PROBE ile anlar ve o moda uygun
 * beklentiyi uygular — böylece hem CI'daki production sunucusunda hem
 * geliştirmede anlamlı çalışır.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

let cerez = "";

async function iste(yol, ekstra = {}) {
  const res = await fetch(`${BASE}${yol}`, {
    redirect: "manual",
    ...ekstra,
    headers: { ...(cerez ? { cookie: cerez } : {}), ...(ekstra.headers ?? {}) },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    const ad = pair.split("=")[0];
    cerez = cerez
      .split("; ")
      .filter((x) => x && !x.startsWith(`${ad}=`))
      .concat(pair)
      .join("; ");
  }
  const text = await res.text().catch(() => "");
  return { status: res.status, text, headers: res.headers };
}

/**
 * Oturum açar. Styleguide oturumsuz erişilebilir DEĞİLDİR (middleware onu
 * public listeye almaz); üretimdeki 404 ile bilinmeyen yolun 307'si arasındaki
 * fark bir varlık sinyali olurdu.
 *
 * 2FA'sı zorunlu olmayan `member` kullanılır — parola tek adımda yeter.
 */
async function oturumAc() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "member@example.com", password: "gelistirme-test-parolasi" }),
    redirect: "manual",
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    cerez = cerez ? `${cerez}; ${pair}` : pair;
  }
  return res.status === 200;
}

/**
 * Mod, sunucuya sorularak değil DOĞRUDAN GÖZLEMLE belirlenir: styleguide'ın
 * kendi yanıtı zaten aradığımız cevaptır. Ayrı bir "hangi moddasın" ucu
 * eklemek, üretimde gereksiz bir bilgi sızıntısı olurdu.
 */
// Oturumsuz davranış — üretim ve geliştirmede AYNI olmalı
const oturumsuz = await iste("/styleguide");
const oturumsuzBilinmeyen = await iste("/kesinlikle-boyle-bir-yol-yok-42");

const girisOk = await oturumAc();
const sg = await iste("/styleguide");
const erisilebilir = sg.status === 200;

console.log(
  `· Sunucu ${erisilebilir ? "GELİŞTİRME" : "ÜRETİM"} modunda görünüyor (styleguide HTTP ${sg.status})\n`,
);

console.log("═══ 0. Oturumsuz yoklama bir varlık sinyali vermiyor ═══");
check("Fixture kullanıcısıyla giriş yapılabildi", girisOk);
check(
  "Oturumsuz /styleguide, bilinmeyen yolla AYNI durum kodunu döner",
  oturumsuz.status === oturumsuzBilinmeyen.status,
  `${oturumsuz.status} / ${oturumsuzBilinmeyen.status}`,
);
check(
  "Oturumsuz yanıtta styleguide içeriği yok",
  !/Tipografi ölçeği|Renk token/i.test(oturumsuz.text),
);
console.log();

if (!erisilebilir) {
  // ── ÜRETİM BEKLENTİSİ ──
  console.log("═══ Üretim: styleguide tamamen kapalı ═══");
  check("GET /styleguide 404 döner", sg.status === 404, `HTTP ${sg.status}`);
  check(
    "403 DEĞİL — sayfanın varlığı da sızmaz",
    sg.status !== 403,
    `HTTP ${sg.status}`,
  );
  check(
    "Yanıt gövdesinde styleguide içeriği yok",
    !/Tipografi ölçeği|Renk token|Mesaj tonları|Odak görünürlüğü/i.test(sg.text),
  );

  /**
   * ⚠ Sayfa başlığı sızmamalı. Next, `metadata` export'unu bileşenden BAĞIMSIZ
   * değerlendirir: sayfa `notFound()` çağırsa bile başlık üretilip 404
   * yanıtının RSC yüküne gömülür ve rotanın adını ele verir. Bu yüzden
   * styleguide'da metadata export'u YOK; başlık bileşenin içinde render edilir.
   */
  check(
    "404 yanıtında sayfa BAŞLIĞI sızmıyor",
    !/Styleguide\s*—\s*Piravel/i.test(sg.text),
  );

  /**
   * Asıl ölçüt: var olan bir rotanın 404'ü, hiç var olmayan bir yolunkinden
   * AYIRT EDİLEMEMELİ. Yoldaki kelimenin RSC router durumunda yankılanması
   * bilgi değildir — her 404 kendi yolunu taşır.
   *
   * Karşılaştırma oturum GEREKTİRMEYEN bir yolla yapılır: korumalı yollar
   * middleware tarafından girişe yönlendirilir (307) ve bu fark styleguide'la
   * ilgili değil, oturumla ilgilidir.
   */
  const uydurma = await iste("/kesinlikle-boyle-bir-yol-yok-42");
  check(
    "Oturumluyken de bilinmeyen yolla aynı durum kodu",
    sg.status === uydurma.status,
    `${sg.status} / ${uydurma.status}`,
  );

  /**
   * Alt yollar ve büyük/küçük harf denemeleri. Yönlendirme kabul edilir —
   * önemli olan içeriğe ULAŞILAMAMASI; 307 girişe yönlendirmedir, erişim
   * değil.
   */
  for (const yol of ["/styleguide/", "/styleguide/renkler", "/StyleGuide"]) {
    const r = await iste(yol);
    const erisimYok = r.status !== 200 && !/Tipografi ölçeği/i.test(r.text);
    check(`${yol} içeriğe erişemiyor`, erisimYok, `HTTP ${r.status}`);
  }

  // Oturumlu bir istek de açamamalı — kapı role değil ortama bağlı
  const cerezli = await iste("/styleguide", {
    headers: { cookie: "better-auth.session_token=uydurma" },
  });
  check("Çerezli istek de 404 alır", cerezli.status === 404, `HTTP ${cerezli.status}`);
} else {
  // ── GELİŞTİRME BEKLENTİSİ ──
  console.log("═══ Geliştirme: styleguide render ediliyor ═══");
  check("GET /styleguide 200 döner", sg.status === 200);
  check("Sayfa başlığı var", sg.text.includes("Styleguide"));

  const bolumler = [
    "Renk token",
    "Tipografi ölçeği",
    "Butonlar",
    "Form kontrolleri",
    "Mesaj tonları",
    "Rozet ve durumlar",
    "Tablo",
    "Kart",
    "Modal ve drawer",
    "Yükleme, boş ve hata",
    "Biçimler",
    "Odak görünürlüğü",
  ];
  for (const b of bolumler) {
    check(`Bölüm var: ${b}`, sg.text.includes(b));
  }

  check(
    "Üretimde kapalı olduğu sayfada yazıyor",
    /tamamen kapalı/i.test(sg.text),
  );
  check(
    "Yalnız sahte veri kullanılıyor",
    !/@(?!example\.com)[a-z0-9.-]+\.[a-z]{2,}/i.test(sg.text.replace(/@example\.com/g, "")),
  );
  check("Arama motorlarına kapalı (noindex)", /noindex/i.test(sg.text));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(" | ")}`);
  process.exit(1);
}
