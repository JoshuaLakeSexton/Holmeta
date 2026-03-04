import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import { resolvePlanFromPriceId, normalizedPlan, type PlanKey } from "./_lib/plans";
import { deriveLicenseKey, hashLicenseKey } from "./_lib/license";

function toDateFromUnix(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

function metadataValue(metadata: Stripe.Metadata | null | undefined, keys: string[]): string {
  if (!metadata) return "";
  for (const key of keys) {
    const value = String(metadata[key] || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function planFromMetadataOrPrice(metadata: Stripe.Metadata | null | undefined, priceId: string | null): PlanKey | null {
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
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";

    if (code === "P2002") {
      return false;
    }

    throw error;
  }
}

async function upsertLicenseFromSubscription(params: {
  checkoutSessionId: string;
  customerId: string;
  subscription: Stripe.Subscription;
  fallbackPlanKey?: string;
}) {
  const { checkoutSessionId, customerId, subscription, fallbackPlanKey } = params;
  const priceId = extractPrimaryPriceId(subscription);
  const planKey = planFromMetadataOrPrice(subscription.metadata, priceId) || fallbackPlanKey || "monthly_a";

  const licenseKey = deriveLicenseKey(checkoutSessionId, subscription.id);
  const licenseHash = hashLicenseKey(licenseKey);

  await prisma.license.upsert({
    where: {
      stripeSubscriptionId: subscription.id
    },
    create: {
      licenseHash,
      stripeCustomerId: customerId || null,
      stripeSubscriptionId: subscription.id,
      stripeCheckoutSessionId: checkoutSessionId,
      planKey,
      status: String(subscription.status || "inactive").toLowerCase(),
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end)
    },
    update: {
      licenseHash,
      stripeCustomerId: customerId || null,
      stripeCheckoutSessionId: checkoutSessionId,
      planKey,
      status: String(subscription.status || "inactive").toLowerCase(),
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end)
    }
  });

  await prisma.licenseReveal.upsert({
    where: {
      stripeCheckoutSessionId: checkoutSessionId
    },
    create: {
      stripeCheckoutSessionId: checkoutSessionId
    },
    update: {}
  });
}

async function updateLicenseStatusBySubscription(subscription: Stripe.Subscription) {
  const priceId = extractPrimaryPriceId(subscription);
  const planKey = planFromMetadataOrPrice(subscription.metadata, priceId);

  await prisma.license.updateMany({
    where: {
      stripeSubscriptionId: subscription.id
    },
    data: {
      status: String(subscription.status || "inactive").toLowerCase(),
      planKey: planKey || undefined,
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end)
    }
  });
}

async function updateLicenseStatusFromInvoice(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : "";
  if (!subscriptionId) {
    return;
  }

  await prisma.license.updateMany({
    where: {
      stripeSubscriptionId: subscriptionId
    },
    data: {
      status: "past_due"
    }
  });
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

  const missingEnv = requireEnvVars(["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "LICENSE_SALT"]);
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
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const checkoutSessionId = String(session.id || "").trim();
      const customerId = typeof session.customer === "string" ? session.customer : "";
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";
      const fallbackPlanKey = normalizedPlan(metadataValue(session.metadata, ["plan_key", "plan"])) || "monthly_a";

      if (checkoutSessionId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertLicenseFromSubscription({
          checkoutSessionId,
          customerId,
          subscription,
          fallbackPlanKey
        });
      }
    }

    if (
      stripeEvent.type === "customer.subscription.created" ||
      stripeEvent.type === "customer.subscription.updated" ||
      stripeEvent.type === "customer.subscription.deleted"
    ) {
      await updateLicenseStatusBySubscription(stripeEvent.data.object as Stripe.Subscription);
    }

    if (stripeEvent.type === "invoice.payment_failed") {
      await updateLicenseStatusFromInvoice(stripeEvent.data.object as Stripe.Invoice);
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
