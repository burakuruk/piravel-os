import { bigint, char, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { newId } from "@/lib/ids";

/** UUID v7 birincil anahtar — uygulama katmanında üretilir (şema Karar 6). */
export const idCol = () => uuid("id").primaryKey().$defaultFn(newId);

/**
 * Ortak denetim sütunları (şema §16).
 * Not: created_by/updated_by/deleted_by kolonlarına DB seviyesinde FK konmadı
 * (Drizzle'da döngüsel referans sadeleştirmesi); bütünlük uygulama katmanında,
 * izlenebilirlik audit_logs'ta korunur.
 */
export const auditCols = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdById: uuid("created_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid("updated_by_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedById: uuid("deleted_by_id"),
};

// PARA — 4 kolon kuralı (şema Karar 1) her tabloda açıkça yazılır:
// amount_minor (bigint) + currency_code + fx_rate + amount_base_minor.
// Tip güvenliği için dinamik kolon üretimi kullanılmaz.
export { bigint, char, numeric };
