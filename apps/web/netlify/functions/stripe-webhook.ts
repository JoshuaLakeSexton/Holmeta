import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import { resolvePlanFromPriceId, normalizedPlan, type PlanKey } from "./_lib/plans";
import { getOrCreateUserByEmail, normalizeEmail } from "./_lib/users";

function toDateFromUnix(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

function metadataValue(
  metadata: Stripe.Metadata | null | undefined,
  keys: string[]
): string {
  if (!metadata) return "";
  for (const key of keys) {
    const value = String(metadata[key] || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function planFromMetadataOrPrice(
  metadata: Stripe.Metadata | null | undefined,
  priceId: string | null
): PlanKey | null {
  const fromMeta = normalizedPlan(metadataValue(metadata, ["plan_key", "plan", "tier"]));
  if (fromMeta) return fromMeta;
  return resolvePlanFromPriceId(priceId);
}

function extractPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id || null;
}

async function markEventReceived(stripeEventId: string, type: string): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: {
        stripeEventId,
        type
      }
    });
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";

    if (code === "P2002") {
      return false;
    }

    throw error;
  }
}

async function resolveUserIdForCustomer(customerId: string): Promise<string> {
  if (!customerId) {
    return "";
  }

  const stripeCustomer = await prisma.stripeCustomer.findUnique({ where: { customerId } });
  return stripeCustomer?.userId || "";
}

async function resolveUserIdFromCheckoutSession(session: Stripe.Checkout.Session): Promise<string> {
  const metadataUser = metadataValue(session.metadata, ["user_id", "userId"]);
  if (metadataUser) {
    return metadataUser;
  }

  const customerId = typeof session.customer === "string" ? session.customer : "";
  if (customerId) {
    const mapped = await resolveUserIdForCustomer(customerId);
    if (mapped) {
      return mapped;
    }
  }

  const email = normalizeEmail(String(session.customer_details?.email || session.customer_email || ""));
  if (email) {
    const user = await getOrCreateUserByEmail(email);
    if (user) {
      return user.id;
    }
  }

  return "";
}

async function upsertSubscriptionForUser(userId: string, subscription: Stripe.Subscription) {
  const priceId = extractPrimaryPriceId(subscription);
  const tier = planFromMetadataOrPrice(subscription.metadata, priceId);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      priceId,
      status: String(subscription.status || "inactive").toLowerCase(),
      tier: tier || "none",
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
    },
    update: {
      stripeSubscriptionId: subscription.id,
      priceId,
      status: String(subscription.status || "inactive").toLowerCase(),
      tier: tier || "none",
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
    }
  });
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = await resolveUserIdFromCheckoutSession(session);
  if (!userId) {
    await reportServerEvent("warn", "stripe_webhook_checkout_missing_user");
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : "";
  if (customerId) {
    await prisma.stripeCustomer.upsert({
      where: { userId },
      create: { userId, customerId },
      update: { customerId }
    });
  }

  if (typeof session.subscription === "string") {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await upsertSubscriptionForUser(userId, subscription);
  }
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  let userId = metadataValue(subscription.metadata, ["user_id", "userId"]);
  if (!userId) {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
    if (customerId) {
      userId = await resolveUserIdForCustomer(customerId);
    }
  }

  if (!userId) {
    await reportServerEvent("warn", "stripe_webhook_subscription_missing_user", {
      subscriptionId: subscription.id
    });
    return;
  }

  await upsertSubscriptionForUser(userId, subscription);
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod === "GET") {
    return json(200, { ok: true, hint: "Use POST (Stripe webhook endpoint)." });
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
  if (missingEnv) {
    await reportServerEvent("error", "stripe_webhook_server_env_missing");
    return missingEnv;
  }

  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const signature =
    event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"] ||
    event.multiValueHeaders?.["stripe-signature"]?.[0] ||
    "";

  if (!signature) {
    await reportServerEvent("error", "stripe_webhook_missing_signature");
    return json(400, {
      error: "Missing stripe-signature header.",
      code: "WEBHOOK_SIGNATURE_MISSING"
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-02-24.acacia"
  });

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body || "", signature, webhookSecret);
  } catch (error) {
    await reportServerEvent("error", "stripe_webhook_verification_failed", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return json(400, {
      error: "Webhook verification failed.",
      code: "WEBHOOK_VERIFICATION_FAILED"
    });
  }

  const firstSeen = await markEventReceived(stripeEvent.id, stripeEvent.type);
  if (!firstSeen) {
    return json(200, {
      ok: true,
      duplicate: true,
      eventId: stripeEvent.id,
      type: stripeEvent.type
    });
  }

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      await handleCheckoutCompleted(stripe, stripeEvent.data.object as Stripe.Checkout.Session);
    }

    if (
      stripeEvent.type === "customer.subscription.created" ||
      stripeEvent.type === "customer.subscription.updated" ||
      stripeEvent.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionChanged(stripeEvent.data.object as Stripe.Subscription);
    }

    await reportServerEvent("info", "stripe_webhook_processed", {
      type: stripeEvent.type,
      eventId: stripeEvent.id
    });

    return json(200, {
      ok: true,
      received: true,
      eventId: stripeEvent.id,
      type: stripeEvent.type
    });
  } catch (error) {
    await reportServerEvent("error", "stripe_webhook_processing_failed", {
      eventId: stripeEvent.id,
      type: stripeEvent.type,
      error: error instanceof Error ? error.message : "unknown"
    });

    return json(500, {
      error: "Webhook processing failed.",
      code: "WEBHOOK_PROCESSING_FAILED"
    });
  }
};
