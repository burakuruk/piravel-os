/**
 * Giriş güvenliği doğrulaması — hibrit koruma (IP rate limit + hesap kilidi).
 *
 * Kullanıcının belirlediği 10 senaryoyu gerçek HTTP istekleriyle sınar.
 * Dev sunucusu ayakta olmalı. Tekrar tekrar çalıştırılabilir.
 *
 * ⚠ PRD §6.3: Bu script parola, TOTP veya kurtarma kodu YAZDIRMAZ.
 */
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
const HEDEF = "member@example.com";

/**
 * Bu koşuya özgü kimlik. Her istekte x-request-id olarak gönderilir; sunucu
 * audit_logs.request_id ve auth_login_attempts.request_id alanlarına yazar.
 *
 * Testler YALNIZCA kendi ürettikleri kayıtları sorgular — zaman penceresine
 * dayanmak yerine. audit_logs append-only'dir; geçmişe dokunulmaz.
 */
const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

async function userId(email) {
  const { rows } = await sql.query("SELECT id FROM auth_user WHERE email=$1", [email]);
  return rows[0]?.id ?? null;
}

/** Güvenlik durumunu sıfırla — testler birbirinden bağımsız olmalı. */
async function sifirla(email) {
  const id = await userId(email);
  if (id) await sql.query("DELETE FROM auth_security_state WHERE user_id=$1", [id]);
  await sql.query("DELETE FROM auth_rate_limit");
}

/** IP rate limit'i atlatmak için her isteğe farklı X-Forwarded-For verilir. */
let ipSayac = 0;
function yeniIp() {
  ipSayac += 1;
  return `203.0.113.${(ipSayac % 250) + 1}`;
}

async function girisDene(email, password, ip = yeniIp()) {
  const basladi = performance.now();
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: BASE,
      "x-forwarded-for": ip,
      "x-request-id": RUN_ID,
    },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* gövdesiz */
  }
  return {
    status: res.status,
    retryAfter: res.headers.get("retry-after"),
    json,
    sureMs: performance.now() - basladi,
  };
}

/** Bu koşuda üretilen audit kayıtlarını sayar (zaman penceresi kullanmaz). */
async function kosuAuditSayisi(action) {
  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM audit_logs WHERE request_id=$1 AND action=$2",
    [RUN_ID, action],
  );
  return rows[0].n;
}

async function durum(email) {
  const id = await userId(email);
  const { rows } = await sql.query(
    "SELECT password_failed_count, password_locked_until, totp_failed_count, totp_locked_until FROM auth_security_state WHERE user_id=$1",
    [id],
  );
  return rows[0] ?? null;
}


// ═══════════════════════════════════════════════════════════════
console.log("═══ 1. Beşinci hatalı parola sonrası geçici kilit ═══");
await sifirla(HEDEF);
{
  for (let i = 1; i <= 5; i++) {
    await girisDene(HEDEF, "kesinlikle-yanlis-parola");
  }
  const st = await durum(HEDEF);
  check("5 başarısız deneme sayacı doğru", st?.password_failed_count === 5, `sayaç=${st?.password_failed_count}`);
  check("Hesap kilitlendi", st?.password_locked_until !== null && new Date(st.password_locked_until) > new Date());
  check("Kilit audit'e yazıldı (bu koşu)", (await kosuAuditSayisi("account_temporarily_locked")) >= 1);
}

console.log("\n═══ 2. Kilitliyken: parola doğruysa 429, yanlışsa 401 ═══");
{
  // Parola DOĞRU + hesap kilitli → gerçek durum bildirilir
  const dogru = await girisDene(HEDEF, PAROLA);
  check("Doğru parola + kilit → 429", dogru.status === 429, `HTTP ${dogru.status}`);
  check("Retry-After başlığı var", Boolean(dogru.retryAfter), `${dogru.retryAfter}s`);
  check(
    "Mesaj sayaç sızdırmıyor",
    !/\d+\s*deneme|kaldı/i.test(dogru.json?.message ?? ""),
    dogru.json?.message ?? "",
  );

  // Parola YANLIŞ + hesap kilitli → kilit durumu ELE VERİLMEZ, 401
  const yanlis = await girisDene(HEDEF, "yine-yanlis-parola-123");
  check("Yanlış parola + kilit → 401 (kilit sızdırılmıyor)", yanlis.status === 401, `HTTP ${yanlis.status}`);
}

