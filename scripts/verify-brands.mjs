/**
 * Marka modülü doğrulaması — Sprint 2 Aşama 1.
 *
 * Gerçek HTTP istekleriyle çalışır; sunucu ayakta olmalıdır.
 * Sınanan şey KURALIN KENDİSİDİR, arayüz değil:
 *   · yetki matrisi (SA/FIN/OPS/MEM) her uçta
 *   · OPS kapsamı: yalnız atandığı markalar — liste, detay, arama, filtre,
 *     yetkili, hizmet, ekip ataması ve CSV
 *   · vergi alanlarının OPS yanıtından ÇIKARILMASI
 *   · kod normalizasyonu, case-insensitive benzersizlik, kod kilidi
 *   · CSV: yetki, alan süzgeci, formül enjeksiyonu, kaçış, BOM
 *   · migration 0010: soft delete + partial unique + RESTRICT
 *
 * ⚠ PRD §6.3: yalnız sahte veri (`example.com`, `DGR-*` kodları) kullanılır.
 *
 * Kullanım: npm run verify:brands
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { totp } from "./_totp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
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
const RUN_ID = `brands-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

let ipSayac = 0;
function client() {
  ipSayac += 1;
  const ip = `198.19.1.${(ipSayac % 250) + 1}`;
  let cookies = "";
  const cerezYaz = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const ad = pair.split("=")[0];
      const silindiMi = /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c);
      cookies = cookies
        .split("; ")
        .filter((x) => x && !x.startsWith(`${ad}=`))
        .concat(silindiMi ? [] : [pair])
        .join("; ");
    }
  };
  const cagir = async (metod, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: metod,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        origin: BASE,
        "x-forwarded-for": ip,
        "x-test-run-id": RUN_ID,
        ...(cookies ? { cookie: cookies } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    cerezYaz(res);
    let json = null;
    let text = "";
    let bytes = new Uint8Array();
    if ((res.headers.get("content-type") ?? "").includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        /* gövdesiz */
      }
    } else {
      /**
       * ⚠ `res.text()` BOM'u SESSİZCE DÜŞÜRÜR (WHATWG kodlama standardı).
       * BOM'un gerçekten dosyada olduğunu görmek için ham baytlara bakılır;
       * yoksa test her koşulda "BOM yok" derdi.
       */
      const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
      bytes = new Uint8Array(buf);
      text = new TextDecoder("utf-8").decode(buf);
    }
    return { status: res.status, json, text, bytes, headers: res.headers };
  };
  return {
    get: (p) => cagir("GET", p),
    post: (p, b) => cagir("POST", p, b ?? {}),
    patch: (p, b) => cagir("PATCH", p, b ?? {}),
    del: (p, b) => cagir("DELETE", p, b ?? {}),
  };
}

/** 2FA zorunlu roller için kurulumu tamamlayarak giriş yapar. */
async function girisYap(c, email, ikiFaKur = false) {
  await c.post("/api/auth/sign-in/email", { email, password: PAROLA });
  if (!ikiFaKur) return;
  const enable = await c.post("/api/auth/two-factor/enable", { password: PAROLA });
  const uri = enable.json?.totpURI ?? enable.json?.totpUri;
  if (uri) {
    const secret = new URL(uri.replace("otpauth://", "http://")).searchParams.get("secret");
    await c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
  }
}

// ── Fixture ───────────────────────────────────────────────────────────────
const DAMGA = Date.now().toString(36).slice(-4).toUpperCase();
const KOD = (x) => `DGR${x}${DAMGA}`.slice(0, 16);

