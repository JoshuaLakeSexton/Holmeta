# holmeta

holmeta is an extension-first, privacy-focused screen health + deep work toolkit.

- Extension: `@holmeta/extension` (MV3)
- Web app: `@holmeta/web` (Next.js + Netlify Functions)
- Shared package: `@holmeta/shared`

## Launch architecture (no-login)

Holmeta launch uses **paid checkout + license key unlock**:

1. User subscribes with Stripe Checkout (`monthly_a`, `yearly`).
2. After successful checkout, `/billing/success` reveals a one-time license key.
3. `/billing/success` can download the extension zip via a gated function.
4. Extension user enters license key in Popup/Options.
5. Extension validates key via `/.netlify/functions/validate-license`.
6. Active/trialing subscription unlocks premium.

No email OTP. No account creation required for launch.

Direct public zip access is disabled. `https://holmeta.com/downloads/holmeta-extension.zip` is blocked.

## Browser-only limitations vs Iris system-wide

holmeta v1 can only transform browser-rendered content. A browser extension cannot apply system-wide gamma ramps like Iris.

## Workspace commands

From repo root:

```bash
npm install
npm run typecheck
npm run build
```

Extension build + gated zip sync:

```bash
npm -w @holmeta/extension run build
npm run build:extension:zip
```

`build:extension:zip` writes the zip to:

- `apps/extension/holmeta-extension.zip` (local artifact)
- `apps/web/netlify/functions/assets/holmeta-extension.zip` (served only by gated function)

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
3. Click **Download Extension** (served by protected download function).
4. Copy license key.
5. In extension Popup or Options, enter license key and click **Activate License**.
6. Click **Refresh Entitlement** to force recheck.

## Endpoints used at launch

- `POST /.netlify/functions/create-checkout-session`
- `POST /.netlify/functions/stripe-webhook`
- `GET|POST /.netlify/functions/get-license`
- `POST /.netlify/functions/validate-license`
- `GET|POST /.netlify/functions/entitlement` (license-based compatibility response)
- `POST /.netlify/functions/create-portal-session`
- `GET|POST /.netlify/functions/download-extension`

Deprecated (return 410):

- `request-account-code`
- `verify-account-code`
- `settings-sync`

## Smoke test

```bash
npm run e2e:smoke -- --base https://holmeta.com --all-plans --dry-run
# after manual checkout:
npm run e2e:smoke -- --base https://holmeta.com --session-id <CHECKOUT_SESSION_ID> --license <HOLMETA-KEY>
```

## Incident response

- Runbook + support templates: `docs/incident-response.md`

## Wellness disclaimer

holmeta provides wellness/comfort/focus guidance and is not medical advice.
