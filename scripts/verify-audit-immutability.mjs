/**
 * audit_logs değiştirilemezliğini UYGULAMA ROLÜYLE doğrular (şema Karar 5).
 * CI'da her koşuda çalışır — koruma sessizce kaybolamaz.
 *
 * Beklenen:
 *   1. INSERT  → başarılı
 *   2. SELECT  → başarılı
 *   3. UPDATE  → reddedilir (rol yetkisi: permission denied)
 *   4. DELETE  → reddedilir (rol yetkisi: permission denied)
 *   5. TRUNCATE→ reddedilir
 *   6. Owner rolüyle UPDATE → trigger reddeder (ikinci katman)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(join(here, "..", ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* CI'da ortam değişkenleri */
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function expectDenied(client, label, query) {
  try {
    await client.query(query);
    check(label, false, "REDDEDİLMESİ gerekirken BAŞARILI oldu");
  } catch (err) {
    const msg = String(err.message);
    const denied = /permission denied|değiştirilemez|must be owner/i.test(msg);
    check(label, denied, msg.split("\n")[0]);
  }
}

// ── Uygulama rolü ──
const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
await app.connect();
try {
  await app.query(
    "INSERT INTO audit_logs (action, entity_type, entity_label) VALUES ('create','_verify','immutability testi')",
  );
  check("app rolü: INSERT başarılı", true);

  const { rows } = await app.query("SELECT count(*)::int AS n FROM audit_logs");
  check("app rolü: SELECT başarılı", rows[0].n >= 1, `${rows[0].n} kayıt`);

  await expectDenied(app, "app rolü: UPDATE reddedildi", "UPDATE audit_logs SET entity_type='x'");
  await expectDenied(app, "app rolü: DELETE reddedildi", "DELETE FROM audit_logs");
  await expectDenied(app, "app rolü: TRUNCATE reddedildi", "TRUNCATE audit_logs");
} finally {
  await app.end();
}

// ── Owner rolü: trigger ikinci katman olarak durdurmalı ──
const owner = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await owner.connect();
try {
  await expectDenied(
    owner,
    "owner rolü: UPDATE trigger tarafından reddedildi",
    "UPDATE audit_logs SET entity_type='x' WHERE entity_type='_verify'",
  );
  await expectDenied(
    owner,
    "owner rolü: DELETE trigger tarafından reddedildi",
    "DELETE FROM audit_logs WHERE entity_type='_verify'",
  );
} finally {
  await owner.end();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} kontrol BAŞARISIZ — audit koruması bozulmuş.`);
  process.exit(1);
}
console.log(`\n${results.length}/${results.length} kontrol geçti — audit_logs append-only.`);
