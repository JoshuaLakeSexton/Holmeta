import { prisma } from "./prisma";
import {
  ACTIVE_FEATURES,
  LOCKED_FEATURES,
  TRIAL_FEATURES,
  deriveEntitlementStatus
} from "../../../lib/entitlement";
import type { PlanKey } from "./plans";

export { ACTIVE_FEATURES, LOCKED_FEATURES, TRIAL_FEATURES };

// Backward-compatible aliases used elsewhere in the extension/web code.
export const PREMIUM_FEATURES = ACTIVE_FEATURES;
export const FREE_FEATURES = LOCKED_FEATURES;

function asIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizeTier(raw: string | null | undefined): PlanKey | "none" {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "monthly_a" || value === "monthly_b" || value === "yearly") {
    return value;
  }
  return "none";
}

export async function entitlementForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  const derived = deriveEntitlementStatus(subscription?.status, subscription?.trialEnd);
  const renewsAt = subscription?.currentPeriodEnd || null;
  const trialEnd = subscription?.trialEnd || null;
  const tier = normalizeTier(subscription?.tier);

  return {
    ok: true,
    userId,
    entitled: derived.entitled,
    active: derived.active,
    status: derived.status,
    tier,
    plan: tier,
    renewsAt: asIso(renewsAt),
    trialEndsAt: asIso(trialEnd),
    current_period_end: asIso(renewsAt),
    trial_end: asIso(trialEnd),
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    features: derived.features
  };
}
