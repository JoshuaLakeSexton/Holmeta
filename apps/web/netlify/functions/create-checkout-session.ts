import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { requireToken } from "./_lib/token";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import {
  normalizedPlan,
  resolvePriceIdForPlan,
  type PlanKey,
  requiredPriceEnvForPlan
} from "./_lib/plans";

interface CheckoutBody {
  plan?: string | null;
  interval?: string | null;
  priceKey?: string | null;
  priceId?: string | null;
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
  const direct = normalizedPlan(body.plan || body.priceKey);
  if (direct) {
    return direct;
  }

  const interval = String(body.interval || "").trim().toLowerCase();
  if (interval === "yearly" || interval === "annual") {
    return "yearly";
  }
  if (interval === "monthly") {
    return "monthly_a";
  }

  const explicitPriceId = String(body.priceId || "").trim();
  if (explicitPriceId) {
    const monthlyA = resolvePriceIdForPlan("monthly_a");
    const monthlyB = resolvePriceIdForPlan("monthly_b");
    const yearly = resolvePriceIdForPlan("yearly");

    if (explicitPriceId === monthlyB) return "monthly_b";
    if (explicitPriceId === yearly) return "yearly";
    if (explicitPriceId === monthlyA) return "monthly_a";
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

  const missingEnv = requireEnvVars(["APP_JWT_SECRET", "DATABASE_URL", "STRIPE_SECRET_KEY", "PUBLIC_BASE_URL"]);
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

  const claims = requireToken(event, ["dashboard"]);
  if (!claims?.sub) {
    await reportServerEvent("warn", "checkout_unauthorized");
    return json(401, {
      error: "Authenticate in dashboard first.",
      code: "UNAUTHORIZED"
    });
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) {
    await reportServerEvent("warn", "checkout_user_not_found", { userId: claims.sub });
    return json(401, {
      error: "Account not found. Sign in again.",
      code: "USER_NOT_FOUND"
    });
  }

  const body = parseJsonBody<CheckoutBody>(event);
  const planKey = resolveRequestedPlan(body);
  const resolvedPriceId = resolvePriceIdForPlan(planKey);
  if (!resolvedPriceId) {
    const requiredName = requiredPriceEnvForPlan(planKey);
    await reportServerEvent("error", "checkout_missing_price_mapping", {
      userId: user.id,
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

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  const existing = await prisma.stripeCustomer.findUnique({
    where: { userId: user.id }
  });

  let customerId = existing?.customerId || "";
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        product: "holmeta",
        userId: user.id
      }
    });

    customerId = customer.id;
    await prisma.stripeCustomer.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        customerId
      },
      update: {
        customerId
      }
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
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
        user_id: user.id,
        email: user.email,
        plan_key: planKey
      }
    },
    metadata: {
      user_id: user.id,
      email: user.email,
      plan_key: planKey
    },
    success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing/cancel`
  });

  if (!session.url) {
    await reportServerEvent("error", "checkout_session_missing_url", {
      userId: user.id,
      planKey
    });
    return json(500, {
      error: "Stripe Checkout session returned no URL.",
      code: "CHECKOUT_URL_MISSING"
    });
  }

  await reportServerEvent("info", "checkout_session_created", {
    userId: user.id,
    planKey,
    trialDays
  });

  return json(200, {
    ok: true,
    url: session.url,
    plan: planKey
  });
};
