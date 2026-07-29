import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirMarka,
  govdeOku,
  hataYanit,
  markaOkuyabilenKullanici,
  rota,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import {
  markadanHizmetCikar,
  markaHizmetBagiYonetebilirMi,
  markaHizmetleri,
  markayaHizmetEkle,
} from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET    /api/v1/brands/:id/services — markanın aldığı hizmetler
 * POST   /api/v1/brands/:id/services — hizmet ekler   (gövde: serviceId)
 * DELETE /api/v1/brands/:id/services — hizmet çıkarır (gövde: serviceId)
 *
 * Hizmet TÜRÜ burada oluşturulmaz; yalnız katalogdan seçilir — katalog SA'nın
 * işidir. Markaya MEVCUT bir hizmeti bağlamak ise günlük operasyondur:
 * SA ve FIN tüm markalarda, OPS yalnız ATANDIĞI markalarda yapabilir
 * (kapsam `erisilebilirMarka` ile zorlanır), MEM erişemez.
 */

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    return Response.json({ services: await markaHizmetleri(id, user.role) });
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    if (!markaHizmetBagiYonetebilirMi(user.role)) {
      return hataYanit("FORBIDDEN", "Bu işlem için yetkiniz yok", 403);
    }

    const govde = await govdeOku<{ serviceId?: string }>(request);
    const sonuc = await markayaHizmetEkle({
      brandId: id,
      serviceId: String(govde.serviceId ?? ""),
      aktorId: user.id,
    });

    if (sonuc.yeni) {
      await yonetimAuditYaz({
        eylem: "create",
        aktor: { id: user.id, email: user.email },
        varlikTuru: "brand_service",
        varlikId: sonuc.id,
        etiket: "Markaya hizmet eklendi",
        degisiklikler: { markaId: id, hizmetId: govde.serviceId },
        rc: buildRequestContext(await gelenBasliklar()),
      });
    }

    return Response.json({ brandService: sonuc }, { status: sonuc.yeni ? 201 : 200 });
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    if (!markaHizmetBagiYonetebilirMi(user.role)) {
      return hataYanit("FORBIDDEN", "Bu işlem için yetkiniz yok", 403);
    }

    const govde = await govdeOku<{ serviceId?: string }>(request);
    const sonuc = await markadanHizmetCikar({
      brandId: id,
      serviceId: String(govde.serviceId ?? ""),
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand_service",
      varlikId: sonuc.id,
      etiket: "Markadan hizmet çıkarıldı",
      degisiklikler: { markaId: id, hizmetId: govde.serviceId },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true });
  });
}

export const dynamic = "force-dynamic";
