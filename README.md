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
- `HOLMETA_EXPOSE_LOGIN_CODE` (optional; local/dev inline code mode)
- `HOLMETA_ALLOW_INLINE_LOGIN_CODE_IN_PROD` (leave `false` for production)
- `HOLMETA_LOGIN_CODE_MAX_PER_HOUR` (default `6`)
- `RESEND_API_KEY`
- `HOLMETA_EMAIL_FROM`
- `HOLMETA_MONITOR_WEBHOOK_URL` (optional Slack/Discord/webhook sink)
- `NEXT_PUBLIC_ENABLE_CLIENT_MONITORING`

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

## Auth delivery hardening

- Production-safe default: inline login codes are disabled in `NODE_ENV=production`.
- Recommended: configure transactional email with Resend.
  - `RESEND_API_KEY`
  - `HOLMETA_EMAIL_FROM` (e.g. `holmeta <auth@holmeta.com>`)
- Optional local/dev shortcut:
  - set `HOLMETA_EXPOSE_LOGIN_CODE=true` to return one-time login codes inline.
- Safety controls:
  - `HOLMETA_LOGIN_CODE_MAX_PER_HOUR` limits account-code requests per user email.
  - `HOLMETA_ALLOW_INLINE_LOGIN_CODE_IN_PROD` should remain `false`.

## Monitoring and alerts

- Server-side functions now emit structured monitor events to Netlify logs.
- Optional alert fan-out:
  - set `HOLMETA_MONITOR_WEBHOOK_URL` to send warn/error events to your webhook target.
- Client-side error capture:
  - browser runtime errors/unhandled rejections are sent to `/.netlify/functions/client-error`.
  - disable with `NEXT_PUBLIC_ENABLE_CLIENT_MONITORING=false`.

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
npm --prefix apps/extension run build:zip
```

## Deploy

### Web (GitHub → Netlify)

- Root config: `netlify.toml`
- Build command: `npm ci && npm --prefix apps/extension run build:zip && npm --prefix apps/web run build`
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

## Chrome Web Store permission rationale

| Permission | Why Holmeta needs it |
|---|---|
| `storage` | Persist local-first settings, reminders, and entitlement cache. |
| `alarms` | Schedule reminder cadence and focus timers reliably. |
| `notifications` | Optional reminder and focus session notifications. |
| `tabs` | Open dashboard/subscribe pages and apply focus tab controls. |
| `sidePanel` | Optional side-panel command center (user-initiated). |
| `declarativeNetRequest` | Focus mode distractor blocking rules. |
| `idle` | Suppress reminders while user is idle/locked. |
| `videoCapture` (optional) | Webcam posture mode only when user opts in. |
| `host_permissions: <all_urls>` | Required to apply in-page browser-only filters and overlays consistently across user browsing contexts; no keylogging and no page-content harvesting. |

Store review note: Holmeta uses broad host access for rendering transforms and reminder overlays, not for scraping page content.

## Wellness disclaimer

holmeta provides wellness/comfort/focus guidance and is not medical advice.
