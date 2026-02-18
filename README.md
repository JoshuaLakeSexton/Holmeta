# holmeta

holmeta is an extension-first, privacy-focused screen health + deep work tool for desk workers on screens 8+ hours/day. v1 ships as a Manifest V3 browser extension (Chrome/Firefox) plus a lightweight web app for pricing/account/billing scaffolding.

## Product Positioning

- Product/business/repo name: `holmeta`
- npm scope/workspaces:
  - `@holmeta/web`
  - `@holmeta/extension`
  - `@holmeta/shared`
- Price target: **$2/month**
- Netlify site suggestion: `holmeta-web` (choose in Netlify UI)
- Extension artifact filename: `holmeta-extension.zip`

## Important v1 Limitation

v1 applies filters and overlays **inside browser content only**. System-wide app filtering requires a future desktop companion.

## Architecture (Text Diagram)

```text
+--------------------+            +-------------------------------+
| Browser Extension  |            | Web App (Next.js on Netlify) |
| @holmeta/extension |            | @holmeta/web                 |
|--------------------|            |-------------------------------|
| popup/options UI   |            | landing + pricing            |
| content overlays   |            | dashboard (account stub)     |
| alarms + reminders |            | checkout trigger             |
| focus DNR blocking |            | entitlement status view      |
| local data storage |            +---------------+---------------+
+---------+----------+                            |
          |                                       |
          | optional entitlement check            |
          v                                       v
+----------------------------+      +-----------------------------------+
| /api/entitlement           |      | Netlify Functions (web/netlify)  |
| /api/checkout              |      | entitlement / checkout / webhook  |
| /api/stripe-webhook        |      | settings-sync (paid stub)         |
+----------------------------+      +-----------------------------------+

Shared logic/types: @holmeta/shared (filter math, schedules, schemas, trends)
```

## Monorepo Structure

```text
holmeta/
  README.md
  .gitignore
  package.json
  package-lock.json
  tsconfig.base.json
  netlify.toml
  .env.example
  apps/
    web/
    extension/
  packages/
    shared/
  scripts/
    new-project.sh
  .github/workflows/
    ci.yml
    build-extension.yml
```

## MVP Features Implemented

- Circadian blue/red/night filter control with SVG `feColorMatrix`
- 20-20-20 eye recovery reminders with guided overlays
- Hydration reminders + glass logging + streak calculation
- Breathwork sessions (box, 4-7-8, physiological sigh) + calm minutes
- Stillness detection using idle/activity signals
- Optional webcam posture monitor (runtime permission + local only, FaceDetector fallback)
- Weekly ergonomic audit + optional local photo + daily energy/mood/sleep logs + trend canvas
- Deep work focus mode with DNR blocking + optional tab closing + panic stop
- Premium paywall stub + entitlement scaffolding + dev bypass mode

## Privacy Model

- Local-first: extension state in `chrome.storage.local`
- No keylogging, no data sale
- Webcam posture mode is optional and local-only
- Minimal required permissions for alarms/storage/reminders/focus blocking

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Run web app

```bash
npm run dev:web
```

### 3) Load extension unpacked

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click Load unpacked
4. Select: `apps/extension`

## Build + Packaging

### Build everything

```bash
npm run build
```

### Build extension zip

```bash
npm run zip:extension
```

Output: `apps/extension/holmeta-extension.zip`

## Web Deployment (GitHub -> Netlify)

- Netlify config is pinned in root `netlify.toml`
- Build command: `npm run build -w @holmeta/web`
- Publish dir: `apps/web/.next`
- Functions dir: `apps/web/netlify/functions`
- Redirects `/api/*` -> `/.netlify/functions/:splat`

Set env vars from `.env.example` in Netlify UI.

## Extension Distribution (GitHub Actions)

- Workflow: `.github/workflows/build-extension.yml`
- Trigger: tag push matching `ext-v*`
- Artifact produced: `holmeta-extension.zip`

Store upload flow:

1. Tag release (`ext-v0.1.0`)
2. Download artifact from Actions
3. Upload zip to Chrome Web Store and Firefox AMO dashboards

## Subscription Scaffold (Phased)

Netlify Functions included:

- `GET /api/entitlement`
- `POST /api/checkout`
- `POST /api/stripe-webhook`
- `GET|POST /api/settings-sync` (paid stub)

Current MVP behavior:

- Paywall UI always visible
- `devBypassPremium=true` keeps features usable in development
- When bypass is off, advanced controls are gated by entitlement state

## CI

`ci.yml` runs:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Utility Script

Create new clean projects under `~/Documents/Projects`:

```bash
./scripts/new-project.sh my-project
```

## Notes

- Browser compatibility: designed for Chromium MV3 and modern Firefox extension flows.
- Keep extension package lightweight and local-first for sustainable low pricing.
