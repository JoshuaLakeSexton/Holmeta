import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { json, methodNotAllowed } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { reportServerEvent } from "./_lib/monitor";

function toDateFromUnix(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

async function upsertSubscriptionForUser(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id || null;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
    },
    update: {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
      trialEnd: toDateFromUnix(subscription.trial_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
    }
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    await reportServerEvent("warn", "stripe_webhook_stub_mode");
    return json(200, { received: true, mode: "stub" });
  }

  const signature = event.headers["stripe-signature"];
  if (!signature) {
    await reportServerEvent("error", "stripe_webhook_missing_signature");
    return json(400, { error: "Missing stripe-signature header" });
  }

  try {
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-02-24.acacia"
    });

    const stripeEvent = stripe.webhooks.constructEvent(event.body || "", signature, webhookSecret);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === "string" ? session.customer : "";
      let userId = String(session.metadata?.userId || "");

      if (customerId && userId) {
        await prisma.stripeCustomer.upsert({
          where: { userId },
          create: { userId, customerId },
          update: { customerId }
        });
      }

      if (!userId && customerId) {
        const stripeCustomer = await prisma.stripeCustomer.findUnique({ where: { customerId } });
        if (stripeCustomer) {
          userId = stripeCustomer.userId;
        }
      }

      if (userId && typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscriptionForUser(userId, subscription);
      }
    }

    if (
      stripeEvent.type === "customer.subscription.created" ||
      stripeEvent.type === "customer.subscription.updated" ||
      stripeEvent.type === "customer.subscription.deleted"
    ) {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
      if (customerId) {
        const stripeCustomer = await prisma.stripeCustomer.findUnique({
          where: { customerId }
        });

        if (stripeCustomer) {
          await upsertSubscriptionForUser(stripeCustomer.userId, subscription);
        }
      }
    }

    await reportServerEvent("info", "stripe_webhook_processed", {
      type: stripeEvent.type
    });

    return json(200, { received: true, type: stripeEvent.type });
  } catch (error) {
    await reportServerEvent("error", "stripe_webhook_verification_failed", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return json(400, {
      error: "Webhook verification failed",
      detail: error instanceof Error ? error.message : "unknown"
    });
  }
};
