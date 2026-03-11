import { normalizeLocale, type SupportedLocale } from "../i18n/config";

export type DisplayPlan = {
  monthlyAmount: number;
  yearlyAmount: number;
  currency: string;
  source: "default" | "localized";
};

const DEFAULT_MONTHLY = Number(process.env.NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_USD || "2");
const DEFAULT_YEARLY = Number(process.env.NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_USD || "20");

function readDisplayAmount(name: string): number | null {
  const raw = String(process.env[name] || "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function localizedMarketForLocale(locale: SupportedLocale): "jp" | "kr" | "zh_cn" | "zh_tw" | null {
  if (locale === "ja") return "jp";
  if (locale === "ko") return "kr";
  if (locale === "zh-cn") return "zh_cn";
  if (locale === "zh-tw") return "zh_tw";
  return null;
}

function displayPriceForMarket(market: "jp" | "kr" | "zh_cn" | "zh_tw"): DisplayPlan | null {
  const upper = market.toUpperCase();
  const monthly = readDisplayAmount(`NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_${upper}`);
  const yearly = readDisplayAmount(`NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_${upper}`);
  const currency = String(process.env[`NEXT_PUBLIC_PRICE_DISPLAY_CURRENCY_${upper}`] || "").trim().toUpperCase();
  if (monthly == null || yearly == null || !currency) {
    return null;
  }
  return {
    monthlyAmount: monthly,
    yearlyAmount: yearly,
    currency,
    source: "localized"
  };
}

export function resolveDisplayPlan(localeInput?: string | null): DisplayPlan {
  const locale = normalizeLocale(localeInput);
  const market = localizedMarketForLocale(locale);
  if (market) {
    const localized = displayPriceForMarket(market);
    if (localized) return localized;
  }

  return {
    monthlyAmount: Number.isFinite(DEFAULT_MONTHLY) ? DEFAULT_MONTHLY : 2,
    yearlyAmount: Number.isFinite(DEFAULT_YEARLY) ? DEFAULT_YEARLY : 20,
    currency: "USD",
    source: "default"
  };
}
