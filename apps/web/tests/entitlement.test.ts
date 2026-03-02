import { describe, expect, it } from "vitest";
import {
  ACTIVE_FEATURES,
  LOCKED_FEATURES,
  TRIAL_FEATURES,
  deriveEntitlementStatus
} from "../lib/entitlement";

describe("entitlement derivation", () => {
  it("activates full feature set for active subscriptions", () => {
    const result = deriveEntitlementStatus("active", new Date(Date.now() - 1000));
    expect(result.entitled).toBe(true);
    expect(result.active).toBe(true);
    expect(result.features).toEqual(ACTIVE_FEATURES);
  });

  it("activates trial feature set for valid trialing subscriptions", () => {
    const result = deriveEntitlementStatus("trialing", new Date(Date.now() + 60_000));
    expect(result.entitled).toBe(true);
    expect(result.features).toEqual(TRIAL_FEATURES);
  });

  it("locks everything when trial is expired", () => {
    const result = deriveEntitlementStatus("trialing", new Date(Date.now() - 60_000));
    expect(result.entitled).toBe(false);
    expect(result.features).toEqual(LOCKED_FEATURES);
  });

  it("locks everything for inactive statuses", () => {
    const result = deriveEntitlementStatus("past_due", null);
    expect(result.entitled).toBe(false);
    expect(result.features).toEqual(LOCKED_FEATURES);
  });
});
