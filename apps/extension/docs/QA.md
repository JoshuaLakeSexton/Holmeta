# HOLMETA v3.0 Manual QA Checklist

## 1) Install + Startup
- Load unpacked extension from the `Holmeta` folder.
- Confirm popup opens without errors.
- Confirm options page opens without errors.
- Confirm onboarding appears on first open and can be completed/skipped.

## 2) Input Stability (critical)
- Type in all text fields (license key, blocked domains, allowlist, exclusions, site profiles JSON).
- Confirm values do not reset while typing.
- Confirm backspace/delete work.
- Close and reopen popup/options and verify values persist.
- Restart browser and verify values persist.

## 3) Light Filters v2.0
- Toggle on/off and confirm apply latency is under ~200ms.
- Test each mode:
  - Warm Shift
  - Red Overlay
  - Red Monochrome
  - Red Spectrum Lock
  - Grayscale + Warm
  - Dim / Night
  - Focus Spotlight
- Adjust intensity, dim, brightness, contrast soften, and reduce-whites from popup/options.
- Enable therapy pulse and test all cadence values.
- Save site profile from popup and verify override behavior on:
  - docs host (e.g. docs.google.com/notion.so)
  - code host (e.g. github.com)
  - video host (e.g. youtube.com)
- Exclude current host and verify filter does not apply there.
- Run diagnostics in options and confirm strategy/media counts update.

## 4) Site Blocker Tool
- Add current host via popup quick-add.
- Confirm redirects to `blocked.html`.
- Pause blocker 10 minutes from blocked page.
- Enable Nuclear Mode and verify allowlist behavior.
- Disable blocker and confirm normal browsing.

## 5) Health Alerts
- Enable alerts with frequency.
- Trigger Test Alert.
- Verify notification + in-page toast.
- Verify sound toggle affects beep playback.
- Click Snooze 10m and verify alerts are paused.

## 6) Deep Work
- Start 25/5 and verify status countdown.
- Verify transition notifications focus->break->focus.
- Stop manually and verify reset.

## 7) Premium Gating (local placeholder)
- Try premium controls while free; verify disabled state.
- Activate local license (`HM-...`) in options and verify premium controls enable.
- Clear license and verify premium controls disable again.

## 8) Data + Debug
- Export settings JSON and logs JSON.
- Import exported settings and verify restoration.
- Toggle debug and check console prefix `[Holmeta ...]` logs.
- Reset all and verify defaults.

## 9) Performance + Accessibility
- Confirm popup remains responsive at 300-400px width.
- Verify keyboard navigation (Tab, Space/Enter).
- Confirm overlays use `pointer-events:none` and do not block page input.
- Confirm no duplicated light overlays after repeated toggle cycles.
