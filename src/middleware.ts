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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