async function fixtureTemizle() {
  await sql.query("DELETE FROM auth_rate_limit");
  // FK'ler RESTRICT: çocuk kayıtlar önce düşer
  await sql.query(
    "DELETE FROM brand_assignments WHERE brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGR%')",
  );
  await sql.query(
    "DELETE FROM brand_services WHERE brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGR%')",
  );
  await sql.query(
    "DELETE FROM brand_contacts WHERE brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGR%')",
  );
  await sql.query("DELETE FROM brands WHERE code LIKE 'DGR%'");
  await sql.query(
    "DELETE FROM brand_services WHERE service_id IN (SELECT id FROM services WHERE code LIKE 'DGH%')",
  );
  await sql.query("DELETE FROM services WHERE code LIKE 'DGH%'");

  const mails = [
    "admin@example.com",
    "finance@example.com",
    "operations@example.com",
    "member@example.com",
  ];
  await sql.query(
    "DELETE FROM auth_two_factor WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [mails],
  );
  await sql.query("UPDATE auth_user SET two_factor_enabled = false WHERE email = ANY($1)", [mails]);
  await sql.query(
    "DELETE FROM auth_session WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [mails],
  );
  await sql.query("UPDATE users SET is_active = true, role = 'super_admin' WHERE email = 'admin@example.com'");
  await sql.query("UPDATE users SET is_active = true, role = 'finance' WHERE email = 'finance@example.com'");
  await sql.query("UPDATE users SET is_active = true, role = 'operations' WHERE email = 'operations@example.com'");
  await sql.query("UPDATE users SET is_active = true, role = 'member' WHERE email = 'member@example.com'");
}

await fixtureTemizle();
console.log("· Fixture sıfırlandı\n");

const sa = client();
const fin = client();
const ops = client();
const mem = client();
await girisYap(sa, "admin@example.com", true);
await girisYap(fin, "finance@example.com", true);
await girisYap(ops, "operations@example.com");
await girisYap(mem, "member@example.com");

