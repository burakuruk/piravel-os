/**
 * Oturum listesi ve iptali doğrulaması — Sprint 1 §2.
 *
 * Gerçek HTTP istekleriyle çalışır; sunucu ayakta olmalıdır.
 *
 * ⚠ PRD §6.3: Bu script ham oturum token'ını, parolayı veya TOTP sırrını
 * EKRANA YAZMAZ.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";
const PAROLA = "gelistirme-test-parolasi";
const RUN_ID = `sessions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

const UA = {
  masaustu:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  telefon:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  bilinmeyen: "curl/8.4.0",
};

let ipSayac = 0;
function client(ua = UA.masaustu, sabitIp = null) {
  ipSayac += 1;
  const ip = sabitIp ?? `198.20.0.${(ipSayac % 250) + 1}`;
  let cookies = "";
  const ortak = (ekstra = {}) => ({
    origin: BASE,
    "x-forwarded-for": ip,
    "user-agent": ua,
    "x-test-run-id": RUN_ID,
    ...(cookies ? { cookie: cookies } : {}),
    ...ekstra,
  });
  const cerezYaz = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const ad = pair.split("=")[0];
      const silindi = /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c);
      cookies = cookies
        .split("; ")
        .filter((x) => x && !x.startsWith(`${ad}=`))
        .concat(silindi ? [] : [pair])
        .join("; ");
    }
  };
  const cagir = async (metod, path, body, ekstra) => {
    const res = await fetch(`${BASE}${path}`, {
      method: metod,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...ortak(ekstra),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    cerezYaz(res);
    let json = null;
    let text = "";
    if ((res.headers.get("content-type") ?? "").includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        /* gövdesiz */
      }
    } else {
      text = await res.text().catch(() => "");
    }
    return { status: res.status, json, text, headers: res.headers };
  };
  return {
    get: (p, h) => cagir("GET", p, undefined, h),
    post: (p, b, h) => cagir("POST", p, b ?? {}, h),
    del: (p, b, h) => cagir("DELETE", p, b, h),
    ip,
  };
}

async function girisYap(c, email, ikiFaKur = false) {
  const giris = await c.post("/api/auth/sign-in/email", { email, password: PAROLA });
  if (!ikiFaKur) return giris;
  const enable = await c.post("/api/auth/two-factor/enable", { password: PAROLA });
  const uri = enable.json?.totpURI ?? enable.json?.totpUri;
  if (uri) {
    const secret = new URL(uri.replace("otpauth://", "http://")).searchParams.get("secret");
    await c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
    return { ...giris, secret };
  }
  return giris;
}

async function girisTotpIle(c, email, secret) {
  await c.post("/api/auth/sign-in/email", { email, password: PAROLA });
  return c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
}

const MAILS = [
  "admin@example.com",
  "finance@example.com",
  "operations@example.com",
  "member@example.com",
];

async function fixtureTemizle() {
  await sql.query("DELETE FROM auth_rate_limit");
  await sql.query(
    "DELETE FROM auth_two_factor WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [MAILS],
  );
  await sql.query("UPDATE auth_user SET two_factor_enabled = false WHERE email = ANY($1)", [MAILS]);
  await sql.query(
    "DELETE FROM auth_session WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [MAILS],
  );
  await sql.query(
    "DELETE FROM auth_reauthentication WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [MAILS],
  );
  await sql.query("UPDATE users SET is_active = true WHERE email = ANY($1)", [MAILS]);
}

await fixtureTemizle();
console.log("· Fixture sıfırlandı\n");

const kullaniciId = async (email) =>
  (await sql.query("SELECT id FROM users WHERE email = $1", [email])).rows[0].id;

