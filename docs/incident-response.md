# holmeta incident response runbook (launch)

## Scope
Use this runbook when web billing/license functions fail and users cannot subscribe or unlock premium.

## Severity levels
- `P0` Critical outage: checkout or license validation down for all users.
- `P1` Major degradation: some functions fail intermittently, high error rate.
- `P2` Minor issue: single endpoint or edge case affected, workaround exists.

## Response targets
- Acknowledge user reports within `15 minutes`.
- Mitigate or provide workaround within `60 minutes`.
- Publish resolution or status update within `24 hours`.

## First 15 minutes (triage checklist)
1. Confirm current deploy and function health:
   - `curl -sS https://holmeta.com/.netlify/functions/env-check | jq`
   - `curl -sS https://holmeta.com/.netlify/functions/create-checkout-session | jq`
2. Verify checkout session creation:
   - `curl -sS -X POST https://holmeta.com/.netlify/functions/create-checkout-session -H 'Content-Type: application/json' --data '{"planKey":"monthly_a"}' | jq`
   - `curl -sS -X POST https://holmeta.com/.netlify/functions/create-checkout-session -H 'Content-Type: application/json' --data '{"planKey":"yearly"}' | jq`
3. Verify license validation path:
   - `curl -sS -X POST https://holmeta.com/.netlify/functions/validate-license -H 'Content-Type: application/json' --data '{"licenseKey":"abc","installId":"incident-check"}' | jq`
4. Check Netlify function logs for the failing endpoint.
5. If regression is deploy-related, trigger rollback to previous known-good deploy.

## Common failures and immediate actions

### A) `SERVER_ENV_MISSING`
- Cause: missing Netlify env var.
- Action:
  1. Set missing variable(s) in Netlify Production.
  2. Trigger redeploy.
  3. Re-run triage curl checks.

### B) `PLAN_KEY_INVALID` or `PRICE_INACTIVE`
- Cause: invalid plan selection or inactive Stripe price.
- Action:
  1. Confirm only `monthly_a` and `yearly` are used.
  2. Activate/replace the Stripe price in dashboard.
  3. Re-test checkout endpoint.

### C) `ENTITLEMENT_SCHEMA_MISSING`
- Cause: Neon schema/migration not applied.
- Action:
  1. Run migration: `npm run db:migrate`.
  2. Redeploy Netlify (ensures runtime sees schema).
  3. Re-test entitlement/license endpoints.

### D) webhook not updating subscription status
- Cause: Stripe webhook signing/configuration mismatch.
- Action:
  1. Verify `STRIPE_WEBHOOK_SECRET`.
  2. Verify subscribed events include checkout + subscription updates.
  3. Replay failed events from Stripe dashboard.

## User communication templates

### 1) Acknowledge (initial)
`We’re currently investigating a billing/activation issue affecting Holmeta. Your subscription data is safe. We’ll post an update shortly.`

### 2) Workaround (if available)
`Checkout is temporarily degraded. Please keep your confirmation page open. If activation fails, retry “Refresh Entitlement” in the extension after 5–10 minutes while we complete remediation.`

### 3) Resolved
`The activation issue has been resolved. Please retry checkout or click “Refresh Entitlement” in the extension. If you still see a lock state, send your checkout session id and we’ll resolve it directly.`

### 4) Direct support reply (one user)
`Thanks for reporting this. We confirmed a temporary issue with subscription activation and have now applied a fix. Please open Holmeta extension → Options → Refresh Entitlement. If it still fails, share your checkout session id (from billing success URL) and we’ll complete activation manually.`

## Recovery verification (must pass before closure)
1. `env-check` returns `ok: true`.
2. `create-checkout-session` returns `ok: true` for `monthly_a` and `yearly`.
3. Stripe webhook events process without error.
4. `get-license` returns one-time key on valid paid session.
5. `validate-license` returns active entitlement for paid/test subscriber.
6. Extension unlock confirmed on a clean browser profile.

## Incident closure checklist
- Document root cause and exact fix commit/deploy id.
- Confirm status page updated.
- Add regression guard (test or validation check) so failure is caught pre-deploy.
- Capture one follow-up task with owner and due date.
