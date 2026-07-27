import { headers as gelenBasliklar } from "next/headers";
import {
  govdeOku,
  hataYanit,
  kritikIslemKapisi,
  rota,
  yazmaIstegiDogrula,
  yonetenKullanici,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { buildRequestContext } from "@/lib/request-context";
import { durumDegistir } from "@/lib/user-admin";

/**
 * PATCH /api/v1/users/[id]/status — aktif/pasif (step-up ister).
 *
 * Pasifleştirmede oturumlar ve step-up kayıtları AYNI transaction'da düşer.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await yonetenKullanici();
    const { id } = await params;
    const govde = await govdeOku<{ isActive?: unknown }>(request);

    if (typeof govde.isActive !== "boolean") {
      return hataYanit("VALIDATION", "isActive alanı boolean olmalıdır", 400);
    }
    await kritikIslemKapisi(user, "user.deactivate");

    const sonuc = await durumDegistir({
      hedefUserId: id,
      aktif: govde.isActive,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user",
      varlikId: id,
      etiket: govde.isActive ? "Kullanıcı aktifleştirildi" : "Kullanıcı pasifleştirildi",
      degisiklikler: { aktif: govde.isActive, dusenOturum: sonuc.dusenOturum },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, ...sonuc });
  });
}

export const dynamic = "force-dynamic";
