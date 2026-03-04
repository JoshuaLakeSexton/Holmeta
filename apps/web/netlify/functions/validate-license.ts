import type { Handler } from "@netlify/functions";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { requireEnvVars } from "./_lib/env";
import { prisma } from "./_lib/prisma";
import {
  buildLicenseEntitlement,
  hashLicenseKey,
  licenseLooksValidShape,
  normalizeSubscriptionStatus
} from "./_lib/license";
import { reportServerEvent } from "./_lib/monitor";

type Body = {
  licenseKey?: string | null;
  installId?: string | null;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const buckets = new Map<string, Bucket>();

function nowTs(): number {
  return Date.now();
}

function cleanupBuckets(now = nowTs()) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function clientIp(event: Parameters<Handler>[0]): string {
  const forwarded = String(event.headers["x-forwarded-for"] || "").split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  const realIp = String(event.headers["x-real-ip"] || "").trim();
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

function hitRateLimit(event: Parameters<Handler>[0]): { limited: boolean; retryAfterSec: number } {
  const now = nowTs();
  cleanupBuckets(now);

  const key = clientIp(event);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return {
      limited: false,
      retryAfterSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > RATE_LIMIT_MAX) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }

  return {
    limited: false,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

function invalidPayload(retryAfterSec = 300) {
  return {
    ok: true,
    valid: false,
    active: false,
    entitled: false,
    status: "inactive",
    plan: "none",
    trialEndsAt: null,
    renewsAt: null,
    features: {
      lightFilters: false,
      everythingElse: false
    },
    nextCheckAfterSec: retryAfterSec
  };
}

function licenseFromEvent(event: Parameters<Handler>[0], body: Body): string {
  const fromBody = String(body.licenseKey || "").trim();
  if (fromBody) {
    return fromBody;
  }

  const auth = String(event.headers.authorization || event.headers.Authorization || "").trim();
  if (!auth) {
    return "";
  }

  if (/^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim();
  }

  return auth;
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "LICENSE_SALT"]);
  if (missingEnv) {
    await reportServerEvent("error", "validate_license_env_missing");
    return missingEnv;
  }

  const rate = hitRateLimit(event);
  if (rate.limited) {
    return json(
      429,
      {
        ...invalidPayload(rate.retryAfterSec),
        error: "Too many requests",
        code: "RATE_LIMITED"
      },
      {
        "Retry-After": String(rate.retryAfterSec)
      }
    );
  }

  const body = parseJsonBody<Body>(event);
  const installId = String(body.installId || "").trim();
  const incomingLicense = licenseFromEvent(event, body);

  // Always compute a hash to keep response timing less informative.
  const hashInput = incomingLicense || "HOLMETA-INVALID-INVALID-INVALID-INVALID";
  let licenseHash = "";
  try {
    licenseHash = hashLicenseKey(hashInput);
  } catch {
    return json(500, {
      ok: false,
      error: "Server license hashing failed",
      code: "LICENSE_HASH_FAILED"
    });
  }

  if (!incomingLicense || !licenseLooksValidShape(incomingLicense)) {
    return json(200, invalidPayload(rate.retryAfterSec));
  }

  try {
    const license = await prisma.license.findUnique({
      where: {
        licenseHash
      },
      select: {
        status: true,
        planKey: true,
        trialEnd: true,
        currentPeriodEnd: true,
        stripeSubscriptionId: true
      }
    });

    if (!license) {
      return json(200, invalidPayload(rate.retryAfterSec));
    }

    const entitlement = buildLicenseEntitlement({
      status: normalizeSubscriptionStatus(license.status),
      planKey: license.planKey,
      trialEnd: license.trialEnd,
      currentPeriodEnd: license.currentPeriodEnd
    });

    await reportServerEvent("info", "validate_license_checked", {
      installId: installId || null,
      subscriptionIdPresent: Boolean(license.stripeSubscriptionId),
      status: entitlement.status,
      active: entitlement.active
    });

    return json(200, {
      ok: true,
      ...entitlement,
      nextCheckAfterSec: entitlement.active ? 12 * 60 * 60 : 5 * 60
    });
  } catch (error) {
    await reportServerEvent("error", "validate_license_failed", {
      error: error instanceof Error ? error.message : "unknown"
    });

    return json(500, {
      ok: false,
      error: "License validation failed",
      code: "VALIDATE_LICENSE_FAILED"
    });
  }
};
