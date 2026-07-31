import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirSozlesme,
  govdeOku,
  rota,
  sozlesmeYonetenKullanici,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import {
  kalemleriYaz,
  kalemToplami,
  sozlesmeDetayi,
  toplamOzeti,
  type KalemGirdisi,
} from "@/lib/contract-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * PUT /api/v1/contracts/:id/items — kapsam kalemlerini TOPLU yazar (SA/FIN)
 *
 * PUT semantiği: gönderilen liste yenisidir; eskiler soft delete edilir.
 *
 * Uyuşmazlık kaydı ENGELLEMEZ, `warnings[]` üretir — pazarlık sonucu toplam
 * ile kalemler tutmayabilir (§7a).
 */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);

    const govde = await govdeOku<{ items?: KalemGirdisi[] }>(request);
    const kalemler = Array.isArray(govde.items) ? govde.items : [];

    const sonuc = await kalemleriYaz({ contractId: id, kalemler, aktorId: user.id });

    // Uyuşmazlık uyarısı kaydetmeden SONRA hesaplanır: kullanıcı ne kaydettiyse
    // onun üzerinden konuşulmalı
    const contract = await sozlesmeDetayi(user, id);
    const c = (contract ?? {}) as Record<string, unknown>;
    const toplam = await kalemToplami(id);
    const ozet = toplamOzeti(
      toplam,
      Number(c.discountMinor ?? 0),
      Number(c.amountMinor ?? 0),
    );

    const warnings = [...sonuc.warnings];
    if (ozet.uyusmazlik) {
      warnings.push(
        "Kalemlerden beklenen net tutar, sözleşmeye yazılı tutardan farklı",
      );
    }

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract_item",
      varlikId: id,
      etiket: `Kapsam kalemleri güncellendi (${sonuc.adet} kalem)`,
      degisiklikler: { adet: sonuc.adet, uyusmazlik: ozet.uyusmazlik },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ adet: sonuc.adet, toplamlar: ozet, warnings });
  });
}

export const dynamic = "force-dynamic";
