import { headers as gelenBasliklar } from "next/headers";
import {
  atamaYonetenKullanici,
  erisilebilirMarka,
  govdeOku,
  kritikIslemKapisi,
  markaOkuyabilenKullanici,
  rota,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { atamaEkle, atamaKaldir, atamalariListele } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET    /api/v1/brands/:id/assignments — sorumlu ekip listesi (kapsam içi herkes)
 * POST   /api/v1/brands/:id/assignments — kullanıcı atar    (YALNIZ SA)
 * DELETE /api/v1/brands/:id/assignments — atamayı kaldırır  (YALNIZ SA)
 *
 * ⚠ Atama bir YETKİ SINIRIDIR: kaldırıldığı anda OPS kullanıcısı markayı ve
 * ona bağlı kayıtları göremez — kapsam her istekte yeniden hesaplanır, açık
 * sekmede de bir sonraki istekte erişim kesilir. Bu yüzden yazma uçları
 * yalnız SA'ya açıktır, diğer roller 404 görür ve her iki işlem de STEP-UP
 * ister: yetki devri, açık bırakılmış bir ekranın başındaki biri tarafından
 * yapılabilecek bir şey olmamalı.
 *
 * Yalnız OPS atanabilir; SA/FIN rolleri gereği zaten tüm markaları görür ve
 * listede "atanmış" görünmeleri yetki tablosunu yanıltırdı.
 */

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    return Response.json({ assignments: await atamalariListele(id) });
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await atamaYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    await kritikIslemKapisi(user, "brand.assignment_change");

    const govde = await govdeOku<{ userId?: string }>(request);
    const sonuc = await atamaEkle({
      brandId: id,
      userId: String(govde.userId ?? ""),
      aktorId: user.id,
    });

    if (sonuc.yeni) {
      await yonetimAuditYaz({
        eylem: "create",
        aktor: { id: user.id, email: user.email },
        varlikTuru: "brand_assignment",
        varlikId: sonuc.id,
        etiket: "Markaya kullanıcı atandı",
        degisiklikler: { markaId: id, kullaniciId: govde.userId },
        rc: buildRequestContext(await gelenBasliklar()),
      });
    }

    return Response.json({ assignment: sonuc }, { status: sonuc.yeni ? 201 : 200 });
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await atamaYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);
    await kritikIslemKapisi(user, "brand.assignment_change");

    const govde = await govdeOku<{ userId?: string }>(request);
    const sonuc = await atamaKaldir({
      brandId: id,
      userId: String(govde.userId ?? ""),
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand_assignment",
      varlikId: sonuc.id,
      etiket: "Marka ataması kaldırıldı",
      degisiklikler: { markaId: id, kullaniciId: govde.userId },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true });
  });
}

export const dynamic = "force-dynamic";
