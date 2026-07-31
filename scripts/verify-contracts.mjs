/**
 * Sözleşme modülü doğrulaması — Sprint 3 Aşama 1.
 *
 * Gerçek HTTP istekleriyle çalışır; sunucu ayakta olmalıdır.
 * Sınanan şey KURALIN KENDİSİDİR, arayüz değil:
 *   · yetki matrisi (SA/FIN/OPS/MEM) her uçta
 *   · OPS için ROLE ÖZEL PROJECTION: tutar alanları yanıtta ANAHTAR OLARAK
 *     BİLE yok
 *   · contract_no: biçim, yıl kaynağı, yarış, yeniden kullanılmama, kilit
 *   · durum geçişleri, alan kilidi, step-up, eşzamanlılık
 *   · amount_basis: zorunluluk, one_time istisnası, kilit
 *   · ödeme planı: kayıt üretmeme, üç toplam eşitliği, 120 sınırı
 *   · yenileme tarih kuralları
 *   · marka-hizmet bağlama: ekleme/canlandırma/dokunmama + denetim
 *   · CSV: kapsam, alan süzgeci, formül enjeksiyonu, BOM
 *
 * ⚠ PRD §6.3: yalnız sahte veri (`example.com`, `DGS-*` kodları) kullanılır.
 *
 * Kullanım: npm run verify:contracts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { tazeTotp, totp } from "./_totp.mjs";

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
const RUN_ID = `contracts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  const ip = `198.19.2.${(ipSayac % 250) + 1}`;
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
    put: (p, b) => cagir("PUT", p, b ?? {}),
    del: (p, b) => cagir("DELETE", p, b ?? {}),
  };
}

async function girisYap(c, email, ikiFaKur = false) {
  await c.post("/api/auth/sign-in/email", { email, password: PAROLA });
  if (!ikiFaKur) return null;
  const enable = await c.post("/api/auth/two-factor/enable", { password: PAROLA });
  const uri = enable.json?.totpURI ?? enable.json?.totpUri;
  if (!uri) return null;
  const secret = new URL(uri.replace("otpauth://", "http://")).searchParams.get("secret");
  await c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
  return secret;
}

/**
 * Step-up alır.
 *
 * ⚠ Aynı TOTP kodu iki kez gönderilirse replay sayılır ve art arda gelen
 * başarısızlıklar hesabı kilitler; `tazeTotp` kod değişene kadar bekler.
 */
async function stepUpAl(c, secret) {
  await sql.query("DELETE FROM auth_rate_limit");
  const r = secret
    ? await c.post("/api/v1/reauth", { password: PAROLA, totpCode: await tazeTotp(secret) })
    : await c.post("/api/v1/reauth", { password: PAROLA });
  /**
   * ⚠ Sessiz başarısızlık en pahalı hata: step-up alınamazsa SONRAKİ her
   * kritik işlem 403 döner ve testler "kural çalışmıyor" gibi görünür.
   * Sebebin kendisi burada raporlanır.
   */
  if (r.status !== 200) {
    check(
      "step-up alınabildi (sonraki kontrollerin ön koşulu)",
      false,
      `HTTP ${r.status} ${r.json?.error?.code ?? ""} ${r.json?.error?.message ?? ""}`,
    );
  }
  return r;
}

// ── Fixture ───────────────────────────────────────────────────────────────
const DAMGA = Date.now().toString(36).slice(-4).toUpperCase();
const KOD = (x) => `DGS${x}${DAMGA}`.slice(0, 16);

async function fixtureTemizle() {
  await sql.query("DELETE FROM auth_rate_limit");
  // FK'ler RESTRICT: çocuklar önce düşer
  await sql.query(
    "DELETE FROM contract_items WHERE contract_id IN (SELECT id FROM contracts WHERE contract_no LIKE 'PRV-%' AND brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGS%'))",
  );
  await sql.query(
    "DELETE FROM contracts WHERE brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGS%')",
  );
  await sql.query(
    "DELETE FROM brand_assignments WHERE brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGS%')",
  );
  await sql.query(
    "DELETE FROM brand_services WHERE brand_id IN (SELECT id FROM brands WHERE code LIKE 'DGS%')",
  );
  await sql.query("DELETE FROM brands WHERE code LIKE 'DGS%'");
  await sql.query(
    "DELETE FROM brand_services WHERE service_id IN (SELECT id FROM services WHERE code LIKE 'DGSH%')",
  );
  await sql.query("DELETE FROM services WHERE code LIKE 'DGSH%'");

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
  await sql.query("DELETE FROM auth_security_state");
  await sql.query("DELETE FROM auth_login_attempts");
  await sql.query("UPDATE users SET is_active = true, role = 'super_admin' WHERE email = 'admin@example.com'");
  await sql.query("UPDATE users SET is_active = true, role = 'finance' WHERE email = 'finance@example.com'");
  await sql.query("UPDATE users SET is_active = true, role = 'operations' WHERE email = 'operations@example.com'");
  await sql.query("UPDATE users SET is_active = true, role = 'member' WHERE email = 'member@example.com'");
}

await fixtureTemizle();

/** Sahte markalar ve hizmetler — doğrudan SQL (davranış testi değil, fixture). */
async function fixtureKur() {
  const marka = async (code, name, status) => {
    const { rows } = await sql.query(
      `INSERT INTO brands (code, name, industry, status)
       VALUES ($1,$2,'Test',$3) RETURNING id`,
      [code, name, status],
    );
    return rows[0].id;
  };
  const hizmet = async (code, name, aktif) => {
    const { rows } = await sql.query(
      `INSERT INTO services (code, name, category, default_unit, is_active)
       VALUES ($1,$2,'genel','Aylık',$3) RETURNING id`,
      [code, name, aktif],
    );
    return rows[0].id;
  };

  const kapsamli = await marka(KOD("A"), "Sahte Kapsam A", "active");
  const kapsamDisi = await marka(KOD("B"), "Sahte Kapsam Disi B", "active");
  const aday = await marka(KOD("C"), "Sahte Aday C", "lead");
  const askida = await marka(KOD("D"), "Sahte Askida D", "suspended");

  const hizmetBagli = await hizmet(`DGSH1${DAMGA}`, "Sahte Bagli Hizmet", true);
  const hizmetBagsiz = await hizmet(`DGSH2${DAMGA}`, "Sahte Bagsiz Hizmet", true);
  const hizmetPasif = await hizmet(`DGSH3${DAMGA}`, "Sahte Pasif Hizmet", true);
  const hizmetSilinmis = await hizmet(`DGSH4${DAMGA}`, "Sahte Silinmis Bag", true);

  // Kapsamlı markaya bir hizmet ZATEN bağlı; biri de soft delete edilmiş
  await sql.query("INSERT INTO brand_services (brand_id, service_id) VALUES ($1,$2)", [
    kapsamli,
    hizmetBagli,
  ]);
  await sql.query(
    "INSERT INTO brand_services (brand_id, service_id, deleted_at) VALUES ($1,$2, now())",
    [kapsamli, hizmetSilinmis],
  );

  // OPS yalnız kapsamlı markaya atanır
  const { rows: opsRows } = await sql.query(
    "SELECT id FROM users WHERE email = 'operations@example.com'",
  );
  await sql.query("INSERT INTO brand_assignments (brand_id, user_id) VALUES ($1,$2)", [
    kapsamli,
    opsRows[0].id,
  ]);

  return {
    kapsamli,
    kapsamDisi,
    aday,
    askida,
    hizmetBagli,
    hizmetBagsiz,
    hizmetPasif,
    hizmetSilinmis,
  };
}

