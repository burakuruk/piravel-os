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
import { markaYonetebilirMi, yetkiliGuncelle, yetkiliMarkasi, yetkiliSil } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * PATCH  /api/v1/contacts/:id — yetkili güncelle (SA/FIN/OPS🔷)
 * DELETE /api/v1/contacts/:id — soft delete (SA/FIN)
 *
 * Yol markayı taşımaz; kapsam kontrolü kaydın KENDİ markası üzerinden yapılır.
 * Kapsam dışıysa 404 — kaydın varlığı da sızdırılmaz.
 */

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;

    const brandId = await yetkiliMarkasi(id);
    if (!brandId) return YOK();
    await erisilebilirMarka(user, brandId);

    const govde = await govdeOku<Record<string, unknown>>(request);
    await yetkiliGuncelle({ contactId: id, govde, aktorId: user.id });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand_contact",
      varlikId: id,
      etiket: "Marka yetkilisi güncellendi",
      degisiklikler: { markaId: brandId, alanlar: Object.keys(govde) },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ contact: { id } });
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;

    const brandId = await yetkiliMarkasi(id);
    if (!brandId) return YOK();
    await erisilebilirMarka(user, brandId);

    // Silme OPS'a kapalı (docs/02 §3.1): kayıt tarihçesi finans tarafını da ilgilendirir
    if (!markaYonetebilirMi(user.role)) {
      return hataYanit("FORBIDDEN", "Bu işlem için yetkiniz yok", 403);
    }

    await yetkiliSil({ contactId: id, aktorId: user.id });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand_contact",
      varlikId: id,
      etiket: "Marka yetkilisi silindi",
      degisiklikler: { markaId: brandId },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true });
  });
}

export const dynamic = "force-dynamic";