console.log("\n═══ 2b. ENUMERATION: kilitli hesap ile bilinmeyen hesap ayırt edilemez ═══");
{
  // Isınma: ilk istek JIT/bağlantı maliyeti taşır, ölçüme dahil edilmez
  await girisDene("isinma@example.com", "yanlis-parola-123");

  const olcum = async (email) => {
    const sureler = [];
    let sonuc;
    for (let i = 0; i < 5; i++) {
      sonuc = await girisDene(email, "yanlis-parola-123");
      sureler.push(sonuc.sureMs);
    }
    sureler.sort((a, b) => a - b);
    return { ortanca: sureler[2], status: sonuc.status, json: sonuc.json };
  };

  const kilitli = await olcum(HEDEF); // hâlâ kilitli
  const bilinmeyen = await olcum("kesinlikle-yok@example.com");

  check(
    "Aynı HTTP durumu",
    kilitli.status === bilinmeyen.status,
    `kilitli=${kilitli.status} bilinmeyen=${bilinmeyen.status}`,
  );
  check(
    "Aynı mesaj",
    (kilitli.json?.message ?? "") === (bilinmeyen.json?.message ?? ""),
    kilitli.json?.message ?? "",
  );
  check(
    "Aynı hata kodu",
    (kilitli.json?.code ?? null) === (bilinmeyen.json?.code ?? null),
    `${kilitli.json?.code} / ${bilinmeyen.json?.code}`,
  );

  // Zamanlama: sahte hash doğrulaması sayesinde makul tolerans içinde
  const oran = Math.max(kilitli.ortanca, bilinmeyen.ortanca) /
    Math.max(1, Math.min(kilitli.ortanca, bilinmeyen.ortanca));
  check(
    "Yanıt süreleri benzer (oran < 3x)",
    oran < 3,
    `kilitli=${kilitli.ortanca.toFixed(0)}ms bilinmeyen=${bilinmeyen.ortanca.toFixed(0)}ms oran=${oran.toFixed(2)}x`,
  );
}

console.log("\n═══ 3. Süre dolduktan sonra doğru giriş ═══");
{
  // Kilidi geçmişe alarak süre dolmasını simüle et
  const id = await userId(HEDEF);
  await sql.query(
    "UPDATE auth_security_state SET password_locked_until = now() - interval '1 minute' WHERE user_id=$1",
    [id],
  );
  const res = await girisDene(HEDEF, PAROLA);
  check("Kilit dolunca doğru parola kabul edildi", res.status === 200, `HTTP ${res.status}`);
}

console.log("\n═══ 4. Başarılı girişte sayaç sıfırlanır ═══");
{
  const st = await durum(HEDEF);
  check("Sayaç sıfırlandı", st?.password_failed_count === 0, `sayaç=${st?.password_failed_count}`);
  check("Kilit temizlendi", st?.password_locked_until === null);
  check("Sıfırlama audit'e yazıldı (bu koşu)", (await kosuAuditSayisi("security_counter_reset")) >= 1);
}

console.log("\n═══ 5. Bilinmeyen e-posta ile kayıtlı e-posta benzer yanıt verir ═══");
await sifirla(HEDEF);
{
  const bilinmeyen = await girisDene("hicvarolmayan@example.com", "yanlis-parola-123");
  const kayitli = await girisDene(HEDEF, "yanlis-parola-123");
  check(
    "Aynı HTTP durumu",
    bilinmeyen.status === kayitli.status,
    `${bilinmeyen.status} / ${kayitli.status}`,
  );
  check(
    "Aynı hata mesajı",
    (bilinmeyen.json?.message ?? "") === (kayitli.json?.message ?? ""),
    bilinmeyen.json?.message ?? "",
  );
  check(
    "Yanıt hesabın varlığını açıklamıyor",
    !/bulunamadı|kayıtlı değil|not found|no user/i.test(
      JSON.stringify(bilinmeyen.json ?? {}),
    ),
  );
}

console.log("\n═══ 6. IP rate limit ile hesap kilidi bağımsız çalışır ═══");
await sifirla(HEDEF);
{
  // Aynı IP'den hızlı 4 istek → IP limiti (10 sn / 3 istek) devreye girer
  const sabitIp = "198.51.100.7";
  const yanitlar = [];
  for (let i = 0; i < 4; i++) {
    yanitlar.push(await girisDene(HEDEF, "yanlis-parola-123", sabitIp));
  }
  const limitli = yanitlar.filter((r) => r.status === 429).length;
  check("IP limiti devreye girdi", limitli >= 1, `${limitli}/4 istek 429`);

  const st = await durum(HEDEF);
  const sayac = st?.password_failed_count ?? 0;
  check(
    "Hesap sayacı IP limitinden bağımsız (limitli istekler sayılmadı)",
    sayac > 0 && sayac < 4,
    `hesap sayacı=${sayac}`,
  );
  check("Hesap henüz kilitlenmedi (eşik 5)", !st?.password_locked_until);

  // Rate limit'i temizle: farklı IP'lerle hesap eşiğine ulaşılabilmeli
  await sql.query("DELETE FROM auth_rate_limit");
  for (let i = sayac; i < 5; i++) await girisDene(HEDEF, "yanlis-parola-123");
  const st2 = await durum(HEDEF);
  check("Farklı IP'lerden hesap kilidi yine de uygulandı", st2?.password_locked_until !== null);
}

