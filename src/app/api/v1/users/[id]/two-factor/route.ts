import { headers as gelenBasliklar } from "next/headers";
import { kritikIslemKapisi, rota, yonetenKullanici } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { buildRequestContext } from "@/lib/request-context";
import { ikiFaSifirla } from "@/lib/user-admin";

/**
 * DELETE /api/v1/users/[id]/two-factor — 2FA'yı sıfırlar (step-up ister).
 *
 * TOTP kaydı ve kurtarma kodları silinir; oturumlar ve step-up kayıtları da
 * düşer — ikinci faktörü sıfırlanmış kullanıcının o faktörle açılmış oturumu
 * geçerli kalmamalıdır.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await yonetenKullanici();
    const { id } = await params;

    await kritikIslemKapisi(user, "user.reset_two_factor");
    const sonuc = await ikiFaSifirla({ hedefUserId: id, aktorId: user.id });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user",
      varlikId: id,
      etiket: "İki aşamalı doğrulama sıfırlandı",
      // ⚠ TOTP sırrı veya kurtarma kodu buraya YAZILMAZ — yalnız sonuç
      degisiklikler: { dusenOturum: sonuc.dusenOturum },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, ...sonuc });
  });
}

export const dynamic = "force-dynamic";
