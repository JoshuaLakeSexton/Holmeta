export type PlanKey = "monthly_a" | "monthly_b" | "yearly";

const PLAN_KEYS: PlanKey[] = ["monthly_a", "monthly_b", "yearly"];

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

export function resolvePriceIdForPlan(plan: PlanKey): string | null {
  if (plan === "monthly_a") {
    return readEnv("STRIPE_PRICE_MONTHLY_A") || readEnv("STRIPE_PRICE_ID_2") || null;
  }
  if (plan === "monthly_b") {
    return readEnv("STRIPE_PRICE_MONTHLY_B") || null;
  }
  return readEnv("STRIPE_PRICE_YEARLY") || null;
}

export function resolvePlanFromPriceId(priceId?: string | null): PlanKey | null {
  const incoming = String(priceId || "").trim();
  if (!incoming) {
    return null;
  }

  const monthlyA = resolvePriceIdForPlan("monthly_a");
  const monthlyB = resolvePriceIdForPlan("monthly_b");
  const yearly = resolvePriceIdForPlan("yearly");

  if (incoming === monthlyA) return "monthly_a";
  if (incoming === monthlyB) return "monthly_b";
  if (incoming === yearly) return "yearly";
  return null;
}

export function requiredPriceEnvForPlan(plan: PlanKey): string {
  if (plan === "monthly_a") {
    return "STRIPE_PRICE_MONTHLY_A (or STRIPE_PRICE_ID_2 fallback)";
  }
  if (plan === "monthly_b") {
    return "STRIPE_PRICE_MONTHLY_B";
  }
  return "STRIPE_PRICE_YEARLY";
}

export function allConfiguredPriceIds() {
  return {
    monthlyA: resolvePriceIdForPlan("monthly_a"),
    monthlyB: resolvePriceIdForPlan("monthly_b"),
    yearly: resolvePriceIdForPlan("yearly")
  };
}
