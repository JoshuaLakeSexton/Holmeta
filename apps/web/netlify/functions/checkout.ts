import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

function getOrigin(event: Parameters<Handler>[0]): string {
  return (
    event.headers.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const origin = getOrigin(event);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!stripeKey || !priceId) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        stub: true,
        url: `${origin}/dashboard?checkout=stub`
      })
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-02-24.acacia"
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/dashboard?checkout=cancelled`,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      customer_email: payload.email || undefined,
      metadata: {
        product: "holmeta"
      }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: session.url
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Unable to create checkout session",
        detail: error instanceof Error ? error.message : "unknown"
      })
    };
  }
};
