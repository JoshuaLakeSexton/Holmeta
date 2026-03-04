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

type Body = {
  licenseKey?: string | null;
};

function invalidResponse(status = "inactive") {
  return {
    ok: true,
    valid: false,
    entitled: false,
    active: false,
    status,
    plan: "none",
    renewsAt: null,
    trialEndsAt: null,
    features: {
      lightFilters: false,
      everythingElse: false
    }
  };
}

function licenseFromEvent(event: Parameters<Handler>[0], body: Body): string {
  const bodyValue = String(body.licenseKey || "").trim();
  if (bodyValue) {
    return bodyValue;
  }

  const queryValue = new URLSearchParams(event.rawUrl.split("?")[1] || "").get("licenseKey");
  if (queryValue) {
    return String(queryValue).trim();
  }

  const auth = String(event.headers.authorization || event.headers.Authorization || "").trim();
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

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "LICENSE_SALT"]);
  if (missingEnv) {
    return missingEnv;
  }

  const body = event.httpMethod === "POST" ? parseJsonBody<Body>(event) : {};
  const licenseKey = licenseFromEvent(event, body);

  // Timing padding: always compute a hash once.
  const hashCandidate = hashLicenseKey(licenseKey || "HOLMETA-INVALID-INVALID-INVALID-INVALID");

  if (!licenseKey || !licenseLooksValidShape(licenseKey)) {
    return json(200, invalidResponse());
  }

  const license = await prisma.license.findUnique({
    where: {
      licenseHash: hashCandidate
    },
    select: {
      status: true,
      planKey: true,
      trialEnd: true,
      currentPeriodEnd: true
    }
  });

  if (!license) {
    return json(200, invalidResponse());
  }

  const normalized = buildLicenseEntitlement({
    status: normalizeSubscriptionStatus(license.status),
    planKey: license.planKey,
    trialEnd: license.trialEnd,
    currentPeriodEnd: license.currentPeriodEnd
  });

  return json(200, {
    ok: true,
    valid: normalized.valid,
    entitled: normalized.entitled,
    active: normalized.active,
    status: normalized.status,
    plan: normalized.plan,
    renewsAt: normalized.renewsAt,
    trialEndsAt: normalized.trialEndsAt,
    features: normalized.features
  });
};
