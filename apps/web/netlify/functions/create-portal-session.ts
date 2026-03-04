import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody, requestId } from "./_lib/http";
import { requireEnvVars } from "./_lib/env";
import { reportServerEvent } from "./_lib/monitor";
import { prisma } from "./_lib/prisma";
import { hashLicenseKey, licenseLooksValidShape } from "./_lib/license";

type Body = {
  session_id?: string | null;
  license_key?: string | null;
  licenseKey?: string | null;
};

function sessionIdFromEvent(event: Parameters<Handler>[0], body: Body): string {
  const fromBody = String(body.session_id || "").trim();
  if (fromBody) {
    return fromBody;
  }
  const fromQuery = new URLSearchParams(event.rawUrl.split("?")[1] || "").get("session_id") || "";
  return String(fromQuery).trim();
}

function licenseKeyFromEvent(event: Parameters<Handler>[0], body: Body): string {
  const fromBodySnake = String(body.license_key || "").trim();
  if (fromBodySnake) {
    return fromBodySnake;
  }

  const fromBodyCamel = String(body.licenseKey || "").trim();
  if (fromBodyCamel) {
    return fromBodyCamel;
  }

  const fromQuery = new URLSearchParams(event.rawUrl.split("?")[1] || "").get("license_key")
    || new URLSearchParams(event.rawUrl.split("?")[1] || "").get("licenseKey")
    || "";
  return String(fromQuery).trim();
}

function normalizeBaseUrl(value: string): string {
  return String(value || "").trim().replace(/\/$/, "");
}

export const handler: Handler = async (event) => {
  const rid = requestId(event);
  const respond = (statusCode: number, body: unknown, headers: Record<string, string> = {}) =>
    json(statusCode, body, {
      "X-Holmeta-Request-Id": rid,
      ...headers
    });

  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod === "GET") {
    return respond(200, { ok: true, hint: "Use POST with { session_id } or { license_key }" });
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["STRIPE_SECRET_KEY", "PUBLIC_BASE_URL", "DATABASE_URL", "LICENSE_SALT"]);
  if (missingEnv) {
    return missingEnv;
  }

  const body = parseJsonBody<Body>(event);
  const sessionId = sessionIdFromEvent(event, body);
  const licenseKey = licenseKeyFromEvent(event, body);
  if (!sessionId && !licenseKey) {
    return respond(400, {
      ok: false,
      error: "Missing session_id or license_key",
      code: "PORTAL_LOOKUP_REQUIRED"
    });
  }

  const stripe = new Stripe(String(process.env.STRIPE_SECRET_KEY || "").trim(), {
    apiVersion: "2025-02-24.acacia"
  });

  try {
    let customerId = "";

    if (sessionId) {
      const checkout = await stripe.checkout.sessions.retrieve(sessionId);
      customerId = typeof checkout.customer === "string"
        ? checkout.customer
        : checkout.customer?.id || "";
    }

    if (!customerId && licenseKey && licenseLooksValidShape(licenseKey)) {
      const licenseHash = hashLicenseKey(licenseKey);
      const license = await prisma.license.findUnique({
        where: {
          licenseHash
        },
        select: {
          stripeCustomerId: true
        }
      });

      customerId = String(license?.stripeCustomerId || "").trim();
    }

    if (!customerId) {
      return respond(404, {
        ok: false,
        error: "Unable to locate billing customer for provided lookup",
        code: "CUSTOMER_NOT_FOUND"
      });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${normalizeBaseUrl(process.env.PUBLIC_BASE_URL || "")}/dashboard`
    });

    return respond(200, {
      ok: true,
      url: portal.url
    });
  } catch (error) {
    await reportServerEvent("error", "portal_session_failed", {
      requestId: rid,
      error: error instanceof Error ? error.message : "unknown"
    });

    return respond(500, {
      ok: false,
      error: "Unable to create portal session",
      code: "PORTAL_SESSION_FAILED"
    });
  }
};
