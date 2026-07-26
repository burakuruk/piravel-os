import { auditLogs } from "./schema";
import type { auditAction } from "./schema";

/**
 * Audit altyapısı — şema §14 + uygulama kuralı §20.6:
 * Audit kaydı, iş işlemiyle AYNI DB transaction'ında yazılır.
 * audit_logs append-only'dir (DB trigger'ı korur).
 */

type AuditActionType = (typeof auditAction.enumValues)[number];

export interface AuditContext {
  actorId: string | null;
  actorEmail: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditEntry {
  action: AuditActionType;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  /** Yalnızca değişen alanlar: { alan: { old, new } } */
  changes?: Record<string, { old: unknown; new: unknown }>;
}

/** Drizzle transaction nesnesi (db.transaction callback parametresi) ile çağrılır. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAudit(tx: any, ctx: AuditContext, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: ctx.actorId,
    actorEmail: ctx.actorEmail,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    entityLabel: entry.entityLabel ?? null,
    changes: entry.changes ?? null,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    requestId: ctx.requestId ?? null,
  });
}

/**
 * İki kayıt arasındaki farkı audit formatına çevirir.
 * Yalnızca değişen alanlar döner; audit sütunları (updated_at vb.) atlanır.
 */
const IGNORED_KEYS = new Set(["updatedAt", "updatedById", "createdAt", "createdById"]);

export function diffForAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (IGNORED_KEYS.has(key)) continue;
    const oldVal = before[key];
    const newVal = after[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }
  return changes;
}
