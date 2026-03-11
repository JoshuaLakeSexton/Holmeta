import { beforeEach, describe, expect, it } from "vitest";

import {
  currencyForMarket,
  resolveMarketFromSignals,
  resolvePriceIdForPlan,
  resolvePlanFromPriceId
} from "../netlify/functions/_lib/plans";

describe("market pricing resolver", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_MONTHLY_A = "price_default_monthly";
    process.env.STRIPE_PRICE_YEARLY = "price_default_yearly";
    process.env.STRIPE_PRICE_MONTHLY_A_JP = "price_jp_monthly";
    process.env.STRIPE_PRICE_YEARLY_JP = "price_jp_yearly";
  });

  it("resolves market from locale and country signals", () => {
    expect(resolveMarketFromSignals({ locale: "ja", country: "JP" })).toBe("jp");
    expect(resolveMarketFromSignals({ locale: "ko-KR" })).toBe("kr");
    expect(resolveMarketFromSignals({ locale: "zh-TW" })).toBe("zh_tw");
    expect(resolveMarketFromSignals({ locale: "en-US" })).toBe("default");
  });

  it("selects market price ids with default fallback", () => {
    expect(resolvePriceIdForPlan("monthly_a", "jp")).toBe("price_jp_monthly");
    expect(resolvePriceIdForPlan("yearly", "jp")).toBe("price_jp_yearly");
    expect(resolvePriceIdForPlan("monthly_a", "kr")).toBe("price_default_monthly");
  });

  it("maps currency hints and reverse plan lookup", () => {
    expect(currencyForMarket("jp")).toBe("jpy");
    expect(currencyForMarket("default")).toBe("usd");
    expect(resolvePlanFromPriceId("price_jp_monthly")).toBe("monthly_a");
    expect(resolvePlanFromPriceId("price_default_yearly")).toBe("yearly");
  });
});
