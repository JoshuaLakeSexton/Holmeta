export type FeatureFlags = {
  lightFilters: boolean;
  everythingElse: boolean;
  advancedCadence: boolean;
  workBlocks: boolean;
  timeWindows: boolean;
  multiProfiles: boolean;
  settingsSync: boolean;
  meetingAutoSuppression: boolean;
  advancedAnalytics: boolean;
  postureWebcam: boolean;
};

export const ACTIVE_FEATURES: FeatureFlags = {
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

export const TRIAL_FEATURES: FeatureFlags = {
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

export const LOCKED_FEATURES: FeatureFlags = {
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

export function normalizeSubscriptionStatus(status: string | null | undefined): string {
  const value = String(status || "").trim().toLowerCase();
  return value || "none";
}

function isFuture(value: Date | string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  const ts = typeof value === "string" ? Date.parse(value) : value.getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }

  return ts > Date.now();
}

export function deriveEntitlementStatus(status: string | null | undefined, trialEnd?: Date | string | null) {
  const normalized = normalizeSubscriptionStatus(status);
  const trialing = normalized === "trialing" && isFuture(trialEnd);
  const active = normalized === "active";
  const entitled = active || trialing;

  const features = active
    ? ACTIVE_FEATURES
    : trialing
      ? TRIAL_FEATURES
      : LOCKED_FEATURES;

  return {
    status: normalized,
    active: entitled,
    entitled,
    features
  };
}
