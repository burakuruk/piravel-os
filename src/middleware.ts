import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rota koruması — ilk savunma katmanı.
 *
 * Burada yalnız ÇEREZ VARLIĞI kontrol edilir (edge'de DB sorgusu yapılmaz).
 * Gerçek yetki kararı — oturumun geçerliliği, rol, zorunlu 2FA — sunucu
 * bileşenlerinde `requireUser()` ile verilir (docs/02 §1: yetki API katmanında).
 * Bu katman yalnız gereksiz sayfa yüklemesini önler.
 */
/**
 * Oturum gerektirmeyen yollar.
 *
 * `/davet` ve `/api/v1/davet` burada olmak ZORUNDA: daveti kabul edecek kişinin
 * tanımı gereği henüz oturumu yoktur. Yetki bu yollarda oturumla değil, kısa
 * ömürlü davet çerezi ve sunucudaki davet kaydıyla kurulur.
 */
const PUBLIC_PREFIXES = ["/giris", "/api/auth", "/wireframe", "/davet", "/api/v1/davet"];

/**
 * Davet akışının tamamı — `/davet/<token>`, temiz `/davet` sayfası ve kabul ucu.
 *
 * Bu yollarda `Referrer-Policy: no-referrer` ZORUNLUDUR: token URL'de geçtiği
 * için, sayfadan çıkılan herhangi bir bağlantı ya da yüklenen bir kaynak
 * Referer başlığında token'ı taşırdı. Başlık tek yerden verilir ki rotalardan
 * biri unutulduğunda koruma düşmesin.
 */
const DAVET_PREFIXES = ["/davet", "/api/v1/davet"];

function davetBasliklari(yanit: NextResponse): NextResponse {
  yanit.headers.set("Referrer-Policy", "no-referrer");
  yanit.headers.set("Cache-Control", "no-store");
  return yanit;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (DAVET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return davetBasliklari(NextResponse.next());
  }

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = new URL("/giris", request.url);
    if (pathname !== "/") url.searchParams.set("devam", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
