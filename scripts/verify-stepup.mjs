/**
 * Step-up (adım yükseltme) doğrulaması.
 *
 * Kritik işlemlerin, oturum "taze" olsa bile açık yeniden doğrulama
 * istediğini ve bu kanıtın doğru koşullarda geçersizleştiğini sınar.
 *
 * ⚠ PRD §6.3: parola, TOTP veya kurtarma kodu EKRANA YAZILMAZ.
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
const RUN_ID = `stepup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  const ip = `198.18.0.${(ipSayac % 250) + 1}`;
  let cookies = "";
  const ortak = () => ({
    origin: BASE,
    "x-forwarded-for": ip,
    // Sunucu bunu KANONİK kimlik olarak KABUL ETMEZ; yalnız korelasyon
    "x-request-id": "istemci-uydurma-kimlik",
    // Test izolasyonu — yalnız üretim dışında okunur
    "x-test-run-id": RUN_ID,
    ...(cookies ? { cookie: cookies } : {}),
  });
  const cerezYaz = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const ad = pair.split("=")[0];
      cookies = cookies
        .split("; ")
        .filter((x) => x && !x.startsWith(`${ad}=`))
        .concat(pair)
        .join("; ");
    }
  };
  return {
    async post(path, body) {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ortak() },
        body: JSON.stringify(body ?? {}),
        redirect: "manual",
      });
      cerezYaz(res);
      let json = null;
      try {
        json = await res.json();
      } catch {
        /* gövdesiz */
      }
      return { status: res.status, json };
    },
    async get(path) {
      const res = await fetch(`${BASE}${path}`, { headers: ortak(), redirect: "manual" });
      cerezYaz(res);
      let json = null;
      try {
        json = await res.json();
      } catch {
        /* gövdesiz */
      }
      return { status: res.status, json };
    },
    get sessionId() {
      return cookies;
    },
  };
}

async function sifirlaFixture() {
  const mails = ["member@example.com", "operations@example.com"];
  await sql.query(
    "DELETE FROM auth_two_factor WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [mails],
  );
  await sql.query("UPDATE auth_user SET two_factor_enabled = false WHERE email = ANY($1)", [mails]);
  await sql.query("DELETE FROM auth_rate_limit");
  await sql.query(
    "DELETE FROM auth_reauthentication WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
    [mails],
  );
}
await sifirlaFixture();
console.log("· Fixture sıfırlandı\n");

console.log("═══ 1. Yükseltme yokken durum sorgusu ═══");
const c = client();
{
  await c.post("/api/auth/sign-in/email", { email: "member@example.com", password: PAROLA });
  const durum = await c.get("/api/v1/reauth");
  check("Oturum var ama yükseltme yok", durum.json?.gecerli === false, JSON.stringify(durum.json));
}

console.log("\n═══ 2. Yanlış parola ile yükseltme reddedilir ═══");
{
  const res = await c.post("/api/v1/reauth", { password: "kesinlikle-yanlis-parola" });
  check("Yanlış parola → 401", res.status === 401, `HTTP ${res.status}`);
  check(
    "Mesaj genel, alan belirtmiyor",
    /e-posta veya şifre/i.test(res.json?.error?.message ?? ""),
    res.json?.error?.message ?? "",
  );
  const durum = await c.get("/api/v1/reauth");
  check("Başarısız denemede yükseltme oluşmadı", durum.json?.gecerli === false);
}

console.log("\n═══ 3. Doğru parola ile yükseltme oluşur (2FA kapalı) ═══");
{
  const res = await c.post("/api/v1/reauth", { password: PAROLA });
  check("Doğru parola → 200", res.status === 200, `HTTP ${res.status}`);
  check("Yöntem 'password'", res.json?.method === "password", res.json?.method);
  check("5 dakikalık geçerlilik", res.json?.expiresInSeconds === 300, `${res.json?.expiresInSeconds}s`);

  const durum = await c.get("/api/v1/reauth");
  check("Yükseltme geçerli", durum.json?.gecerli === true);
  check(
    "Kalan süre makul (≤300sn)",
    durum.json?.kalanSaniye > 0 && durum.json?.kalanSaniye <= 300,
    `${durum.json?.kalanSaniye}s`,
  );
}

console.log("\n═══ 4. Yükseltme OTURUMA bağlı — başka oturum kullanamaz ═══");
{
  const digerOturum = client();
  await digerOturum.post("/api/auth/sign-in/email", {
    email: "member@example.com",
    password: PAROLA,
  });
  const durum = await digerOturum.get("/api/v1/reauth");
  check(
    "Aynı kullanıcının İKİNCİ oturumu yükseltmeyi devralmıyor",
    durum.json?.gecerli === false,
    JSON.stringify(durum.json),
  );

  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE user_id=(SELECT id FROM auth_user WHERE email=$1)",
    ["member@example.com"],
  );
  check("DB'de tek yükseltme kaydı var", rows[0].n === 1, `${rows[0].n} kayıt`);
}

