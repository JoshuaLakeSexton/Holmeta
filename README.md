# holmeta

holmeta is an extension-first, privacy-focused screen health + deep work toolkit.

- Extension: `@holmeta/extension` (MV3)
- Web app: `@holmeta/web` (Next.js + Netlify Functions)
- Shared package: `@holmeta/shared`

## Launch architecture (no-login)

Holmeta launch uses **paid checkout + license key unlock**:

1. User subscribes with Stripe Checkout (`monthly_a`, `yearly`).
2. After successful checkout, `/billing/success` reveals a one-time license key.
3. Extension user enters license key in Popup/Options.
4. Extension validates key via `/.netlify/functions/validate-license`.
5. Active/trialing subscription unlocks premium.

No email OTP. No account creation required for launch.

## Browser-only limitations vs Iris system-wide

holmeta v1 can only transform browser-rendered content. A browser extension cannot apply system-wide gamma ramps like Iris.

## Workspace commands

From repo root:

```bash
npm install
npm run typecheck
npm run build
```

Extension build + zip:

```bash
npm -w @holmeta/extension run build
npm run build:extension:zip
```

Web build:

```bash
npm -w @holmeta/web run build
```

## Required env vars

Production runtime (Netlify):

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY_A`
- `STRIPE_PRICE_YEARLY`
- `PUBLIC_BASE_URL`
- `TRIAL_DAYS` (default `3`)
- `LICENSE_SALT`

Optional legacy fallback:

- `STRIPE_PRICE_ID_2` (used only if `STRIPE_PRICE_MONTHLY_A` is empty)

Verify Netlify env:

```bash
npm run verify:netlify-env
```

## Stripe setup

1. Create recurring prices in Stripe:
   - monthly A
   - yearly
2. Add webhook endpoint:
   - `https://<site>/.netlify/functions/stripe-webhook`
3. Subscribe webhook to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Set `STRIPE_WEBHOOK_SECRET`.

## Netlify deploy

`netlify.toml` builds from monorepo root and deploys `apps/web`.

## Extension unlock flow

1. Open `/dashboard/subscribe` and complete checkout.
2. Open `/billing/success?session_id=...`.
3. Copy license key.
4. In extension Popup or Options, enter license key and click **Activate License**.
5. Click **Refresh Entitlement** to force recheck.

## Endpoints used at launch

- `POST /.netlify/functions/create-checkout-session`
- `POST /.netlify/functions/stripe-webhook`
- `GET|POST /.netlify/functions/get-license`
- `POST /.netlify/functions/validate-license`
- `GET|POST /.netlify/functions/entitlement` (compat alias style response)
- `POST /.netlify/functions/create-portal-session`

Deprecated (return 410):

- `request-account-code`
- `verify-account-code`
- `create-pairing-code`
- `exchange-pairing-code`
- `settings-sync`

## Smoke test

```bash
npm run e2e:smoke -- --base https://holmeta.com --all-plans --dry-run
# after manual checkout:
npm run e2e:smoke -- --base https://holmeta.com --session-id <CHECKOUT_SESSION_ID> --license <HOLMETA-KEY>
```

## Wellness disclaimer

holmeta provides wellness/comfort/focus guidance and is not medical advice.
