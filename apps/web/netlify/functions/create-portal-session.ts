import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { requireEnvVars } from "./_lib/env";

type Body = {
  session_id?: string | null;
};

function sessionIdFromEvent(event: Parameters<Handler>[0], body: Body): string {
  const fromBody = String(body.session_id || "").trim();
  if (fromBody) {
    return fromBody;
  }
  const fromQuery = new URLSearchParams(event.rawUrl.split("?")[1] || "").get("session_id") || "";
  return String(fromQuery).trim();
}

function normalizeBaseUrl(value: string): string {
  return String(value || "").trim().replace(/\/$/, "");
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod === "GET") {
    return json(200, { ok: true, hint: "Use POST with { session_id } or pass ?session_id=" });
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["STRIPE_SECRET_KEY", "PUBLIC_BASE_URL"]);
  if (missingEnv) {
    return missingEnv;
  }

  const body = parseJsonBody<Body>(event);
  const sessionId = sessionIdFromEvent(event, body);
  if (!sessionId) {
    return json(400, {
      ok: false,
      error: "Missing session_id",
      code: "SESSION_ID_REQUIRED"
    });
  }

  const stripe = new Stripe(String(process.env.STRIPE_SECRET_KEY || "").trim(), {
    apiVersion: "2025-02-24.acacia"
  });

  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const customerId = typeof checkout.customer === "string"
      ? checkout.customer
      : checkout.customer?.id || "";

    if (!customerId) {
      return json(404, {
        ok: false,
        error: "No customer associated with this checkout session",
        code: "CUSTOMER_NOT_FOUND"
      });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${normalizeBaseUrl(process.env.PUBLIC_BASE_URL || "")}/dashboard`
    });

    return json(200, {
      ok: true,
      url: portal.url
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to create portal session",
      code: "PORTAL_SESSION_FAILED"
    });
  }
};
