import { isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Soft delete altyapısı — şema Karar 4 + uygulama kuralı §20.7:
 * Tüm sorgular varsayılan olarak deleted_at IS NULL filtresi uygular.
 * Finansal kayıtlar ASLA fiziksel silinmez.
 */

/** Standart canlı kayıt filtresi: her listede zorunlu. */
export function notDeleted(deletedAtCol: PgColumn): SQL {
  return isNull(deletedAtCol);
}

/** Soft delete değerleri — update ile birlikte kullanılır. */
export function softDeleteValues(actorId: string) {
  return { deletedAt: sql`now()`, deletedById: actorId };
}

/** Geri yükleme değerleri (şema §15: üst kaydın canlı olduğu app katmanında doğrulanır). */
export function restoreValues(actorId: string) {
  return { deletedAt: null, deletedById: null, updatedById: actorId };
}
