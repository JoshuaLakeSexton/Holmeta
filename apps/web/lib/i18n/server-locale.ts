import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEFAULT_LOCALE, isSupportedLocale, localeFromAcceptLanguage, normalizeLocale, pathWithLocale, type SupportedLocale } from "@/lib/i18n/config";

export async function resolveRequestLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const requestHeaders = await headers();

  const cookieRaw = String(cookieStore.get("holmeta_locale")?.value || "").toLowerCase().trim();
  const cookieLocale = isSupportedLocale(cookieRaw) ? normalizeLocale(cookieRaw) : null;
  const headerLocale = localeFromAcceptLanguage(requestHeaders.get("accept-language"));

  return cookieLocale || headerLocale || DEFAULT_LOCALE;
}

export async function redirectToLocalizedPath(pathname: string): Promise<never> {
  const locale = await resolveRequestLocale();
  redirect(pathWithLocale(locale, pathname));
}
