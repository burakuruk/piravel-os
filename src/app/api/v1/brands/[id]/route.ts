import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirMarka,
  govdeOku,
  hataYanit,
  markaOkuyabilenKullanici,
  rota,
  YOK,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { markaDetayi, markaGuncelle, markaYonetebilirMi } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET   /api/v1/brands/:id — detay (kapsam + alan süzgeci)
 * PATCH /api/v1/brands/:id — güncelle
 *
 * OPS yalnız ATANDIĞI markayı görür ve yalnız OPERASYONEL alanları düzenler;
 * vergi alanları ne yanıta girer ne de güncellenebilir.
 */

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    const brand = await markaDetayi(user, id);
    // Kapsam dışı marka "yok"tur — varlığı sızdırılmaz
    if (!brand) return YOK();
    return Response.json({ brand });
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;

    /**
     * Önce KAPSAM, sonra yetki: kapsam dışı bir markada OPS'a 403 dönmek,
     * o markanın var olduğunu söylerdi.
     */
    await erisilebilirMarka(user, id);
    if (!markaYonetebilirMi(user.role) && user.role !== "operations") {
      return hataYanit("FORBIDDEN", "Bu işlem için yetkiniz yok", 403);
    }

    const govde = await govdeOku<Record<string, unknown>>(request);
    const sonuc = await markaGuncelle({
      brandId: id,
      govde,
      role: user.role,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand",
      varlikId: id,
      etiket: "Marka güncellendi",
      degisiklikler: { alanlar: sonuc.degisenAlanlar },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ brand: await markaDetayi(user, id) });
  });
}

export const dynamic = "force-dynamic";
