import { beforeEach, describe, expect, it } from "vitest";

import { resolveDisplayPlan } from "../lib/pricing/display";

describe("pricing display resolver", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_JP;
    delete process.env.NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_JP;
    delete process.env.NEXT_PUBLIC_PRICE_DISPLAY_CURRENCY_JP;
  });

  it("always resolves fixed USD display pricing", () => {
    const plan = resolveDisplayPlan("ja");
    expect(plan.currency).toBe("USD");
    expect(plan.monthlyAmount).toBe(2);
    expect(plan.yearlyAmount).toBe(20);
    expect(plan.source).toBe("fixed");
  });

  it("ignores localized display env overrides", () => {
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_MONTHLY_JP = "300";
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_YEARLY_JP = "3000";
    process.env.NEXT_PUBLIC_PRICE_DISPLAY_CURRENCY_JP = "JPY";

    const plan = resolveDisplayPlan("ja");
    expect(plan.currency).toBe("USD");
    expect(plan.monthlyAmount).toBe(2);
    expect(plan.yearlyAmount).toBe(20);
    expect(plan.source).toBe("fixed");
  });
});
