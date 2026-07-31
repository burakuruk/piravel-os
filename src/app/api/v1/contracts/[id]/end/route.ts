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
import { sozlesmeSonlandir } from "@/lib/contract-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * POST /api/v1/contracts/:id/end — sözleşmeyi sonlandırır (SA/FIN)
 *
 * STEP-UP ister; `endReason` zorunludur (3-500 karakter, trim'li). Aylar sonra
 * "neden bitti" sorusunun tek cevabı bu alan olacak.
 *
 * ⚠ `brand_services` DOKUNULMAZ: marka o hizmeti başka bir sözleşmeyle alıyor
 * ya da operasyonel olarak kullanıyor olabilir.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);
    await kritikIslemKapisi(user, "contract.end");

    const govde = await govdeOku<{ endReason?: unknown }>(request);
    const sonuc = await sozlesmeSonlandir({
      contractId: id,
      endReason: govde.endReason,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract",
      varlikId: id,
      etiket: `Sözleşme sonlandırıldı: ${sonuc.contractNo}`,
      degisiklikler: { durum: "ended", gerekce: sonuc.endReason },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({
      contract: { id: sonuc.id, contractNo: sonuc.contractNo, status: "ended" },
    });
  });
}

export const dynamic = "force-dynamic";
