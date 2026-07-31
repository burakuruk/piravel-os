import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirSozlesme,
  govdeOku,
  rota,
  sozlesmeOkuyabilenKullanici,
  sozlesmeSilenKullanici,
  sozlesmeYonetenKullanici,
  yazmaIstegiDogrula,
  YOK,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import {
  brutHesapla,
  finansGorebilirMi,
  kalemleriListele,
  kalemToplami,
  sozlesmeDetayi,
  sozlesmeGuncelle,
  sozlesmeSil,
  toplamOzeti,
} from "@/lib/contract-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET /api/v1/contracts/:id — detay + kalemler
 *
 * OPS için finansal alanlar sorguya hiç girmez; `toplamlar` bloğu da yalnız
 * finans görebilen roller için hesaplanır.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await sozlesmeOkuyabilenKullanici();
    const { id } = await ctx.params;

    const contract = await sozlesmeDetayi(user, id);
    if (!contract) return YOK();

    const items = await kalemleriListele(id, user.role);

    if (!finansGorebilirMi(user.role)) {
      return Response.json({ contract, items });
    }

    const c = contract as Record<string, unknown>;
    const amountMinor = Number(c.amountMinor);
    const vatRate = Number(c.vatRate);
    const toplam = await kalemToplami(id);

    return Response.json({
      contract: {
        ...c,
        // Brüt HESAPLANIR, saklanmaz (§7b)
        grossAmountMinor: brutHesapla(amountMinor, vatRate),
      },
      items,
      toplamlar: toplamOzeti(toplam, Number(c.discountMinor ?? 0), amountMinor),
    });
  });
}

/**
 * PATCH /api/v1/contracts/:id — duruma göre alan kilidiyle günceller (SA/FIN)
 *
 * Kilitli alan gövdede gelirse sessizce yutulmaz: 422 `CONTRACT_LOCKED`.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);

    const govde = await govdeOku<Record<string, unknown>>(request);
    const sonuc = await sozlesmeGuncelle({ contractId: id, govde, aktorId: user.id });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract",
      varlikId: id,
      etiket: "Sözleşme güncellendi",
      degisiklikler: { alanlar: sonuc.degisenAlanlar },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ contract: sonuc });
  });
}

/**
 * DELETE /api/v1/contracts/:id — YALNIZ taslak, yalnız SA
 *
 * Soft delete: satır durur, numara serbest bırakılmaz.
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeSilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);

    const sonuc = await sozlesmeSil({ contractId: id, aktorId: user.id });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract",
      varlikId: id,
      etiket: `Taslak sözleşme silindi: ${sonuc.contractNo}`,
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ contract: sonuc });
  });
}

export const dynamic = "force-dynamic";
