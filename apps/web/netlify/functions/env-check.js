export async function handler(event, context) {
  const has = (k) => Boolean(process.env[k] && String(process.env[k]).trim().length);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify({
      // core
      hasStripeSecret: has("STRIPE_SECRET_KEY"),
      hasStripeWebhookSecret: has("STRIPE_WEBHOOK_SECRET"),
      hasDatabaseUrl: has("DATABASE_URL"),
      hasPrice2: has("STRIPE_PRICE_ID_2"),

      // helpful debugging (safe)
      CONTEXT: process.env.CONTEXT || null,
      DEPLOY_CONTEXT: process.env.DEPLOY_CONTEXT || null,
      URL: process.env.URL || null,
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL || null,
      SITE_ID: process.env.SITE_ID ? "present" : "missing",
      NETLIFY: process.env.NETLIFY || null,
    }),
  };
}
