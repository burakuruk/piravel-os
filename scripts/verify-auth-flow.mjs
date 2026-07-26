/**
 * Sprint 1 kanıt scripti — kimlik doğrulama akışının uçtan uca doğrulaması.
 *
 * Gerçek HTTP istekleriyle çalışır (dev sunucusu ayakta olmalı).
 * ⚠ PRD §6.3: bu script sırları EKRANA YAZMAZ; yalnız varlık/uzunluk raporlar.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BASE = process.env.PREVIEW_URL ?? "http://localhost:3000";
const PAROLA = "gelistirme-test-parolasi";

/**
 * Bu koşuya özgü kimlik — x-test-run-id olarak gönderilir, sunucu audit ve
 * deneme günlüğüne yazar. Sızıntı kontrolleri yalnız bu koşunun kayıtlarına
 * bakar; zaman penceresi kullanılmaz (append-only geçmişe dokunulmaz).
 */
const RUN_ID = `authflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** RFC 6238 TOTP — test için minimal uygulama. */
function totp(base32Secret, at = Date.now()) {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32Secret.replace(/=+$/, "").toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes = Buffer.from(bits.match(/.{8}/g)?.map((b) => parseInt(b, 2)) ?? []);
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", bytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Çerez taşıyan basit istemci.
 *
 * Her istemci AYRI bir X-Forwarded-For kullanır: IP bazlı rate limit bu
 * dosyanın konusu değildir (verify-lockout.mjs sınar). Tek IP kullanılsaydı
 * fonksiyonel testler kendi aralarında limite takılırdı.
 */
let ipSayac = 0;
function client() {
  ipSayac += 1;
  const ip = `192.0.2.${(ipSayac % 250) + 1}`;
  let cookies = "";
  return {
    get cookies() {
      return cookies;
    },
    async post(path, body) {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Better Auth CSRF koruması Origin bekler (tarayıcı davranışı)
          origin: BASE,
          "x-forwarded-for": ip,
          "x-test-run-id": RUN_ID,
          ...(cookies ? { cookie: cookies } : {}),
        },
        body: JSON.stringify(body ?? {}),
        redirect: "manual",
      });
      const setCookie = res.headers.getSetCookie?.() ?? [];
      for (const c of setCookie) {
        const pair = c.split(";")[0];
        const name = pair.split("=")[0];
        cookies = cookies
          .split("; ")
          .filter((x) => x && !x.startsWith(`${name}=`))
          .concat(pair)
          .join("; ");
      }
      let json = null;
      try {
        json = await res.json();
      } catch {
        /* gövdesiz yanıt */
      }
      return { status: res.status, json };
    },
    async get(path) {
      const res = await fetch(`${BASE}${path}`, {
        headers: { origin: BASE, "x-forwarded-for": ip, "x-test-run-id": RUN_ID, ...(cookies ? { cookie: cookies } : {}) },
        redirect: "manual",
      });
      return { status: res.status, location: res.headers.get("location") };
    },
  };
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

async function auditCount(action, email) {
  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE action=$1 AND actor_email=$2",
    [action, email],
  );
  return rows[0].n;
}

/**
 * Test öncesi sıfırlama — script tekrar tekrar çalıştırılabilir olmalı (CI).
 * OPS kullanıcısının 2FA'sı kaldırılır ki kurulum akışı sıfırdan denenebilsin.
 */
const FIXTURE_MAILS = [
  "admin@example.com",
  "finance@example.com",
  "operations@example.com",
  "member@example.com",
];
await sql.query(
  "DELETE FROM auth_two_factor WHERE user_id IN (SELECT id FROM auth_user WHERE email = ANY($1))",
  [FIXTURE_MAILS],
);
await sql.query("UPDATE auth_user SET two_factor_enabled = false WHERE email = ANY($1)", [
  FIXTURE_MAILS,
]);
await sql.query("UPDATE users SET totp_enabled_at = NULL WHERE email = ANY($1)", [FIXTURE_MAILS]);
// IP rate limit sayacı temizlenir — koruma kapatılmaz, yalnız fixture
// sıfırlanır. Limitin kendisi verify-lockout.mjs ile sınanır.
await sql.query("DELETE FROM auth_rate_limit");
console.log("· Fixture 2FA ve rate-limit durumu sıfırlandı (tekrarlanabilirlik)\n");

console.log("═══ 1. Giriş / çıkış / oturum / audit ═══");
{
  const c = client();
  const before = await auditCount("login", "member@example.com");
  const login = await c.post("/api/auth/sign-in/email", {
    email: "member@example.com",
    password: PAROLA,
  });
  check("MEM girişi başarılı", login.status === 200);
  check("Oturum çerezi verildi", c.cookies.includes("session_token"));
  check("2FA istenmedi (isteğe bağlı rol)", !login.json?.twoFactorRedirect);
  check("Giriş audit_logs'a yazıldı", (await auditCount("login", "member@example.com")) === before + 1);

  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_session s JOIN auth_user u ON u.id=s.user_id WHERE u.email=$1",
    ["member@example.com"],
  );
  check("Oturum kaydı DB'de", rows[0].n >= 1, `${rows[0].n} oturum`);

  const out = await c.post("/api/auth/sign-out");
  check("Çıkış başarılı", out.status === 200);
  check("Çıkış audit_logs'a yazıldı", (await auditCount("logout", "member@example.com")) >= 1);
}

console.log("\n═══ 2. Başarısız giriş ═══");
{
  const c = client();
  const before = await auditCount("login_failed", "member@example.com");
  const bad = await c.post("/api/auth/sign-in/email", {
    email: "member@example.com",
    password: "kesinlikle-yanlis-parola",
  });
  check("Yanlış parola reddedildi", bad.status === 401);
  check(
    "Başarısız deneme audit'e yazıldı",
    (await auditCount("login_failed", "member@example.com")) === before + 1,
  );
}

console.log("\n═══ 3. Zorunlu 2FA rol kontrolü ═══");
{
  const c = client();
  await c.post("/api/auth/sign-in/email", { email: "admin@example.com", password: PAROLA });
  const dash = await c.get("/");
  check(
    "SA (2FA'sız) → /guvenlik-kurulumu yönlendirmesi",
    dash.status >= 300 && dash.status < 400 && (dash.location ?? "").includes("guvenlik-kurulumu"),
    `${dash.status} → ${dash.location}`,
  );

  const m = client();
  await m.post("/api/auth/sign-in/email", { email: "member@example.com", password: PAROLA });
  const mDash = await m.get("/");
  check("MEM (2FA'sız) dashboard'a erişebiliyor", mDash.status === 200, `${mDash.status}`);
}

console.log("\n═══ 4. Oturumsuz erişim ═══");
{
  const anon = client();
  const r = await anon.get("/");
  check(
    "Oturumsuz istek /giris'e yönlendiriliyor",
    r.status >= 300 && r.status < 400 && (r.location ?? "").includes("/giris"),
    `${r.status} → ${r.location}`,
  );
}

console.log("\n═══ 5. TOTP kurulumu (OPS — isteğe bağlı 2FA) ═══");
let opsBackupCodes = [];
{
  const c = client();
  await c.post("/api/auth/sign-in/email", { email: "operations@example.com", password: PAROLA });

  const enable = await c.post("/api/auth/two-factor/enable", { password: PAROLA });
  check("2FA etkinleştirme yanıtı alındı", enable.status === 200);

  const uri = enable.json?.totpURI ?? "";
  const secret = uri ? new URL(uri).searchParams.get("secret") : null;
  check("otpauth URI ve anahtar üretildi", Boolean(secret), `anahtar uzunluğu ${secret?.length ?? 0}`);

  opsBackupCodes = enable.json?.backupCodes ?? [];
  check("Kurtarma kodları üretildi", opsBackupCodes.length > 0, `${opsBackupCodes.length} kod`);

  const verify = await c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
  check("Üretilen TOTP kodu doğrulandı", verify.status === 200, `${verify.status}`);

  const { rows } = await sql.query("SELECT two_factor_enabled FROM auth_user WHERE email=$1", [
    "operations@example.com",
  ]);
  check("OPS için 2FA etkin işaretlendi", rows[0]?.two_factor_enabled === true);
}

console.log("\n═══ 6. 2FA'lı giriş ve kurtarma kodu ═══");
{
  const c = client();
  const login = await c.post("/api/auth/sign-in/email", {
    email: "operations@example.com",
    password: PAROLA,
  });
  check("2FA etkinken giriş ikinci adım istiyor", login.json?.twoFactorRedirect === true);

  const dash = await c.get("/");
  check(
    "TOTP doğrulanmadan korumalı sayfaya girilemiyor",
    dash.status >= 300 && dash.status < 400,
    `${dash.status} → ${dash.location}`,
  );

  const bad = await c.post("/api/auth/two-factor/verify-backup-code", { code: "sahte-kod-0000" });
  check("Geçersiz kurtarma kodu reddedildi", bad.status !== 200, `${bad.status}`);

  const ok = await c.post("/api/auth/two-factor/verify-backup-code", { code: opsBackupCodes[2] });
  check("Geçerli kurtarma kodu kabul edildi (3. kod)", ok.status === 200, `${ok.status}`);

  const after = await c.get("/");
  check("Doğrulama sonrası dashboard erişilebilir", after.status === 200, `${after.status}`);

  const reuse = client();
  await reuse.post("/api/auth/sign-in/email", {
    email: "operations@example.com",
    password: PAROLA,
  });
  const reused = await reuse.post("/api/auth/two-factor/verify-backup-code", {
    code: opsBackupCodes[2],
  });
  check("Kullanılmış kurtarma kodu TEKRAR kabul edilmiyor", reused.status !== 200, `${reused.status}`);
}

console.log("\n═══ 7. Rol bazlı finans maskeleme (dashboard HTML) ═══");
{
  // Tutarlar OPS/MEM'e GÖNDERİLMEZ — gizlenmez, HTML'de hiç bulunmaz.
  async function dashboardHtml(email) {
    const c = client();
    await c.post("/api/auth/sign-in/email", { email, password: PAROLA });
    const res = await fetch(`${BASE}/`, { headers: { cookie: c.cookies, origin: BASE } });
    return res.text();
  }

  const memHtml = await dashboardHtml("member@example.com");
  const tutarIzleri = ["142.350", "3.120,00", "257.050", "86.000", "17.500"];
  const sizan = tutarIzleri.filter((t) => memHtml.includes(t));
  check("MEM dashboard HTML'inde tutar yok", sizan.length === 0, sizan.join(", ") || "temiz");
  check("MEM için finans başlıkları yok", !memHtml.includes("Banka &amp; Kasa") && !memHtml.includes("Banka & Kasa"));

  const { rows } = await sql.query("SELECT id FROM auth_user WHERE email=$1", ["finance@example.com"]);
  check("Fixture doğrulaması: finance kullanıcısı mevcut", rows.length === 1);
}

console.log("\n═══ 8. Sır sızıntısı kontrolü ═══");
{
  // Yalnız bu koşunun kayıtları (request_id ile), zaman penceresi değil
  const { rows } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs
     WHERE test_run_id = $1
       AND (changes::text ILIKE '%secret%' OR changes::text ILIKE '%otpauth%'
         OR changes::text ILIKE '%backup%')`,
    [RUN_ID],
  );
  check("audit_logs'ta 2FA sır izi yok (bu koşu)", rows[0].n === 0, `${rows[0].n} şüpheli kayıt`);

  const { rows: pw } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs
     WHERE test_run_id = $1
       AND (changes::text ILIKE '%parola%' OR changes::text ILIKE '%password%')`,
    [RUN_ID],
  );
  check("audit_logs'ta parola izi yok (bu koşu)", pw[0].n === 0, `${pw[0].n} şüpheli kayıt`);

  const { rows: kanit } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1",
    [RUN_ID],
  );
  check("Bu koşu audit kaydı üretti (test_run_id çalışıyor)", kanit[0].n > 0, `${kanit[0].n} kayıt`);
}

await sql.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
