import { headers as gelenBasliklar } from "next/headers";
import { durumDegistirenIstek, oturumluKullanici, rota } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { buildRequestContext } from "@/lib/request-context";
import { digerOturumlariKapat, oturumlariListele } from "@/lib/session-admin";

/**
 * GET    /api/v1/sessions — KENDİ oturumları
 * DELETE /api/v1/sessions — mevcut oturum HARİÇ diğerlerini kapatır
 *
 * ⚠ Bu uçlar `userId` parametresi ALMAZ. Kullanıcı yalnız kendi oturumlarına
 * erişir; hedef her zaman oturumdan türetilir. Parametre kabul edilseydi,
 * yetki kontrolü unutulduğu anda herkes başkasının listesini okuyabilirdi.
 */

export async function GET() {
  return rota(async () => {
    const user = await oturumluKullanici();
    const sessions = await oturumlariListele(user.id, user.sessionId);
    return Response.json({ sessions });
  });
}

export async function DELETE(request: Request) {
  return rota(async () => {
    // Ortak kapı: Origin zorunlu, gövde varsa yalnız JSON (CSRF)
    await durumDegistirenIstek(request);
    const user = await oturumluKullanici();
    const sonuc = await digerOturumlariKapat({
      userId: user.id,
      korunacakSessionId: user.sessionId,
    });

    await yonetimAuditYaz({
      eylem: "delete",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user_session",
      varlikId: user.id,
      etiket: "Diğer tüm oturumlar kapatıldı",
      // ⚠ Token ve tam IP audit'e girmez — yalnız sayı
      degisiklikler: { dusenOturum: sonuc.dusenOturum },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ ok: true, ...sonuc });
  });
}

export const dynamic = "force-dynamic";
