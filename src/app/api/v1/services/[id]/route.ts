import { headers as gelenBasliklar } from "next/headers";
import { govdeOku, hizmetYonetenKullanici, rota, yazmaIstegiDogrula } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { hizmetGuncelle } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * PATCH /api/v1/services/:id — hizmeti günceller veya PASİFLEŞTİRİR (SA/FIN)
 *
 * ⚠ DELETE ucu YOKTUR ve bilerek yoktur: hizmet silinmez, `isActive=false`
 * ile pasifleştirilir. Geçmiş sözleşmeler ve faturalar ona referans verecek;
 * silinirse tarihsel kayıtlar anlamını yitirir. Pasif hizmet yeni markalara
 * atanamaz, mevcut atamalar korunur.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await hizmetYonetenKullanici();
    const { id } = await ctx.params;
    const govde = await govdeOku<Record<string, unknown>>(request);

    const sonuc = await hizmetGuncelle({ serviceId: id, govde, aktorId: user.id });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "service",
      varlikId: id,
      etiket:
        govde.isActive === false ? "Hizmet pasifleştirildi" : "Hizmet güncellendi",
      degisiklikler: { alanlar: sonuc.degisenAlanlar },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ service: { id } });
  });
}

export const dynamic = "force-dynamic";
