# Holmeta Extension Entitlement Architecture

## Objective
Implement a strict commercial access model:
- Full 3-day trial with full product access.
- Seamless paid continuation after successful billing.
- Full product lockout when entitlement is inactive after trial.

## Source of Truth
- Primary source of truth: backend `validate-license` response (Stripe-backed state).
- Extension local cache: `chrome.storage.local` state under `entitlement` for fast startup and offline tolerance.

## Trial Trigger
- Trial starts on first extension UI open (`holmeta:get-state` with `source: "popup"` or `source: "options"`).
- Trigger location: background service worker `maybeStartTrial()` within `holmeta:get-state` flow.

## Entitlement State Machine
Implemented states:
- `ACCESS_UNKNOWN`
- `TRIAL_ACTIVE`
- `SUB_ACTIVE`
- `SUB_TRIALING`
- `SUB_PAST_DUE`
- `SUB_CANCELED_ACTIVE_UNTIL_END`
- `BILLING_REQUIRED`
- `ACCESS_LOCKED`

Access decision is centralized in `computeAccessDecision()` and synchronized by `syncEntitlementAccess()`.

## Lockout Enforcement
- Message-level gate in background: non-allowlisted messages return `access_locked`.
- Allowlisted while locked: `get-state`, `activate-license`, `clear-license`, `entitlement-refresh`, onboarding/options open flows.
- Popup/options UI now render an explicit lock screen and hide tool panels when locked.

## Stripe + License Sync
- Extension validates license via:
  - `https://holmeta.com/.netlify/functions/validate-license`
- Refresh happens:
  - startup/initialization
  - explicit refresh (`holmeta:entitlement-refresh`)
  - periodic heartbeat when a license key exists
- Backend/webhook remains authoritative for subscription transitions.

## Offline Behavior
- If previously entitled and temporary validation fails, local grace window can keep access (`graceUntil`).
- If not entitled after trial and no valid subscription state, extension remains locked.

## Update Strategy
- Store updates apply to all users (paid/trial/locked).
- Access remains controlled by entitlement gate, not by code distribution.
- On extension update:
  - state normalization + schema migration
  - entitlement sync
  - lock state re-evaluated before exposing tools

## UI Numbering + Order
Central registry: `apps/extension/ui/tool-registry.js`
- Popup and options section order + titles are controlled from one source.
- Required top order enforced:
  1. Light Filter Tool
  2. Day / Night Appearance

## QA
Use `docs/extension-qa.md` section `12) Entitlement / Trial / Lockout (Critical)` for manual release signoff.
