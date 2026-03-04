import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { requireEnvVars } from "./_lib/env";
import { reportServerEvent } from "./_lib/monitor";
import { deriveLicenseKey, hashLicenseKey, normalizeSubscriptionStatus } from "./_lib/license";
import { normalizedPlan, resolvePlanFromPriceId } from "./_lib/plans";

type Body = {
  session_id?: string | null;
};

function bodySessionId(eventBody: Body): string {
  return String(eventBody?.session_id || "").trim();
}

function querySessionId(rawPath: string): string {
  const value = new URLSearchParams(rawPath.split("?")[1] || "").get("session_id") || "";
  return String(value).trim();
}

function firstForwardedIp(raw: string | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value) {
    return null;
  }
  return value.split(",")[0]?.trim() || null;
}

function statusAllowsReveal(session: Stripe.Checkout.Session): boolean {
  const status = String(session.status || "").toLowerCase();
  const payment = String(session.payment_status || "").toLowerCase();
  if (status === "complete") {
    return true;
  }
  return payment === "paid";
}

function toDateFromUnix(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "STRIPE_SECRET_KEY", "LICENSE_SALT"]);
  if (missingEnv) {
    return missingEnv;
  }

  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-02-24.acacia"
  });

  const body = event.httpMethod === "POST" ? parseJsonBody<Body>(event) : {};
  const sessionId = bodySessionId(body) || querySessionId(event.rawUrl || "");

  if (!sessionId) {
    return json(400, {
      ok: false,
      error: "Missing session_id",
      code: "SESSION_ID_REQUIRED"
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"]
    });

    if (!statusAllowsReveal(session)) {
      return json(402, {
        ok: false,
        error: "not_paid",
        code: "CHECKOUT_NOT_COMPLETE"
      });
    }

    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || "";

    if (!subscriptionId) {
      return json(409, {
        ok: false,
        error: "missing_subscription",
        code: "SUBSCRIPTION_REQUIRED"
      });
    }

    let subscription: Stripe.Subscription;
    if (typeof session.subscription === "string" || !session.subscription) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } else {
      subscription = session.subscription;
    }

    const customerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;

    const primaryPriceId = subscription.items?.data?.[0]?.price?.id || null;

    const planKey = normalizedPlan(String(session.metadata?.plan_key || "").trim())
      || normalizedPlan(String(subscription.metadata?.plan_key || "").trim())
      || resolvePlanFromPriceId(primaryPriceId)
      || "monthly_a";

    const licenseKey = deriveLicenseKey(session.id, subscription.id);
    const licenseHash = hashLicenseKey(licenseKey);

    await prisma.license.upsert({
      where: {
        stripeSubscriptionId: subscription.id
      },
      create: {
        licenseHash,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeCheckoutSessionId: session.id,
        planKey,
        status: normalizeSubscriptionStatus(subscription.status),
        currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
        trialEnd: toDateFromUnix(subscription.trial_end)
      },
      update: {
        licenseHash,
        stripeCustomerId: customerId,
        stripeCheckoutSessionId: session.id,
        planKey,
        status: normalizeSubscriptionStatus(subscription.status),
        currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
        trialEnd: toDateFromUnix(subscription.trial_end)
      }
    });

    const reveal = await prisma.licenseReveal.upsert({
      where: {
        stripeCheckoutSessionId: session.id
      },
      create: {
        stripeCheckoutSessionId: session.id
      },
      update: {},
      select: {
        id: true,
        revealedAt: true
      }
    });

    if (reveal.revealedAt) {
      await reportServerEvent("warn", "license_reveal_duplicate", {
        sessionId: session.id
      });

      return json(409, {
        ok: false,
        error: "already_revealed",
        code: "LICENSE_ALREADY_REVEALED"
      });
    }

    await prisma.licenseReveal.update({
      where: {
        id: reveal.id
      },
      data: {
        revealedAt: new Date(),
        revealedIp: firstForwardedIp(event.headers["x-forwarded-for"]),
        userAgent: String(event.headers["user-agent"] || "").slice(0, 512)
      }
    });

    return json(200, {
      ok: true,
      licenseKey,
      planKey,
      status: normalizeSubscriptionStatus(subscription.status),
      trialEndsAt: toDateFromUnix(subscription.trial_end)?.toISOString() || null,
      renewsAt: toDateFromUnix(subscription.current_period_end)?.toISOString() || null
    });
  } catch (error) {
    await reportServerEvent("error", "get_license_failed", {
      error: error instanceof Error ? error.message : "unknown"
    });

    return json(500, {
      ok: false,
      error: "Unable to fetch license",
      code: "GET_LICENSE_FAILED"
    });
  }
};
