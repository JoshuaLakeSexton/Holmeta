import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { requireToken } from "./_lib/token";

interface CheckoutBody {
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

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const body = parseJsonBody<CheckoutBody>(event);
  const bodyPriceId = String(body.priceId || "").trim();

  const stripeKey = requiredEnv("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return json(500, { error: "Missing STRIPE_SECRET_KEY." });
  }

  const envPriceId = requiredEnv("STRIPE_PRICE_ID_2");
  const priceId = bodyPriceId || envPriceId;
  if (!priceId) {
    return json(500, { error: "Missing STRIPE_PRICE_ID_2 and no priceId provided." });
  }

  const publicBaseUrl = requiredEnv("PUBLIC_BASE_URL");
  if (!publicBaseUrl) {
    return json(500, { error: "Missing PUBLIC_BASE_URL." });
  }

  const baseUrl = normalizeBaseUrl(publicBaseUrl);
  const trialDays = trialDaysFromEnv();

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  const claims = requireToken(event, ["dashboard"]);
  let customerId: string | undefined;
  let customerEmail: string | undefined;
  let userId: string | undefined;

  if (claims?.sub) {
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (user) {
      userId = user.id;
      customerEmail = user.email;

      const existing = await prisma.stripeCustomer.findUnique({
        where: { userId: user.id }
      });

      if (existing?.customerId) {
        customerId = existing.customerId;
      } else {
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
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_email: customerEmail,
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
        userId: userId || "anonymous"
      }
    },
    metadata: {
      userId: userId || "anonymous"
    },
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/?checkout=cancel`
  });

  if (!session.url) {
    return json(500, { error: "Stripe Checkout session returned no URL." });
  }

  return json(200, {
    url: session.url
  });
};