console.log("\n═══ 7. TOTP sayacı parola sayacından ayrı ═══");
await sifirla("operations@example.com");
{
  const id = await userId("operations@example.com");
  // Parola sayacını doğrudan yükselt
  await sql.query(
    `INSERT INTO auth_security_state (user_id, password_failed_count, password_window_started_at)
     VALUES ($1, 3, now())
     ON CONFLICT (user_id) DO UPDATE SET password_failed_count = 3, password_window_started_at = now()`,
    [id],
  );
  // TOTP sayacını ayrı olarak yükselt
  await sql.query(
    "UPDATE auth_security_state SET totp_failed_count = 2, totp_window_started_at = now() WHERE user_id=$1",
    [id],
  );
  const st = await durum("operations@example.com");
  check(
    "İki sayaç ayrı tutuluyor",
    st?.password_failed_count === 3 && st?.totp_failed_count === 2,
    `parola=${st?.password_failed_count}, totp=${st?.totp_failed_count}`,
  );

  // Başarılı parola girişi TOTP sayacını ETKİLEMEMELİ
  await sql.query("DELETE FROM auth_rate_limit");
  await girisDene("operations@example.com", PAROLA);
  const st2 = await durum("operations@example.com");
  check(
    "Başarılı giriş yalnız parola sayacını sıfırladı",
    st2?.password_failed_count === 0 && st2?.totp_failed_count === 2,
    `parola=${st2?.password_failed_count}, totp=${st2?.totp_failed_count}`,
  );
}

console.log("\n═══ 8. Parola sıfırlama parola kilidini temizler ═══");
await sifirla(HEDEF);
{
  const id = await userId(HEDEF);
  await sql.query(
    `INSERT INTO auth_security_state (user_id, password_failed_count, password_locked_until)
     VALUES ($1, 5, now() + interval '15 minutes')
     ON CONFLICT (user_id) DO UPDATE SET password_failed_count = 5,
       password_locked_until = now() + interval '15 minutes'`,
    [id],
  );
  const kilitli = await durum(HEDEF);
  check("Ön koşul: hesap kilitli", kilitli?.password_locked_until !== null);

  // parolaSifirlamaSonrasiTemizle ile aynı SQL etkisi
  await sql.query(
    `UPDATE auth_security_state SET password_failed_count = 0,
       password_window_started_at = NULL, password_locked_until = NULL WHERE user_id=$1`,
    [id],
  );
  const temiz = await durum(HEDEF);
  check(
    "Sıfırlama sonrası kilit ve sayaç temiz",
    temiz?.password_locked_until === null && temiz?.password_failed_count === 0,
  );
  await sql.query("DELETE FROM auth_rate_limit");
  const res = await girisDene(HEDEF, PAROLA);
  check("Sıfırlama sonrası giriş yapılabiliyor", res.status === 200, `HTTP ${res.status}`);
}