const F = await fixtureKur();
console.log("· Fixture kuruldu\n");

const sa = client();
const fin = client();
const ops = client();
const mem = client();
const saSecret = await girisYap(sa, "admin@example.com", true);
const finSecret = await girisYap(fin, "finance@example.com", true);
await girisYap(ops, "operations@example.com");
await girisYap(mem, "member@example.com");

/** Standart taslak gövdesi. */
function taslakGovde(uzer = {}) {
  return {
    brandId: F.kapsamli,
    title: "Sahte Sozlesme",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    enteredAmountMinor: 4_500_000,
    amountBasis: "per_period",
    vatRate: 20,
    vatIncluded: false,
    discountMinor: 100_000,
    billingFrequency: "monthly",
    billingInterval: 1,
    firstDueDate: "2026-04-30",
    paymentDay: 31,
    ...uzer,
  };
}

async function taslakOlustur(c = fin, uzer = {}) {
  const r = await c.post("/api/v1/contracts", taslakGovde(uzer));
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("═══ 1. Erişim kapısı ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  check("SA listeyi görüyor", (await sa.get("/api/v1/contracts")).status === 200);
  check("FIN listeyi görüyor", (await fin.get("/api/v1/contracts")).status === 200);
  check("OPS listeyi görüyor", (await ops.get("/api/v1/contracts")).status === 200);

  const memListe = await mem.get("/api/v1/contracts");
  check("MEM listede 404 (403 değil)", memListe.status === 404, `HTTP ${memListe.status}`);
  const memCsv = await mem.get("/api/v1/contracts/export");
  check("MEM CSV ucunda 404", memCsv.status === 404, `HTTP ${memCsv.status}`);
  const memYaz = await mem.post("/api/v1/contracts", taslakGovde());
  check("MEM oluşturma ucunda 404", memYaz.status === 404, `HTTP ${memYaz.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 2. amount_basis zorunluluğu ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const govde = taslakGovde();
  delete govde.amountBasis;
  const r = await fin.post("/api/v1/contracts", govde);
  check(
    "amountBasis eksikse VALIDATION (sessizce dönemlik sayılmaz)",
    r.status === 400 && r.json?.error?.code === "VALIDATION",
    `HTTP ${r.status} ${r.json?.error?.code ?? ""}`,
  );

  const kolon = await sql.query(
    "SELECT column_default FROM information_schema.columns WHERE table_name='contracts' AND column_name='amount_basis'",
  );
  check(
    "amount_basis kolonunun DB'de DEFAULT'u yok",
    kolon.rows[0]?.column_default === null,
    String(kolon.rows[0]?.column_default),
  );

  const gecersiz = await fin.post("/api/v1/contracts", taslakGovde({ amountBasis: "aylik" }));
  check("geçersiz amountBasis reddediliyor", gecersiz.status === 400, `HTTP ${gecersiz.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 3. contract_no üretimi ═══");
// ═══════════════════════════════════════════════════════════════════════════
let sozlesmeA;
{
  const r = await taslakOlustur();
  check("FIN taslak oluşturabiliyor", r.status === 201, `HTTP ${r.status}`);
  sozlesmeA = r.json?.contract?.id;

  const no = r.json?.contract?.contractNo ?? "";
  const yil = new Date().toLocaleString("en-CA", { timeZone: "Europe/Istanbul" }).slice(0, 4);
  check(
    `numara biçimi PRV-${yil}-NNNN`,
    new RegExp(`^PRV-${yil}-\\d{4}$`).test(no),
    no,
  );

  // Yıl kaynağı start_date DEĞİL: geçmiş yıla ait bir sözleşme de bu yılın
  // numarasını alır
  const eski = await fin.post(
    "/api/v1/contracts",
    // Vadeler de o yıla çekilir; aksi hâlde ilk vade bitişten sonraya düşer
    taslakGovde({ startDate: "2024-01-01", endDate: "2024-12-31", firstDueDate: "2024-01-31" }),
  );
  check(
    "numara yılı start_date'ten DEĞİL, Europe/Istanbul'dan geliyor",
    (eski.json?.contract?.contractNo ?? "").startsWith(`PRV-${yil}-`),
    eski.json?.contract?.contractNo,
  );

  // Paralel iki taslak farklı numara alır
  const [p1, p2, p3] = await Promise.all([taslakOlustur(), taslakOlustur(), taslakOlustur()]);
  const numaralar = [p1, p2, p3].map((x) => x.json?.contract?.contractNo);
  check(
    "paralel üç taslak farklı numara aldı, 500 yok",
    new Set(numaralar).size === 3 && [p1, p2, p3].every((x) => x.status === 201),
    numaralar.join(", "),
  );

  // Silinen taslağın numarası yeniden kullanılmaz
  const silinecek = await taslakOlustur();
  const silinenNo = silinecek.json?.contract?.contractNo;
  await stepUpAl(sa, saSecret);
  const silme = await sa.del(`/api/v1/contracts/${silinecek.json?.contract?.id}`);
  const sonraki = await taslakOlustur();
  check(
    "silinen taslağın numarası yeniden kullanılmıyor",
    silme.status === 200 && sonraki.json?.contract?.contractNo !== silinenNo,
    `${silinenNo} → ${sonraki.json?.contract?.contractNo}`,
  );

  // Numara her durumda değiştirilemez (draft dâhil)
  const dbHata = await sql
    .query("UPDATE contracts SET contract_no = 'PRV-2000-9999' WHERE id = $1", [sozlesmeA])
    .then(() => null)
    .catch((e) => e);
  check("contract_no UPDATE'i trigger'la reddediliyor (draft dâhil)", dbHata !== null);

  const apiNo = await fin.patch(`/api/v1/contracts/${sozlesmeA}`, {
    contractNo: "PRV-2000-9999",
  });
  check(
    "API üzerinden numara değişimi 422 CONTRACT_LOCKED",
    apiNo.status === 422 && apiNo.json?.error?.code === "CONTRACT_LOCKED",
    `HTTP ${apiNo.status} ${apiNo.json?.error?.code ?? ""}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 4. OPS role özel projection ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const FINANSAL = [
    "amountMinor", "amountBasis", "amountBaseMinor", "fxRate", "vatRate",
    "vatIncluded", "discountMinor", "paymentDay", "paymentTermsDays",
    "paymentMethod", "currencyCode", "billingFrequency", "billingInterval",
    "installmentCount", "firstDueDate", "grossAmountMinor",
  ];

  const opsListe = await ops.get("/api/v1/contracts");
  const opsGovde = JSON.stringify(opsListe.json);
  const sizan = FINANSAL.filter((a) => opsGovde.includes(`"${a}"`));
  check(
    "OPS listesinde finansal alan ANAHTAR OLARAK BİLE yok",
    sizan.length === 0,
    sizan.join(", "),
  );

  const opsDetay = await ops.get(`/api/v1/contracts/${sozlesmeA}`);
  const opsDetayGovde = JSON.stringify(opsDetay.json);
  const sizanDetay = FINANSAL.filter((a) => opsDetayGovde.includes(`"${a}"`));
  check(
    "OPS detayında da yok (kalem fiyatları dâhil)",
    opsDetay.status === 200 && sizanDetay.length === 0 && !opsDetayGovde.includes("unitPriceMinor"),
    sizanDetay.join(", "),
  );
  check("OPS detayında toplamlar bloğu yok", opsDetay.json?.toplamlar === undefined);

  const finDetay = await fin.get(`/api/v1/contracts/${sozlesmeA}`);
  check(
    "FIN detayında tutar ve brüt var",
    finDetay.json?.contract?.amountMinor === 4_500_000 &&
      finDetay.json?.contract?.grossAmountMinor === 5_400_000,
    `${finDetay.json?.contract?.amountMinor} / ${finDetay.json?.contract?.grossAmountMinor}`,
  );

  // Kapsam: OPS atanmadığı markanın sözleşmesini göremez
  const disKontrat = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ brandId: F.kapsamDisi }),
  );
  const opsDis = await ops.get(`/api/v1/contracts/${disKontrat.json?.contract?.id}`);
  check("OPS kapsam dışı sözleşmede 404", opsDis.status === 404, `HTTP ${opsDis.status}`);

  const opsYaz = await ops.post("/api/v1/contracts", taslakGovde());
  check("OPS oluşturma ucunda 403", opsYaz.status === 403, `HTTP ${opsYaz.status}`);

  const opsPlan = await ops.get(`/api/v1/contracts/${sozlesmeA}/payment-preview`);
  check(
    "OPS ödeme planı ucunda 404 (uç tamamen finansal)",
    opsPlan.status === 404,
    `HTTP ${opsPlan.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 5. Kalemler, snapshot ve uyuşmazlık ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const yaz = await fin.put(`/api/v1/contracts/${sozlesmeA}/items`, {
    items: [
      { serviceId: F.hizmetBagli, quantity: 1, unitPriceMinor: 3_000_000 },
      { serviceId: F.hizmetBagsiz, quantity: 1, unitPriceMinor: 1_600_000 },
    ],
  });
  check("kalemler yazıldı", yaz.status === 200 && yaz.json?.adet === 2, `HTTP ${yaz.status}`);
  check(
    "markaya bağlı olmayan hizmet UYARI üretiyor (engellemiyor)",
    (yaz.json?.warnings ?? []).some((w) => w.includes("tanımlı değil")),
    JSON.stringify(yaz.json?.warnings),
  );
  check(
    "kalem toplamı = beklenen net → uyuşmazlık yok",
    yaz.json?.toplamlar?.uyusmazlik === false,
    JSON.stringify(yaz.json?.toplamlar),
  );

  // Uyuşmazlık: kaydı ENGELLEMEZ, uyarır
  const uyus = await fin.put(`/api/v1/contracts/${sozlesmeA}/items`, {
    items: [
      { serviceId: F.hizmetBagli, quantity: 1, unitPriceMinor: 3_000_000 },
      { serviceId: F.hizmetBagsiz, quantity: 1, unitPriceMinor: 1_700_000 },
    ],
  });
  check(
    "uyuşmazlık kaydı engellemiyor, warnings dolu",
    uyus.status === 200 && uyus.json?.toplamlar?.uyusmazlik === true &&
      (uyus.json?.warnings ?? []).length > 0,
    JSON.stringify(uyus.json?.toplamlar),
  );

  // SNAPSHOT: katalogda ad değişince kalem adı DEĞİŞMEZ
  const oncekiAd = (
    await sql.query(
      "SELECT name FROM contract_items WHERE contract_id = $1 AND service_id = $2 AND deleted_at IS NULL",
      [sozlesmeA, F.hizmetBagli],
    )
  ).rows[0]?.name;
  await sql.query("UPDATE services SET name = 'DEGISTIRILMIS AD' WHERE id = $1", [F.hizmetBagli]);
  const sonraAd = (
    await sql.query(
      "SELECT name FROM contract_items WHERE contract_id = $1 AND service_id = $2 AND deleted_at IS NULL",
      [sozlesmeA, F.hizmetBagli],
    )
  ).rows[0]?.name;
  check(
    "SNAPSHOT: katalog adı değişti, kalem adı değişmedi",
    oncekiAd === sonraAd && sonraAd !== "DEGISTIRILMIS AD",
    `${oncekiAd} → ${sonraAd}`,
  );
  await sql.query("UPDATE services SET name = 'Sahte Bagli Hizmet' WHERE id = $1", [F.hizmetBagli]);

  // Pasif hizmet yeni kaleme eklenemez
  await sql.query("UPDATE services SET is_active = false WHERE id = $1", [F.hizmetPasif]);
  const pasif = await fin.put(`/api/v1/contracts/${sozlesmeA}/items`, {
    items: [{ serviceId: F.hizmetPasif, quantity: 1, unitPriceMinor: 100_000 }],
  });
  check(
    "pasif hizmet yeni kaleme eklenemiyor (422 SERVICE_INACTIVE)",
    pasif.status === 422 && pasif.json?.error?.code === "SERVICE_INACTIVE",
    `HTTP ${pasif.status} ${pasif.json?.error?.code ?? ""}`,
  );

  // Kalemleri doğru hâline geri getir
  await fin.put(`/api/v1/contracts/${sozlesmeA}/items`, {
    items: [
      { serviceId: F.hizmetBagli, quantity: 1, unitPriceMinor: 3_000_000 },
      { serviceId: F.hizmetBagsiz, quantity: 1, unitPriceMinor: 1_600_000 },
      { serviceId: F.hizmetSilinmis, quantity: 1, unitPriceMinor: 0 },
    ],
  });

  // Kalem para birimi trigger'ı
  const trigger = await sql
    .query(
      "UPDATE contract_items SET currency_code = 'USD' WHERE contract_id = $1 AND deleted_at IS NULL",
      [sozlesmeA],
    )
    .then(() => null)
    .catch((e) => e);
  check("kalem para birimi sözleşmeden farklı olamıyor (trigger)", trigger !== null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 6. Ödeme planı önizlemesi ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const once = await sql.query("SELECT count(*)::int AS n FROM receivables");
  const onceTpl = await sql.query("SELECT count(*)::int AS n FROM recurring_templates");

  const plan = await fin.get(`/api/v1/contracts/${sozlesmeA}/payment-preview`);
  check("plan üretiliyor", plan.status === 200, `HTTP ${plan.status}`);
  check(
    "per_period: 12 satır, toplam = tutar × 12",
    plan.json?.satirlar?.length === 12 && plan.json?.toplam?.netMinor === 4_500_000 * 12,
    `${plan.json?.satirlar?.length} satır / ${plan.json?.toplam?.netMinor}`,
  );
  check(
    "ay sonu kuralı uygulanıyor",
    plan.json?.satirlar?.[0]?.vadeTarihi === "2026-04-30" &&
      plan.json?.satirlar?.[1]?.vadeTarihi === "2026-05-31" &&
      plan.json?.satirlar?.[10]?.vadeTarihi === "2027-02-28",
    plan.json?.satirlar?.map((s) => s.vadeTarihi).join(","),
  );
  check("yanıt 'kayıt oluşturmaz' ibaresini taşıyor", Boolean(plan.json?.not));

  const sonra = await sql.query("SELECT count(*)::int AS n FROM receivables");
  const sonraTpl = await sql.query("SELECT count(*)::int AS n FROM recurring_templates");
  check(
    "önizleme HİÇ receivable/recurring_template yazmıyor",
    once.rows[0].n === sonra.rows[0].n && onceTpl.rows[0].n === sonraTpl.rows[0].n,
    `${once.rows[0].n}→${sonra.rows[0].n}, ${onceTpl.rows[0].n}→${sonraTpl.rows[0].n}`,
  );

  // contract_total: üç toplam eşitliği
  const toplamSoz = await fin.post(
    "/api/v1/contracts",
    taslakGovde({
      amountBasis: "contract_total",
      enteredAmountMinor: 10_000_000,
      installmentCount: 3,
      endDate: null,
      firstDueDate: "2026-06-30",
    }),
  );
  const tPlan = await fin.get(
    `/api/v1/contracts/${toplamSoz.json?.contract?.id}/payment-preview`,
  );
  const netler = tPlan.json?.satirlar?.map((s) => s.netMinor) ?? [];
  const kdvler = tPlan.json?.satirlar?.map((s) => s.kdvMinor) ?? [];
  check(
    "contract_total: kalan kuruş SON taksite (net)",
    JSON.stringify(netler) === JSON.stringify([3_333_333, 3_333_333, 3_333_334]),
    JSON.stringify(netler),
  );
  check(
    "contract_total: KDV ayrı bölünüyor, kalan son taksitte",
    JSON.stringify(kdvler) === JSON.stringify([666_666, 666_666, 666_668]),
    JSON.stringify(kdvler),
  );
  check(
    "ÜÇ TOPLAM EŞİTLİĞİ: net/KDV/brüt sözleşme değerleriyle birebir",
    tPlan.json?.toplam?.netMinor === 10_000_000 &&
      tPlan.json?.toplam?.kdvMinor === 2_000_000 &&
      tPlan.json?.toplam?.brutMinor === 12_000_000,
    JSON.stringify(tPlan.json?.toplam),
  );

  // one_time: tam 1 satır, taksit/bitiş aranmadan
  const tek = await fin.post(
    "/api/v1/contracts",
    taslakGovde({
      billingFrequency: "one_time",
      amountBasis: "contract_total",
      installmentCount: null,
      endDate: null,
      firstDueDate: null,
      paymentDay: null,
    }),
  );
  check("one_time taslağı taksit/bitiş olmadan oluşuyor", tek.status === 201, `HTTP ${tek.status}`);
  const tekPlan = await fin.get(`/api/v1/contracts/${tek.json?.contract?.id}/payment-preview`);
  check(
    "one_time: tam 1 satır",
    tekPlan.json?.satirlar?.length === 1,
    String(tekPlan.json?.satirlar?.length),
  );

  // contract_total + sınırsız → DB CHECK reddediyor
  const sinirsiz = await fin.post(
    "/api/v1/contracts",
    taslakGovde({
      amountBasis: "contract_total",
      installmentCount: null,
      endDate: null,
    }),
  );
  check(
    "contract_total + sınırsız reddediliyor",
    sinirsiz.status === 400,
    `HTTP ${sinirsiz.status}`,
  );

  const dbSinirsiz = await sql
    .query(
      `INSERT INTO contracts (brand_id, contract_no, title, start_date, amount_minor, amount_basis,
                              currency_code, amount_base_minor, billing_frequency)
       VALUES ($1, 'PRV-9999-0001', 'db', '2026-01-01', 100, 'contract_total', 'TRY', 100, 'monthly')`,
      [F.kapsamli],
    )
    .then(() => null)
    .catch((e) => e);
  check("DB CHECK de sınırsız contract_total'ı reddediyor", dbSinirsiz !== null);

  // 120 sınırı — her iki temelde de liste KESİLMEZ, reddedilir
  const uzunPP = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ installmentCount: 121, endDate: null }),
  );
  check(
    "per_period 121 vade → 422 PREVIEW_TOO_LONG",
    uzunPP.status === 422 && uzunPP.json?.error?.code === "PREVIEW_TOO_LONG",
    `HTTP ${uzunPP.status} ${uzunPP.json?.error?.code ?? ""}`,
  );
  const uzunCT = await fin.post(
    "/api/v1/contracts",
    taslakGovde({
      amountBasis: "contract_total",
      enteredAmountMinor: 10_000_000,
      installmentCount: 121,
      endDate: null,
    }),
  );
  check(
    "contract_total 121 vade → 422 PREVIEW_TOO_LONG (kesilmiyor)",
    uzunCT.status === 422 && uzunCT.json?.error?.code === "PREVIEW_TOO_LONG",
    `HTTP ${uzunCT.status} ${uzunCT.json?.error?.code ?? ""}`,
  );
  const tamSinir = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ installmentCount: 120, endDate: null }),
  );
  check("tam 120 vade kabul ediliyor", tamSinir.status === 201, `HTTP ${tamSinir.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 7. Yenileme tarih kuralları ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const esit = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ renewalDate: "2027-03-31" }),
  );
  check(
    "renewal_date = end_date reddediliyor (kesin büyük olmalı)",
    esit.status >= 400,
    `HTTP ${esit.status}`,
  );

  const oncesi = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ renewalDate: "2027-01-01" }),
  );
  check("renewal_date < end_date reddediliyor", oncesi.status >= 400, `HTTP ${oncesi.status}`);

  const sonrasi = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ renewalDate: "2027-04-01", renewalReviewDate: "2026-09-15" }),
  );
  check(
    "renewal_date > end_date ve review <= renewal kabul ediliyor",
    sonrasi.status === 201,
    `HTTP ${sonrasi.status}`,
  );

  const suresiz = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ endDate: null, renewalDate: "2027-04-01", installmentCount: 12 }),
  );
  check(
    "süresiz sözleşmede renewal_date kullanılamıyor",
    suresiz.status >= 400,
    `HTTP ${suresiz.status}`,
  );

  const suresizReview = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ endDate: null, renewalReviewDate: "2026-09-15", installmentCount: 12 }),
  );
  check(
    "süresiz sözleşmede renewal_review_date kullanılabiliyor",
    suresizReview.status === 201,
    `HTTP ${suresizReview.status}`,
  );

  const reviewOnce = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ renewalReviewDate: "2026-01-01" }),
  );
  check(
    "renewal_review_date < start_date reddediliyor",
    reviewOnce.status >= 400,
    `HTTP ${reviewOnce.status}`,
  );

  const otoYenile = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ autoRenew: true, renewalDate: null }),
  );
  check(
    "auto_renew + boş renewal_date reddediliyor",
    otoYenile.status >= 400,
    `HTTP ${otoYenile.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 8. Step-up ve durum geçişleri ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Step-up olmadan aktivasyon
  await sql.query(
    "DELETE FROM auth_reauthentication WHERE user_id = (SELECT id::text FROM users WHERE email = 'finance@example.com')",
  );
  const stepsiz = await fin.post(`/api/v1/contracts/${sozlesmeA}/activate`);
  check(
    "step-up'sız aktivasyon 403 SESSION_STALE",
    stepsiz.status === 403 && stepsiz.json?.error?.code === "SESSION_STALE",
    `HTTP ${stepsiz.status} ${stepsiz.json?.error?.code ?? ""}`,
  );

  await stepUpAl(fin, finSecret);
  const aktif = await fin.post(`/api/v1/contracts/${sozlesmeA}/activate`);
  check("step-up sonrası aktivasyon 200", aktif.status === 200, `HTTP ${aktif.status}`);

  const durum = await sql.query(
    "SELECT status, activated_at FROM contracts WHERE id = $1",
    [sozlesmeA],
  );
  check(
    "durum active ve activated_at dolu",
    durum.rows[0].status === "active" && durum.rows[0].activated_at !== null,
  );

  // Aktifken alan kilidi
  const kilitli = await fin.patch(`/api/v1/contracts/${sozlesmeA}`, {
    enteredAmountMinor: 9_999_999,
  });
  check(
    "aktifte tutar PATCH'i 422 CONTRACT_LOCKED",
    kilitli.status === 422 && kilitli.json?.error?.code === "CONTRACT_LOCKED",
    `HTTP ${kilitli.status} ${kilitli.json?.error?.code ?? ""}`,
  );
  const temelKilit = await fin.patch(`/api/v1/contracts/${sozlesmeA}`, {
    amountBasis: "contract_total",
  });
  check(
    "aktifte amount_basis PATCH'i de kilitli",
    temelKilit.status === 422,
    `HTTP ${temelKilit.status}`,
  );
  const notlar = await fin.patch(`/api/v1/contracts/${sozlesmeA}`, { notes: "sahte not" });
  check("aktifte notes güncellenebiliyor", notlar.status === 200, `HTTP ${notlar.status}`);

  // Aktif sözleşme silinemez
  await stepUpAl(sa, saSecret);
  const silme = await sa.del(`/api/v1/contracts/${sozlesmeA}`);
  check("aktif sözleşme DELETE 422", silme.status === 422, `HTTP ${silme.status}`);

  // FIN silemez
  const finSil = await fin.del(`/api/v1/contracts/${sozlesmeA}`);
  check("FIN silme ucunda 403", finSil.status === 403, `HTTP ${finSil.status}`);

  // Geçersiz geçiş
  const geriDraft = await fin.patch(`/api/v1/contracts/${sozlesmeA}`, { status: "draft" });
  check("status alanı PATCH ile değiştirilemiyor", geriDraft.status === 422, `HTTP ${geriDraft.status}`);

  await stepUpAl(fin, finSecret);
  const tekrarAktif = await fin.post(`/api/v1/contracts/${sozlesmeA}/activate`);
  check(
    "aktif sözleşme tekrar aktive edilemiyor (422 INVALID_TRANSITION)",
    tekrarAktif.status === 422 && tekrarAktif.json?.error?.code === "INVALID_TRANSITION",
    `HTTP ${tekrarAktif.status} ${tekrarAktif.json?.error?.code ?? ""}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 9. Marka durumu ve hizmet bağlama ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Askıdaki markada aktivasyon reddediliyor
  const askidaSoz = await fin.post("/api/v1/contracts", taslakGovde({ brandId: F.askida }));
  await stepUpAl(fin, finSecret);
  const askidaAktif = await fin.post(
    `/api/v1/contracts/${askidaSoz.json?.contract?.id}/activate`,
  );
  check(
    "askıdaki markada aktivasyon 422 BRAND_NOT_ACTIVATABLE",
    askidaAktif.status === 422 && askidaAktif.json?.error?.code === "BRAND_NOT_ACTIVATABLE",
    `HTTP ${askidaAktif.status} ${askidaAktif.json?.error?.code ?? ""}`,
  );

  // Aday markada aktivasyon markayı da aktifleştirir
  const adaySoz = await fin.post("/api/v1/contracts", taslakGovde({ brandId: F.aday }));
  const adaySozId = adaySoz.json?.contract?.id;
  await stepUpAl(fin, finSecret);
  const adayAktif = await fin.post(`/api/v1/contracts/${adaySozId}/activate`);
  const markaDurum = await sql.query("SELECT status FROM brands WHERE id = $1", [F.aday]);
  check(
    "aday markada aktivasyon markayı active yapıyor",
    adayAktif.status === 200 && markaDurum.rows[0].status === "active",
    `HTTP ${adayAktif.status} / ${markaDurum.rows[0].status}`,
  );
  const ikiAudit = await sql.query(
    `SELECT entity_type, count(*)::int AS n FROM audit_logs
      WHERE test_run_id = $1 AND entity_id IN ($2, $3)
      GROUP BY entity_type`,
    [RUN_ID, adaySozId, F.aday],
  );
  check(
    "aktivasyon İKİ AYRI denetim kaydı üretiyor (contract + brand)",
    ikiAudit.rows.length === 2,
    JSON.stringify(ikiAudit.rows),
  );

  // ── Marka-hizmet bağlama (sozlesmeA aktive edilmişti) ──
  const bagliSayim = await sql.query(
    `SELECT service_id, count(*)::int AS n, count(*) FILTER (WHERE deleted_at IS NULL)::int AS canli
       FROM brand_services WHERE brand_id = $1 GROUP BY service_id`,
    [F.kapsamli],
  );
  const satir = (id) => bagliSayim.rows.find((r) => r.service_id === id);

  check(
    "zaten bağlı hizmette İKİNCİ SATIR oluşmadı",
    satir(F.hizmetBagli)?.n === 1 && satir(F.hizmetBagli)?.canli === 1,
    JSON.stringify(satir(F.hizmetBagli)),
  );
  check(
    "bağlı olmayan hizmet markaya EKLENDİ",
    satir(F.hizmetBagsiz)?.canli === 1,
    JSON.stringify(satir(F.hizmetBagsiz)),
  );
  check(
    "soft delete edilmiş bağ CANLANDIRILDI (yeni satır yok)",
    satir(F.hizmetSilinmis)?.n === 1 && satir(F.hizmetSilinmis)?.canli === 1,
    JSON.stringify(satir(F.hizmetSilinmis)),
  );

  const bagAudit = await sql.query(
    `SELECT action, changes->>'source' AS source FROM audit_logs
      WHERE test_run_id = $1 AND entity_type = 'brand_service'
      ORDER BY action`,
    [RUN_ID],
  );
  check(
    "denetim: create ve restore kullanıldı, source=contract_activation",
    bagAudit.rows.length === 2 &&
      bagAudit.rows.every((r) => r.source === "contract_activation") &&
      bagAudit.rows.map((r) => r.action).sort().join(",") === "create,restore",
    JSON.stringify(bagAudit.rows),
  );

  /**
   * Enum 0000'dan beri 15 değerlidir. Sprint 3 marka-hizmet bağlamayı mevcut
   * `create`/`restore` ile yazar; sayı artmışsa biri enum'a serbest metin
   * eklemiş demektir.
   */
  const enumDegerleri = await sql.query(
    "SELECT count(*)::int AS n FROM pg_enum WHERE enumtypid = 'audit_action'::regtype",
  );
  check(
    "audit_action enum'ına YENİ DEĞER EKLENMEDİ (15 değer)",
    enumDegerleri.rows[0].n === 15,
    `${enumDegerleri.rows[0].n} değer`,
  );

  // Pasif hizmet bağlanmıyor ama aktivasyonu engellemiyor
  const pasifSoz = await fin.post("/api/v1/contracts", taslakGovde());
  const pasifSozId = pasifSoz.json?.contract?.id;
  await sql.query("UPDATE services SET is_active = true WHERE id = $1", [F.hizmetPasif]);
  await fin.put(`/api/v1/contracts/${pasifSozId}/items`, {
    items: [{ serviceId: F.hizmetPasif, quantity: 1, unitPriceMinor: 4_400_000 }],
  });
  await sql.query("UPDATE services SET is_active = false WHERE id = $1", [F.hizmetPasif]);
  await stepUpAl(fin, finSecret);
  const pasifAktif = await fin.post(`/api/v1/contracts/${pasifSozId}/activate`);
  const pasifBag = await sql.query(
    "SELECT count(*)::int AS n FROM brand_services WHERE brand_id = $1 AND service_id = $2 AND deleted_at IS NULL",
    [F.kapsamli, F.hizmetPasif],
  );
  check(
    "pasif hizmet aktivasyonu engellemiyor ama BAĞLANMIYOR",
    pasifAktif.status === 200 && pasifBag.rows[0].n === 0 &&
      (pasifAktif.json?.warnings ?? []).length > 0,
    `HTTP ${pasifAktif.status} / bag ${pasifBag.rows[0].n}`,
  );

  // Sonlandırma brand_services'e DOKUNMUYOR
  const oncekiBag = await sql.query(
    "SELECT count(*)::int AS n FROM brand_services WHERE brand_id = $1 AND deleted_at IS NULL",
    [F.kapsamli],
  );
  await stepUpAl(fin, finSecret);
  const son = await fin.post(`/api/v1/contracts/${sozlesmeA}/end`, {
    endReason: "Sahte sonlandirma gerekcesi",
  });
  const sonrakiBag = await sql.query(
    "SELECT count(*)::int AS n FROM brand_services WHERE brand_id = $1 AND deleted_at IS NULL",
    [F.kapsamli],
  );
  check(
    "sonlandırma brand_services'e dokunmuyor",
    son.status === 200 && oncekiBag.rows[0].n === sonrakiBag.rows[0].n,
    `${oncekiBag.rows[0].n} → ${sonrakiBag.rows[0].n}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 10. Gerekçe ve yaşam döngüsü CHECK'leri ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const bosGerekce = await fin.post(`/api/v1/contracts/${sozlesmeA}/end`, { endReason: "   " });
  check(
    "boşluktan ibaret gerekçe reddediliyor",
    bosGerekce.status >= 400,
    `HTTP ${bosGerekce.status}`,
  );

  // Taslak iptali de STEP-UP ister
  const iptalSoz = await fin.post("/api/v1/contracts", taslakGovde());
  const iptalId = iptalSoz.json?.contract?.id;
  await sql.query(
    "DELETE FROM auth_reauthentication WHERE user_id = (SELECT id::text FROM users WHERE email = 'finance@example.com')",
  );
  const iptalStepsiz = await fin.post(`/api/v1/contracts/${iptalId}/cancel`, {
    cancelReason: "Sahte iptal gerekcesi",
  });
  check(
    "TASLAK iptali de step-up istiyor (403 SESSION_STALE)",
    iptalStepsiz.status === 403 && iptalStepsiz.json?.error?.code === "SESSION_STALE",
    `HTTP ${iptalStepsiz.status} ${iptalStepsiz.json?.error?.code ?? ""}`,
  );

  await stepUpAl(fin, finSecret);
  const iptal = await fin.post(`/api/v1/contracts/${iptalId}/cancel`, {
    cancelReason: "Sahte iptal gerekcesi",
  });
  const iptalDurum = await sql.query(
    "SELECT status, cancelled_at, activated_at FROM contracts WHERE id = $1",
    [iptalId],
  );
  check(
    "taslak iptalinde activated_at NULL kalıyor",
    iptal.status === 200 && iptalDurum.rows[0].status === "cancelled" &&
      iptalDurum.rows[0].cancelled_at !== null && iptalDurum.rows[0].activated_at === null,
    JSON.stringify(iptalDurum.rows[0]),
  );

  // DB seviyesinde bozuk yaşam döngüsü
  // Gerekçe AÇIKÇA boşaltılır: satır zaten 'ended' ve gerekçesi dolu olsaydı
  // CHECK geçerdi ve test hiçbir şey kanıtlamazdı.
  const gerekcesiz = await sql
    .query(
      "UPDATE contracts SET status = 'ended', ended_at = now(), end_reason = NULL WHERE id = $1",
      [sozlesmeA],
    )
    .then(() => null)
    .catch((e) => e);
  check("DB: gerekçesiz 'ended' reddediliyor", gerekcesiz !== null);

  const cifteDurum = await sql
    .query(
      "UPDATE contracts SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'test gerekce' WHERE id = $1",
      [sozlesmeA],
    )
    .then(() => null)
    .catch((e) => e);
  check(
    "DB: hem ended_at hem cancelled_at dolu satır reddediliyor",
    cifteDurum !== null,
  );

  const bosluk = await sql
    .query(
      "UPDATE contracts SET status = 'cancelled', ended_at = NULL, end_reason = NULL, cancelled_at = now(), cancel_reason = '   ' WHERE id = $1",
      [sozlesmeA],
    )
    .then(() => null)
    .catch((e) => e);
  check("DB: boşluktan ibaret gerekçe reddediliyor", bosluk !== null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 11. Eşzamanlılık ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const es = await fin.post("/api/v1/contracts", taslakGovde());
  const esId = es.json?.contract?.id;
  await fin.put(`/api/v1/contracts/${esId}/items`, {
    items: [{ serviceId: F.hizmetBagli, quantity: 1, unitPriceMinor: 4_400_000 }],
  });
  await stepUpAl(fin, finSecret);

  const [a1, a2] = await Promise.all([
    fin.post(`/api/v1/contracts/${esId}/activate`),
    fin.post(`/api/v1/contracts/${esId}/activate`),
  ]);
  const basarili = [a1, a2].filter((r) => r.status === 200).length;
  const sunucuHatasi = [a1, a2].filter((r) => r.status >= 500).length;
  const auditSayim = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs
      WHERE test_run_id = $1 AND entity_id = $2 AND entity_type = 'contract'
        AND entity_label LIKE 'Sözleşme yürürlüğe alındı%'`,
    [RUN_ID, esId],
  );
  check(
    "paralel iki activate → yalnız BİR durum değişikliği, 500 yok",
    basarili === 1 && sunucuHatasi === 0,
    `${basarili} başarılı, ${sunucuHatasi} sunucu hatası (${a1.status}/${a2.status})`,
  );
  check(
    "paralel activate TEK audit etkisi bıraktı",
    auditSayim.rows[0].n === 1,
    `${auditSayim.rows[0].n} kayıt`,
  );

  await stepUpAl(fin, finSecret);
  const [e1, e2] = await Promise.all([
    fin.post(`/api/v1/contracts/${esId}/end`, { endReason: "Sahte paralel gerekce" }),
    fin.post(`/api/v1/contracts/${esId}/end`, { endReason: "Sahte paralel gerekce" }),
  ]);
  check(
    "paralel iki end → yalnız biri geçiyor, 500 yok",
    [e1, e2].filter((r) => r.status === 200).length === 1 &&
      [e1, e2].every((r) => r.status < 500),
    `${e1.status}/${e2.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 12. FK RESTRICT ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const markaSil = await sql
    .query("DELETE FROM brands WHERE id = $1", [F.kapsamli])
    .then(() => null)
    .catch((e) => e);
  check("fiziksel DELETE FROM brands → RESTRICT", markaSil !== null);

  const kontratSil = await sql
    .query("DELETE FROM contracts WHERE id = $1", [sozlesmeA])
    .then(() => null)
    .catch((e) => e);
  check("kalemi olan sözleşmenin fiziksel silinmesi → RESTRICT", kontratSil !== null);

  const hizmetSil = await sql
    .query("DELETE FROM services WHERE id = $1", [F.hizmetBagli])
    .then(() => null)
    .catch((e) => e);
  check("kalemde kullanılan hizmetin fiziksel silinmesi → RESTRICT", hizmetSil !== null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 13. CSV ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const finCsv = await fin.get("/api/v1/contracts/export");
  check("FIN CSV alabiliyor", finCsv.status === 200, `HTTP ${finCsv.status}`);
  check(
    "CSV BOM ile başlıyor",
    finCsv.bytes[0] === 0xef && finCsv.bytes[1] === 0xbb && finCsv.bytes[2] === 0xbf,
  );
  const basliklar = (finCsv.text.split("\n")[0] ?? "").replace(/^﻿/, "");
  check(
    "FIN CSV'sinde NET TUTAR ve hemen yanında TUTAR TEMELI var",
    basliklar.includes("NET TUTAR") && basliklar.includes("TUTAR TEMELI"),
    basliklar.slice(0, 120),
  );

  const opsCsv = await ops.get("/api/v1/contracts/export");
  const opsBasliklar = (opsCsv.text.split("\n")[0] ?? "").replace(/^﻿/, "");
  check(
    "OPS CSV'sinde tutar sütunları YOK",
    opsCsv.status === 200 &&
      !opsBasliklar.includes("NET TUTAR") &&
      !opsBasliklar.includes("KDV") &&
      !opsBasliklar.includes("FATURALAMA"),
    opsBasliklar.slice(0, 120),
  );
  check(
    "OPS CSV'si kapsamla sınırlı (kapsam dışı marka yok)",
    !opsCsv.text.includes("Sahte Kapsam Disi B"),
  );

  // Formül enjeksiyonu
  const enj = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ title: "=1+1", installmentCount: 3, endDate: null }),
  );
  const enjCsv = await fin.get("/api/v1/contracts/export");
  check(
    "formül enjeksiyonu kaçırılıyor (=1+1 ham geçmiyor)",
    enj.status === 201 && !/^=1\+1/m.test(enjCsv.text) && enjCsv.text.includes("1+1"),
  );

  const exportAudit = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1 AND action = 'export' AND entity_type = 'contract'",
    [RUN_ID],
  );
  check("CSV dışa aktarımı denetime yazılıyor", exportAudit.rows[0].n >= 2, `${exportAudit.rows[0].n} kayıt`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 14. GERÇEK EKRANLAR (HTML) ═══");
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⚠ Buradaki kontroller API'yi değil EKRANI sınar.
 *
 * Bir alanın API yanıtında olmaması yetmez: sunucu bileşeni onu başka bir
 * yoldan (ör. ayrı bir sorgu) çekip HTML'e basabilir. OPS'un gördüğü sayfanın
 * KAYNAK KODUNDA da tutar geçmemeli.
 */
{
  const taslakEkran = await fin.post("/api/v1/contracts", taslakGovde());
  const taslakId = taslakEkran.json?.contract?.id;
  const taslakNo = taslakEkran.json?.contract?.contractNo;
  await fin.put(`/api/v1/contracts/${taslakId}/items`, {
    items: [{ serviceId: F.hizmetBagli, quantity: 1, unitPriceMinor: 4_400_000 }],
  });

  // ── Rol görünürlüğü: durum KODU da sınanır ──
  for (const [ad, c, beklenen] of [
    ["SA", sa, 200],
    ["FIN", fin, 200],
    ["OPS", ops, 200],
    ["MEM", mem, 404],
  ]) {
    const liste = await c.get("/sozlesmeler");
    check(`${ad} /sozlesmeler → ${beklenen}`, liste.status === beklenen, `HTTP ${liste.status}`);
  }

  const memDetay = await mem.get(`/sozlesmeler/${taslakId}`);
  check("MEM sözleşme detayında 404", memDetay.status === 404, `HTTP ${memDetay.status}`);
  const memYeni = await mem.get("/sozlesmeler/yeni");
  check("MEM yeni sözleşme ekranında 404", memYeni.status === 404, `HTTP ${memYeni.status}`);
  const opsYeni = await ops.get("/sozlesmeler/yeni");
  check("OPS yeni sözleşme ekranında 404", opsYeni.status === 404, `HTTP ${opsYeni.status}`);

  // ── OPS ekranında finansal iz YOK ──
  const opsListeHtml = (await ops.get("/sozlesmeler")).text;
  const opsDetayHtml = (await ops.get(`/sozlesmeler/${taslakId}`)).text;
  const FINANSAL_METIN = [
    "44.000,00", "4.400.000", "amountMinor", "vatRate", "discountMinor",
    "unitPriceMinor", "billingFrequency", "installmentCount", "grossAmountMinor",
    "NET TUTAR", "Brüt tutar", "Ödeme planı", "İlk vade",
  ];
  const listeSizan = FINANSAL_METIN.filter((x) => opsListeHtml.includes(x));
  const detaySizan = FINANSAL_METIN.filter((x) => opsDetayHtml.includes(x));
  check(
    "OPS liste HTML'inde tutar/KDV/faturalama izi yok",
    listeSizan.length === 0,
    listeSizan.join(", "),
  );
  check(
    "OPS detay HTML'inde tutar/KDV/indirim/kur/ödeme/vade/kalem fiyatı yok",
    detaySizan.length === 0,
    detaySizan.join(", "),
  );
  check(
    "OPS detayında rolün kapsamı açıkça yazıyor",
    opsDetayHtml.includes("rolünüz kapsamında değildir"),
  );

  // FIN aynı ekranda tutarı GÖRÜYOR — kontrol boş bir sayfayı doğrulamıyor
  const finDetayHtml = (await fin.get(`/sozlesmeler/${taslakId}`)).text;
  check(
    "FIN aynı detayda tutarı görüyor (test boş sayfayı doğrulamıyor)",
    finDetayHtml.includes("45.000,00") && finDetayHtml.includes("Brüt tutar"),
  );

  // ── Sözleşme numarası ekranda DEĞİŞTİRİLEMEZ ──
  check(
    "detayda sözleşme numarası input değil (name/value ile form alanı yok)",
    finDetayHtml.includes(taslakNo) &&
      !new RegExp(`<input[^>]*value="${taslakNo}"`).test(finDetayHtml),
  );
  check(
    "yeni sözleşme ekranında numara alanı yok, 'otomatik verilir' yazıyor",
    (await fin.get("/sozlesmeler/yeni")).text.includes("otomatik verilir"),
  );

  // ── Mobil kart gerçek bağlantı ──
  check(
    "mobil kart listesi gerçek <a href> taşıyor",
    new RegExp(`<a[^>]+href="/sozlesmeler/${taslakId}"`).test(
      (await fin.get("/sozlesmeler")).text,
    ),
  );

  // ── Taslak kalemleri düzenlenebilir, aktif kalemleri salt okunur ──
  const taslakHtml = finDetayHtml;
  check(
    "taslakta kalemler için Düzenle var",
    taslakHtml.includes("Kapsam kalemleri") && taslakHtml.includes("Düzenle"),
  );
  /**
   * ⚠ Düğme metni ">…<" ile aranır. Düz `includes("Yürürlüğe al")` yanıltır:
   * aktif sözleşmedeki "Yürürlüğe alındı: 31.07.2026" damgası da eşleşir ve
   * test "düğme hâlâ duruyor" der.
   */
  check("taslakta Yürürlüğe al düğmesi var", taslakHtml.includes(">Yürürlüğe al<"));

  await stepUpAl(fin, finSecret);
  await fin.post(`/api/v1/contracts/${taslakId}/activate`);
  const aktifHtml = (await fin.get(`/sozlesmeler/${taslakId}`)).text;
  check(
    "aktif sözleşmede kilit ibaresi görünüyor",
    aktifHtml.includes("Kilitli") && aktifHtml.includes("değiştirilemez"),
  );
  check(
    "aktif sözleşmede Yürürlüğe al düğmesi YOK, Sonlandır var",
    !aktifHtml.includes(">Yürürlüğe al<") && aktifHtml.includes(">Sonlandır<"),
  );
  check(
    "aktif sözleşmede yürürlük damgası görünüyor",
    aktifHtml.includes("Yürürlüğe alındı:"),
  );

  // ── Ödeme planı ekranı: FIN'de var, OPS'ta yok ──
  check("FIN detayında ödeme planı düğmesi var", aktifHtml.includes("Ödeme planını gör"));
  check(
    "OPS detayında ödeme planı düğmesi YOK",
    !(await ops.get(`/sozlesmeler/${taslakId}`)).text.includes("Ödeme planını gör"),
  );

  // ── Boş ve filtreli durumlar ──
  const bos = await fin.get("/sozlesmeler?q=kesinlikle-boyle-bir-sozlesme-yok");
  check(
    "filtre sonucu boş ekranı doğru metni gösteriyor",
    bos.status === 200 &&
      bos.text.includes("Bu filtrelerle eşleşen sözleşme yok") &&
      bos.text.includes("Filtreleri temizle"),
  );
  check(
    "boş filtre ekranında 'Henüz sözleşme yok' metni YOK (iki boşluk ayrı)",
    !bos.text.includes("Henüz sözleşme yok"),
  );

  const opsBos = await ops.get("/sozlesmeler?marka=" + F.kapsamDisi);
  check(
    "OPS kapsam dışı marka filtresinde veri sızmıyor",
    opsBos.status === 200 && !opsBos.text.includes("Sahte Kapsam Disi B"),
  );

  // ── CSV filtresi ekranla aynı ──
  const csvFiltreli = await fin.get("/api/v1/contracts/export?status=draft");
  const csvSatir = csvFiltreli.text.trim().split("\n").length;
  const listeFiltreli = await fin.get("/api/v1/contracts?status=draft");
  check(
    "CSV filtresi liste ile aynı sayıda kayıt veriyor",
    csvSatir - 1 === (listeFiltreli.json?.kayitlar?.length ?? -1),
    `CSV ${csvSatir - 1} · liste ${listeFiltreli.json?.kayitlar?.length}`,
  );

  // ── 120 sınırı kullanıcıya AÇIK hata olarak dönüyor ──
  const uzun = await fin.post(
    "/api/v1/contracts",
    taslakGovde({ installmentCount: 200, endDate: null }),
  );
  check(
    "120 sınırı aşan yapılandırma açık hata veriyor (kesilmiş liste değil)",
    uzun.status === 422 && uzun.json?.error?.code === "PREVIEW_TOO_LONG",
    `HTTP ${uzun.status} ${uzun.json?.error?.code ?? ""}`,
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
