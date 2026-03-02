# LAUNCH_AUDIT_HOLMETA.md

## 1) Executive Summary
Holmeta is now a working extension-first product with a deployable Next.js web surface, Stripe subscription plumbing, extension pairing + entitlement checks, and a browser-install funnel. The current user experience is coherent: landing explains value, download flow routes by browser family, dashboard handles account-code login + trial/subscription status, and extension popup/options expose the core controls (filters, cadence, focus, hydration/posture/reminders) with premium gating.

The highest launch risks were build stability and trust/compliance surfaces. Before this pass, typecheck/build reliability was fragile, legal/status links were incomplete, and extension store-readiness assets (icons) were missing. Those are now fixed.

Remaining risk is operational rather than code-breaking: authentication is still account-code based without real transactional email delivery, automated tests are mostly smoke/no-op, and monitoring/incident tooling is not yet wired.

---

## 2) Launch Readiness Score + GO / NO-GO

**Launch Readiness Score: 86 / 100**

**Verdict: GO (with WARN items tracked)**

### Category Scorecard (PASS / WARN / FAIL)
| Category | Result | Evidence |
|---|---|---|
| Functional completeness | PASS | Core web routes build and render; extension popup/options/background/content script surfaces are wired and syntactically valid. |
| Content completeness | PASS | No lorem/placeholder blocks on landing hero; legal/status pages exist (`/privacy`, `/terms`, `/status`). |
| Broken clicks/routes | PASS | Internal link check reports no broken internal links. |
| Extension reliability | PASS | `manifest.json` valid; popup/options IDs referenced by JS are present; message paths are wired. |
| Clarity and IA | PASS | Landing and download flows are clear; dashboard status chips + entitlement states are explicit. |
| Accessibility minimums | WARN | Basic semantics/focus styles present; no formal a11y audit tooling yet. |
| Error handling | PASS | Dashboard/extension show explicit status lines for invalid URL, entitlement/API failure, pairing failure. |
| Billing correctness | WARN | Stripe checkout/webhook/entitlement exist; portal falls back to stub when Stripe not configured. |
| Chrome Web Store readiness | PASS | Required icon set (16/32/48/128) now present and declared in manifest. |
| Security/privacy posture | WARN | Local-first and no-keylogging language present; auth still inline-code mode unless email delivery is implemented. |
| Polish (typos/consistency) | PASS | Key copy and install guidance cleaned; footer/legal routes corrected. |

### Minimum Shippable Fix List to Reach GO
Completed in this pass:
1. Stabilize typecheck/build pipeline.
2. Add extension icon set + manifest icon declarations.
3. Add legal/status routes and fix footer links.
4. Fix extension dashboard defaults so dashboard CTA resolves without manual URL setup.
5. Correct manual install instructions for downloadable zip.

---

## 3) Page + Surface Inventory (Complete)

### Marketing / Public Web

#### Item 1
- Name: Home
- URL/Route: `/`
- Purpose: Explain product value and route users to install or dashboard.
- Primary user intent: Understand what Holmeta does quickly.
- Primary CTA(s): `Get Extension`, `Open Dashboard`, `Start Trial`.
- Secondary actions: Anchor nav to Features / How it Works / Privacy / Pricing / FAQ.
- Sections/modules present: Hero, trust strip, capabilities, protocol, privacy posture, pricing, FAQ, footer links.
- Empty/Loading/Error states present? quality rating: N/A (static content), **A-**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Footer legal links previously routed to dashboard (**High**, fixed).
- Fix plan: Completed (added dedicated legal/status routes and linked footer).

#### Item 2
- Name: Download Console
- URL/Route: `/download`
- Purpose: Browser-aware install recommendations + fallback zip/manual instructions.
- Primary user intent: Install extension for current browser.
- Primary CTA(s): Recommended install button, `Download .zip`.
- Secondary actions: Browser family selector, open dashboard.
- Sections/modules present: Detection summary, browser chooser, install panel, manual install panel.
- Empty/Loading/Error states present? quality rating: Zip unavailable warning present, **A-**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Manual instruction previously referenced wrong target folder for downloaded zip (**High**, fixed).
- Fix plan: Completed (instruction now points to extracted folder containing `manifest.json`).