// ═══════════════════════════════════════════════════════════════════
console.log("═══ 1. Kullanıcı yalnız KENDİ oturumlarını görür ═══");
// ═══════════════════════════════════════════════════════════════════
const uye = client(UA.masaustu);
const uyeTelefon = client(UA.telefon);
const uyeBilinmeyen = client(UA.bilinmeyen);
{
  await girisYap(uye, "member@example.com");
  await girisYap(uyeTelefon, "member@example.com");
  await girisYap(uyeBilinmeyen, "member@example.com");

  const liste = await uye.get("/api/v1/sessions");
  check("Oturum listesi okunabiliyor", liste.status === 200, `HTTP ${liste.status}`);
  const oturumlar = liste.json?.sessions ?? [];
  check("Üç oturum da listelendi", oturumlar.length === 3, `${oturumlar.length} oturum`);

  // Başka bir kullanıcının oturumları hiç görünmemeli
  const ops = client();
  await girisYap(ops, "operations@example.com");
  const opsListe = await ops.get("/api/v1/sessions");
  const uyeId = await kullaniciId("member@example.com");
  const { rows: uyeOturumlari } = await sql.query(
    "SELECT id FROM auth_session WHERE user_id = $1",
    [uyeId],
  );
  const yabanci = (opsListe.json?.sessions ?? []).filter((o) =>
    uyeOturumlari.some((r) => r.id === o.id),
  );
  check("Başka kullanıcının oturumları listede YOK", yabanci.length === 0, `${yabanci.length} sızıntı`);

  // Uç userId parametresi kabul etmemeli
  const sahte = await ops.get(`/api/v1/sessions?userId=${uyeId}`);
  const sahteIdler = (sahte.json?.sessions ?? []).map((o) => o.id);
  check(
    "userId parametresi hedefi DEĞİŞTİRMİYOR",
    !sahteIdler.some((id) => uyeOturumlari.some((r) => r.id === id)),
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 2. Yanıtta sır yok ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const liste = await uye.get("/api/v1/sessions");
  const govde = JSON.stringify(liste.json);

  const { rows: tokenlar } = await sql.query(
    "SELECT token FROM auth_session WHERE user_id = $1",
    [await kullaniciId("member@example.com")],
  );
  check(
    "Ham oturum token'ı yanıtta YOK",
    tokenlar.every((t) => !govde.includes(t.token)),
  );
  check("token/hash anahtarı yanıtta YOK", !/token|hash|secret/i.test(govde));
  check(
    "Tam IP yanıtta YOK",
    !/"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"/.test(govde),
    govde.match(/"ag":"[^"]*"/)?.[0] ?? "",
  );
  check("Çerez içeriği yanıtta YOK", !/cookie/i.test(govde));
  check("Step-up kimliği yanıtta YOK", !/reauth|stepUp|step_up/i.test(govde));

  const ilk = liste.json.sessions[0];
  check(
    "Yalnız beklenen alanlar var",
    Object.keys(ilk).sort().join(",") === "ag,cihaz,id,mevcut,olusturulma,sonKullanim",
    Object.keys(ilk).join(","),
  );
  check("Ağ bilgisi maskeli", ilk.ag === null || /\/(24|48)$/.test(ilk.ag), String(ilk.ag));
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 3. Cihaz özeti ve mevcut oturum etiketi ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const liste = await uye.get("/api/v1/sessions");
  const oturumlar = liste.json.sessions;
  const mevcutlar = oturumlar.filter((o) => o.mevcut);
  check("Tam olarak BİR oturum 'mevcut' işaretli", mevcutlar.length === 1, `${mevcutlar.length}`);
  check(
    "Mevcut oturum bu istemcinin tarayıcısı",
    mevcutlar[0]?.cihaz === "Chrome · Windows",
    mevcutlar[0]?.cihaz ?? "",
  );
  check(
    "Telefon oturumu doğru özetlendi",
    oturumlar.some((o) => o.cihaz === "Safari · iPhone"),
    oturumlar.map((o) => o.cihaz).join(" | "),
  );
  check(
    "Çözümlenemeyen UA 'Bilinmeyen cihaz' gösteriyor",
    oturumlar.some((o) => o.cihaz === "Bilinmeyen cihaz"),
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 4. Tek oturum iptali ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const liste = await uye.get("/api/v1/sessions");
  const hedef = liste.json.sessions.find((o) => !o.mevcut && o.cihaz === "Safari · iPhone");

  const kapat = await uye.del(`/api/v1/sessions/${hedef.id}`);
  check("Tek oturum kapatıldı", kapat.status === 200, `HTTP ${kapat.status}`);
  check("Kendi oturumu değildi", kapat.json?.kendiniKapatti === false);

  const sonra = await uye.get("/api/v1/sessions");
  check("Liste bir azaldı", sonra.json.sessions.length === 2, `${sonra.json.sessions.length}`);

  const erisim = await uyeTelefon.get("/api/v1/sessions");
  check("İptal edilen oturum korumalı uca erişemiyor", erisim.status >= 400, `HTTP ${erisim.status}`);

  // Tekrar çalıştırılabilirlik: aynı iptal ikinci kez yan etki üretmez
  const ikinci = await uye.del(`/api/v1/sessions/${hedef.id}`);
  check("Aynı oturumu ikinci kez kapatmak 404", ikinci.status === 404, `HTTP ${ikinci.status}`);

  // Başkasının oturum kimliğiyle iptal denemesi
  const ops = client();
  await girisYap(ops, "operations@example.com");
  const uyeListe = await uye.get("/api/v1/sessions");
  const baskasininId = uyeListe.json.sessions[0].id;
  const yetkisiz = await ops.del(`/api/v1/sessions/${baskasininId}`);
  check(
    "Başkasının oturumu kimlikle kapatılamıyor (404)",
    yetkisiz.status === 404,
    `HTTP ${yetkisiz.status}`,
  );
  const halaVar = await uye.get("/api/v1/sessions");
  check(
    "Hedef oturum hâlâ açık",
    halaVar.json.sessions.some((o) => o.id === baskasininId),
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 5. Oturum silinince step-up kaydı da düşer ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const c1 = client(UA.masaustu);
  await girisYap(c1, "member@example.com");
  await c1.post("/api/v1/reauth", { password: PAROLA });

  const uyeId = await kullaniciId("member@example.com");
  const { rows: once } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE user_id = $1",
    [uyeId],
  );
  check("Step-up kaydı oluştu", once[0].n >= 1, `${once[0].n} kayıt`);

  const liste = await c1.get("/api/v1/sessions");
  const kendi = liste.json.sessions.find((o) => o.mevcut);
  await uye.del(`/api/v1/sessions/${kendi.id}`);

  const { rows: sonra } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE session_id = $1",
    [kendi.id],
  );
  check("Oturuma bağlı step-up kaydı silindi (FK CASCADE)", sonra[0].n === 0, `${sonra[0].n}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 6. Diğer tüm oturumları kapat ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const a = client(UA.masaustu);
  const b = client(UA.telefon);
  const d = client(UA.bilinmeyen);
  await girisYap(a, "member@example.com");
  await girisYap(b, "member@example.com");
  await girisYap(d, "member@example.com");

  const oncesi = await a.get("/api/v1/sessions");
  const mevcutId = oncesi.json.sessions.find((o) => o.mevcut).id;

  const kapat = await a.del("/api/v1/sessions");
  check("Diğerleri kapatıldı", kapat.status === 200, `HTTP ${kapat.status}`);

  const sonrasi = await a.get("/api/v1/sessions");
  check("Mevcut oturum KORUNDU", sonrasi.status === 200, `HTTP ${sonrasi.status}`);
  check("Listede yalnız mevcut oturum kaldı", sonrasi.json.sessions.length === 1);
  check("Kalan oturum aynı oturum", sonrasi.json.sessions[0].id === mevcutId);

  const digeri = await b.get("/api/v1/sessions");
  check("Kapatılan diğer oturum erişemiyor", digeri.status >= 400, `HTTP ${digeri.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 7. Mevcut oturumu kapatma = çıkış ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const c = client(UA.masaustu);
  await girisYap(c, "member@example.com");
  const liste = await c.get("/api/v1/sessions");
  const kendi = liste.json.sessions.find((o) => o.mevcut);

  const kapat = await c.del(`/api/v1/sessions/${kendi.id}`);
  check("Mevcut oturum kapatıldı", kapat.status === 200, `HTTP ${kapat.status}`);
  check("Yanıt kendiniKapatti=true diyor", kapat.json?.kendiniKapatti === true);

  const sonra = await c.get("/api/v1/sessions");
  check("Kullanıcı artık çıkış yapmış durumda", sonra.status >= 400, `HTTP ${sonra.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 8. Paralel iptal istekleri ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const c = client(UA.masaustu);
  const hedefTarayici = client(UA.telefon);
  await girisYap(c, "member@example.com");
  await girisYap(hedefTarayici, "member@example.com");

  const liste = await c.get("/api/v1/sessions");
  const hedef = liste.json.sessions.find((o) => !o.mevcut);

  const [r1, r2] = await Promise.all([
    c.del(`/api/v1/sessions/${hedef.id}`),
    c.del(`/api/v1/sessions/${hedef.id}`),
  ]);
  const kodlar = [r1.status, r2.status].sort();
  check(
    "İki paralel iptalden biri 200, diğeri 404 — ikisi de güvenli",
    kodlar[0] === 200 && kodlar[1] === 404,
    kodlar.join(","),
  );

  const { rows } = await sql.query("SELECT count(*)::int AS n FROM auth_session WHERE id = $1", [
    hedef.id,
  ]);
  check("Oturum gerçekten kapandı", rows[0].n === 0);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 9. Başkasının oturumlarını kapatma (SA + step-up) ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const hedef = client(UA.masaustu);
  await girisYap(hedef, "member@example.com");
  const uyeId = await kullaniciId("member@example.com");

  // FIN ve OPS yapamaz
  const fin = client();
  await girisYap(fin, "finance@example.com", true);
  const finDeneme = await fin.del(`/api/v1/users/${uyeId}/sessions`);
  check("FIN başkasının oturumlarını kapatamıyor", finDeneme.status === 404, `HTTP ${finDeneme.status}`);

  const ops = client();
  await girisYap(ops, "operations@example.com");
  const opsDeneme = await ops.del(`/api/v1/users/${uyeId}/sessions`);
  check("OPS başkasının oturumlarını kapatamıyor", opsDeneme.status === 404, `HTTP ${opsDeneme.status}`);

  const opsOturumListesi = await ops.get(`/api/v1/users/${uyeId}/sessions`);
  check(
    "OPS başkasının oturum LİSTESİNİ de alamıyor",
    opsOturumListesi.status >= 400,
    `HTTP ${opsOturumListesi.status}`,
  );

  // SA step-up olmadan yapamaz
  const sa = client();
  const saGiris = await girisYap(sa, "admin@example.com", true);
  const saSecret = saGiris.secret;
  const saSuz = client();
  await girisTotpIle(saSuz, "admin@example.com", saSecret);
  const stepUpsuz = await saSuz.del(`/api/v1/users/${uyeId}/sessions`);
  check(
    "SA step-up olmadan kapatamıyor",
    stepUpsuz.json?.error?.code === "SESSION_STALE",
    `HTTP ${stepUpsuz.status} ${stepUpsuz.json?.error?.code ?? ""}`,
  );

  const halaAcik = await hedef.get("/api/v1/sessions");
  check("Hedefin oturumu hâlâ açık", halaAcik.status === 200, `HTTP ${halaAcik.status}`);

  // Step-up sonrası yapabilir
  await saSuz.post("/api/v1/reauth", { password: PAROLA, totpCode: totp(saSecret) });
  const kapat = await saSuz.del(`/api/v1/users/${uyeId}/sessions`);
  check("Step-up sonrası kapatabiliyor", kapat.status === 200, `HTTP ${kapat.status}`);

  const sonra = await hedef.get("/api/v1/sessions");
  check("Hedefin oturumu düştü", sonra.status >= 400, `HTTP ${sonra.status}`);

  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_session WHERE user_id = $1",
    [uyeId],
  );
  check("Hedefin tüm oturumları kapandı", rows[0].n === 0, `${rows[0].n} oturum`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 10. Sahte x-forwarded-for hız sınırını atlatamaz ═══");
// ═══════════════════════════════════════════════════════════════════
{
  await sql.query("DELETE FROM auth_rate_limit");
  const sabitIp = "198.21.0.42";
  const kodlar = [];

  /**
   * Her istek FARKLI bir sahte önek ekliyor ama gerçek (proxy'nin eklediği)
   * adres sabit. Zincir sağdan okunduğu için hepsi AYNI kovaya düşmeli.
   */
  for (let i = 0; i < 7; i++) {
    const res = await fetch(`${BASE}/api/v1/davet/kabul`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: BASE,
        "x-forwarded-for": `10.0.0.${i}, ${sabitIp}`,
        "x-test-run-id": RUN_ID,
      },
      body: JSON.stringify({ password: "gecersiz-parola-denemesi" }),
      redirect: "manual",
    });
    kodlar.push(res.status);
  }
  check(
    "Sahte önek değiştirse de sınıra takıldı",
    kodlar.includes(429),
    kodlar.join(","),
  );

  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_rate_limit WHERE id LIKE 'piravel:invite_accept:%'",
  );
  check("Tek bir sayaç satırı oluştu (kova bölünmedi)", rows[0].n === 1, `${rows[0].n} satır`);

  const { rows: ham } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_rate_limit WHERE id ~ '\\d+\\.\\d+\\.\\d+\\.\\d+'",
  );
  check("Sayaç anahtarında ham IP YOK", ham[0].n === 0, `${ham[0].n} satır`);

  const { rows: onek } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_rate_limit WHERE id LIKE 'piravel:%'",
  );
  check("Anahtarlar isim alanlı (Better Auth ile çakışmaz)", onek[0].n >= 1);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 11. Denetim izi ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const { rows: adet } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1 AND entity_type = 'user_session'",
    [RUN_ID],
  );
  check("Oturum iptalleri audit'e yazıldı", adet[0].n > 0, `${adet[0].n} kayıt`);

  const { rows: sir } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1
       AND (changes::text ILIKE '%token%' OR changes::text ILIKE '%secret%'
         OR changes::text ILIKE '%password%' OR changes::text ILIKE '%parola%')`,
    [RUN_ID],
  );
  check("Audit'te token/secret/parola izi yok", sir[0].n === 0, `${sir[0].n} şüpheli`);

  const { rows: ip } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs
      WHERE test_run_id = $1 AND ip_address ~ '^\\d+\\.\\d+\\.\\d+\\.\\d+$'`,
    [RUN_ID],
  );
  check("Audit'te tam IP yok", ip[0].n === 0, `${ip[0].n} kayıt`);
}

await fixtureTemizle();
await sql.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(" | ")}`);
  process.exit(1);
}
