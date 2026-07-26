/**
 * Uygulama DB rolünü (piravel_app) oluşturur ve yetkilerini uygular.
 * OWNER/ADMIN bağlantısıyla çalışır — DATABASE_ADMIN_URL.
 *
 * Kullanım: npm run db:roles
 * İdempotenttir.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

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

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  console.error("HATA: DATABASE_ADMIN_URL tanımlı değil (owner bağlantısı gerekir).");
  process.exit(1);
}

const password = process.env.APP_DB_PASSWORD ?? "piravel_app";
// SQL enjeksiyonuna karşı: parola yalnızca güvenli karakterler içerebilir
if (!/^[A-Za-z0-9._~!#%^*+=-]{8,128}$/.test(password)) {
  console.error(
    "HATA: APP_DB_PASSWORD 8-128 karakter olmalı ve tırnak/boşluk içermemelidir.",
  );
  process.exit(1);
}

const sql = readFileSync(join(here, "setup-db-roles.sql"), "utf8").replaceAll(
  ":'app_password'",
  `'${password}'`,
);

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  await client.query(sql);
  console.log("✓ piravel_app rolü ve yetkileri uygulandı");
  console.log("  · iş tabloları: SELECT/INSERT/UPDATE/DELETE");
  console.log("  · audit_logs  : yalnız INSERT + SELECT (UPDATE/DELETE/TRUNCATE yok)");
} finally {
  await client.end();
}
