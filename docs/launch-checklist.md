# Holmeta Launch Checklist

Updated: March 10, 2026

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

## Current Status Snapshot (March 10, 2026)

- Automated gates: passing (`lint`, `typecheck`, `build`, `test`, env check, extension validate, extension zip sync) at 2026-03-10 15:53 ET.
- Runtime smoke automation: `npm run qa:extension-runtime` passes popup typing persistence, screenshot start, color picker start, and sound alert path via offscreen audio across GitHub, Stripe, YouTube, NYTimes, and Amazon.
- Real non-dry-run e2e executed with production base and real checkout session id; blocked at `get-license` with `402 CHECKOUT_NOT_COMPLETE` until session payment is completed.
- Remaining GO blockers: completed paid checkout + one-time reveal + license validation + extension premium unlock + cancel/past_due downgrade confirmation.
