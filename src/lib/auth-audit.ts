import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { redact } from "@/lib/redact";

/**
 * Kimlik doğrulama olaylarının audit köprüsü — docs/02 §6.
 *
 * Better Auth kendi uçlarını yönetir; giriş/çıkış/başarısız giriş olaylarını
 * BİZ `audit_logs`'a yazarız (silinemez denetim izi, şema §14).
 *
 * ⚠ PRD §6.3: Bu fonksiyona giren hiçbir veri sır içermez. Gövde yine de
 * redact()'ten geçirilir — savunmanın ikinci katmanı.
 */

type AuthAuditAction = "login" | "login_failed" | "logout";

export interface AuthAuditInput {
  action: AuthAuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Ek bağlam — sırlar redact() ile temizlenir */
  context?: Record<string, unknown>;
}

const LABELS: Record<AuthAuditAction, string> = {
  login: "Giriş yapıldı",
  login_failed: "Başarısız giriş denemesi",
  logout: "Çıkış yapıldı",
};

export async function writeAuthAudit(input: AuthAuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: "auth",
      entityId: null,
      entityLabel: LABELS[input.action],
      changes: input.context ? redact(input.context) : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    // Audit yazımı giriş akışını ASLA bloke etmez; ama sessizce de kaybolmaz.
    console.error("Audit yazılamadı:", redact(err));
  }
}
