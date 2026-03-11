import type { Metadata } from "next";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale, pathWithLocale } from "@/lib/i18n/config";
import { getMessages, t } from "@/lib/i18n/messages";

function baseUrl(): string {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_BASE_URL || "https://holmeta.com").trim();
  return raw.replace(/\/$/, "");
}

export function localeAlternates(path: string, currentLocale: string = DEFAULT_LOCALE) {
  const canonicalLocale = normalizeLocale(currentLocale);
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = `${baseUrl()}${pathWithLocale(locale, path)}`;
  }
  return {
    canonical: `${baseUrl()}${pathWithLocale(canonicalLocale, path)}`,
    languages,
    "x-default": `${baseUrl()}${pathWithLocale(DEFAULT_LOCALE, path)}`
  };
}

export function localeMetadata(localeInput: string | null | undefined, path: string): Metadata {
  const locale = normalizeLocale(localeInput);
  const messages = getMessages(locale);
  return {
    title: t(messages, "meta.title", "HOLMETA"),
    description: t(messages, "meta.description", "Holmeta browser extension"),
    alternates: localeAlternates(path, locale)
  };
}