#### Item 3
- Name: Privacy Policy
- URL/Route: `/privacy`
- Purpose: Explain storage/processing boundaries and privacy posture.
- Primary user intent: Trust validation before install/subscribe.
- Primary CTA(s): `Open Dashboard`.
- Secondary actions: `Open Terms`.
- Sections/modules present: What we store, what we do not store, permissions/processing.
- Empty/Loading/Error states present? quality rating: Static legal content, **B+**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Route missing before this pass (**Blocker**, fixed).
- Fix plan: Completed.

#### Item 4
- Name: Terms
- URL/Route: `/terms`
- Purpose: Basic terms, billing, acceptable use.
- Primary user intent: Understand usage terms.
- Primary CTA(s): `Open Billing`.
- Secondary actions: `Open Privacy`.
- Sections/modules present: Service scope, billing/trial, acceptable use.
- Empty/Loading/Error states present? quality rating: Static legal content, **B+**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Route missing before this pass (**Blocker**, fixed).
- Fix plan: Completed.

#### Item 5
- Name: Status / Changelog
- URL/Route: `/status`
- Purpose: Public ops status + release notes.
- Primary user intent: Validate project health and recency.
- Primary CTA(s): None (informational page).
- Secondary actions: N/A.
- Sections/modules present: Operational chip + changelog list.
- Empty/Loading/Error states present? quality rating: Static list, **B**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Route missing before this pass (**High**, fixed).
- Fix plan: Completed.

### Web App / Dashboard

#### Item 6
- Name: Dashboard Account Console
- URL/Route: `/dashboard`
- Purpose: Sign-in, billing, pairing code generation, entitlement visibility.
- Primary user intent: Manage subscription and connect extension.
- Primary CTA(s): `REQUEST CODE`, `VERIFY + LOGIN`, `SUBSCRIBE $2/MO (3-DAY TRIAL)`, `GENERATE PAIRING CODE`.
- Secondary actions: Refresh entitlement, open billing portal, log out, legal/status links.
- Sections/modules present: Status header, sign-in form, billing panel, pairing panel, feature-access panel.
- Empty/Loading/Error states present? quality rating: Good status feedback on all network actions, **A-**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Copy ambiguity for non-email auth path (**Medium**, fixed).
- Fix plan: Completed (added explicit inline-code fallback note).

#### Item 7
- Name: Dashboard Subscribe Entry
- URL/Route: `/dashboard/subscribe`
- Purpose: Lightweight route to direct users into dashboard trial/subscription flow.
- Primary user intent: Start trial quickly.
- Primary CTA(s): `OPEN DASHBOARD`.
- Secondary actions: N/A.
- Sections/modules present: Single guidance panel.
- Empty/Loading/Error states present? quality rating: Minimal but acceptable, **B**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): None critical.
- Fix plan: Keep as thin redirect helper.

### Extension Surfaces

#### Item 8
- Name: Popup Command Center
- URL/Route (or extension view): `apps/extension/src/popup.html`
- Purpose: Fast control surface for filters, focus, cadence, reminder tests, entitlement state.
- Primary user intent: Start/stop focus and adjust immediate behavior.
- Primary CTA(s): Focus buttons, panic off, subscribe, open dashboard/options.
- Secondary actions: Open/close HUD, sound test, reminder tests.
- Sections/modules present: Readouts, primary commands, sound engine, filter controls, tests, paywall.
- Empty/Loading/Error states present? quality rating: Explicit status chips + fallback text, **A-**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Dashboard open could fail when URL unset (**High**, fixed via defaults/fallback).
- Fix plan: Completed.

#### Item 9
- Name: Options Ops Console
- URL/Route (or extension view): `apps/extension/src/options.html`
- Purpose: Full configuration for cadence/filtering/sound/posture/audit/account.
- Primary user intent: Configure long-term behavior and account pairing.
- Primary CTA(s): Save config, apply onboarding, pair extension, refresh entitlement, subscribe.
- Secondary actions: Test reminder, reapply filter, test dashboard URL, test entitlement fetch.
- Sections/modules present: Onboarding, filter engine, calibration/debug, cadence editor, timeline, posture, audit, account.
- Empty/Loading/Error states present? quality rating: Strong status messaging, **A-**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): Placeholder defaults pointed to stale netlify name (**Medium**, fixed).
- Fix plan: Completed.

