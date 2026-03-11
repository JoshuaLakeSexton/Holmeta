import { notFound } from "next/navigation";

import { isSupportedLocale, normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

export function localeFromRouteParam(rawLocale: string): SupportedLocale {
  if (!isSupportedLocale(rawLocale)) {
    notFound();
  }
  return normalizeLocale(rawLocale);
}
