import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/** Hızlı ön kontrol: çerez yoksa giriş sayfasına yönlendirir. Asıl doğrulama sayfalarda `girisGerekli` ile yapılır. */
export function proxy(istek: NextRequest) {
  if (!getSessionCookie(istek)) return NextResponse.redirect(new URL("/giris", istek.url));
  return NextResponse.next();
}

export const config = {
  // /dosya: imzalı bağlantılar oturum gerektirmez; imza ve süre route içinde doğrulanır.
  // /api: route'lar oturumu kendisi doğrular. Proxy'den geçen istek gövdesi 10 MB'ta kesildiği için fotoğraf yüklemesi bozulurdu.
  matcher: ["/((?!giris|api/|dosya/|_next/static|_next/image|favicon.ico).*)"],
};
