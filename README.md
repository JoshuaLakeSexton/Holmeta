# holmeta

holmeta is an extension-first, privacy-focused screen health + deep work stack for people on screens 8+ hours/day.

- Extension: `@holmeta/extension` (Chrome/Firefox MV3)
- Web app: `@holmeta/web` (Next.js + Netlify Functions)
- Shared package: `@holmeta/shared`
- Pricing target: **$2/month**

## Browser-only limitations vs Iris system-wide

holmeta v1 can only transform browser-rendered content. A browser extension cannot apply true OS-level gamma ramps like Iris system-wide controls. holmeta achieves strong in-browser intensity via:

- SVG `feColorMatrix`
- CSS filter stack (brightness/contrast/saturation)
- Overlay tint layer + blend modes

## Architecture

```text
+-----------------------------------------+
| Browser Extension (@holmeta/extension)  |
|-----------------------------------------|
| Filter Engine v2 (matrix+css+overlay)   |
| Cadence Engine v2 (interval/work/window)|
| Quiet/idle/focus/meeting suppression    |
| Focus mode (DNR + tab actions)          |
| Local-first logs + onboarding           |
+---------------------+-------------------+
                      | Bearer token (pairing flow)
                      v
+-----------------------------------------+
| Netlify Functions (apps/web/netlify)    |
|-----------------------------------------|
| request-account-code / verify-account   |
| create-checkout-session                 |
| stripe-webhook                          |
| create-portal-session                   |
| create-pairing-code / exchange-pairing  |
| entitlement / settings-sync             |
+---------------------+-------------------+
                      |
                      v
+-----------------------------------------+
| Postgres + Prisma (apps/web/prisma)     |
|-----------------------------------------|
| User / StripeCustomer / Subscription    |
| PairingCode / ExtensionToken / LoginCode|
+-----------------------------------------+
```

## Free vs Premium

Free:

- Basic filters
- Basic eye reminders (interval mode)
- Basic focus sessions

Premium ($2/mo):

- Advanced cadence modes (work blocks + time windows)
- Meeting auto-suppression + richer summaries
- Pairing-token entitlement + paid sync endpoint

## Local development

### 1) Install

```bash
npm install
```

### 2) Configure env

Copy `.env.example` and set:

- `DATABASE_URL`
- `APP_JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_2`
- `TRIAL_DAYS`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_CHROME_STORE_URL`
- `NEXT_PUBLIC_EDGE_STORE_URL`
- `NEXT_PUBLIC_FIREFOX_AMO_URL`
- `NEXT_PUBLIC_SAFARI_URL`
- `PUBLIC_BASE_URL`
- `HOLMETA_EXPOSE_LOGIN_CODE` (optional; enable test login code output in non-prod)

### 3) Prepare DB schema

```bash
npm -w @holmeta/web run prisma:dbpush
```

### 4) Run web + functions

Use Netlify local runtime so function paths behave like production:

```bash
netlify dev
```

### 5) Build extension and load unpacked

```bash
npm -w @holmeta/extension run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click Load unpacked
4. Select `apps/extension/dist/extension`

## Stripe setup (test mode)

1. In Stripe, create a monthly `$2` recurring price.
2. Put the price ID into `STRIPE_PRICE_ID_2`.
3. Set `TRIAL_DAYS` (default `3`).
4. Deploy web app to Netlify.
5. Add webhook endpoint:
   `https://<your-site>/.netlify/functions/stripe-webhook`
6. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Set `STRIPE_WEBHOOK_SECRET` in Netlify env.
8. Entitlement is active only for `trialing` and `active` statuses; trial end locks premium features in the extension.

## Extension pairing flow

1. Log into `/dashboard` with account code flow.
2. Click **Generate Pairing Code**.
3. In extension Options, enter code under **Account + Premium Entitlement**.
4. Extension exchanges code for JWT and stores it locally.
5. Extension refreshes entitlement via `/.netlify/functions/entitlement`.

## Download CTA configuration

- Landing uses a browser-aware **Download Extension** CTA and routes to `/download`.
- Configure store links with:
  - `NEXT_PUBLIC_CHROME_STORE_URL`
  - `NEXT_PUBLIC_EDGE_STORE_URL`
  - `NEXT_PUBLIC_FIREFOX_AMO_URL`
  - `NEXT_PUBLIC_SAFARI_URL`
- Manual Chromium fallback uses `apps/web/public/downloads/holmeta-extension.zip`.
- To generate the archive from monorepo root:

```bash
npm run zip:extension
cp apps/extension/holmeta-extension.zip apps/web/public/downloads/holmeta-extension.zip
```

## Deploy

### Web (GitHub → Netlify)

- Root config: `netlify.toml`
- Build command: `npm ci --include=dev && DATABASE_URL=${DATABASE_URL:-postgresql://placeholder:placeholder@localhost:5432/holmeta} npm -w @holmeta/web run build`
- Functions dir: `apps/web/netlify/functions`
- Note: set a real `DATABASE_URL` in Netlify for runtime function access (build uses a safe fallback only).
- Redirect `/api/*` → `/.netlify/functions/:splat`

### Extension (GitHub Actions)

- Workflow: `.github/workflows/build-extension.yml`
- Trigger tags: `ext-v*`
- Artifact: `holmeta-extension.zip`

## Core extension capabilities (current)

- Filter Engine v2 with strong presets and panic/color-accurate toggles
- Cadence Engine v2 with per-reminder scheduling modes
- Quiet hours + suppress-on-focus + suppress-on-idle + meeting mode
- Reminder delivery styles (overlay/notification/popup-only/sound/gentle)
- Test reminders + timeline preview + completion summaries
- Focus mode with DNR rules + panic stop
- Hydration, breathwork, daily logs, ergonomic audit, posture monitor

## Wellness disclaimer

holmeta provides wellness/comfort/focus guidance and is not medical advice.
