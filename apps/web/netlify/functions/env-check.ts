import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed } from "./_lib/http";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY_A",
  "STRIPE_PRICE_YEARLY",
  "PUBLIC_BASE_URL",
  "TRIAL_DAYS",
  "LICENSE_SALT"
] as const;

function hasValue(name: string): boolean {
  return Boolean(String(process.env[name] || "").trim());
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "GET") {
    return methodNotAllowed(["GET", "OPTIONS"]);
  }

  const env = Object.fromEntries(REQUIRED_KEYS.map((key) => [key, hasValue(key)])) as Record<
    (typeof REQUIRED_KEYS)[number],
    boolean
  >;

  const missing = Object.entries(env)
    .filter(([, present]) => !present)
    .map(([key]) => key);

  return json(200, {
    ok: missing.length === 0,
    env,
    missing
  });
};
