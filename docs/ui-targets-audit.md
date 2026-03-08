# Holmeta UI Fix Targets Audit (Targeted Pass)

Date: 2026-03-07

## 1) Onboarding walkthrough implementation targets

- Extension onboarding implementation:
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/popup.html`
    - `#onboarding` dialog
    - `#onboardNext` (Finish/Next button)
    - `#onboardSkip` (Skip / Close fallback)
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/popup.js`
    - `bindOnboardingEvents()`
    - `renderOnboarding()`
    - `completeOnboarding()` (new completion path)
    - `hydrate()` onboarding gate
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/popup.css`
    - `.onboarding` and `.onboarding-card` z-index/pointer-events/hidden behavior

- Extension onboarding completion state:
  - In-memory: `state.app.meta.onboarded` in `popup.js`
  - Persistent extension storage:
    - Background state key: `meta.onboarded` via runtime message `holmeta:set-onboarded`
    - Popup fallback key: `chrome.storage.local["onboardingCompleted"]`
    - Popup local fallback: `localStorage["holmeta_onboarding_completed"]`

- Background handler used by onboarding:
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/background.js`
    - message type: `holmeta:set-onboarded`
    - persists state with `meta.onboarded = true`

## 2) Website/dashboard onboarding targets

- Search results for onboarding/tour/finish on web app found no onboarding walkthrough component:
  - No `onboarding`/`tour` components in `/apps/web/app` routes
  - No FINISH button flow in website/dashboard code
- Conclusion:
  - Onboarding FINISH bug is extension popup-specific in current codebase.

## 3) Button system + theme token targets

- Web shared token and UI layers:
  - `/Users/cultureofelan/Documents/New project/Holmeta/packages/shared/styles/holmeta-tokens.css`
  - `/Users/cultureofelan/Documents/New project/Holmeta/packages/shared/styles/holmeta-ui.css`
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/web/app/globals.css`
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/web/components/holmeta/Button.tsx`

- Extension theme + button/layout styles:
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/ui/theme.css`
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/popup.css`
  - `/Users/cultureofelan/Documents/New project/Holmeta/apps/extension/options.css`

## 4) Likely root cause for FINISH unreliability (from audit)

- Completion previously depended on a single runtime message path (`holmeta:set-onboarded`).
- No fallback persisted flag in popup storage/local storage if runtime call failed or raced.
- No explicit completion function ordering with guarded close/persist/navigate flow.
