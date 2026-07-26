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
const PUBLIC_PREFIXES = ["/giris", "/api/auth", "/wireframe"];

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
