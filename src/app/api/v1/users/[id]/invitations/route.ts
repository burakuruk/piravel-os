import { eq } from "drizzle-orm";
import { headers as gelenBasliklar } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  durumDegistirenIstek,
  rota,
  uygulamaOrigin,
  yazmaIstegiDogrula,
  YOK,
  yonetenKullanici,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { acikDavetleriIptalEt, davetOlustur } from "@/lib/invitations";
import { buildRequestContext } from "@/lib/request-context";

/**
 * POST   /api/v1/users/[id]/invitations — daveti yeniden oluşturur
 * DELETE /api/v1/users/[id]/invitations — açık daveti iptal eder
 *
 * ⚠ Ham token YALNIZ POST yanıtında, BİR KEZ döner. Yeniden oluşturma, önceki
 * açık davetleri aynı transaction içinde iptal eder — eski bağlantı ve ona
 * bağlı çerez oturumu anında geçersizleşir.
 *
 * Davet üretimi step-up İSTEMEZ: kullanıcıyı zaten SA oluşturmuştur ve token
 * yalnız o kullanıcıyı aktive eder, yetki yükseltmez.
 */

async function hedefKullanici(id: string) {
  const rows = await db
    .select({ id: users.id, email: users.email, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await yonetenKullanici();
    const { id } = await params;

    const hedef = await hedefKullanici(id);
    if (!hedef) return YOK();

    const rc = buildRequestContext(await gelenBasliklar());
    const davet = await davetOlustur({
      userId: id,
      createdById: user.id,
      requestId: rc.requestId,
    });

    await yonetimAuditYaz({
      eylem: "create",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user_invitation",
      varlikId: id,
      etiket: `Davet yeniden oluşturuldu: ${hedef.email}`,
      degisiklikler: { davetSonGecerlilik: davet.expiresAt.toISOString() },
      rc,
    });

    return Response.json(
      {
        invitation: {
          token: davet.token,
          url: `${await uygulamaOrigin()}/davet/${davet.token}`,
          expiresAt: davet.expiresAt.toISOString(),
        },
      },
      { status: 201 },
    );
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await durumDegistirenIstek(request);
    const user = await yonetenKullanici();
    const { id } = await params;

    const hedef = await hedefKullanici(id);
    if (!hedef) return YOK();

    const iptalEdilen = await acikDavetleriIptalEt(db, id, user.id);

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user_invitation",
      varlikId: id,
      etiket: `Davet iptal edildi: ${hedef.email}`,
      degisiklikler: { iptalEdilen },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, iptalEdilen });
  });
}

export const dynamic = "force-dynamic";
