import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

function localeTag(locale: SupportedLocale): string {
  if (locale === "zh-cn") return "zh-CN";
  if (locale === "zh-tw") return "zh-TW";
  return locale;
}

export function formatCurrency(amount: number, currency: string, localeInput?: string | null): string {
  const locale = normalizeLocale(localeInput);
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: currency.toUpperCase() === "JPY" || currency.toUpperCase() === "KRW" ? 0 : 2
  }).format(amount);
}

export function formatNumber(value: number, localeInput?: string | null): string {
  const locale = normalizeLocale(localeInput);
  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(value: Date, localeInput?: string | null): string {
  const locale = normalizeLocale(localeInput);
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(value);
}
