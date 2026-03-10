# Holmeta Launch Checklist

Updated: March 10, 2026

## Preflight

- [ ] Working tree clean (no unstaged or untracked release-impacting files)
- [ ] `npm run lint` passes (includes real extension lint)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run verify:netlify-env` passes
- [ ] `npm run validate:extension` passes

## Packaging

- [ ] `npm run build:extension:zip` succeeds
- [ ] `/apps/extension/holmeta-extension.zip` rebuilt from latest source
- [ ] `/apps/web/netlify/functions/assets/holmeta-extension.zip` synced
- [ ] Public static zip route is blocked (`/downloads/holmeta-extension.zip` -> 404/403)

## Paid Flow (GA-critical)

- [ ] Checkout session creation works (`monthly_a`, `yearly`)
- [ ] Stripe checkout completion confirmed for at least one real session
- [ ] Webhook persisted subscription/license state in Neon
- [ ] `get-license` one-time reveal behavior confirmed
- [ ] `validate-license` returns active/trialing for paid key
- [ ] Extension accepts license and unlocks premium
- [ ] Cancel or `invoice.payment_failed` path verified to downgrade entitlement

## Runtime QA (Latest Extension Build)

- [ ] GitHub pass
- [ ] Stripe dashboard pass
- [ ] YouTube pass
- [ ] News/article pass
- [ ] Ecommerce pass

Checks per site:
- [ ] Reading theme remains readable (no blacked-out/washed-out pages)
- [ ] Light filter overlays remain single-instance and non-blocking
- [ ] Eyedropper/screenshot starts without messaging errors
- [ ] Site overrides and exclusions behave as expected

## Notifications + Sound

- [ ] Health alert notifications trigger on schedule
- [ ] Sound alert plays when enabled
- [ ] Sound stays silent when disabled
- [ ] No repeated overlapping sound spam

## Decision Gate

Set one:
- [ ] GO
- [ ] SOFT LAUNCH ONLY
- [ ] NO-GO

## Current Status Snapshot (March 10, 2026)

- Automated gates: passing (`lint`, `typecheck`, `build`, `test`, env check, extension validate).
- Runtime smoke automation: `npm run qa:extension-runtime` passes core checks (popup typing persistence, screenshot start, color picker start, sound alert path via offscreen audio) across GitHub, Stripe, YouTube, NYTimes, and Amazon.
- Paid flow: partial automation pass (checkout creation and access control pass), but **real completed checkout + reveal + activation + downgrade** still needs execution and signoff.
- Runtime manual QA: still required for final visual readability signoff on dark/light rendering across target sites.
