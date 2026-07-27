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
import { gecerliRolMu, rolDegistir } from "@/lib/user-admin";

/**
 * PATCH /api/v1/users/[id]/role — rol değişimi (step-up ister).
 *
 * Başarılı olursa hedefin TÜM oturumları düşer: yetki değişimi bir güvenlik
 * sınırıdır ve eski rolle alınmış step-up kayıtları yeni role taşınmamalıdır.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await yonetenKullanici();
    const { id } = await params;
    const govde = await govdeOku<{ role?: string }>(request);

    if (!gecerliRolMu(govde.role)) {
      return hataYanit("VALIDATION", "Geçersiz rol", 400);
    }
    await kritikIslemKapisi(user, "user.role_change");

    const sonuc = await rolDegistir({
      hedefUserId: id,
      yeniRol: govde.role,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user",
      varlikId: id,
      etiket: "Kullanıcı rolü değiştirildi",
      degisiklikler: {
        eskiRol: sonuc.eskiRol,
        yeniRol: sonuc.yeniRol,
        dusenOturum: sonuc.dusenOturum,
      },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, ...sonuc });
  });
}

export const dynamic = "force-dynamic";