#### Item 10
- Name: Side Panel
- URL/Route (or extension view): `apps/extension/src/sidepanel.html`
- Purpose: Optional compact control rail.
- Primary user intent: Trigger quick actions without opening popup/options.
- Primary CTA(s): Focus 25/50, snooze, panic off, close panel.
- Secondary actions: Open options.
- Sections/modules present: Topbar, status line, quick action grid.
- Empty/Loading/Error states present? quality rating: Narrow-mode hint + responsive class, **B+**.
- Clickability/functionality status: **PASS** (requires sidePanel permission support).
- Issues found (with severity): Permission mismatch risk before this pass (**High**, fixed by adding `sidePanel` permission).
- Fix plan: Completed.

#### Item 11
- Name: Content Script Runtime Surface
- URL/Route (or extension view): `apps/extension/src/content.js`
- Purpose: Apply page filters, overlays/toasts/modals, optional HUD, panic-off handling.
- Primary user intent: In-page comfort/focus assistance.
- Primary CTA(s): Overlay actions from reminders, escape key panic off.
- Secondary actions: HUD open/close via popup messages.
- Sections/modules present: SVG/CSS filter injection, overlay layer, reminder modal layer, optional HUD host.
- Empty/Loading/Error states present? quality rating: Good guards (protocol + panic + idempotent injection), **A-**.
- Clickability/functionality status: **PASS**.
- Issues found (with severity): None critical in this pass.
- Fix plan: Continue browser-compat smoke checks on high-traffic sites.

---

## 4) Top User Flows (Step-by-Step)

### Flow A: New visitor → understand value → install extension
- Entry: `/`
- Actions: Read hero + trust strip → click `Get Extension` → `/download` auto-recommends browser path.
- Success moment: User starts store install or downloads real zip.
- Retention loop: User installs and is sent to dashboard for pairing/subscription.
- Friction points + fixes:
  - Friction: Wrong manual target folder text for zip install.
  - Fix: Updated to “select extracted folder containing manifest.json”.

### Flow B: New user → onboarding → first success moment
- Entry: `/dashboard`
- Actions: Enter email → request code → verify → generate pairing code → paste in extension options.
- Success moment: Extension entitlement refresh shows trial/premium chip.
- Retention loop: User configures cadence + filters and uses popup daily.
- Friction points + fixes:
  - Friction: unclear non-email fallback behavior.
  - Fix: Added explicit inline-code fallback copy.

### Flow C: User configures filter/reminder → sees in-browser effect
- Entry: Extension popup/options.
- Actions: Select filter preset + intensity; configure cadence mode; run test reminder.
- Success moment: Content script overlay/filter updates active tab.
- Retention loop: Daily reminders + summary + focus loop.
- Friction points + fixes:
  - Friction: dashboard/open-subscribe paths could fail without URL config.
  - Fix: Production defaults + dashboard fallback added in shared extension settings.

### Flow D: Returning user → recall/pairing/entitlement health
- Entry: `/dashboard` with persisted token.
- Actions: Refresh entitlement; open billing portal if needed.
- Success moment: Status chip shows trial/active and feature flags.
- Retention loop: Pairing code regeneration + extension sync.
- Friction points + fixes:
  - Friction: missing public status/legal route lowered trust.
  - Fix: `/status`, `/privacy`, `/terms` added and linked.

### Flow E: Change settings → result reflected
- Entry: Extension options.
- Actions: Edit cadence/filter/sound values → save config.
- Success moment: Status line confirms save; popup/content reflects new state.
- Retention loop: quick action usage in popup.
- Friction points + fixes:
  - Friction: stale placeholder URLs caused confusion.
  - Fix: updated account URL placeholders to production-form values.

### Flow F: Upgrade/subscription flow
- Entry: `/dashboard` billing panel or extension `SUBSCRIBE` CTA.
- Actions: Start checkout → Stripe success redirect → entitlement refresh.
- Success moment: `STATUS: PREMIUM ACTIVE` or `STATUS: TRIAL ACTIVE`.
- Retention loop: Premium features unlocked in extension.
- Friction points + fixes:
  - Friction: when Stripe env missing, portal uses stub route.
  - Fix: documented as WARN; acceptable for dev, must be configured in prod.

