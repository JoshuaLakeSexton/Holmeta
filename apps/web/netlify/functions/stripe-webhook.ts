import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed"
    };
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, mode: "stub" })
    };
  }

  const signature = event.headers["stripe-signature"];
  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing stripe-signature header" })
    };
  }

  try {
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-02-24.acacia"
    });

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body || "",
      signature,
      webhookSecret
    );

    // MVP scaffold only. Replace with DB writes for real entitlement state.
    if (
      stripeEvent.type === "checkout.session.completed" ||
      stripeEvent.type === "customer.subscription.updated" ||
      stripeEvent.type === "customer.subscription.deleted"
    ) {
      console.log("holmeta webhook event", stripeEvent.type, stripeEvent.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, type: stripeEvent.type })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Webhook verification failed",
        detail: error instanceof Error ? error.message : "unknown"
      })
    };
  }
};
