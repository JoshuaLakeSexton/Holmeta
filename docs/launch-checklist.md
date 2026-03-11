# Holmeta Launch Checklist

Updated: March 11, 2026

## Preflight

- [x] Working tree clean (no unstaged or untracked release-impacting files)
- [x] `npm run lint` passes (includes real extension lint)
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] `npm run verify:netlify-env` passes
- [x] `npm run validate:extension` passes

## Packaging

- [x] `npm run build:extension:zip` succeeds
- [x] `/apps/extension/holmeta-extension.zip` rebuilt from latest source
- [x] `/apps/web/netlify/functions/assets/holmeta-extension.zip` synced
- [x] Public static zip route is blocked (`/downloads/holmeta-extension.zip` -> 404/403)

## Paid Flow (GA-critical)

- [x] Checkout session creation works (`monthly_a`, `yearly`)
- [ ] Stripe checkout completion confirmed for at least one real session
- [ ] Webhook persisted subscription/license state in Neon
- [ ] `get-license` one-time reveal behavior confirmed
- [ ] `validate-license` returns active/trialing for paid key
- [ ] Extension accepts license and unlocks premium
- [ ] Cancel or `invoice.payment_failed` path verified to downgrade entitlement

## Runtime QA (Latest Extension Build)

- [x] GitHub pass
- [x] Stripe dashboard pass
- [x] YouTube pass
- [x] News/article pass
- [x] Ecommerce pass

Checks per site:
- [ ] Reading theme remains readable (no blacked-out/washed-out pages)
- [ ] Light filter overlays remain single-instance and non-blocking
- [x] Eyedropper/screenshot starts without messaging errors
- [ ] Site overrides and exclusions behave as expected

## Notifications + Sound

- [x] Health alert notifications trigger on schedule
- [x] Sound alert plays when enabled
- [x] Sound stays silent when disabled
- [x] No repeated overlapping sound spam

## Decision Gate

Set one:
- [ ] GO
- [x] SOFT LAUNCH ONLY
- [ ] NO-GO

## Current Status Snapshot (March 11, 2026)

- Automated gates: passing (`npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run verify:netlify-env`, `npm run validate:extension`).
- Runtime smoke automation: `npm run qa:extension-runtime` passes popup typing persistence, screenshot start, color picker start, light diagnostics, and health alert sound path across GitHub, Stripe, YouTube, NYTimes, and Amazon.
- Paid-path endpoint health:
  - `create-checkout-session`: pass (production URL returned).
  - `get-license` server runtime regression (Prisma binary target mismatch) fixed in code (`rhel-openssl-3.0.x` added in Prisma client generation).
  - latest non-dry run still blocks at `get-license` with `402 CHECKOUT_NOT_COMPLETE` for newly created, unpaid sessions (expected until checkout is completed).
- Remaining GO blockers:
  - complete one real paid checkout to generate a completed `cs_...` session.
  - verify one-time reveal returns real `HOLMETA-...` key.
  - verify `validate-license` success path with real key.
  - verify cancel/past_due downgrade path changes entitlement to locked on next check.