---

## 5) Content Journey Outline

1. Awareness (`/`):
   - Learns: what Holmeta does and who it is for.
   - Trust checkpoint: Local-first, browser-only, cancel-anytime language.
   - Improvement made: Added working legal/status links.

2. Install decision (`/download`):
   - Learns: recommended browser path and fallback options.
   - Trust checkpoint: Clear manual steps and zip availability warning.
   - Improvement made: corrected manual install wording.

3. Activation (`/dashboard` + extension options):
   - Learns: account code login, billing status, pairing flow.
   - Trust checkpoint: explicit entitlement state, pairing validity window.
   - Improvement made: clarified inline-code fallback to avoid dead-end confusion.

4. Daily use (popup/options/content scripts):
   - Learns: quick controls in popup, deep config in options, in-page effect behavior.
   - Trust checkpoint: clear status chips + deterministic commands.
   - Improvement made: default dashboard/API URLs so primary CTA works out of the box.

---

## 6) Master Issues Log (Prioritized)

| ID | Severity | Location | Steps to Reproduce | Expected vs Actual | Root Cause | Recommended Fix | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|---|
| HM-001 | Blocker | `npm run typecheck` / `npm run build` | Run quality gates repeatedly after local file churn | Expected stable typecheck; actual intermittent TS missing-file errors | stale TS build metadata + duplicated ambient type discovery | cleanup in typecheck script + harden shared tsconfig types | `npm run typecheck` passes consistently | Fixed |
| HM-002 | Blocker | Extension store readiness | Review `manifest.json` for icon declarations | Expected required icon set; actual missing icons | no icon assets/references | add 16/32/48/128 icons and declare in manifest | manifest includes icons; files present with correct dimensions | Fixed |
| HM-003 | High | Public legal/trust routes | Click footer links on homepage | Expected dedicated legal/status pages; actual links routed to dashboard | incomplete IA and route set | add `/privacy`, `/terms`, `/status`; update footer | routes exist and render content | Fixed |
| HM-004 | High | Extension popup/options dashboard CTA | Fresh extension install, click `OPEN DASHBOARD` | Expected tab opens; actual could fail without manual URL setup | empty default `apiBaseUrl/dashboardUrl` settings | add production defaults + fallback in URL resolver | dashboard CTA opens valid URL on fresh profile | Fixed |
| HM-005 | High | `/download` manual install copy | Follow fallback instructions | Expected accurate path; actual referenced `dist/extension` even for zip | instruction mismatch with packaged artifact | update copy to select extracted folder containing `manifest.json` | instructions align with downloadable zip structure | Fixed |
| HM-006 | High | Side panel control path | Trigger sidepanel open/close actions | Expected sidepanel API usable; actual risk without permission | missing `sidePanel` permission in manifest | add permission in manifest | sidepanel commands available on supported Chromium builds | Fixed |
| HM-007 | Medium | Dashboard sign-in UX | Request account code with no email provider configured | Expected clear fallback; actual ambiguity | auth flow supports inline code but copy unclear | add explicit inline-code fallback note | user sees clear next step after requesting code | Fixed |
| HM-008 | Medium | Operational auth hardening | Disable inline code in env without email provider | Expected reliable delivery; actual no email delivery implementation | no transactional email integration yet | implement Resend/SMTP provider or enforce inline mode explicitly | login works in production mode without exposing code | Open WARN |
| HM-009 | Medium | Billing portal | call portal endpoint without Stripe env | Expected clear disabled state; actual stub URL fallback | dev fallback behavior | document + surface explicit “billing unavailable” state in UI | no ambiguous portal behavior in production | Open WARN |
| HM-010 | Medium | Test coverage | Run `npm test` | Expected meaningful checks; actual smoke/no-op tests | test suite not implemented | add route tests + function tests + extension message tests | CI catches regressions pre-release | Open WARN |
| HM-011 | Low | Monitoring | Post-deploy observability | Expected basic error/perf telemetry | no existing monitor integration | add Sentry/Netlify logs dashboards + alerting | errors visible with alert thresholds | Open WARN |
| HM-012 | Low | Permission scope review | Review host permissions | Expected least privilege narrative | `<all_urls>` is broad (but functionally required for full filtering) | keep with rationale now, plan optional scopes later | store review rationale documented | Open WARN |

