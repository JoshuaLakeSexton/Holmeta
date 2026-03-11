import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { DEFAULT_LOCALE, isSupportedLocale, localeFromAcceptLanguage, normalizeLocale, splitLocaleFromPath } from "@/lib/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;

function isBypassedPath(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/.netlify")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/downloads")) return true;
  if (PUBLIC_FILE.test(pathname)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isBypassedPath(pathname)) return NextResponse.next();

  const { locale, restPath } = splitLocaleFromPath(pathname);

  if (!locale) {
    const cookieRaw = String(request.cookies.get("holmeta_locale")?.value || "").toLowerCase();
    const cookieLocale = isSupportedLocale(cookieRaw) ? normalizeLocale(cookieRaw) : null;
    const headerLocale = localeFromAcceptLanguage(request.headers.get("accept-language"));
    const resolved = cookieLocale || headerLocale || DEFAULT_LOCALE;

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${resolved}${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("holmeta_locale", resolved, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
    return response;
  }

  const response = NextResponse.next();
  response.cookies.set("holmeta_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });

  // Keep root locale route canonicalized to /<locale> instead of /<locale>/
  if (restPath === "/" && pathname.endsWith("/")) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.pathname = `/${locale}`;
    return NextResponse.redirect(cleanUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
