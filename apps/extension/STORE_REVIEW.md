# holmeta Chrome Web Store Review Notes

## Product behavior

holmeta is a privacy-first browser wellness/focus extension. Core functionality:

- In-browser screen filter transforms (browser-only, no system-level control).
- Reminder overlays/notifications (eye, hydration, posture, movement).
- Focus mode with declarative blocking rules.
- Optional paid feature unlock via entitlement checks.

## Data posture

- Default storage: `chrome.storage.local`.
- No keylogging.
- No sale of personal data.
- No page-content harvesting for ad analytics.
- Camera access is optional, runtime-requested, and local-only when posture webcam mode is enabled.

## Permission rationale

| Permission | Rationale |
|---|---|
| `storage` | Save settings, local logs, and entitlement cache. |
| `alarms` | Schedule reminder cadence and focus timers. |
| `notifications` | Deliver reminder/focus prompts when enabled. |
| `tabs` | Open dashboard/subscription pages and manage focus tab actions. |
| `sidePanel` | Optional side panel command center. |
| `declarativeNetRequest` | Apply temporary focus blocking rules. |
| `idle` | Suppress reminders while user is idle/locked. |
| `videoCapture` (optional) | Webcam posture mode only when user opts in. |
| `host_permissions: <all_urls>` | Required to apply visual filter overlays and reminder HUD consistently on sites users visit. |

## Host permission guardrails

- Content script runs only on `http://*/*` and `https://*/*`.
- Runtime protocol guard prevents unsupported contexts.
- Panic Off/ESC escape path removes overlays and pauses injection.
- Overlay/filter layers are `pointer-events:none` where appropriate to avoid page breakage.

## Billing and entitlement

- Subscription status is verified by secure server functions.
- Entitlement states:
  - `trialing`: Light Filters only
  - `active`: all premium modules
  - other statuses: locked

## User-facing policy links

- Privacy: `https://holmeta.com/privacy`
- Terms: `https://holmeta.com/terms`
- Status: `https://holmeta.com/status`
