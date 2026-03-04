import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import {
  normalizedPlan,
  resolvePriceIdForPlan,
  type PlanKey,
  requiredPriceEnvForPlan
} from "./_lib/plans";

interface CheckoutBody {
  planKey?: string | null;
  plan?: string | null;
  installId?: string | null;
}

function trialDaysFromEnv(): number {
  const raw = Number(process.env.TRIAL_DAYS ?? "3");
  if (!Number.isFinite(raw)) {
    return 3;
  }

  return Math.max(0, Math.min(30, Math.round(raw)));
}

function requiredEnv(name: string): string | null {
  const value = String(process.env[name] || "").trim();
  return value ? value : null;
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/$/, "");
}

function resolveRequestedPlan(body: CheckoutBody): PlanKey {
  const direct = normalizedPlan(body.planKey || body.plan);
  if (direct) {
    return direct;
  }
  return "monthly_a";
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      hint: "Use POST",
      supportedPlans: ["monthly_a", "monthly_b", "yearly"]
    });
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["STRIPE_SECRET_KEY", "PUBLIC_BASE_URL"]);
  if (missingEnv) {
    await reportServerEvent("error", "checkout_server_env_missing");
    return missingEnv;
  }

  const stripeKey = requiredEnv("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    await reportServerEvent("error", "checkout_missing_stripe_key");
    return json(500, {
      error: "Server missing STRIPE_SECRET_KEY.",
      code: "CHECKOUT_ENV_MISSING"
    });
  }

  const body = parseJsonBody<CheckoutBody>(event);
  const planKey = resolveRequestedPlan(body);
  const resolvedPriceId = resolvePriceIdForPlan(planKey);
  if (!resolvedPriceId) {
    const requiredName = requiredPriceEnvForPlan(planKey);
    await reportServerEvent("error", "checkout_missing_price_mapping", {
      planKey,
      requiredName
    });

    return json(500, {
      error: `Server missing price mapping for ${planKey}. Configure ${requiredName}.`,
      code: "PRICE_MAPPING_MISSING"
    });
  }

  const publicBaseUrl = requiredEnv("PUBLIC_BASE_URL");
  if (!publicBaseUrl) {
    await reportServerEvent("error", "checkout_missing_public_base_url");
    return json(500, {
      error: "Server missing PUBLIC_BASE_URL.",
      code: "CHECKOUT_ENV_MISSING"
    });
  }

  const baseUrl = normalizeBaseUrl(publicBaseUrl);
  const trialDays = trialDaysFromEnv();
  const installId = String(body.installId || "").trim();

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_collection: "always",
    allow_promotion_codes: true,
    line_items: [
      {
        price: resolvedPriceId,
        quantity: 1
      }
    ],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: {
        plan_key: planKey,
        install_id: installId
      }
    },
    metadata: {
      plan_key: planKey,
      install_id: installId
    },
    success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing/cancel`
  });

  if (!session.url) {
    await reportServerEvent("error", "checkout_session_missing_url", {
      planKey
    });
    return json(500, {
      error: "Stripe Checkout session returned no URL.",
      code: "CHECKOUT_URL_MISSING"
    });
  }

  await reportServerEvent("info", "checkout_session_created", {
    planKey,
    trialDays
  });

  return json(200, {
    ok: true,
    url: session.url,
    planKey
  });
};
