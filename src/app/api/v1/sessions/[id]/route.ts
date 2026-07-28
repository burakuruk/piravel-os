import { headers as gelenBasliklar } from "next/headers";
import { durumDegistirenIstek, hataYanit, oturumluKullanici, rota, YOK } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { buildRequestContext } from "@/lib/request-context";
import { oturumuKapat } from "@/lib/session-admin";

/**
 * DELETE /api/v1/sessions/[id] — tek oturumu kapatır (yalnız kendi oturumu).
 *
 * Mevcut oturum kapatılabilir; bu durumda yanıt `kendiniKapatti: true` döner
 * ve istemci kullanıcıyı çıkış ekranına yönlendirir.
 *
 * ⚠ Tekrar çalıştırılabilir: zaten kapatılmış bir oturumu kapatmak 404 döner
 * ve hiçbir yan etki üretmez. Bu, iki paralel iptal isteğinin ikisinin de
 * güvenli sonuçlanmasını sağlar.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return rota(async () => {
    await durumDegistirenIstek(request);
    const user = await oturumluKullanici();
    const { id } = await params;

    if (typeof id !== "string" || id.length === 0 || id.length > 128) {
      return hataYanit("VALIDATION", "Geçersiz oturum kimliği", 400);
    }

    const kendiniKapatti = id === user.sessionId;
    const sonuc = await oturumuKapat({ userId: user.id, sessionId: id });

    /**
     * Sahibi olmayan ya da zaten kapatılmış oturum: aynı 404. "Senin değil"
     * demek, o kimliğin var olduğunu doğrulayan bir oracle olurdu.
     */
    if (!sonuc.kapatildi) return YOK();

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user_session",
      varlikId: user.id,
      etiket: kendiniKapatti ? "Mevcut oturum kapatıldı" : "Bir oturum kapatıldı",
      // ⚠ Oturum token'ı ve tam IP audit'e girmez
      degisiklikler: { kendiniKapatti },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, kendiniKapatti });
  });
}

export const dynamic = "force-dynamic";