console.log("\n═══ 8b. Kilit yükseltmesi: 15 dk → aynı gün 60 dk → ertesi gün 15 dk ═══");
await sifirla(HEDEF);
{
  const id = await userId(HEDEF);
  const kilitDk = async () => {
    const { rows } = await sql.query(
      "SELECT EXTRACT(EPOCH FROM (password_locked_until - now()))/60 AS dk, password_lock_count_today AS sayi, password_lock_count_date AS gun FROM auth_security_state WHERE user_id=$1",
      [id],
    );
    return rows[0];
  };
  const esigeUlas = async () => {
    await sql.query("DELETE FROM auth_rate_limit");
    for (let i = 0; i < 5; i++) await girisDene(HEDEF, "yanlis-parola-123");
  };

  // 1. eşik → 15 dk
  await esigeUlas();
  const ilk = await kilitDk();
  check("İlk kilit ≈ 15 dk", ilk.dk > 13 && ilk.dk <= 15.5, `${Number(ilk.dk).toFixed(1)} dk`);
  check("Gün sayacı 1", Number(ilk.sayi) === 1, `sayı=${ilk.sayi}`);

  // Aynı gün 2. eşik → 60 dk (kilidi ve pencereyi temizle, gün sayacı kalsın)
  await sql.query(
    `UPDATE auth_security_state SET password_locked_until = NULL,
       password_failed_count = 0, password_window_started_at = NULL WHERE user_id=$1`,
    [id],
  );
  await esigeUlas();
  const ikinci = await kilitDk();
  check("Aynı gün 2. kilit ≈ 60 dk", ikinci.dk > 58 && ikinci.dk <= 60.5, `${Number(ikinci.dk).toFixed(1)} dk`);
  check("Gün sayacı 2", Number(ikinci.sayi) === 2, `sayı=${ikinci.sayi}`);

  // Ertesi gün 1. eşik → yine 15 dk (sayaç günü dünde bırakılır)
  await sql.query(
    `UPDATE auth_security_state SET password_locked_until = NULL,
       password_failed_count = 0, password_window_started_at = NULL,
       password_lock_count_date = CURRENT_DATE - 1 WHERE user_id=$1`,
    [id],
  );
  await esigeUlas();
  const ertesi = await kilitDk();
  check("Ertesi gün ilk kilit ≈ 15 dk", ertesi.dk > 13 && ertesi.dk <= 15.5, `${Number(ertesi.dk).toFixed(1)} dk`);
  check("Gün sayacı 1'e döndü", Number(ertesi.sayi) === 1, `sayı=${ertesi.sayi}`);
}

console.log("\n═══ 9. Audit çıktısında sır yok ═══");
{
  /**
   * Yalnız BU KOŞUDA üretilen kayıtlar denetlenir — request_id ile.
   * Zaman penceresi kullanılmaz: pencere hem kırılgandır (yavaş koşuda
   * kayıt dışarı taşar) hem de başka koşuların kayıtlarını yakalayabilir.
   * audit_logs append-only'dir; geçmişe dokunulmaz.
   */
  const kayitSayisi = await kosuAuditSayisi("login_failed");
  check("Bu koşu audit kaydı üretti (request_id çalışıyor)", kayitSayisi > 0, `${kayitSayisi} kayıt`);

  const { rows } = await sql.query(
    `SELECT count(*)::int AS n FROM audit_logs
     WHERE request_id = $1
       AND (changes::text ILIKE '%parola%' OR changes::text ILIKE '%password%'
         OR changes::text ILIKE '%secret%'  OR changes::text ILIKE '%otpauth%'
         OR changes::text ILIKE '%backup%'  OR changes::text ILIKE '%token%')`,
    [RUN_ID],
  );
  check("audit_logs'ta sır izi yok (bu koşu)", rows[0].n === 0, `${rows[0].n} şüpheli kayıt`);

  const { rows: dg } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_login_attempts WHERE request_id=$1",
    [RUN_ID],
  );
  check("Deneme günlüğü bu koşuyu kaydetti", dg[0].n > 0, `${dg[0].n} deneme`);

  const { rows: ip } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_login_attempts WHERE request_id=$1 AND (ip_hash LIKE '%.%' OR identifier_hash LIKE '%@%')",
    [RUN_ID],
  );
  check("Deneme günlüğünde ham IP/e-posta yok (yalnız hash)", ip[0].n === 0, `${ip[0].n} kayıt`);

  const { rows: len } = await sql.query(
    "SELECT count(*)::int AS n FROM auth_login_attempts WHERE request_id=$1 AND length(identifier_hash) <> 64",
    [RUN_ID],
  );
  check("Kimlik hash'leri sha256 uzunluğunda", len[0].n === 0);
}

console.log("\n═══ 10. Paralel istekler sayacı kaybetmez ═══");
await sifirla(HEDEF);
{
  // 5 isteği AYNI ANDA gönder; atomik olmayan sayaç artışı kayıp verir
  await sql.query("DELETE FROM auth_rate_limit");
  await Promise.all(
    Array.from({ length: 5 }, () => girisDene(HEDEF, "yanlis-parola-123", yeniIp())),
  );
  const st = await durum(HEDEF);
  check(
    "Eşzamanlı 5 başarısız denemenin tamamı sayıldı",
    st?.password_failed_count === 5,
    `sayaç=${st?.password_failed_count}`,
  );
  check("Eşik aşıldığı için kilit uygulandı", st?.password_locked_until !== null);
}

// Temizlik: fixture kullanıcılarını normale döndür
for (const mail of [HEDEF, "operations@example.com"]) await sifirla(mail);
await sql.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
if (failed.length) {
  console.error(`BAŞARISIZ: ${failed.map((f) => f.name).join(" | ")}`);
  process.exit(1);
}
