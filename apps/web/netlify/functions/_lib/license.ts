import crypto from "node:crypto";

export type LicensePlanKey = "monthly_a" | "yearly";

export type LicenseEntitlementPayload = {
  valid: boolean;
  active: boolean;
  entitled: boolean;
  status: string;
  plan: string;
  trialEndsAt: string | null;
  renewsAt: string | null;
  features: {
    lightFilters: boolean;
    everythingElse: boolean;
  };
};

const BASE32_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function requiredSalt(): string {
  const value = String(process.env.LICENSE_SALT || "").trim();
  if (!value) {
    throw new Error("LICENSE_SALT is not configured");
  }
  return value;
}

function base32FromBytes(bytes: Uint8Array): string {
  let buffer = 0;
  let bitsLeft = 0;
  let out = "";

  for (let i = 0; i < bytes.length; i += 1) {
    buffer = (buffer << 8) | bytes[i];
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      out += BASE32_ALPHABET[(buffer >> bitsLeft) & 31];
    }
  }

  if (bitsLeft > 0) {
    out += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31];
  }

  return out;
}

function normalizeCompact(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "");
}

function withPrefix(compactBody: string): string {
  const body = compactBody.startsWith("HOLMETA")
    ? compactBody.slice("HOLMETA".length)
    : compactBody;
  return `HOLMETA${body}`;
}

export function normalizeLicenseKey(raw: string): string {
  return withPrefix(normalizeCompact(raw));
}

export function formatLicenseKey(raw: string): string {
  const normalized = normalizeLicenseKey(raw);
  const body = normalized.slice("HOLMETA".length);
  const groups = body.match(/.{1,4}/g) || [];
  return `HOLMETA-${groups.join("-")}`;
}

export function deriveLicenseKey(checkoutSessionId: string, subscriptionId: string): string {
  const salt = requiredSalt();
  const payload = `${String(checkoutSessionId || "").trim()}:${String(subscriptionId || "").trim()}`;
  const digest = crypto.createHmac("sha256", salt).update(payload).digest();
  const body = base32FromBytes(digest).slice(0, 20); // >=100 bits entropy, human-enterable
  return formatLicenseKey(`HOLMETA${body}`);
}

export function hashLicenseKey(licenseKey: string): string {
  const salt = requiredSalt();
  const normalized = normalizeLicenseKey(licenseKey);
  return crypto.createHmac("sha256", salt).update(normalized).digest("hex");
}

export function licenseLooksValidShape(value: string): boolean {
  const normalized = normalizeLicenseKey(value);
  if (!normalized.startsWith("HOLMETA")) {
    return false;
  }
  const body = normalized.slice("HOLMETA".length);
  return body.length >= 16 && body.length <= 28;
}

export function normalizeSubscriptionStatus(value: string | null | undefined): string {
  const status = String(value || "none").trim().toLowerCase();
  return status || "none";
}

export function activeFromStatus(status: string | null | undefined, trialEnd?: Date | null): boolean {
  const normalized = normalizeSubscriptionStatus(status);
  if (normalized === "active") {
    return true;
  }
  if (normalized !== "trialing") {
    return false;
  }
  if (!trialEnd) {
    return true;
  }
  return trialEnd.getTime() > Date.now();
}

export function featuresFromStatus(status: string | null | undefined, trialEnd?: Date | null) {
  const normalized = normalizeSubscriptionStatus(status);

  if (normalized === "active" || normalized === "trialing") {
    const trialingActive = normalized !== "trialing" || !trialEnd || trialEnd.getTime() > Date.now();
    if (!trialingActive) {
      return {
        lightFilters: false,
        everythingElse: false
      };
    }

    return {
      lightFilters: true,
      everythingElse: true
    };
  }

  return {
    lightFilters: false,
    everythingElse: false
  };
}

export function buildLicenseEntitlement(payload: {
  status: string | null | undefined;
  planKey: string | null | undefined;
  trialEnd?: Date | null;
  currentPeriodEnd?: Date | null;
}): LicenseEntitlementPayload {
  const status = normalizeSubscriptionStatus(payload.status);
  const features = featuresFromStatus(status, payload.trialEnd || null);
  const active = activeFromStatus(status, payload.trialEnd || null);

  return {
    valid: active,
    active,
    entitled: active,
    status,
    plan: String(payload.planKey || "none"),
    trialEndsAt: payload.trialEnd ? payload.trialEnd.toISOString() : null,
    renewsAt: payload.currentPeriodEnd ? payload.currentPeriodEnd.toISOString() : null,
    features
  };
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}
