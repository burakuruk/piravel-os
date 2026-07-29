import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirMarka,
  govdeOku,
  markaOkuyabilenKullanici,
  rota,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { yetkilileriListele, yetkiliEkle } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET  /api/v1/brands/:id/contacts — marka yetkilileri
 * POST /api/v1/brands/:id/contacts — yetkili ekler (SA/FIN/OPS🔷)
 *
 * ⚠ Yetkili bir SİSTEM KULLANICISI DEĞİLDİR: giriş yapmaz, davet almaz.
 * Yalnız marka tarafındaki iletişim kaydıdır.
 */

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    return Response.json({ contacts: await yetkilileriListele(id) });
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);

    const govde = await govdeOku<Record<string, unknown>>(request);
    const { id: contactId } = await yetkiliEkle({
      brandId: id,
      fullName: String(govde.fullName ?? ""),
      title: govde.title as string | null,
      email: govde.email as string | null,
      phone: govde.phone as string | null,
      isPrimary: govde.isPrimary === true,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "create",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand_contact",
      varlikId: contactId,
      etiket: "Marka yetkilisi eklendi",
      degisiklikler: { markaId: id, birincil: govde.isPrimary === true },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ contact: { id: contactId } }, { status: 201 });
  });
}

export const dynamic = "force-dynamic";
