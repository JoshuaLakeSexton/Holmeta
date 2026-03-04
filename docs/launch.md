# holmeta GA launch checklist (no-login)

## Launch architecture

Holmeta GA is **paid checkout + license key unlock**:

1. User selects one of two plans (`monthly_a` or `yearly`).
2. Stripe Checkout completes.
3. `/billing/success?session_id=...` reveals a one-time license key.
4. User downloads extension through `/.netlify/functions/download-extension` (gated).
5. User installs extension and activates premium with license key.

Direct public ZIP access stays blocked at `/downloads/*`.

## Required production env vars (Netlify)

Set these in **Site configuration → Environment variables**:

- `DATABASE_URL` (Neon pooled Postgres URI, `sslmode=require`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY_A`
- `STRIPE_PRICE_YEARLY`
- `PUBLIC_BASE_URL=https://holmeta.com`
- `TRIAL_DAYS=3`
- `LICENSE_SALT`

## Database migration (Neon)

From repo root:

```bash
npm run db:migrate
```

This applies Prisma schema changes (including `licenses`, `license_reveals`, `webhook_events`).

## Stripe configuration

1. Create recurring prices:
   - monthly plan (`monthly_a`)
   - yearly plan (`yearly`)
2. Set:
   - `STRIPE_PRICE_MONTHLY_A`
   - `STRIPE_PRICE_YEARLY`
3. Configure webhook endpoint:

`https://holmeta.com/.netlify/functions/stripe-webhook`

4. Subscribe webhook to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

## Deploy

```bash
npm ci
npm run db:migrate
npm run build:extension:zip
npm -w @holmeta/web run build
```

Deploy via Netlify Git integration.

## Post-deploy verification

### 1) Environment health

```bash
curl -s https://holmeta.com/.netlify/functions/env-check | jq
```

Expect:
- `ok: true`
- all required keys present

### 2) Plan-limited checkout creation

```bash
curl -s -X POST https://holmeta.com/.netlify/functions/create-checkout-session \
  -H 'content-type: application/json' \
  -d '{"planKey":"monthly_a"}' | jq

curl -s -X POST https://holmeta.com/.netlify/functions/create-checkout-session \
  -H 'content-type: application/json' \
  -d '{"planKey":"yearly"}' | jq
```

Expect `ok: true` and Stripe `url` in both responses.

Invalid plan check:

```bash
curl -s -X POST https://holmeta.com/.netlify/functions/create-checkout-session \
  -H 'content-type: application/json' \
  -d '{"planKey":"monthly_b"}' | jq
```

Expect HTTP `400` with `PLAN_KEY_INVALID`.

### 3) Success page reveal + gated download

After completing checkout, open:

`https://holmeta.com/billing/success?session_id=<CHECKOUT_SESSION_ID>`

Expect:
- license revealed exactly once
- protected download succeeds via function

Direct public URL must fail:

```bash
curl -I https://holmeta.com/downloads/holmeta-extension.zip
```

Expect `404` or `403`.

### 4) License validation

```bash
curl -s -X POST https://holmeta.com/.netlify/functions/validate-license \
  -H 'content-type: application/json' \
  -d '{"licenseKey":"HOLMETA-XXXX-XXXX-XXXX-XXXX","installId":"ga-smoke"}' | jq
```

Expect:
- `valid: true`
- `status` in `trialing|active` for paid subscriber

### 5) Subscription cancellation / status propagation

Cancel in Stripe portal, then confirm webhook updates license status and next validation returns `valid: false` or non-active status as expected.

## Smoke test script

Dry run plan coverage:

```bash
npm run e2e:smoke -- --base https://holmeta.com --all-plans --dry-run
```

Post-checkout validation:

```bash
npm run e2e:smoke -- --base https://holmeta.com --session-id <CHECKOUT_SESSION_ID> --license <HOLMETA-LICENSE-KEY>
```

## Rollback

If release fails:

1. Redeploy previous known-good Netlify deploy.
2. Replay failed Stripe webhook events.
3. Re-run smoke checks and critical curls above.
