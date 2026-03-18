import type { Handler } from "@netlify/functions";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { requireEnvVars } from "./_lib/env";
import { prisma } from "./_lib/prisma";
import { isPrismaStoreUnavailable, prismaErrorCode } from "./_lib/prisma-error";
import { reportServerEvent } from "./_lib/monitor";
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
  let hashCandidate = "";
  try {
    hashCandidate = hashLicenseKey(licenseKey || "HOLMETA-INVALID-INVALID-INVALID-INVALID");
  } catch {
    return json(500, {
      ok: false,
      error: "License validation unavailable",
      code: "ENTITLEMENT_HASH_FAILED"
    });
  }

  if (!licenseKey || !licenseLooksValidShape(licenseKey)) {
    return json(200, invalidResponse());
  }

  try {
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
  } catch (error) {
    const code = prismaErrorCode(error);
    const schemaMissing = code === "P2021";
    const storeUnavailable = isPrismaStoreUnavailable(error);
    await reportServerEvent("error", "entitlement_lookup_failed", {
      schemaMissing,
      storeUnavailable,
      code: code || null,
      error: error instanceof Error ? error.message : "unknown"
    });

    if (schemaMissing || storeUnavailable) {
      return json(503, {
        ok: false,
        error: schemaMissing ? "Entitlement store is not ready" : "Entitlement lookup unavailable",
        code: schemaMissing ? "ENTITLEMENT_SCHEMA_MISSING" : "ENTITLEMENT_STORE_UNAVAILABLE"
      });
    }

    return json(500, {
      ok: false,
      error: "Entitlement lookup failed",
      code: "ENTITLEMENT_LOOKUP_FAILED"
    });
  }
};
