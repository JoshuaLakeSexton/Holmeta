export type PlanKey = "monthly_a" | "yearly";
export type MarketKey = "default" | "jp" | "kr" | "zh_cn" | "zh_tw";

const PLAN_KEYS: PlanKey[] = ["monthly_a", "yearly"];
const MARKET_KEYS: MarketKey[] = ["default", "jp", "kr", "zh_cn", "zh_tw"];

const MARKET_BY_COUNTRY: Record<string, MarketKey> = {
  JP: "jp",
  KR: "kr",
  CN: "zh_cn",
  TW: "zh_tw",
  HK: "zh_tw",
  MO: "zh_tw"
};

const MARKET_BY_LOCALE: Array<{ prefix: string; market: MarketKey }> = [
  { prefix: "ja", market: "jp" },
  { prefix: "ko", market: "kr" },
  { prefix: "zh-cn", market: "zh_cn" },
  { prefix: "zh-hans", market: "zh_cn" },
  { prefix: "zh-tw", market: "zh_tw" },
  { prefix: "zh-hant", market: "zh_tw" }
];

function readEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

export function normalizedPlan(input?: string | null): PlanKey | null {
  const value = String(input || "").trim().toLowerCase();
  if (!value) {
    return null;
  }

  if ((PLAN_KEYS as string[]).includes(value)) {
    return value as PlanKey;
  }

  return null;
}

export function normalizedMarket(input?: string | null): MarketKey | null {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return null;
  if ((MARKET_KEYS as string[]).includes(value)) {
    return value as MarketKey;
  }
  return null;
}

function normalizeCountry(input?: string | null): string {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function envCandidatesForPlan(plan: PlanKey, market: MarketKey): string[] {
  const monthly = plan === "monthly_a";
  const base = monthly ? "STRIPE_PRICE_MONTHLY_A" : "STRIPE_PRICE_YEARLY";
  if (market === "jp") return [`${base}_JP`, `${base}_JPY`, base];
  if (market === "kr") return [`${base}_KR`, `${base}_KRW`, base];
  if (market === "zh_cn") return [`${base}_ZH_CN`, `${base}_CN`, `${base}_CNY`, base];
  if (market === "zh_tw") return [`${base}_ZH_TW`, `${base}_TW`, `${base}_TWD`, `${base}_HKD`, base];
  return [base];
}

export function resolveMarketFromSignals(input: {
  locale?: string | null;
  country?: string | null;
  currency?: string | null;
}): MarketKey {
  const country = normalizeCountry(input.country);
  if (country && MARKET_BY_COUNTRY[country]) {
    return MARKET_BY_COUNTRY[country];
  }

  const locale = String(input.locale || "").trim().toLowerCase();
  if (locale) {
    const matched = MARKET_BY_LOCALE.find((row) => locale.startsWith(row.prefix));
    if (matched) return matched.market;
  }

  const currency = String(input.currency || "").trim().toLowerCase();
  if (currency === "jpy") return "jp";
  if (currency === "krw") return "kr";
  if (currency === "cny") return "zh_cn";
  if (currency === "twd" || currency === "hkd") return "zh_tw";

  return "default";
}

export function currencyForMarket(market: MarketKey): string {
  if (market === "jp") return "jpy";
  if (market === "kr") return "krw";
  if (market === "zh_cn") return "cny";
  if (market === "zh_tw") return "twd";
  return "usd";
}

export function resolvePriceIdForPlan(plan: PlanKey, market: MarketKey = "default"): string | null {
  for (const envName of envCandidatesForPlan(plan, market)) {
    const resolved = readEnv(envName);
    if (resolved) return resolved;
  }
  return null;
}

export function resolvePlanFromPriceId(priceId?: string | null): PlanKey | null {
  const incoming = String(priceId || "").trim();
  if (!incoming) {
    return null;
  }

  for (const market of MARKET_KEYS) {
    const monthly = resolvePriceIdForPlan("monthly_a", market);
    const yearly = resolvePriceIdForPlan("yearly", market);
    if (incoming === monthly) return "monthly_a";
    if (incoming === yearly) return "yearly";
  }
  return null;
}

export function requiredPriceEnvForPlan(plan: PlanKey, market: MarketKey = "default"): string {
  return envCandidatesForPlan(plan, market)[0] || (plan === "monthly_a" ? "STRIPE_PRICE_MONTHLY_A" : "STRIPE_PRICE_YEARLY");
}

export function allConfiguredPriceIds() {
  const byMarket: Record<MarketKey, { monthlyA: string | null; yearly: string | null }> = {
    default: { monthlyA: resolvePriceIdForPlan("monthly_a", "default"), yearly: resolvePriceIdForPlan("yearly", "default") },
    jp: { monthlyA: resolvePriceIdForPlan("monthly_a", "jp"), yearly: resolvePriceIdForPlan("yearly", "jp") },
    kr: { monthlyA: resolvePriceIdForPlan("monthly_a", "kr"), yearly: resolvePriceIdForPlan("yearly", "kr") },
    zh_cn: { monthlyA: resolvePriceIdForPlan("monthly_a", "zh_cn"), yearly: resolvePriceIdForPlan("yearly", "zh_cn") },
    zh_tw: { monthlyA: resolvePriceIdForPlan("monthly_a", "zh_tw"), yearly: resolvePriceIdForPlan("yearly", "zh_tw") }
  };

  return {
    monthlyA: byMarket.default.monthlyA,
    yearly: byMarket.default.yearly,
    byMarket
  };
}