console.log("\n═══ 5. Süre dolunca yükseltme geçersiz ═══");
{
  // Süre dolmasını taklit ederken İKİ damga birden geriye alınır:
  // chk_reauth_window (expires_at > verified_at) korunmalı — kısıt doğru,
  // yalnız expires_at'i geçmişe çekmek tutarsız bir satır üretirdi.
  await sql.query(
    `UPDATE auth_reauthentication
       SET verified_at = now() - interval '10 minutes',
           expires_at  = now() - interval '5 minutes'
     WHERE user_id=(SELECT id FROM auth_user WHERE email=$1)`,
    ["member@example.com"],
  );
  const durum = await c.get("/api/v1/reauth");
  check("Süresi dolmuş yükseltme geçersiz sayılıyor", durum.json?.gecerli === false);
}

console.log("\n═══ 6. Oturum iptalinde yükseltme silinir (FK CASCADE) ═══");
{
  await c.post("/api/v1/reauth", { password: PAROLA });
  const { rows: once } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE user_id=(SELECT id FROM auth_user WHERE email=$1)",
    ["member@example.com"],
  );
  check("Ön koşul: yükseltme var", once[0].n >= 1, `${once[0].n} kayıt`);

  await c.post("/api/auth/sign-out");
  const { rows: sonra } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication r JOIN auth_session s ON s.id=r.session_id WHERE r.user_id=(SELECT id FROM auth_user WHERE email=$1)",
    ["member@example.com"],
  );
  check("Çıkış sonrası oturuma bağlı yükseltme kalmadı", sonra[0].n === 0, `${sonra[0].n} kayıt`);
}

console.log("\n═══ 7. 2FA etkinken TOTP zorunlu ═══");
{
  const o = client();
  await o.post("/api/auth/sign-in/email", { email: "operations@example.com", password: PAROLA });

  // 2FA'yı kur
  const enable = await o.post("/api/auth/two-factor/enable", { password: PAROLA });
  const secret = new URL(enable.json.totpURI).searchParams.get("secret");
  await o.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });

  // 2FA kurulumu step-up'ı geçersiz kılmalı
  const kurulumSonrasi = await o.get("/api/v1/reauth");
  check("2FA kurulumu sonrası yükseltme yok", kurulumSonrasi.json?.gecerli === false);

  // Yalnız parola → TOTP isteniyor
  const yalnizParola = await o.post("/api/v1/reauth", { password: PAROLA });
  check("2FA açıkken yalnız parola YETMİYOR", yalnizParola.status === 401, `HTTP ${yalnizParola.status}`);
  check("TOTP_REQUIRED kodu döndü", yalnizParola.json?.error?.code === "TOTP_REQUIRED", yalnizParola.json?.error?.code);

  // Yanlış TOTP
  const yanlisKod = await o.post("/api/v1/reauth", { password: PAROLA, totpCode: "000000" });
  check("Yanlış TOTP reddedildi", yanlisKod.status === 401, `HTTP ${yanlisKod.status}`);

  // Parola + doğru TOTP
  const tam = await o.post("/api/v1/reauth", { password: PAROLA, totpCode: totp(secret) });
  check("Parola + TOTP → 200", tam.status === 200, `HTTP ${tam.status}`);
  check("Yöntem 'password_totp'", tam.json?.method === "password_totp", tam.json?.method);
}

console.log("\n═══ 8. request_id GÜVENİ: istemci kanonik kimliği seçemez ═══");
{
  const { rows: uydurma } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE request_id = $1",
    ["istemci-uydurma-kimlik"],
  );
  check(
    "İstemcinin gönderdiği değer request_id OLARAK kabul edilmedi",
    uydurma[0].n === 0,
    `${uydurma[0].n} kayıt`,
  );

  const { rows: upstream } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE upstream_request_id = $1 AND test_run_id = $2",
    ["istemci-uydurma-kimlik", RUN_ID],
  );
  check(
    "İstemci değeri yalnız upstream_request_id olarak saklandı",
    upstream[0].n > 0,
    `${upstream[0].n} kayıt`,
  );

  const { rows: kanonik } = await sql.query(
    "SELECT count(DISTINCT request_id)::int AS n FROM audit_logs WHERE test_run_id = $1",
    [RUN_ID],
  );
  check(
    "Sunucu her istek için AYRI kanonik kimlik üretti",
    kanonik[0].n > 1,
    `${kanonik[0].n} farklı request_id`,
  );

  const { rows: bicim } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1
       AND request_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    [RUN_ID],
  );
  check("Kanonik kimlikler UUID v7 biçiminde", bicim[0].n === 0, `${bicim[0].n} uyumsuz`);
}

console.log("\n═══ 9. Sır sızıntısı (bu koşu) ═══");
{
  const { rows } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1
       AND (changes::text ILIKE '%password%' OR changes::text ILIKE '%parola%'
         OR changes::text ILIKE '%secret%'   OR changes::text ILIKE '%otpauth%'
         OR changes::text ILIKE '%totpCode%')`,
    [RUN_ID],
  );
  check("audit_logs'ta sır izi yok", rows[0].n === 0, `${rows[0].n} şüpheli kayıt`);

  const { rows: reauth } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE method NOT IN ('password','password_totp')",
  );
  check("Yükseltme kayıtlarında yalnız yöntem adı var", reauth[0].n === 0);
}

await sifirlaFixture();
await sql.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(" | ")}`);
  process.exit(1);
}
