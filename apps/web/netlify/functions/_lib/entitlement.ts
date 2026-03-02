import { prisma } from "./prisma";
import {
  ACTIVE_FEATURES,
  LOCKED_FEATURES,
  TRIAL_FEATURES,
  deriveEntitlementStatus
} from "../../../lib/entitlement";

export { ACTIVE_FEATURES, LOCKED_FEATURES, TRIAL_FEATURES };

// Backward-compatible aliases used elsewhere in the extension/web code.
export const PREMIUM_FEATURES = ACTIVE_FEATURES;
export const FREE_FEATURES = LOCKED_FEATURES;

function asIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function entitlementForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  const derived = deriveEntitlementStatus(subscription?.status, subscription?.trialEnd);
  const renewsAt = subscription?.currentPeriodEnd || null;
  const trialEnd = subscription?.trialEnd || null;

  return {
    ok: true,
    userId,
    entitled: derived.entitled,
    active: derived.active,
    status: derived.status,
    plan: "2",
    renewsAt: asIso(renewsAt),
    trialEndsAt: asIso(trialEnd),
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    features: derived.features
  };
}
