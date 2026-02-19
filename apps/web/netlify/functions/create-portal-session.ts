import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { json, methodNotAllowed, getOrigin } from "./_lib/http";
import { requireToken } from "./_lib/token";
import { prisma } from "./_lib/prisma";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const claims = requireToken(event, ["dashboard"]);
  if (!claims) {
    return json(401, { error: "Unauthorized" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return json(200, {
      stub: true,
      url: `${getOrigin(event)}/dashboard?portal=stub`
    });
  }

  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { userId: claims.sub }
  });

  if (!stripeCustomer) {
    return json(404, { error: "No Stripe customer for this account" });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  const portal = await stripe.billingPortal.sessions.create({
    customer: stripeCustomer.customerId,
    return_url: `${getOrigin(event)}/dashboard`
  });

  return json(200, {
    url: portal.url
  });
};
