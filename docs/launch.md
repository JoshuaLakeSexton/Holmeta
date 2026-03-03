# holmeta launch checklist

## Required production env vars (Netlify)

Set these in **Site configuration → Environment variables**:

- `DATABASE_URL` (Neon pooled Postgres URI, `sslmode=require`)
- `APP_JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY_A`
- `STRIPE_PRICE_MONTHLY_B`
- `STRIPE_PRICE_YEARLY`
- `RESEND_API_KEY`
- `HOLMETA_EMAIL_FROM`
- `PUBLIC_BASE_URL=https://holmeta.com`
- `TRIAL_DAYS=3`

Legacy fallback supported:

- `STRIPE_PRICE_ID_2` can act as `STRIPE_PRICE_MONTHLY_A`.

## Database migration (Neon)

From repo root:

```bash
npm run db:migrate
```

This runs Prisma `db push` using `apps/web/prisma/schema.prisma` and creates/updates launch-critical tables/columns (including webhook idempotency records).

## Stripe configuration

1. Create 3 recurring prices in Stripe:
   - monthly option A
   - monthly option B
   - yearly option
2. Put the three price IDs into:
   - `STRIPE_PRICE_MONTHLY_A`
   - `STRIPE_PRICE_MONTHLY_B`
   - `STRIPE_PRICE_YEARLY`
3. Configure webhook endpoint:

`https://holmeta.com/.netlify/functions/stripe-webhook`

4. Subscribe webhook to at least:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

## Deploy

```bash
npm ci
npm run build:extension:zip
npm -w @holmeta/web run build
```

Then deploy through Netlify Git integration.

## Post-deploy verification

### 1) Environment health

```bash
curl -s https://holmeta.com/.netlify/functions/env-check | jq
```

Expect:

- `ok: true`
- all required env keys `true`

### 2) Request login code

```bash
curl -s -X POST https://holmeta.com/.netlify/functions/request-login-code \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com"}' | jq
```

Expect: `{ "ok": true, ... }`

### 3) Verify code and get JWT

```bash
curl -s -X POST https://holmeta.com/.netlify/functions/verify-login-code \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","code":"123456"}' | jq
```

Expect: `{ "ok": true, "token": "..." }`

### 4) Start checkout for a specific plan

```bash
curl -s -X POST https://holmeta.com/.netlify/functions/create-checkout-session \
  -H "authorization: Bearer <DASHBOARD_JWT>" \
  -H 'content-type: application/json' \
  -d '{"plan":"monthly_a"}' | jq
```

Expect: `{ "ok": true, "url": "https://checkout.stripe.com/..." }`

### 5) Validate entitlement after checkout/webhook

```bash
curl -s https://holmeta.com/.netlify/functions/entitlement \
  -H "authorization: Bearer <DASHBOARD_JWT>" | jq
```

Expect:

- `status` in `trialing` or `active`
- `entitled: true`
- `tier` reflects selected plan

### 6) Extension pairing + entitlement refresh

1. Dashboard: generate pairing code.
2. Extension options: paste pairing code.
3. Extension: run “Refresh entitlement”.
4. Confirm premium gating changes immediately based on entitlement payload.

## Smoke test script

Run from repo root:

```bash
npm run e2e:smoke -- --base https://holmeta.com --token <DASHBOARD_JWT> --email you@example.com --plan monthly_a
```

Use `--dry-run` to skip checkout session creation.

## Rollback

If release fails:

1. In Netlify, redeploy last known good deploy.
2. Re-run webhook retry events from Stripe dashboard once fixed.
3. Re-run entitlement checks with the smoke script.
