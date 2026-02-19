import { prisma } from "./prisma";

export const ACTIVE_FEATURES = {
  lightFilters: true,
  everythingElse: true,
  advancedCadence: true,
  workBlocks: true,
  timeWindows: true,
  multiProfiles: true,
  settingsSync: true,
  meetingAutoSuppression: true,
  advancedAnalytics: true,
  postureWebcam: true
};

export const TRIAL_FEATURES = {
  lightFilters: true,
  everythingElse: false,
  advancedCadence: false,
  workBlocks: false,
  timeWindows: false,
  multiProfiles: false,
  settingsSync: false,
  meetingAutoSuppression: false,
  advancedAnalytics: false,
  postureWebcam: false
};

export const LOCKED_FEATURES = {
  lightFilters: false,
  everythingElse: false,
  advancedCadence: false,
  workBlocks: false,
  timeWindows: false,
  multiProfiles: false,
  settingsSync: false,
  meetingAutoSuppression: false,
  advancedAnalytics: false,
  postureWebcam: false
};

// Backward-compatible aliases used elsewhere in the extension/web code.
export const PREMIUM_FEATURES = ACTIVE_FEATURES;
export const FREE_FEATURES = LOCKED_FEATURES;

function normalizeStatus(status: string | null | undefined): string {
  return String(status || "inactive").toLowerCase();
}

function asIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function isFuture(value: Date | null | undefined): boolean {
  if (!value) {
    return true;
  }

  return value.getTime() > Date.now();
}

export async function entitlementForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  const status = normalizeStatus(subscription?.status);
  const renewsAt = subscription?.currentPeriodEnd || null;
  const trialEnd = subscription?.trialEnd || null;

  const trialing = status === "trialing" && isFuture(trialEnd);
  const active = status === "active";
  const entitled = active || trialing;

  const features = active
    ? ACTIVE_FEATURES
    : trialing
      ? TRIAL_FEATURES
      : LOCKED_FEATURES;

  return {
    ok: true,
    userId,
    entitled,
    active: entitled,
    status,
    plan: "2",
    renewsAt: asIso(renewsAt),
    trialEndsAt: asIso(trialEnd),
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    features
  };
}
