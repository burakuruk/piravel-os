/**
 * Şema yapısı doğrulaması — tablo, kısıt, index, trigger, eklenti.
 *
 * Migration'ın "hatasız koştu" demesi yeterli değildir: bir DROP INDEX sessizce
 * hiçbir şey düşürmemiş, bir FK yanlışlıkla CASCADE kalmış ya da bir CHECK hiç
 * eklenmemiş olabilir. Bu script ÜRETİLEN YAPIYA bakar.
 *
 * Temiz bir veritabanında da, mevcut veritabanında da aynı sonucu vermelidir.
 *
 * Kullanım: npm run verify:schema
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(join(here, "..", ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* .env yoksa ortam değişkenleri kullanılır (CI) */
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const sql = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await sql.connect();

// ═══════════════════════════════════════════════════════════════════════════
console.log("═══ 1. Migration geçmişi ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { rows } = await sql.query(
    "SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations",
  );
  check("11 migration uygulanmış (0000–0010)", rows[0].n === 11, `${rows[0].n} kayıt`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 2. Eklentiler ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { rows } = await sql.query("SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'");
  check(
    "pg_trgm kurulu (marka aramasının koşulu)",
    rows.length === 1,
    rows.length === 1 ? "" : "CREATE EXTENSION başarısız — dağıtım durdurulmalı",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 3. Sprint 2 tabloları ═══");
// ═══════════════════════════════════════════════════════════════════════════
const BEKLENEN_KOLONLAR = {
  brand_services: [
    "id", "brand_id", "service_id", "notes",
    "created_at", "created_by_id", "updated_at", "updated_by_id",
    "deleted_at", "deleted_by_id",
  ],
  brand_assignments: [
    "id", "brand_id", "user_id", "assigned_at", "notes",
    "created_at", "created_by_id", "updated_at", "updated_by_id",
    "deleted_at", "deleted_by_id",
  ],
};

for (const [tablo, beklenen] of Object.entries(BEKLENEN_KOLONLAR)) {
  const { rows } = await sql.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
    [tablo],
  );
  const adlar = rows.map((r) => r.column_name).sort();
  check(
    `${tablo} tablosu beklenen kolonlarla var`,
    beklenen.every((k) => adlar.includes(k)) && adlar.length === beklenen.length,
    adlar.join(","),
  );
  const id = rows.find((r) => r.column_name === "id");
  check(`${tablo}.id bağımsız UUID`, id?.data_type === "uuid", id?.data_type ?? "yok");
  const silme = rows.find((r) => r.column_name === "deleted_at");
  check(
    `${tablo} soft delete destekliyor`,
    silme?.data_type === "timestamp with time zone",
    silme?.data_type ?? "yok",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 4. Yabancı anahtarlar — RESTRICT (CASCADE değil) ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const beklenen = {
    fk_brand_services_brand: "brands",
    fk_brand_services_service: "services",
    fk_brand_assignments_brand: "brands",
    fk_brand_assignments_user: "users",
  };
  const { rows } = await sql.query(
    `SELECT c.conname, c.confdeltype, t.relname AS hedef
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.confrelid
      WHERE c.conname = ANY($1)`,
    [Object.keys(beklenen)],
  );
  check("Dört FK de tanımlı", rows.length === 4, `${rows.length}`);
  for (const r of rows) {
    check(
      `${r.conname} → ${r.hedef} RESTRICT`,
      r.confdeltype === "r" && r.hedef === beklenen[r.conname],
      `confdeltype=${r.confdeltype}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 5. Index'ler ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { rows } = await sql.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'");
  const bul = (ad) => rows.find((r) => r.indexname === ad);

  for (const ad of ["uq_brand_service_live", "uq_brand_assignment_live"]) {
    const idx = bul(ad);
    check(
      `${ad} partial unique (yalnız deleted_at IS NULL)`,
      Boolean(idx) && /UNIQUE/i.test(idx.indexdef) && /deleted_at IS NULL/i.test(idx.indexdef),
      idx?.indexdef ?? "yok",
    );
  }

  for (const ad of ["uq_brands_code", "uq_services_code"]) {
    const idx = bul(ad);
    check(
      `${ad} case-insensitive (upper(code)) ve partial`,
      Boolean(idx) && /upper/i.test(idx.indexdef) && /deleted_at IS NULL/i.test(idx.indexdef),
      idx?.indexdef ?? "yok",
    );
  }

  for (const ad of ["idx_brands_name_trgm", "idx_brands_code_trgm"]) {
    const idx = bul(ad);
    check(
      `${ad} trigram GIN indeksi`,
      Boolean(idx) && /gin/i.test(idx.indexdef) && /trgm/i.test(idx.indexdef),
      idx?.indexdef ?? "yok",
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 6. CHECK kısıtları ve trigger'lar ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { rows } = await sql.query(
    `SELECT conname, pg_get_constraintdef(oid) AS tanim FROM pg_constraint
      WHERE conname IN ('chk_brands_code_normalized','chk_services_code_normalized')`,
  );
  check("İki kod normalizasyon CHECK'i var", rows.length === 2, `${rows.length}`);
  for (const r of rows) {
    check(
      `${r.conname} upper+btrim zorunlu kılıyor`,
      /upper/i.test(r.tanim) && /btrim/i.test(r.tanim),
      r.tanim.slice(0, 70),
    );
  }

  const trg = await sql.query(
    `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
       ('trg_brands_code_immutable','trg_touch_brand_services','trg_touch_brand_assignments')`,
  );
  const adlar = trg.rows.map((r) => r.tgname);
  check("Marka kodu kilidi trigger'ı kurulu", adlar.includes("trg_brands_code_immutable"));
  check(
    "İki yeni tabloda updated_at trigger'ı var",
    adlar.includes("trg_touch_brand_services") && adlar.includes("trg_touch_brand_assignments"),
    adlar.join(","),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 7. Kuralların canlı davranışı ═══");
// ═══════════════════════════════════════════════════════════════════════════
{
  const kod = `ZZ${Date.now().toString(36).slice(-5).toUpperCase()}`;
  await sql.query("INSERT INTO brands (code, name) VALUES ($1, $2)", [kod, "Şema Doğrulama"]);

  let kucukHarf = false;
  try {
    await sql.query("INSERT INTO brands (code, name) VALUES ($1, $2)", [kod.toLowerCase(), "x"]);
  } catch (e) {
    kucukHarf = e.code === "23514" || e.code === "23505";
  }
  check("Normalize edilmemiş/çakışan kod DB'de reddediliyor", kucukHarf);

  let kilit = false;
  try {
    await sql.query("UPDATE brands SET code = 'ZZDEGISTI' WHERE code = $1", [kod]);
  } catch (e) {
    kilit = /değiştirilemez/i.test(e.message);
  }
  check("Marka kodu DB'de değiştirilemiyor", kilit);

  // Soft delete edilmiş kayıt yeniden eklenebilmeli (partial unique)
  const { rows: marka } = await sql.query("SELECT id FROM brands WHERE code = $1", [kod]);
  const { rows: hizmet } = await sql.query(
    "INSERT INTO services (code, name, category) VALUES ($1, $2, 'genel') RETURNING id",
    [`ZS${Date.now().toString(36).slice(-5).toUpperCase()}`, "Şema Hizmeti"],
  );
  await sql.query("INSERT INTO brand_services (brand_id, service_id) VALUES ($1, $2)", [
    marka[0].id,
    hizmet[0].id,
  ]);
  await sql.query(
    "UPDATE brand_services SET deleted_at = now() WHERE brand_id = $1 AND service_id = $2",
    [marka[0].id, hizmet[0].id],
  );
  let yeniden = true;
  try {
    await sql.query("INSERT INTO brand_services (brand_id, service_id) VALUES ($1, $2)", [
      marka[0].id,
      hizmet[0].id,
    ]);
  } catch {
    yeniden = false;
  }
  check("Soft delete sonrası aynı ilişki yeniden eklenebiliyor", yeniden);

  let ikiCanli = false;
  try {
    await sql.query("INSERT INTO brand_services (brand_id, service_id) VALUES ($1, $2)", [
      marka[0].id,
      hizmet[0].id,
    ]);
  } catch (e) {
    ikiCanli = e.code === "23505";
  }
  check("İki CANLI kopya engelleniyor (partial unique)", ikiCanli);

  let restrict = false;
  try {
    await sql.query("DELETE FROM brands WHERE id = $1", [marka[0].id]);
  } catch (e) {
    restrict = e.code === "23503";
  }
  check("Bağlı kaydı olan marka fiziksel silinemiyor (RESTRICT)", restrict);

  // Temizlik
  await sql.query("DELETE FROM brand_services WHERE brand_id = $1", [marka[0].id]);
  await sql.query("DELETE FROM brands WHERE id = $1", [marka[0].id]);
  await sql.query("DELETE FROM services WHERE id = $1", [hizmet[0].id]);
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
