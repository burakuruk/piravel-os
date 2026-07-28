import { cookies, headers as gelenBasliklar } from "next/headers";
import { govdeOku, rota, yazmaIstegiDogrula } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { auth } from "@/lib/auth";
import { MESAJ } from "@/lib/auth-messages";
import { isTwoFactorRequired, type UserRole } from "@/lib/auth-policy";
import { hizSiniri } from "@/lib/rate-limit";
import { davetCereziSil } from "@/lib/davet-cerez";
import {
  DavetKullanilamaz,
  DAVET_CEREZ_ADI,
  DAVET_HATA_KODU,
  DAVET_HATA_MESAJI,
  davetiKabulEt,
} from "@/lib/invitations";
import { buildRequestContext } from "@/lib/request-context";

/**
 * POST /api/v1/davet/kabul — daveti kabul eder ve parolayı belirler.
 *
 * ⚠ TEK TİP YANIT: geçersiz, süresi dolmuş, iptal edilmiş ve daha önce
 * kullanılmış davetlerin HEPSİ aynı kodu ve aynı mesajı alır. Aksi hâlde
 * bağlantı bir varlık/durum oracle'ına dönüşür — saldırgan hangi token'ın
 * gerçek olduğunu yanıt farkından anlayabilirdi. Gerçek sebep yalnız
 * `audit_logs` bağlamına yazılır.
 *
 * Sertleştirme: Origin + Content-Type (yazmaIstegiDogrula) · HttpOnly çerez ·
 * ikinci POST hiçbir yeni etki üretmez (idempotent).
 */
export async function POST(request: Request) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const rc = buildRequestContext(await gelenBasliklar());

    /**
     * ⚠ Hız sınırı, davet HİÇ ARANMADAN önce uygulanır.
     *
     * Sıra önemlidir: önce davet aransaydı, geçerli ve geçersiz token'lar
     * farklı zamanlarda sınıra takılır ve yanıt süresi bir varlık oracle'ı
     * üretirdi. Sayaç yalnız IP'ye bakar; hangi davetin denendiğini bilmez.
     */
    const hiz = await hizSiniri({
      kapsam: "invite_accept",
      ip: rc.ipAddress,
      limit: 5,
      pencereSn: 60,
    });
    if (!hiz.izinli) {
      return Response.json(
        { error: { code: "TOO_MANY_REQUESTS", message: MESAJ.cokFazlaDeneme } },
        {
          status: 429,
          headers: {
            "Retry-After": String(hiz.yenidenDeneSn),
            "Referrer-Policy": "no-referrer",
          },
        },
      );
    }

    const cerezDeposu = await cookies();
    const cerezKimligi = cerezDeposu.get(DAVET_CEREZ_ADI)?.value ?? "";
    const govde = await govdeOku<{ password?: string }>(request);

    try {
      const kripto = (await auth.$context).password;
      const sonuc = await davetiKabulEt({
        cerezKimligi,
        parola: typeof govde.password === "string" ? govde.password : "",
        // Better Auth'un KENDİ hash mekanizması; elle hash yazılmaz
        parolaHashle: (p) => kripto.hash(p),
        requestId: rc.requestId,
      });

      await yonetimAuditYaz({
        eylem: "update",
        aktor: { id: sonuc.userId, email: sonuc.email },
        varlikTuru: "user",
        varlikId: sonuc.userId,
        etiket: "Davet kabul edildi ve hesap aktifleştirildi",
        // ⚠ Parola ve token buraya girmez
        degisiklikler: { rol: sonuc.role },
        rc,
      });

      const yanit = Response.json({
        ok: true,
        // SA/FIN zorunlu 2FA kurulumuna düşer; diğerleri panoya
        next: isTwoFactorRequired(sonuc.role as UserRole) ? "/guvenlik-kurulumu" : "/",
      });
      // Çerez KABUL ANINDA silinir — sunucu tarafı eşleme zaten düştü
      yanit.headers.append("Set-Cookie", davetCereziSil());
      // Davet akışının HER yanıtında: token'ın bir sonraki isteğin
      // Referer'ında sızmaması için (yanıt gövdesi taşımasa da sayfa
      // geçişlerinde bu başlık geçerli kalır)
      yanit.headers.set("Referrer-Policy", "no-referrer");
      return yanit;
    } catch (e) {
      if (e instanceof DavetKullanilamaz) {
        /**
         * Gerçek sebep YALNIZ denetim izine yazılır. Kullanıcıya dönen gövde
         * her durumda aynıdır.
         */
        await yonetimAuditYaz({
          eylem: "update",
          // Kim olduğu bilinmiyor: geçersiz bir davetle gelen herkes olabilir
          aktor: null,
          varlikTuru: "user_invitation",
          etiket: "Davet kabulü reddedildi",
          degisiklikler: { sebep: e.sebep },
          rc,
        }).catch(() => {});

        const yanit = Response.json(
          { error: { code: DAVET_HATA_KODU, message: DAVET_HATA_MESAJI } },
          { status: 400 },
        );
        yanit.headers.append("Set-Cookie", davetCereziSil());
        return yanit;
      }
      throw e;
    }
  });
}

export const dynamic = "force-dynamic";
