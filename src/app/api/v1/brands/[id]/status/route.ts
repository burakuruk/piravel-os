import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirMarka,
  govdeOku,
  kritikIslemKapisi,
  markaYonetenKullanici,
  rota,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { markaDurumDegistir } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * POST /api/v1/brands/:id/status — yaşam döngüsü değişimi (SA/FIN)
 *
 * Durum değişimi OPS'a kapalıdır: pasifleştirme faturalama ve sözleşme
 * tarafını etkiler. Aynı sebeple STEP-UP ister — markayı pasife almak geri
 * dönüşü olan ama sonuçları anında yayılan bir karardır.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    await kritikIslemKapisi(user, "brand.status_change");

    const govde = await govdeOku<{ status?: string }>(request);
    const sonuc = await markaDurumDegistir({
      brandId: id,
      status: String(govde.status ?? ""),
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand",
      varlikId: id,
      etiket: `Marka durumu: ${sonuc.status}`,
      degisiklikler: { durum: sonuc.status },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ brand: sonuc });
  });
}

export const dynamic = "force-dynamic";
