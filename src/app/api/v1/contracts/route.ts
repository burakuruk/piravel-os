import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirMarka,
  govdeOku,
  rota,
  sozlesmeOkuyabilenKullanici,
  sozlesmeYonetenKullanici,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import {
  sozlesmeleriSayfali,
  sozlesmeOlustur,
  type SozlesmeFiltresi,
  type YeniSozlesme,
} from "@/lib/contract-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET /api/v1/contracts — liste (SA/FIN tam, OPS kapsam + finanssız)
 *
 * ⚠ OPS'un yanıtında tutar alanları ANAHTAR OLARAK BİLE YOKTUR: süzgeç
 * uygulanmaz, kolonlar sorguya hiç girmez (contract-admin §5a).
 */
export async function GET(request: Request) {
  return rota(async () => {
    const user = await sozlesmeOkuyabilenKullanici();
    const url = new URL(request.url);

    const filtre: SozlesmeFiltresi = {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      brandId: url.searchParams.get("brandId") ?? undefined,
      expiringWithin: url.searchParams.has("expiringWithin")
        ? Number(url.searchParams.get("expiringWithin"))
        : undefined,
    };
    const sayfa = Number(url.searchParams.get("sayfa") ?? "1");

    const sonuc = await sozlesmeleriSayfali(user, filtre, sayfa);
    return Response.json(sonuc);
  });
}

/**
 * POST /api/v1/contracts — taslak oluşturur (SA/FIN)
 *
 * ⚠ `amountBasis` ZORUNLUDUR. Gönderilmezse `VALIDATION` döner; sunucu eksik
 * alanı sessizce "dönemlik" saymaz — tutarın anlamı tahmin edilecek bir şey
 * değildir.
 */
export async function POST(request: Request) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeYonetenKullanici();
    const govde = await govdeOku<Record<string, unknown>>(request);

    // Marka kapsamı: kullanıcı göremediği bir markaya sözleşme yazamaz
    const brandId = String(govde.brandId ?? "");
    if (brandId) await erisilebilirMarka(user, brandId);

    const sonuc = await sozlesmeOlustur({
      ...(govde as unknown as YeniSozlesme),
      brandId,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "create",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract",
      varlikId: sonuc.id,
      etiket: `Sözleşme oluşturuldu: ${sonuc.contractNo}`,
      degisiklikler: { markaId: brandId, contractNo: sonuc.contractNo },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ contract: sonuc }, { status: 201 });
  });
}

export const dynamic = "force-dynamic";
