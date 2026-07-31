import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirSozlesme,
  govdeOku,
  kritikIslemKapisi,
  rota,
  sozlesmeYonetenKullanici,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { sozlesmeIptalEt } from "@/lib/contract-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * POST /api/v1/contracts/:id/cancel — sözleşmeyi iptal eder (SA/FIN)
 *
 * ⚠ TASLAK İPTALİ DÂHİL step-up ister. Numara verilmiş bir belge iz
 * bırakmadan yok edilmemeli; iptal de kalıcı bir kayıttır.
 *
 * `cancelReason` zorunludur (3-500, trim'li). `brand_services` dokunulmaz.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);
    await kritikIslemKapisi(user, "contract.cancel");

    const govde = await govdeOku<{ cancelReason?: unknown }>(request);
    const sonuc = await sozlesmeIptalEt({
      contractId: id,
      cancelReason: govde.cancelReason,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract",
      varlikId: id,
      etiket: `Sözleşme iptal edildi: ${sonuc.contractNo}`,
      degisiklikler: { durum: "cancelled", gerekce: sonuc.cancelReason },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({
      contract: { id: sonuc.id, contractNo: sonuc.contractNo, status: "cancelled" },
    });
  });
}

export const dynamic = "force-dynamic";
