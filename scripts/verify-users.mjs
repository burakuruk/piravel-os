/**
 * Kullanıcı yönetimi ve davet akışı doğrulaması — Sprint 1 §1.
 *
 * Gerçek HTTP istekleriyle çalışır; sunucu ayakta olmalıdır.
 *
 * ⚠ PRD §6.3: Bu script ham davet token'ını, parolayı veya TOTP sırrını
 * EKRANA YAZMAZ. Token'lar yalnız varlık/uzunluk olarak raporlanır.
 *
 * Kapsanan plan senaryoları: 1-9, 12, 15-30 (10, 11 → verify-sessions;
 * 13 → verify-a11y; 14 → verify-styleguide).
 */
import { createHmac } from "node:crypto";
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
const YENI_PAROLA = "davet-kabul-parolasi-2026";
const RUN_ID = `users-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DAMGA = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

/** Üretimdeki ile AYNI sözleşme: HMAC + alan ayrımı (src/lib/invitations.ts). */
function hmac(alan, deger) {
  return createHmac("sha256", process.env.INVITE_TOKEN_PEPPER ?? "")
    .update(`${alan}:${deger}`)
    .digest("hex");
}

let ipSayac = 0;
function client() {
  ipSayac += 1;
  const ip = `198.19.0.${(ipSayac % 250) + 1}`;
  let cookies = "";
  const ortak = (ekstra = {}) => ({
    origin: BASE,
    "x-forwarded-for": ip,
    "x-test-run-id": RUN_ID,
    ...(cookies ? { cookie: cookies } : {}),
    ...ekstra,
  });
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
  const cagir = async (metod, path, body, ekstraBaslik) => {
    const res = await fetch(`${BASE}${path}`, {
      method: metod,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...ortak(ekstraBaslik),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    cerezYaz(res);
    let json = null;
    let text = "";
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
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
    patch: (p, b, h) => cagir("PATCH", p, b ?? {}, h),
    del: (p, b, h) => cagir("DELETE", p, b, h),
    get cerez() {
      return cookies;
    },
    cerezSil() {
      cookies = "";
    },
  };
}

/** 2FA dahil gerçek giriş; SA/FIN için kurulum yapılır. */
async function girisYap(c, email, parola = PAROLA, ikiFaKur = false) {
  const giris = await c.post("/api/auth/sign-in/email", { email, password: parola });
  if (!ikiFaKur) return giris;
  const enable = await c.post("/api/auth/two-factor/enable", { password: parola });
  const uri = enable.json?.totpURI ?? enable.json?.totpUri;
  if (uri) {
    const secret = new URL(uri.replace("otpauth://", "http://")).searchParams.get("secret");
    await c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
    return { ...giris, secret };
  }
  return giris;
}

/**
 * 2FA'sı ZATEN açık bir kullanıcı için tam oturum açar.
 *
 * Yalnız parola göndermek `twoFactorRedirect` döndürür ve oturum çerezi
 * oluşmaz; TOTP adımı tamamlanmadan korumalı uçlara erişilemez.
 */
async function girisTotpIle(c, email, secret, parola = PAROLA) {
  await c.post("/api/auth/sign-in/email", { email, password: parola });
  return c.post("/api/auth/two-factor/verify-totp", { code: totp(secret) });
}

/** Step-up alır (SA'nın 2FA'sı açıksa TOTP ile). */
async function stepUpAl(c, parola = PAROLA, secret = null) {
  return c.post("/api/v1/reauth", {
    password: parola,
    ...(secret ? { totpCode: totp(secret) } : {}),
  });
}

const olusturulanIdler = [];
const mail = (x) => `du-${x}-${DAMGA}@example.com`;

async function fixtureTemizle() {
  await sql.query("DELETE FROM auth_rate_limit");
  // Bu koşunun ürettiği kullanıcılar (davetler FK CASCADE ile düşer)
  await sql.query("DELETE FROM auth_user WHERE email LIKE 'du-%@example.com'");
  await sql.query("DELETE FROM users WHERE email LIKE 'du-%@example.com'");
  // Sabit fixture kullanıcılarının 2FA'sı ve oturumları
  const mails = ["admin@example.com", "finance@example.com", "operations@example.com", "member@example.com"];
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

// ═══════════════════════════════════════════════════════════════════
console.log("═══ 1. Erişim kapısı: kim kullanıcı yönetimini görür ═══");
// ═══════════════════════════════════════════════════════════════════
const sa = client();
{
  const g = await girisYap(sa, "admin@example.com", PAROLA, true);
  var saSecret = g.secret ?? null;
  const liste = await sa.get("/api/v1/users");
  check("SA kullanıcı listesini görebiliyor", liste.status === 200, `HTTP ${liste.status}`);
  check("Liste dizi döndü", Array.isArray(liste.json?.users), typeof liste.json?.users);
}

const mem = client();
{
  await girisYap(mem, "member@example.com");
  const liste = await mem.get("/api/v1/users");
  check(
    "MEM 404 alır (403 değil — ucun varlığı sızdırılmaz)",
    liste.status === 404,
    `HTTP ${liste.status}`,
  );
}

const fin = client();
{
  const g = await girisYap(fin, "finance@example.com", PAROLA, true);
  var finSecret = g.secret ?? null;
  const liste = await fin.get("/api/v1/users");
  check("FIN listeyi salt okuma görebiliyor", liste.status === 200, `HTTP ${liste.status}`);
  const ilk = liste.json?.users?.[0] ?? {};
  check(
    "FIN yanıtında yalnız izinli alanlar var",
    !("phone" in ilk) && !("twoFactorEnabled" in ilk) && !("activatedAt" in ilk),
    Object.keys(ilk).join(","),
  );
  check("FIN ad/e-posta/rol/aktiflik görüyor", "email" in ilk && "role" in ilk && "isActive" in ilk);
}

const ops = client();
{
  await girisYap(ops, "operations@example.com");
  const liste = await ops.get("/api/v1/users");
  check("OPS listeyi salt okuma görebiliyor", liste.status === 200, `HTTP ${liste.status}`);
  const ilk = liste.json?.users?.[0] ?? {};
  check(
    "OPS aktiflik/2FA/aktivasyon göremiyor",
    !("isActive" in ilk) && !("twoFactorEnabled" in ilk) && !("activatedAt" in ilk),
    Object.keys(ilk).join(","),
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 2. Kullanıcı oluşturma ve tek seferlik davet bağlantısı ═══");
// ═══════════════════════════════════════════════════════════════════
let opsKullanici = null;
let opsDavetToken = null;
{
  const yaz = await fin.post("/api/v1/users", {
    email: mail("fin-deneme"),
    fullName: "FIN Deneme",
    role: "member",
  });
  check("FIN kullanıcı oluşturamaz", yaz.status === 403 || yaz.status === 404, `HTTP ${yaz.status}`);

  const olustur = await sa.post("/api/v1/users", {
    email: mail("ops1"),
    fullName: "Sahte Operasyon",
    role: "operations",
  });
  check("SA ayrıcalıksız kullanıcı oluşturabiliyor", olustur.status === 201, `HTTP ${olustur.status}`);
  opsKullanici = olustur.json?.user?.id ?? null;
  opsDavetToken = olustur.json?.invitation?.token ?? null;
  check(
    "Yanıtta ham davet token'ı BİR KEZ döndü",
    typeof opsDavetToken === "string" && opsDavetToken.length >= 40,
    opsDavetToken ? `uzunluk=${opsDavetToken.length}` : "yok",
  );
  check(
    "Yanıtta davet bağlantısı da var",
    typeof olustur.json?.invitation?.url === "string" &&
      olustur.json.invitation.url.includes("/davet/"),
  );

  const { rows } = await sql.query("SELECT is_active, activated_at FROM users WHERE id = $1", [
    opsKullanici,
  ]);
  check("Yeni kullanıcı pasif ve aktifleşmemiş", rows[0]?.is_active === false && rows[0]?.activated_at === null);

  const { rows: cred } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_account WHERE user_id = $1 AND provider_id = 'credential'",
    [opsKullanici],
  );
  check("auth_account credential satırı HİÇ yazılmadı", cred[0].n === 0, `${cred[0].n} satır`);
}

// ── SA/FIN oluşturmak step-up ister (plan: user.create_privileged) ──
{
  const saSuz = client();
  await girisTotpIle(saSuz, "admin@example.com", saSecret);
  const yaz = await saSuz.post("/api/v1/users", {
    email: mail("fin-yeni"),
    fullName: "Sahte Finans",
    role: "finance",
  });
  check(
    "Step-up olmadan FIN kullanıcı oluşturulamaz",
    yaz.status === 403 && yaz.json?.error?.code === "SESSION_STALE",
    `HTTP ${yaz.status} ${yaz.json?.error?.code ?? ""}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 3. Davet token'ı hiçbir okuma yanıtında görünmez ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const liste = await sa.get("/api/v1/users");
  const govde = JSON.stringify(liste.json);
  check("Kullanıcı listesi yanıtında ham token yok", !govde.includes(opsDavetToken ?? "___"));
  check("Kullanıcı listesi yanıtında token_hash yok", !/token_?hash/i.test(govde));

  const detay = await sa.get(`/api/v1/users/${opsKullanici}`);
  const dGovde = JSON.stringify(detay.json);
  check("Kullanıcı detayı yanıtında ham token yok", !dGovde.includes(opsDavetToken ?? "___"));
  check("Kullanıcı detayı yanıtında token_hash yok", !/token_?hash/i.test(dGovde));
  check(
    "Detayda davet DURUMU var (token değil)",
    detay.json?.user?.invitation?.durum === "pending",
    detay.json?.user?.invitation?.durum ?? "yok",
  );
  check(
    "Detayda davetin son geçerlilik tarihi var",
    typeof detay.json?.user?.invitation?.expiresAt === "string",
  );

  const html = await sa.get("/kullanicilar");
  check(
    "Kullanıcı listesi HTML kaynağında ham token yok",
    !html.text.includes(opsDavetToken ?? "___"),
  );
  check("Kullanıcı listesi HTML kaynağında hash yok", !/token_?hash/i.test(html.text));
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 4. Davet sırları veritabanında ham durmaz ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const { rows } = await sql.query("SELECT count(*)::int AS n FROM user_invitations WHERE token_hash = $1", [
    opsDavetToken,
  ]);
  check("Ham davet token'ı DB'de BULUNAMAZ", rows[0].n === 0);

  const { rows: h } = await sql.query(
    "SELECT count(*)::int AS n FROM user_invitations WHERE token_hash = $1",
    [hmac("invite_token", opsDavetToken)],
  );
  check("Saklanan değer HMAC-SHA256'dır", h[0].n === 1);

  const { rows: audit } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1 AND changes::text LIKE $2",
    [RUN_ID, `%${opsDavetToken}%`],
  );
  check("Ham token audit_logs'a yazılmadı", audit[0].n === 0);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 5. Pending kullanıcı giriş yapamaz ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const c = client();
  const giris = await c.post("/api/auth/sign-in/email", {
    email: mail("ops1"),
    password: YENI_PAROLA,
  });
  check("Pending kullanıcı parola ile giriş yapamıyor", giris.status >= 400, `HTTP ${giris.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 6. Davet bağlantısı: GET değiştirmez, temiz URL'e yönlendirir ═══");
// ═══════════════════════════════════════════════════════════════════
const davetci = client();
{
  const once = await sql.query("SELECT accepted_at, cookie_hash FROM user_invitations WHERE user_id = $1", [
    opsKullanici,
  ]);
  const res = await davetci.get(`/davet/${opsDavetToken}`);
  check("GET /davet/<token> yönlendiriyor", res.status === 302 || res.status === 307, `HTTP ${res.status}`);
  check(
    "Temiz /davet adresine yönlendiriyor (token URL'de kalmıyor)",
    (res.headers.get("location") ?? "").endsWith("/davet"),
    res.headers.get("location") ?? "",
  );
  check("Davet çerezi yazıldı", davetci.cerez.includes("piravel_davet"), davetci.cerez ? "var" : "yok");
  check(
    "Çerez ham token'ı İÇERMİYOR",
    !davetci.cerez.includes(opsDavetToken),
  );

  const sonra = await sql.query("SELECT accepted_at FROM user_invitations WHERE user_id = $1", [
    opsKullanici,
  ]);
  check("GET daveti KABUL ETMEDİ", sonra.rows[0].accepted_at === null);
  check("GET öncesi de kabul edilmemişti", once.rows[0].accepted_at === null);

  const { rows: cerez } = await sql.query(
    "SELECT cookie_hash, cookie_expires_at FROM user_invitations WHERE user_id = $1",
    [opsKullanici],
  );
  check("Çerez eşlemesi DB'ye yazıldı", cerez[0].cookie_hash !== null);
  const kalanDk = (new Date(cerez[0].cookie_expires_at) - Date.now()) / 60000;
  check("Çerez ömrü ≤ 10 dakika", kalanDk > 0 && kalanDk <= 10.1, `${kalanDk.toFixed(1)} dk`);

  // Çerez nitelikleri
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const dc = setCookie.find((c) => c.startsWith("piravel_davet=")) ?? "";
  check("Çerez HttpOnly", /HttpOnly/i.test(dc));
  check("Çerez SameSite=Strict", /SameSite=Strict/i.test(dc));
  check("Çerez Path=/davet", /Path=\/davet/i.test(dc));
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 7. Kabul ucunun sertleştirmesi ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const yanlisOrigin = await davetci.post(
    "/api/v1/davet/kabul",
    { password: YENI_PAROLA },
    { origin: "https://kotu.example" },
  );
  check("Yanlış Origin reddedilir", yanlisOrigin.status === 403, `HTTP ${yanlisOrigin.status}`);

  const res = await fetch(`${BASE}/api/v1/davet/kabul`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      origin: BASE,
      cookie: davetci.cerez,
      "x-test-run-id": RUN_ID,
    },
    body: "password=x",
    redirect: "manual",
  });
  check("Yanlış Content-Type reddedilir", res.status === 415 || res.status === 400, `HTTP ${res.status}`);

  const cerezsiz = client();
  const yok = await cerezsiz.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
  check(
    "Çerezsiz kabul isteği tek tip hatayla reddedilir",
    yok.json?.error?.code === "INVITATION_UNAVAILABLE",
    yok.json?.error?.code ?? `HTTP ${yok.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 8. Davet kabulü atomik ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const kabul = await davetci.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
  check("Kabul başarılı", kabul.status === 200, `HTTP ${kabul.status}`);

  const { rows } = await sql.query(
    `SELECT u.is_active, u.activated_at, i.accepted_at, i.cookie_hash, i.cookie_expires_at,
            (SELECT count(*)::int FROM auth_account a
              WHERE a.user_id = u.id::text AND a.provider_id = 'credential') AS cred
       FROM users u JOIN user_invitations i ON i.user_id = u.id::text
      WHERE u.id = $1`,
    [opsKullanici],
  );
  const r = rows[0];
  check("Kullanıcı aktifleşti", r.is_active === true);
  check("activated_at dolduruldu", r.activated_at !== null);
  check("accepted_at dolduruldu", r.accepted_at !== null);
  check("credential oluşturuldu", r.cred === 1, `${r.cred} satır`);
  check("Davet çerezi eşlemesi hemen temizlendi", r.cookie_hash === null && r.cookie_expires_at === null);
  check("Kabul sonrası çerez tarayıcıdan silindi", !davetci.cerez.includes("piravel_davet"));

  const c = client();
  const giris = await c.post("/api/auth/sign-in/email", {
    email: mail("ops1"),
    password: YENI_PAROLA,
  });
  check("Kabul eden kullanıcı artık giriş yapabiliyor", giris.status === 200, `HTTP ${giris.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 9. Kullanılmış davet ikinci kez etki üretmez ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const c = client();
  const tekrar = await c.get(`/davet/${opsDavetToken}`);
  const konum = tekrar.headers.get("location") ?? "";
  check(
    "Kullanılmış token için çerez yazılmaz",
    !c.cerez.includes("piravel_davet"),
    konum,
  );

  const { rows: once } = await sql.query(
    "SELECT accepted_at, updated_at FROM user_invitations WHERE user_id = $1",
    [opsKullanici],
  );
  const ikinci = await c.post("/api/v1/davet/kabul", { password: "baska-bir-parola-123" });
  check(
    "İkinci kabul denemesi tek tip hata döner",
    ikinci.json?.error?.code === "INVITATION_UNAVAILABLE",
    ikinci.json?.error?.code ?? `HTTP ${ikinci.status}`,
  );
  const { rows: sonra } = await sql.query(
    "SELECT accepted_at, updated_at FROM user_invitations WHERE user_id = $1",
    [opsKullanici],
  );
  check(
    "İkinci istek HİÇBİR yeni etki üretmedi",
    String(once[0].accepted_at) === String(sonra[0].accepted_at),
  );

  const c2 = client();
  const eskiParola = await c2.post("/api/auth/sign-in/email", {
    email: mail("ops1"),
    password: "baska-bir-parola-123",
  });
  check("İkinci kabul parolayı DEĞİŞTİRMEDİ", eskiParola.status >= 400, `HTTP ${eskiParola.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 10. Dört geçersiz davet durumu AYNI yanıtı verir ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const yanitlar = {};

  // (a) hiç var olmayan token
  {
    const c = client();
    const r = await c.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
    yanitlar.invalid = JSON.stringify(r.json?.error ?? {});
  }

  // (b) süresi dolmuş · (c) iptal edilmiş · (d) kabul edilmiş
  const senaryolar = [
    ["expired", async (uid) =>
      sql.query(
        `UPDATE user_invitations SET created_at = now() - interval '73 hours',
                                     expires_at = now() - interval '1 hour'
          WHERE user_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
        [uid],
      )],
    ["revoked", async (uid) =>
      sql.query(
        "UPDATE user_invitations SET revoked_at = now() WHERE user_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL",
        [uid],
      )],
  ];

  for (const [ad, bozan] of senaryolar) {
    const olustur = await sa.post("/api/v1/users", {
      email: mail(`ds-${ad}`),
      fullName: `Sahte ${ad}`,
      role: "member",
    });
    const uid = olustur.json?.user?.id;
    const tok = olustur.json?.invitation?.token;
    olusturulanIdler.push(uid);

    const c = client();
    await c.get(`/davet/${tok}`); // çerezi al (henüz geçerliyken)
    await bozan(uid);
    const r = await c.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
    yanitlar[ad] = JSON.stringify(r.json?.error ?? {});
  }

  // (d) zaten kabul edilmiş — yukarıdaki ops1
  {
    const c = client();
    const r = await c.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
    yanitlar.accepted = JSON.stringify(r.json?.error ?? {});
  }

  const kume = new Set(Object.values(yanitlar));
  check(
    "invalid/expired/revoked/accepted AYNI hata sözleşmesini döner",
    kume.size === 1,
    `${kume.size} farklı yanıt: ${[...kume].join(" || ")}`,
  );
  check(
    "Hata kodu INVITATION_UNAVAILABLE",
    yanitlar.invalid.includes("INVITATION_UNAVAILABLE"),
    yanitlar.invalid,
  );
  /**
   * Genel mesajın kendisi "kullanılamıyor" der — bu durum bildirmez, yalnız
   * sonucu söyler. Aranan şey NEDENİ ele veren kelimeler.
   */
  check(
    "Mesaj hangi durumda olduğunu AÇIKLAMIYOR",
    !/süresi dol|expired|iptal edil|revoked|daha önce|accepted|bulunamadı|geçersiz token/i.test(
      yanitlar.invalid,
    ),
    yanitlar.invalid,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 11. Davet yenileme ve iptali ═══");
// ═══════════════════════════════════════════════════════════════════
let yenilemeUid = null;
{
  const olustur = await sa.post("/api/v1/users", {
    email: mail("yenileme"),
    fullName: "Sahte Yenileme",
    role: "member",
  });
  yenilemeUid = olustur.json?.user?.id;
  const tok1 = olustur.json?.invitation?.token;
  olusturulanIdler.push(yenilemeUid);

  // Eski çerez oturumu aç
  const eskiTarayici = client();
  await eskiTarayici.get(`/davet/${tok1}`);
  check("Yenileme öncesi çerez alındı", eskiTarayici.cerez.includes("piravel_davet"));

  const yeni = await sa.post(`/api/v1/users/${yenilemeUid}/invitations`);
  check("Davet yeniden oluşturuldu", yeni.status === 201 || yeni.status === 200, `HTTP ${yeni.status}`);
  const tok2 = yeni.json?.invitation?.token;
  check("Yenileme yanıtında yeni ham token bir kez döndü", typeof tok2 === "string" && tok2 !== tok1);

  // Eski token artık çalışmaz
  const c = client();
  const eskiGet = await c.get(`/davet/${tok1}`);
  check(
    "Eski davet bağlantısı geçersiz",
    !c.cerez.includes("piravel_davet"),
    `HTTP ${eskiGet.status}`,
  );

  // Eski çerez oturumu da geçersiz
  const eskiCerezKabul = await eskiTarayici.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
  check(
    "Yenileme eski ÇEREZ oturumunu da geçersiz kıldı",
    eskiCerezKabul.json?.error?.code === "INVITATION_UNAVAILABLE",
    eskiCerezKabul.json?.error?.code ?? `HTTP ${eskiCerezKabul.status}`,
  );

  const { rows } = await sql.query(
    `SELECT count(*)::int AS n FROM user_invitations
      WHERE user_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [yenilemeUid],
  );
  check("Aynı kullanıcı için tek açık davet var", rows[0].n === 1, `adet=${rows[0].n}`);

  // İptal
  const iptal = await sa.del(`/api/v1/users/${yenilemeUid}/invitations`);
  check("Davet iptal edildi", iptal.status === 200, `HTTP ${iptal.status}`);
  const { rows: sonra } = await sql.query(
    `SELECT revoked_at, cookie_hash, cookie_expires_at FROM user_invitations
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [yenilemeUid],
  );
  check("revoked_at dolduruldu", sonra[0].revoked_at !== null);
  check(
    "İptalde cookie_hash ve cookie_expires_at temizlendi",
    sonra[0].cookie_hash === null && sonra[0].cookie_expires_at === null,
  );

  const iptalSonrasi = await sa.post(`/api/v1/users/${yenilemeUid}/invitations`);
  check(
    "İptal sonrası yeni davet üretilebiliyor",
    iptalSonrasi.status === 201 || iptalSonrasi.status === 200,
    `HTTP ${iptalSonrasi.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 12. Süresi dolmuş davet yeni davet üretimini kilitlemez ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const olustur = await sa.post("/api/v1/users", {
    email: mail("suresi"),
    fullName: "Sahte Suresi",
    role: "member",
  });
  const uid = olustur.json?.user?.id;
  olusturulanIdler.push(uid);

  await sql.query(
    `UPDATE user_invitations SET created_at = now() - interval '73 hours',
                                 expires_at = now() - interval '1 hour'
      WHERE user_id = $1`,
    [uid],
  );
  const yeni = await sa.post(`/api/v1/users/${uid}/invitations`);
  check(
    "Süresi dolmuş davetten SONRA yeni davet üretilebiliyor (index kilitlemiyor)",
    yeni.status === 201 || yeni.status === 200,
    `HTTP ${yeni.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 13. Yarıda kalan kabul: yarı aktif kullanıcı oluşmaz ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const olustur = await sa.post("/api/v1/users", {
    email: mail("yarim"),
    fullName: "Sahte Yarim",
    role: "member",
  });
  const uid = olustur.json?.user?.id;
  const tok = olustur.json?.invitation?.token;
  olusturulanIdler.push(uid);

  /**
   * Better Auth'un parola oluşturması bizim transaction'ımıza katılamaz.
   * Bu yüzden credential ÖNCE yazılır, aktivasyon+kabul tek transaction'da
   * sonra gelir. Aradaki kesintinin bıraktığı durum burada birebir kurulur:
   * credential var, ama is_active=false ve accepted_at NULL.
   */
  const { rows: kaynak } = await sql.query(
    "SELECT password FROM auth_account WHERE provider_id = 'credential' AND password IS NOT NULL LIMIT 1",
  );
  await sql.query(
    `INSERT INTO auth_account (id, account_id, provider_id, user_id, password, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, 'credential', $1, $2, now(), now())`,
    [uid, kaynak[0].password],
  );

  const { rows: ara } = await sql.query(
    "SELECT is_active, activated_at FROM users WHERE id = $1",
    [uid],
  );
  check("Kesinti anında kullanıcı aktif DEĞİL", ara[0].is_active === false && ara[0].activated_at === null);

  const c = client();
  const giris = await c.post("/api/auth/sign-in/email", { email: mail("yarim"), password: PAROLA });
  check(
    "Yarım kalmış kullanıcı giriş YAPAMAZ",
    giris.status >= 400 || giris.json?.user === undefined,
    `HTTP ${giris.status}`,
  );

  const { rows: dv } = await sql.query(
    "SELECT accepted_at, revoked_at FROM user_invitations WHERE user_id = $1",
    [uid],
  );
  check("Davet hâlâ kullanılabilir durumda", dv[0].accepted_at === null && dv[0].revoked_at === null);

  // Tekrar deneme başarıyla tamamlanır
  const c2 = client();
  await c2.get(`/davet/${tok}`);
  const kabul = await c2.post("/api/v1/davet/kabul", { password: YENI_PAROLA });
  check("Kesintiden sonra kabul tekrar denenince tamamlanıyor", kabul.status === 200, `HTTP ${kabul.status}`);

  const { rows: son } = await sql.query(
    "SELECT is_active, activated_at FROM users WHERE id = $1",
    [uid],
  );
  check("Tekrar denemeden sonra kullanıcı aktif", son[0].is_active === true && son[0].activated_at !== null);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 14. Step-up olmadan kritik işlemler reddedilir ═══");
// ═══════════════════════════════════════════════════════════════════
const saSuz = client();
{
  await girisTotpIle(saSuz, "admin@example.com", saSecret);
  const hedef = opsKullanici;

  const rol = await saSuz.patch(`/api/v1/users/${hedef}/role`, { role: "member" });
  check("Step-up olmadan rol değişimi reddedilir", rol.json?.error?.code === "SESSION_STALE", `HTTP ${rol.status}`);

  const durum = await saSuz.patch(`/api/v1/users/${hedef}/status`, { isActive: false });
  check("Step-up olmadan pasifleştirme reddedilir", durum.json?.error?.code === "SESSION_STALE", `HTTP ${durum.status}`);

  const ikiFa = await saSuz.del(`/api/v1/users/${hedef}/two-factor`);
  check("Step-up olmadan 2FA sıfırlama reddedilir", ikiFa.json?.error?.code === "SESSION_STALE", `HTTP ${ikiFa.status}`);

  const oturum = await saSuz.del(`/api/v1/users/${hedef}/sessions`);
  check("Step-up olmadan oturum iptali reddedilir", oturum.json?.error?.code === "SESSION_STALE", `HTTP ${oturum.status}`);

  // Temel bilgi güncellemesi step-up İSTEMEZ
  const temel = await saSuz.patch(`/api/v1/users/${hedef}`, { fullName: "Sahte Operasyon 2" });
  check("Temel bilgi güncellemesi step-up istemez", temel.status === 200, `HTTP ${temel.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 15. Rol değişimi ve oturum sonuçları ═══");
// ═══════════════════════════════════════════════════════════════════
{
  await stepUpAl(sa, PAROLA, saSecret);

  // Hedefin açık bir oturumu olsun
  const hedefTarayici = client();
  await hedefTarayici.post("/api/auth/sign-in/email", { email: mail("ops1"), password: YENI_PAROLA });
  const oncesi = await hedefTarayici.get("/api/v1/reauth");
  check("Hedefin oturumu açık", oncesi.status === 200 || oncesi.status === 401, `HTTP ${oncesi.status}`);

  const rol = await sa.patch(`/api/v1/users/${opsKullanici}/role`, { role: "member" });
  check("Step-up sonrası rol değişimi başarılı", rol.status === 200, `HTTP ${rol.status}`);

  const { rows } = await sql.query("SELECT role FROM users WHERE id = $1", [opsKullanici]);
  check("Rol veritabanında değişti", rows[0].role === "member", rows[0].role);

  const { rows: oturum } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_session WHERE user_id = $1",
    [opsKullanici],
  );
  check("Rol değişimi tüm oturumları düşürdü", oturum[0].n === 0, `${oturum[0].n} oturum`);

  const sonra = await hedefTarayici.get("/api/v1/users");
  check(
    "Eski oturum korumalı sayfaya erişemiyor",
    sonra.status === 401 || sonra.status === 404 || sonra.status === 403,
    `HTTP ${sonra.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 16. Son süper yönetici koruması ═══");
// ═══════════════════════════════════════════════════════════════════
{
  await stepUpAl(sa, PAROLA, saSecret);
  const { rows: saListe } = await sql.query(
    "SELECT id FROM users WHERE role = 'super_admin' AND is_active = true AND deleted_at IS NULL",
  );
  check("Tek aktif SA var (kural sınanabilir)", saListe.length === 1, `${saListe.length} SA`);

  const kendi = await sa.patch(`/api/v1/users/${saListe[0].id}/status`, { isActive: false });
  check(
    "Kullanıcı kendini pasifleştiremez",
    kendi.status === 400 || kendi.status === 409,
    `HTTP ${kendi.status} ${kendi.json?.error?.code ?? ""}`,
  );

  const kendiRol = await sa.patch(`/api/v1/users/${saListe[0].id}/role`, { role: "member" });
  check(
    "Kullanıcı kendi SA rolünü kaldıramaz",
    kendiRol.status === 400 || kendiRol.status === 409,
    `HTTP ${kendiRol.status} ${kendiRol.json?.error?.code ?? ""}`,
  );

  // İkinci bir SA yarat, sonra ilkini düşürmeyi dene
  const ikinci = await sa.post("/api/v1/users", {
    email: mail("sa2"),
    fullName: "Sahte SA",
    role: "super_admin",
  });
  const sa2 = ikinci.json?.user?.id;
  olusturulanIdler.push(sa2);
  check("SA oluşturma step-up ile başarılı", ikinci.status === 201, `HTTP ${ikinci.status}`);

  // sa2 pending olduğu için AKTİF SA sayılmaz
  const dusur = await sa.patch(`/api/v1/users/${saListe[0].id}/role`, { role: "member" });
  check(
    "Pending SA, 'son aktif SA' korumasını KALDIRMAZ",
    dusur.status === 400 || dusur.status === 409,
    `HTTP ${dusur.status} ${dusur.json?.error?.code ?? ""}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 17. Pasifleştirme oturumları anında düşürür ═══");
// ═══════════════════════════════════════════════════════════════════
{
  await stepUpAl(sa, PAROLA, saSecret);
  const hedefTarayici = client();
  await hedefTarayici.post("/api/auth/sign-in/email", { email: "operations@example.com", password: PAROLA });
  const opsId = (
    await sql.query("SELECT id FROM users WHERE email = 'operations@example.com'")
  ).rows[0].id;

  const pasif = await sa.patch(`/api/v1/users/${opsId}/status`, { isActive: false });
  check("Pasifleştirme başarılı", pasif.status === 200, `HTTP ${pasif.status}`);

  const { rows } = await sql.query("SELECT count(*)::int AS n FROM auth_session WHERE user_id = $1", [
    opsId,
  ]);
  check("Pasifleştirilen kullanıcının oturumları silindi", rows[0].n === 0, `${rows[0].n} oturum`);

  const { rows: su } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE user_id = $1",
    [opsId],
  );
  check("Step-up kayıtları da silindi", su[0].n === 0);

  const erisim = await hedefTarayici.get("/api/v1/users");
  check("İptal edilmiş oturum korumalı uca erişemiyor", erisim.status >= 400, `HTTP ${erisim.status}`);

  await sa.patch(`/api/v1/users/${opsId}/status`, { isActive: true });
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 18. 2FA sıfırlama ═══");
// ═══════════════════════════════════════════════════════════════════
{
  await stepUpAl(sa, PAROLA, saSecret);
  const finId = (await sql.query("SELECT id FROM users WHERE email = 'finance@example.com'")).rows[0].id;
  await stepUpAl(fin, PAROLA, finSecret);

  const { rows: once } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE user_id = $1",
    [finId],
  );
  check("FIN'in step-up kaydı var", once[0].n >= 1, `${once[0].n} kayıt`);

  const sifirla = await sa.del(`/api/v1/users/${finId}/two-factor`);
  check("2FA sıfırlama başarılı", sifirla.status === 200, `HTTP ${sifirla.status}`);

  const { rows: tf } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_two_factor WHERE user_id = $1",
    [finId],
  );
  check("TOTP kaydı silindi", tf[0].n === 0);
  const { rows: bayrak } = await sql.query(
    "SELECT two_factor_enabled FROM auth_user WHERE id = $1",
    [finId],
  );
  check("two_factor_enabled kapatıldı", bayrak[0].two_factor_enabled === false);

  const { rows: oturum } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_session WHERE user_id = $1",
    [finId],
  );
  check("2FA sıfırlama oturumları düşürdü", oturum[0].n === 0, `${oturum[0].n} oturum`);
  const { rows: sonra } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_reauthentication WHERE user_id = $1",
    [finId],
  );
  check("2FA sıfırlama step-up kayıtlarını da geçersiz kıldı", sonra[0].n === 0, `${sonra[0].n} kayıt`);

  const eski = await fin.get("/api/v1/users");
  check("FIN'in eski oturumu erişemiyor", eski.status >= 400, `HTTP ${eski.status}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n═══ 19. Denetim izi ve sır sızıntısı ═══");
// ═══════════════════════════════════════════════════════════════════
{
  const { rows: adet } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1",
    [RUN_ID],
  );
  check("Bu koşu audit kaydı üretti", adet[0].n > 0, `${adet[0].n} kayıt`);

  const { rows } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE test_run_id = $1
       AND (changes::text ILIKE '%password%'  OR changes::text ILIKE '%parola%'
         OR changes::text ILIKE '%secret%'    OR changes::text ILIKE '%otpauth%'
         OR changes::text ILIKE '%recovery%'  OR changes::text ILIKE '%token%')`,
    [RUN_ID],
  );
  check("Audit'te parola/token/TOTP/kurtarma izi yok", rows[0].n === 0, `${rows[0].n} şüpheli kayıt`);

  const { rows: ip } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs
      WHERE test_run_id = $1 AND ip_address ~ '^\\d+\\.\\d+\\.\\d+\\.\\d+$'`,
    [RUN_ID],
  );
  check("Audit'te tam IP saklanmıyor", ip[0].n === 0, `${ip[0].n} kayıt`);
}

await fixtureTemizle();
await sql.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(" | ")}`);
  process.exit(1);
}