---

## 7) Copy Rewrite Set (Before → After)

1. Download fallback instruction
- Before: `Download zip → extract → chrome://extensions → Developer mode → Load unpacked → select dist/extension.`
- After: `Download zip → extract → chrome://extensions → Developer mode → Load unpacked → select the extracted folder that contains manifest.json.`

2. Footer legal links
- Before: `Status / Changelog -> /dashboard`, `Terms -> /dashboard`
- After: `Status / Changelog -> /status`, `Privacy -> /privacy`, `Terms -> /terms`

3. Dashboard sign-in clarity
- Before: generic code-request instruction only.
- After: added explicit fallback note for inline one-time code when transactional email is not configured.

4. Extension account placeholders
- Before: stale netlify-specific placeholders (`holmeta-web.netlify.app`).
- After: production-form placeholders (`https://holmeta.com/.netlify/functions`, `https://holmeta.com/dashboard`).

---

## 8) Implementation Changes (Code Fixes)

### Commits grouped by category
- `793cdd1` — **chore(lint/test): stabilize typecheck and shared ui styles**
- `8a3c2a4` — **fix(extension): add production defaults and store icon set**
- `4ac31e5` — **fix(web): add legal routes and launch copy cleanup**

### Files changed (Blocker + High fixes)
- Extension
  - `apps/extension/manifest.json`
  - `apps/extension/src/common.js`
  - `apps/extension/src/options.html`
  - `apps/extension/src/assets/icons/icon16.png`
  - `apps/extension/src/assets/icons/icon32.png`
  - `apps/extension/src/assets/icons/icon48.png`
  - `apps/extension/src/assets/icons/icon128.png`
- Web
  - `apps/web/app/page.tsx`
  - `apps/web/app/download/page.tsx`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/privacy/page.tsx`
  - `apps/web/app/terms/page.tsx`
  - `apps/web/app/status/page.tsx`
- Build/quality
  - `apps/web/package.json`
  - `apps/web/tsconfig.json`
  - `packages/shared/tsconfig.json`
  - `packages/shared/styles/holmeta-ui.css`
- Packaging artifact
  - `apps/web/public/downloads/holmeta-extension.zip`

### Post-fix verification checklist
Run from repo root:
1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `npm run build:extension:zip`
7. `unzip -l apps/web/public/downloads/holmeta-extension.zip | rg "manifest.json|assets/icons/icon128.png|src/content.js"`
8. Load unpacked extension from `apps/extension/dist/extension` and verify:
   - popup opens and buttons are clickable
   - options page saves config
   - open dashboard/subscription buttons open a tab
   - trial/premium status chips render

### Remaining WARN items (follow-up)
1. Add transactional email delivery (Resend or SMTP) and disable inline auth-code exposure in production.
2. Replace no-op tests with meaningful function/component/extension interaction tests.
3. Add operational monitoring (errors + deploy health) and alert thresholds.
4. Add explicit store-review permission rationale text for `<all_urls>` in public docs.

---

## GO / NO-GO + Remaining Tasks

**GO** for public launch with the WARN follow-ups above queued in the next sprint.

### Exact release steps
1. `npm ci`
2. `npm run lint && npm run typecheck && npm run test && npm run build`
3. `npm run build:extension:zip`
4. Confirm artifact: `apps/web/public/downloads/holmeta-extension.zip`
5. Commit + push `main`
6. Netlify deploy (root config already wired)
7. Upload extension package from `apps/extension/dist/extension` (or generated zip) to Chrome Web Store draft

### Post-launch monitoring suggestions
- Web/API errors: Netlify function logs + deploy logs (required baseline).
- Add Sentry for web + functions (first external observability addition).
- Add Stripe webhook failure alerts (signature/processing errors).
- Track funnel metrics (landing → download → dashboard auth → pairing → subscription) using privacy-conscious event counters.