// ═══════════════════════════════════════════════════════════════════════════
console.log("═══ 1. Erişim kapısı ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const liste = await sa.get("/api/v1/brands");
  check("SA marka listesini görüyor", liste.status === 200, `HTTP ${liste.status}`);

  const finListe = await fin.get("/api/v1/brands");
  check("FIN marka listesini görüyor", finListe.status === 200, `HTTP ${finListe.status}`);

  const memListe = await mem.get("/api/v1/brands");
  check(
    "MEM 404 alır (403 değil — ucun varlığı sızdırılmaz)",
    memListe.status === 404,
    `HTTP ${memListe.status}`,
  );

  const memHizmet = await mem.get("/api/v1/services");
  check("MEM hizmet kataloğunda da 404 alır", memHizmet.status === 404, `HTTP ${memHizmet.status}`);

  const memCsv = await mem.get("/api/v1/brands/export");
  check("MEM CSV ucunda da 404 alır", memCsv.status === 404, `HTTP ${memCsv.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 2. Marka oluşturma ve kod kuralları ═══");
// ═══════════════════════════════════════════════════════════════════════════
let markaA;
let markaB;
{
  const olustur = await fin.post("/api/v1/brands", {
    code: `  ${KOD("A").toLowerCase()}  `,
    name: "Doğrulama Marka A",
    taxNumber: "1234567890",
    taxOffice: "Örnek VD",
    industry: "Danışmanlık",
    email: "a@example.com",
  });
  markaA = olustur.json?.brand?.id;
  check("FIN marka oluşturabiliyor", olustur.status === 201, `HTTP ${olustur.status}`);
  check(
    "Kod trim + BÜYÜK HARF normalize edildi",
    olustur.json?.brand?.code === KOD("A"),
    olustur.json?.brand?.code,
  );

  const ayniKod = await sa.post("/api/v1/brands", {
    code: KOD("A").toLowerCase(),
    name: "Kopya",
  });
  check(
    "Aynı kod farklı harf büyüklüğüyle bile ikinci kez alınamaz (409)",
    ayniKod.status === 409,
    `HTTP ${ayniKod.status} ${ayniKod.json?.error?.code ?? ""}`,
  );

  const gecersiz = await sa.post("/api/v1/brands", { code: "A B", name: "Geçersiz" });
  check("Boşluklu kod reddedilir (400)", gecersiz.status === 400, `HTTP ${gecersiz.status}`);

  const b = await sa.post("/api/v1/brands", {
    code: KOD("B"),
    name: "Doğrulama Marka B",
    taxNumber: "9876543210",
  });
  markaB = b.json?.brand?.id;
  check("SA ikinci markayı oluşturdu", b.status === 201, `HTTP ${b.status}`);

  const opsOlustur = await ops.post("/api/v1/brands", { code: KOD("X"), name: "OPS denemesi" });
  check(
    "OPS marka oluşturamaz (403)",
    opsOlustur.status === 403,
    `HTTP ${opsOlustur.status}`,
  );

  const kodDegis = await sa.patch(`/api/v1/brands/${markaA}`, { code: "YENIKOD" });
  check(
    "Marka kodu değiştirilemez (422 BRAND_CODE_IMMUTABLE)",
    kodDegis.status === 422 && kodDegis.json?.error?.code === "BRAND_CODE_IMMUTABLE",
    `HTTP ${kodDegis.status} ${kodDegis.json?.error?.code ?? ""}`,
  );

  // Uygulama katmanı atlansa bile DB kilidi durur
  let dbKilidi = false;
  try {
    await sql.query("UPDATE brands SET code = 'ELLEDEGIS' WHERE id = $1", [markaA]);
  } catch (e) {
    dbKilidi = /değiştirilemez/i.test(e.message);
  }
  check("Kod kilidi DB trigger'ında da var (elle UPDATE reddedildi)", dbKilidi);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 3. OPS kapsamı — yalnız atandığı markalar ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const oncesi = await ops.get("/api/v1/brands");
  const kodlar = (oncesi.json?.brands ?? []).map((b) => b.code);
  check(
    "Atama yokken OPS bu markaları görmüyor",
    !kodlar.includes(KOD("A")) && !kodlar.includes(KOD("B")),
    `görünen: ${kodlar.length}`,
  );

  const detay = await ops.get(`/api/v1/brands/${markaA}`);
  check(
    "Atanmamış markanın detayı 404 (403 değil — varlığı sızdırılmaz)",
    detay.status === 404,
    `HTTP ${detay.status}`,
  );

  const detayB = await ops.get(`/api/v1/brands/${markaB}`);
  check("İkinci marka da OPS'a kapalı", detayB.status === 404, `HTTP ${detayB.status}`);

  const yetkililer = await ops.get(`/api/v1/brands/${markaA}/contacts`);
  check("Atanmamış markada yetkili ucu da 404", yetkililer.status === 404, `HTTP ${yetkililer.status}`);

  const hizmetler = await ops.get(`/api/v1/brands/${markaA}/services`);
  check("Atanmamış markada hizmet ucu da 404", hizmetler.status === 404, `HTTP ${hizmetler.status}`);

  const atamalar = await ops.get(`/api/v1/brands/${markaA}/assignments`);
  check("Atanmamış markada ekip ucu da 404", atamalar.status === 404, `HTTP ${atamalar.status}`);

  const arama = await ops.get(`/api/v1/brands?q=${encodeURIComponent("Doğrulama")}`);
  check(
    "ARAMA kapsamı deler mi — hayır, sonuç boş",
    (arama.json?.brands ?? []).length === 0,
    `${(arama.json?.brands ?? []).length} sonuç`,
  );

  const filtre = await ops.get("/api/v1/brands?status=lead");
  const filtreKod = (filtre.json?.brands ?? []).map((b) => b.code);
  check(
    "FİLTRE kapsamı deler mi — hayır",
    !filtreKod.includes(KOD("A")) && !filtreKod.includes(KOD("B")),
    `${filtreKod.length} sonuç`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 4. Ekip ataması — yalnız OPS atanabilir ═══");
// ═══════════════════════════════════════════════════════════════════════════
const opsId = (await sql.query("SELECT id FROM users WHERE email = 'operations@example.com'")).rows[0].id;
const finId = (await sql.query("SELECT id FROM users WHERE email = 'finance@example.com'")).rows[0].id;
const saId = (await sql.query("SELECT id FROM users WHERE email = 'admin@example.com'")).rows[0].id;
const memId = (await sql.query("SELECT id FROM users WHERE email = 'member@example.com'")).rows[0].id;
{
  const adaylar = await fin.get(`/api/v1/brands/${markaA}/assignments/candidates`);
  const roller = new Set((adaylar.json?.candidates ?? []).map((k) => k.role));
  check("Aday listesi 200 döndü", adaylar.status === 200, `HTTP ${adaylar.status}`);
  check(
    "Aday listesinde YALNIZ operations var (SA/FIN/MEM yok)",
    roller.size <= 1 && (roller.size === 0 || roller.has("operations")),
    [...roller].join(",") || "boş",
  );

  for (const [ad, id] of [["FIN", finId], ["SA", saId], ["MEM", memId]]) {
    const dene = await fin.post(`/api/v1/brands/${markaA}/assignments`, { userId: id });
    check(
      `${ad} markaya atanamaz (422 USER_NOT_ASSIGNABLE)`,
      dene.status === 422 && dene.json?.error?.code === "USER_NOT_ASSIGNABLE",
      `HTTP ${dene.status} ${dene.json?.error?.code ?? ""}`,
    );
  }

  const opsAta = await ops.post(`/api/v1/brands/${markaA}/assignments`, { userId: opsId });
  check("OPS kendini atayamaz (403/404)", opsAta.status === 403 || opsAta.status === 404, `HTTP ${opsAta.status}`);

  const ata = await fin.post(`/api/v1/brands/${markaA}/assignments`, { userId: opsId });
  check("FIN operasyon kullanıcısını atadı", ata.status === 201, `HTTP ${ata.status}`);

  const ekip = await fin.get(`/api/v1/brands/${markaA}/assignments`);
  const ekipRoller = new Set((ekip.json?.assignments ?? []).map((a) => a.role));
  check(
    "Sorumlu ekipte yalnız OPS listeleniyor",
    ekipRoller.size === 1 && ekipRoller.has("operations"),
    [...ekipRoller].join(","),
  );

  // Atama açıkça yazılsa bile finans kullanıcısı "sorumlu ekip"te görünmez
  await sql.query(
    "INSERT INTO brand_assignments (brand_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [markaA, finId],
  );
  const ekip2 = await fin.get(`/api/v1/brands/${markaA}/assignments`);
  const ekip2Roller = new Set((ekip2.json?.assignments ?? []).map((a) => a.role));
  check(
    "Elle yazılmış FIN ataması bile sorumlu ekipte gösterilmiyor",
    !ekip2Roller.has("finance"),
    [...ekip2Roller].join(","),
  );
  await sql.query("DELETE FROM brand_assignments WHERE brand_id = $1 AND user_id = $2", [
    markaA,
    finId,
  ]);

  const adaylar2 = await fin.get(`/api/v1/brands/${markaA}/assignments/candidates`);
  check(
    "Atanmış kullanıcı aday listesinden düştü",
    !(adaylar2.json?.candidates ?? []).some((k) => k.id === opsId),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 5. Atama sonrası kapsam ve vergi alanları ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const liste = await ops.get("/api/v1/brands");
  const kodlar = (liste.json?.brands ?? []).map((b) => b.code);
  check("OPS artık atandığı markayı görüyor", kodlar.includes(KOD("A")), kodlar.join(","));
  check("OPS atanmadığı markayı hâlâ görmüyor", !kodlar.includes(KOD("B")));

  const kayit = (liste.json?.brands ?? []).find((b) => b.code === KOD("A")) ?? {};
  check(
    "OPS yanıtında vergi no ve vergi dairesi YOK",
    !("taxNumber" in kayit) && !("taxOffice" in kayit),
    Object.keys(kayit).join(","),
  );

  const detay = await ops.get(`/api/v1/brands/${markaA}`);
  check("OPS detayı görebiliyor", detay.status === 200, `HTTP ${detay.status}`);
  check(
    "OPS detayında da vergi alanları yok",
    !("taxNumber" in (detay.json?.brand ?? {})) && !("taxOffice" in (detay.json?.brand ?? {})),
  );

  const saDetay = await sa.get(`/api/v1/brands/${markaA}`);
  check(
    "SA aynı markada vergi alanlarını görüyor",
    saDetay.json?.brand?.taxNumber === "1234567890",
    saDetay.json?.brand?.taxNumber ?? "yok",
  );

  const vergiYaz = await ops.patch(`/api/v1/brands/${markaA}`, { taxNumber: "0000000000" });
  const sonra = await sa.get(`/api/v1/brands/${markaA}`);
  check(
    "OPS vergi numarasını DEĞİŞTİREMEZ (gövdeden düşer)",
    sonra.json?.brand?.taxNumber === "1234567890",
    `HTTP ${vergiYaz.status} · ${sonra.json?.brand?.taxNumber}`,
  );

  const opsAd = await ops.patch(`/api/v1/brands/${markaA}`, { phone: "+90 555 000 0000" });
  check("OPS operasyonel alanı düzenleyebiliyor", opsAd.status === 200, `HTTP ${opsAd.status}`);

  const durum = await ops.post(`/api/v1/brands/${markaA}/status`, { status: "churned" });
  check("OPS marka durumunu değiştiremez (403)", durum.status === 403, `HTTP ${durum.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 6. Hizmet kataloğu ═══");
// ═══════════════════════════════════════════════════════════════════════════
let hizmet1;
let hizmetPasif;
{
  const h1 = await sa.post("/api/v1/services", {
    code: `dgh1${DAMGA}`,
    name: "Doğrulama Hizmeti",
    defaultUnit: "Aylık",
  });
  hizmet1 = h1.json?.service?.id;
  check("SA hizmet tanımlayabiliyor", h1.status === 201, `HTTP ${h1.status}`);
  check("Hizmet kodu normalize edildi", h1.json?.service?.code === `DGH1${DAMGA}`, h1.json?.service?.code);

  const opsHizmet = await ops.post("/api/v1/services", { code: `DGH9${DAMGA}`, name: "OPS" });
  check("OPS hizmet tanımlayamaz (403)", opsHizmet.status === 403, `HTTP ${opsHizmet.status}`);

  const h2 = await sa.post("/api/v1/services", { code: `dgh2${DAMGA}`, name: "Pasif Hizmet" });
  hizmetPasif = h2.json?.service?.id;
  const pasiflestir = await sa.patch(`/api/v1/services/${hizmetPasif}`, { isActive: false });
  check("Hizmet pasifleştirilebiliyor", pasiflestir.status === 200, `HTTP ${pasiflestir.status}`);

  const katalog = await ops.get("/api/v1/services");
  const kayit = (katalog.json?.services ?? []).find((s) => s.code === `DGH1${DAMGA}`) ?? {};
  check(
    "OPS katalogunda fiyat/maliyet alanları YOK",
    !("listPriceMinor" in kayit) && !("estCostMinor" in kayit) && !("minPriceMinor" in kayit),
    Object.keys(kayit).join(","),
  );
  const saKatalog = await sa.get("/api/v1/services");
  const saKayit = (saKatalog.json?.services ?? []).find((s) => s.code === `DGH1${DAMGA}`) ?? {};
  check("SA katalogunda fiyat alanları var", "listPriceMinor" in saKayit);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 7. Markanın hizmetleri — soft delete ve yeniden ekleme ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ekle = await fin.post(`/api/v1/brands/${markaA}/services`, { serviceId: hizmet1 });
  check("Markaya hizmet eklendi", ekle.status === 201, `HTTP ${ekle.status}`);

  const pasifEkle = await fin.post(`/api/v1/brands/${markaA}/services`, { serviceId: hizmetPasif });
  check(
    "Pasif hizmet yeni markaya atanamaz (422 SERVICE_INACTIVE)",
    pasifEkle.status === 422 && pasifEkle.json?.error?.code === "SERVICE_INACTIVE",
    `HTTP ${pasifEkle.status} ${pasifEkle.json?.error?.code ?? ""}`,
  );

  const opsEkle = await ops.post(`/api/v1/brands/${markaA}/services`, { serviceId: hizmet1 });
  check("OPS markaya hizmet ekleyemez (403)", opsEkle.status === 403, `HTTP ${opsEkle.status}`);

  const cikar = await fin.del(`/api/v1/brands/${markaA}/services`, { serviceId: hizmet1 });
  check("Hizmet markadan çıkarıldı", cikar.status === 200, `HTTP ${cikar.status}`);

  const kalan = await sql.query(
    "SELECT deleted_at FROM brand_services WHERE brand_id = $1 AND service_id = $2",
    [markaA, hizmet1],
  );
  check(
    "Kayıt SİLİNMEDİ, soft delete edildi",
    kalan.rows.length === 1 && kalan.rows[0].deleted_at !== null,
    `${kalan.rows.length} satır`,
  );

  const yenidenEkle = await fin.post(`/api/v1/brands/${markaA}/services`, { serviceId: hizmet1 });
  check(
    "Çıkarılan hizmet yeniden eklenebiliyor (partial unique index)",
    yenidenEkle.status === 201,
    `HTTP ${yenidenEkle.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 8. Marka yetkilileri ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const y1 = await fin.post(`/api/v1/brands/${markaA}/contacts`, {
    fullName: "Sahte Yetkili",
    title: "Pazarlama Müdürü",
    email: "sahte.yetkili@example.com",
    isPrimary: true,
  });
  check("Yetkili eklendi", y1.status === 201, `HTTP ${y1.status}`);

  const y2 = await ops.post(`/api/v1/brands/${markaA}/contacts`, {
    fullName: "Örnek Kişi",
    isPrimary: true,
  });
  check("OPS atandığı markaya yetkili ekleyebiliyor", y2.status === 201, `HTTP ${y2.status}`);

  const birincilSayisi = await sql.query(
    "SELECT count(*)::int AS n FROM brand_contacts WHERE brand_id = $1 AND is_primary AND deleted_at IS NULL",
    [markaA],
  );
  check(
    "Marka başına TEK birincil yetkili",
    birincilSayisi.rows[0].n === 1,
    `${birincilSayisi.rows[0].n} birincil`,
  );

  const kullanici = await sql.query("SELECT count(*)::int AS n FROM users WHERE email = $1", [
    "sahte.yetkili@example.com",
  ]);
  check(
    "Yetkili sistem KULLANICISI değil — users tablosuna satır açılmadı",
    kullanici.rows[0].n === 0,
  );

  const y2Id = y2.json?.contact?.id;
  const opsSil = await ops.del(`/api/v1/contacts/${y2Id}`);
  check("OPS yetkili silemez (403)", opsSil.status === 403, `HTTP ${opsSil.status}`);
  const finSil = await fin.del(`/api/v1/contacts/${y2Id}`);
  check("FIN yetkili silebiliyor", finSil.status === 200, `HTTP ${finSil.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 9. CSV dışa aktarma ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Formül enjeksiyonu denemesi: marka adına Excel formülü yazılır
  const zararli = await sa.post("/api/v1/brands", {
    code: KOD("C"),
    name: `=cmd|'/c calc'!A1 Doğrulama`,
    taxNumber: "5555555555",
  });
  check("Formül içeren ad kabul edildi (engel CSV tarafında)", zararli.status === 201);

  const saCsv = await sa.get("/api/v1/brands/export");
  check("SA CSV indirebiliyor", saCsv.status === 200, `HTTP ${saCsv.status}`);
  check(
    "Content-Type text/csv",
    (saCsv.headers.get("content-type") ?? "").includes("text/csv"),
    saCsv.headers.get("content-type") ?? "",
  );
  check(
    "Dosya adı Content-Disposition'da",
    (saCsv.headers.get("content-disposition") ?? "").includes("attachment"),
  );
  const bom = saCsv.bytes.slice(0, 3);
  check(
    "Dosya UTF-8 BOM ile başlıyor (Excel Türkçe karakterleri bozmasın)",
    bom[0] === 0xef && bom[1] === 0xbb && bom[2] === 0xbf,
    [...bom].map((b) => b.toString(16)).join(" "),
  );
  check("Satır sonu CRLF", saCsv.text.includes("\r\n"));
  check("SA CSV'sinde vergi sütunları var", saCsv.text.includes("VERGI NO"));
  check(
    "Formül enjeksiyonu etkisiz — hücre = ile başlamıyor",
    !/(^|\r\n|,)"?=cmd/.test(saCsv.text),
    saCsv.text.split("\r\n").find((s) => s.includes("cmd"))?.slice(0, 60) ?? "",
  );
  check(
    "Formül tek tırnakla zararsızlaştırıldı",
    saCsv.text.includes("'=cmd"),
  );

  const opsCsv = await ops.get("/api/v1/brands/export");
  check("OPS CSV indirebiliyor", opsCsv.status === 200, `HTTP ${opsCsv.status}`);
  check("OPS CSV'sinde VERGI NO sütunu YOK", !opsCsv.text.includes("VERGI NO"));
  check("OPS CSV'sinde vergi DEĞERİ de yok", !opsCsv.text.includes("1234567890"));
  check("OPS CSV'sinde atandığı marka var", opsCsv.text.includes(KOD("A")));
  check("OPS CSV'sinde atanmadığı marka YOK", !opsCsv.text.includes(KOD("B")));

  const filtreliCsv = await sa.get(`/api/v1/brands/export?q=${encodeURIComponent(KOD("B"))}`);
  const satirSayisi = filtreliCsv.text.trim().split("\r\n").length;
  check(
    "CSV listenin O ANKİ filtresini dışa aktarır",
    satirSayisi === 2 && filtreliCsv.text.includes(KOD("B")),
    `${satirSayisi} satır (başlık dahil)`,
  );

  const denetim = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE action = 'export' AND entity_type = 'brand' AND request_id IS NOT NULL",
  );
  check("Dışa aktarma denetim izine yazıldı", denetim.rows[0].n >= 3, `${denetim.rows[0].n} kayıt`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 10. Atama kaldırılınca erişim kesilir ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const kaldir = await fin.del(`/api/v1/brands/${markaA}/assignments`, { userId: opsId });
  check("Atama kaldırıldı", kaldir.status === 200, `HTTP ${kaldir.status}`);

  const detay = await ops.get(`/api/v1/brands/${markaA}`);
  check(
    "OPS aynı oturumla markayı ARTIK göremiyor (404)",
    detay.status === 404,
    `HTTP ${detay.status}`,
  );

  const csv = await ops.get("/api/v1/brands/export");
  check("CSV'de de yok", !csv.text.includes(KOD("A")));

  const kayit = await sql.query(
    "SELECT deleted_at FROM brand_assignments WHERE brand_id = $1 AND user_id = $2",
    [markaA, opsId],
  );
  check(
    "Atama kaydı tarihçede duruyor (soft delete)",
    kayit.rows.length === 1 && kayit.rows[0].deleted_at !== null,
  );

  const tekrar = await fin.post(`/api/v1/brands/${markaA}/assignments`, { userId: opsId });
  check("Kaldırılan atama yeniden verilebiliyor", tekrar.status === 201, `HTTP ${tekrar.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 11. Migration 0010 — RESTRICT ve indeksler ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  let restrict = false;
  try {
    await sql.query("DELETE FROM brands WHERE id = $1", [markaA]);
  } catch (e) {
    restrict = e.code === "23503";
  }
  check("Atanmış markanın FİZİKSEL silinmesi RESTRICT ile engellendi", restrict);

  const fkler = await sql.query(`
    SELECT conname, confdeltype FROM pg_constraint
     WHERE conname IN ('fk_brand_services_brand','fk_brand_services_service',
                       'fk_brand_assignments_brand','fk_brand_assignments_user')`);
  check(
    "Dört FK de RESTRICT (CASCADE değil)",
    fkler.rows.length === 4 && fkler.rows.every((r) => r.confdeltype === "r"),
    fkler.rows.map((r) => `${r.conname}:${r.confdeltype}`).join(" "),
  );

  const idx = await sql.query(`
    SELECT indexname, indexdef FROM pg_indexes
     WHERE indexname IN ('uq_brand_service_live','uq_brand_assignment_live',
                         'uq_brands_code','uq_services_code',
                         'idx_brands_name_trgm','idx_brands_code_trgm')`);
  const adlar = idx.rows.map((r) => r.indexname);
  check("Partial unique index'ler var", adlar.includes("uq_brand_service_live") && adlar.includes("uq_brand_assignment_live"));
  check(
    "Partial index'ler yalnız deleted_at IS NULL kayıtları kapsıyor",
    idx.rows
      .filter((r) => r.indexname.endsWith("_live"))
      .every((r) => /deleted_at IS NULL/i.test(r.indexdef)),
  );
  check(
    "Marka kodu benzersizliği case-insensitive (upper(code))",
    idx.rows.some((r) => r.indexname === "uq_brands_code" && /upper/i.test(r.indexdef)),
  );
  check("Marka arama indeksleri kurulu", adlar.includes("idx_brands_name_trgm") && adlar.includes("idx_brands_code_trgm"));

  const plan = await sql.query(
    "EXPLAIN SELECT id FROM brands WHERE lower(name) LIKE '%klinik%' AND deleted_at IS NULL",
  );
  check(
    "Arama planı üretiliyor (indeks küçük tabloda seq scan seçebilir)",
    plan.rows.length > 0,
    plan.rows[0]["QUERY PLAN"].slice(0, 50),
  );
}

// ── Özet ──────────────────────────────────────────────────────────────────
const basarisiz = results.filter((r) => !r.ok);
console.log(`\n${results.length - basarisiz.length}/${results.length} kontrol geçti`);
if (basarisiz.length > 0) {
  console.log("\nBAŞARISIZ:");
  for (const r of basarisiz) console.log(`  ✗ ${r.name}`);
}
await sql.end();
process.exit(basarisiz.length > 0 ? 1 : 0);
