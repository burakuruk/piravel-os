import { uygulamaOrigin } from "@/lib/api";
import { davetCereziYaz } from "@/lib/davet-cerez";
import { cerezeBagla, davetiTokenIleBul, kabulEdilebilirMi } from "@/lib/invitations";

/**
 * GET /davet/[token] — davet bağlantısının giriş noktası.
 *
 * ⚠ BU UÇ HİÇBİR KAYDI DEĞİŞTİRMEZ (davet kabul edilmez). Tek yaptığı,
 * token'ı doğrulayıp kısa ömürlü bir çerez oturumu açmak ve TEMİZ `/davet`
 * adresine yönlendirmektir.
 *
 * Neden: ham token URL'de kalırsa tarayıcı geçmişine, Referer başlığına,
 * sunucu erişim log'una ve paylaşılan ekran görüntülerine sızar. Yönlendirme
 * sonrası adres çubuğunda token kalmaz.
 *
 * Geçersiz/süresi dolmuş/iptal edilmiş/kullanılmış token'ların HEPSİ aynı
 * şekilde ele alınır: çerez yazılmaz, aynı sayfaya yönlendirilir. Fark
 * edilebilir bir davranış, bağlantıyı bir varlık oracle'ına çevirirdi.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = await uygulamaOrigin();
  const hedef = `${origin}/davet`;

  const basliklar = new Headers({
    Location: hedef,
    // Token'ın bir sonraki isteğin Referer'ında görünmesini engeller
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });

  const davet = await davetiTokenIleBul(token).catch(() => null);
  if (!davet || !kabulEdilebilirMi(davet)) {
    return new Response(null, { status: 302, headers: basliklar });
  }

  const cerezKimligi = await cerezeBagla(davet.id);
  basliklar.append("Set-Cookie", davetCereziYaz(cerezKimligi));
  return new Response(null, { status: 302, headers: basliklar });
}

export const dynamic = "force-dynamic";
