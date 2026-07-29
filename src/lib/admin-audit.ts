import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { maskeliIp, redact } from "@/lib/redact";
import type { RequestContext } from "@/lib/request-context";

/**
 * Yönetim işlemlerinin audit köprüsü — şema §14, docs/02 §6.
 *
 * `audit_action` bir Postgres enum'ıdır ve genel fiiller taşır (create/update/
 * delete). İşlemin NE olduğu `entityType` + `entityLabel` + `changes` ile
 * anlatılır; her yeni işlem için enum'a değer eklemek migration gerektirirdi.
 *
 * ⚠ PRD §6.3: `changes` gövdesi redact()'ten geçer. Davet token'ı, parola ve
 * TOTP sırrı buraya ASLA girmez — girse bile maskelenir.
 */

export type YonetimEylemi = "create" | "update" | "delete" | "export";

export interface YonetimAuditGirdisi {
  eylem: YonetimEylemi;
  /** Kimliği bilinmeyen istekler için null — uydurma bir aktör yazılmaz. */
  aktor: { id: string; email: string } | null;
  varlikTuru:
    | "user"
    | "user_invitation"
    | "user_session"
    | "brand"
    | "brand_contact"
    | "brand_service"
    | "brand_assignment"
    | "service";
  varlikId?: string | null;
  etiket: string;
  degisiklikler?: Record<string, unknown>;
  rc: RequestContext;
}

export async function yonetimAuditYaz(girdi: YonetimAuditGirdisi): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: girdi.aktor?.id ?? null,
      actorEmail: girdi.aktor?.email ?? null,
      action: girdi.eylem,
      entityType: girdi.varlikTuru,
      entityId: girdi.varlikId ?? null,
      entityLabel: girdi.etiket,
      changes: girdi.degisiklikler ? redact(girdi.degisiklikler) : null,
      // ⚠ Tam IP denetim izine YAZILMAZ (PRD §6.3) — yalnız ağ öneki
      ipAddress: maskeliIp(girdi.rc.ipAddress),
      userAgent: girdi.rc.userAgent,
      requestId: girdi.rc.requestId,
      upstreamRequestId: girdi.rc.upstreamRequestId,
      testRunId: girdi.rc.testRunId,
    });
  } catch (err) {
    // Audit yazımı işlemi bloke etmez; ama sessizce de kaybolmaz.
    console.error("Yönetim audit'i yazılamadı:", redact(err));
  }
}
