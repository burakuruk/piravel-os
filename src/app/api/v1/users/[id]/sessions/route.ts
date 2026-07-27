import { headers as gelenBasliklar } from "next/headers";
import { kritikIslemKapisi, rota, yonetenKullanici } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { buildRequestContext } from "@/lib/request-context";
import { oturumlariIptalEt } from "@/lib/user-admin";

/**
 * DELETE /api/v1/users/[id]/sessions — başkasının tüm oturumlarını kapatır
 * (step-up ister).
 *
 * ⚠ Bu uç yalnız İPTAL eder; oturumların LİSTESİ dönmez. Bir yöneticinin
 * başkasının cihaz/tarayıcı geçmişini görmesi için meşru bir sebep yok
 * (docs/02 §5) — kullanıcı kendi listesini `/api/v1/sessions`'tan görür.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await yonetenKullanici();
    const { id } = await params;

    await kritikIslemKapisi(user, "user.revoke_all_sessions");
    const sonuc = await oturumlariIptalEt({ hedefUserId: id });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user_session",
      varlikId: id,
      etiket: "Kullanıcının tüm oturumları kapatıldı",
      degisiklikler: { dusenOturum: sonuc.dusenOturum },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, ...sonuc });
  });
}

export const dynamic = "force-dynamic";
