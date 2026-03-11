import { beforeEach, describe, expect, it } from "vitest";

import { resolveDisplayPlan } from "../lib/pricing/display";

describe("pricing display resolver", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_USD = "2";
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_USD = "20";
    delete process.env.NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_JP;
    delete process.env.NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_JP;
    delete process.env.NEXT_PUBLIC_PRICE_DISPLAY_CURRENCY_JP;
  });

  it("falls back to USD defaults when localized env is not set", () => {
    const plan = resolveDisplayPlan("ja");
    expect(plan.currency).toBe("USD");
    expect(plan.monthlyAmount).toBe(2);
    expect(plan.source).toBe("default");
  });

  it("uses localized display config when provided", () => {
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_JP = "300";
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_JP = "3000";
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_CURRENCY_JP = "JPY";

    const plan = resolveDisplayPlan("ja");
    expect(plan.currency).toBe("JPY");
    expect(plan.monthlyAmount).toBe(300);
    expect(plan.yearlyAmount).toBe(3000);
    expect(plan.source).toBe("localized");
  });
});
