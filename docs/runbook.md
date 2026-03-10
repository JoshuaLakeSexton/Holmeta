# Holmeta Launch Runbook

Updated: March 10, 2026

## 1) Checkout Fails

Symptoms:
- `create-checkout-session` returns non-200
- User sees checkout redirect failure

Steps:
1. Check `/apps/web/netlify/functions/create-checkout-session.ts` deploy status in Netlify logs.
2. Confirm production env vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_MONTHLY_A`
   - `STRIPE_PRICE_YEARLY`
   - `PUBLIC_BASE_URL`
3. Run:
   - `npm run e2e:smoke -- --base https://holmeta.com --all-plans`
4. If one plan fails, validate its price ID in Stripe dashboard and Netlify env.

## 2) Webhook Fails

Symptoms:
- Checkout completes, but no license/entitlement update
- Stripe retries webhook deliveries

Steps:
1. Open Stripe event deliveries for webhook endpoint.
2. Check Netlify logs for `stripe-webhook`.
3. Validate `STRIPE_WEBHOOK_SECRET` is correct in Netlify Production.
4. Verify DB availability (`DATABASE_URL`) and migration state.
5. Confirm idempotency table writes (no repeated fatal errors on same event ID).

## 3) License Reveal Fails (`get-license`)

Symptoms:
- `not_paid`, `already_revealed`, or server error on success page

Steps:
1. Confirm `session_id` is from completed checkout and not truncated.
2. Retry endpoint directly:
   - `/.netlify/functions/get-license?session_id=cs_...`
3. If `already_revealed`, use support fallback workflow (manual recovery path).
4. If `not_paid`, verify checkout actually completed in Stripe.

## 4) Extension Activation Fails

Symptoms:
- Valid paid user cannot unlock premium

Steps:
1. In extension popup, run activation again and inspect service worker logs.
2. Check `validate-license` response:
   - `/.netlify/functions/validate-license`
3. Confirm local storage state persisted (`license`, status, timestamps).
4. Reload extension and retry.
5. If status is inactive despite payment, inspect webhook subscription status mapping.

## 5) Dark/Light Rendering Fails on Specific Site

Symptoms:
- Page unreadable, over-darkened, washed out

Steps:
1. Toggle `Exclude site` and confirm immediate recovery.
2. Switch reading preset to lower-intensity safe preset.
3. Disable one of `Reading Theme` or `Light Filter` to isolate composition.
4. Verify only one overlay root exists (no duplicate injection).
5. Apply site override with reduced intensity and save profile.

## 6) Notifications / Sound Fails

Symptoms:
- Alerts appear without sound, or no alerts at all

Steps:
1. Confirm alerts enabled in popup settings and frequency configured.
2. Confirm offscreen document created and not failing in service worker logs.
3. Verify browser notification permission is granted.
4. Trigger test alert and inspect:
   - offscreen lifecycle
   - audio message dispatch
5. If blocked by browser autoplay policy, ensure playback path originates from extension-controlled flow.

## 7) Emergency Rollback

1. In Netlify, redeploy previous known-good production deploy.
2. Revert extension artifact to prior signed zip if store release is impacted.
3. Announce incident window and mitigation in status page.
4. Open follow-up issue with:
   - root cause
   - impacted surfaces
   - prevention action
