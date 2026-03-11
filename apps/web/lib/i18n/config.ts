export const SUPPORTED_LOCALES = ["en", "ja", "ko", "zh-cn", "zh-tw"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function normalizeLocale(input?: string | null): SupportedLocale {
  const value = String(input || "").trim().toLowerCase();
  if (value === "zh" || value === "zh-hans" || value === "zh-cn") return "zh-cn";
  if (value === "zh-hant" || value === "zh-tw" || value === "zh-hk") return "zh-tw";
  if (value === "jp") return "ja";
  if (LOCALE_SET.has(value)) return value as SupportedLocale;
  return DEFAULT_LOCALE;
}

export function isSupportedLocale(input?: string | null): input is SupportedLocale {
  return LOCALE_SET.has(String(input || "").toLowerCase());
}

export function localeFromAcceptLanguage(headerValue?: string | null): SupportedLocale {
  const raw = String(headerValue || "").trim();
  if (!raw) return DEFAULT_LOCALE;
  const candidates = raw.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase() || "").filter(Boolean);
  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) {
      return normalizeLocale(candidate);
    }
    const base = candidate.split("-")[0];
    if (isSupportedLocale(base)) {
      return normalizeLocale(base);
    }
    if (candidate.startsWith("zh-")) {
      return normalizeLocale(candidate);
    }
  }
  return DEFAULT_LOCALE;
}

export function pathWithLocale(locale: SupportedLocale, path = "/"): string {
  const safeLocale = normalizeLocale(locale);
  const safePath = String(path || "/").startsWith("/") ? String(path || "/") : `/${String(path || "")}`;
  if (safePath === "/") return `/${safeLocale}`;
  return `/${safeLocale}${safePath}`;
}

export function splitLocaleFromPath(pathname: string): { locale: SupportedLocale | null; restPath: string } {
  const path = String(pathname || "/").trim() || "/";
  const segments = path.split("/").filter(Boolean);
  const first = segments[0] || "";
  if (!isSupportedLocale(first)) {
    return { locale: null, restPath: path };
  }
  const rest = `/${segments.slice(1).join("/")}`;
  return {
    locale: normalizeLocale(first),
    restPath: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/"
  };
}

export function localeDisplayName(locale: SupportedLocale): string {
  switch (locale) {
    case "ja":
      return "日本語";
    case "ko":
      return "한국어";
    case "zh-cn":
      return "简体中文";
    case "zh-tw":
      return "繁體中文";
    default:
      return "English";
  }
}
