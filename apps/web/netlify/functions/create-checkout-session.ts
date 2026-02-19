import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { json, methodNotAllowed, getOrigin } from "./_lib/http";
import { requireToken } from "./_lib/token";
import { prisma } from "./_lib/prisma";

function trialDaysFromEnv(): number {
  const raw = Number(process.env.TRIAL_DAYS || 3);
  if (!Number.isFinite(raw)) {
    return 3;
  }

  return Math.max(0, Math.min(30, Math.round(raw)));
}

function resolveBaseUrl(event: Parameters<Handler>[0]): string {
  const configured = String(
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    getOrigin(event)
  ).trim();

  return configured.replace(/\/$/, "");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const claims = requireToken(event, ["dashboard"]);
  if (!claims) {
    return json(401, { error: "Unauthorized" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID_2;
  const baseUrl = resolveBaseUrl(event);
  const trialDays = trialDaysFromEnv();

  if (!stripeKey || !priceId) {
    return json(200, {
      stub: true,
      url: `${baseUrl}/dashboard/subscribe?checkout=stub`,
      trialDays
    });
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) {
    return json(404, { error: "User not found" });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  let customerId = (
    await prisma.stripeCustomer.findUnique({
      where: { userId: user.id }
    })
  )?.customerId;

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
    customer_email: user.email || undefined,
    payment_method_collection: "always",
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: {
        userId: user.id
      }
    },
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/dashboard?checkout=cancel`,
    metadata: {
      userId: user.id
    }
  });

  return json(200, {
    ok: true,
    url: session.url,
    sessionId: session.id,
    trialDays
  });
};
