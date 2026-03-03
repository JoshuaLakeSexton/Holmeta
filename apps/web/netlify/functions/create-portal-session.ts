import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import { corsPreflight, json, methodNotAllowed, getOrigin } from "./_lib/http";
import { requireToken } from "./_lib/token";
import { prisma } from "./_lib/prisma";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod === "GET") {
    return json(200, { ok: true, hint: "Use POST" });
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "APP_JWT_SECRET"]);
  if (missingEnv) {
    await reportServerEvent("error", "portal_server_env_missing");
    return missingEnv;
  }

  const claims = requireToken(event, ["dashboard"]);
  if (!claims) {
    await reportServerEvent("warn", "portal_unauthorized");
    return json(401, { error: "Unauthorized" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    await reportServerEvent("warn", "portal_stub_mode", { userId: claims.sub });
    return json(200, {
      stub: true,
      url: `${getOrigin(event)}/dashboard?portal=stub`
    });
  }

  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { userId: claims.sub }
  });

  if (!stripeCustomer) {
    await reportServerEvent("warn", "portal_missing_customer", { userId: claims.sub });
    return json(404, { error: "No Stripe customer for this account" });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  const portal = await stripe.billingPortal.sessions.create({
    customer: stripeCustomer.customerId,
    return_url: `${getOrigin(event)}/dashboard`
  });

  await reportServerEvent("info", "portal_session_created", { userId: claims.sub });

  return json(200, {
    url: portal.url
  });
};
