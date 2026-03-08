# HOLMETA v3.0 Assets + Integration Notes

## Included assets
- `assets/icons/icon16.png`
- `assets/icons/icon32.png`
- `assets/icons/icon48.png`
- `assets/icons/icon128.png`
- `assets/icons/icon-master.svg` (editable source)

## Sound alarms
- Sound is generated locally with `AudioContext` (no external audio files).

## TensorFlow.js / face model (optional future premium upgrade)
Current v3.0 ships a lightweight fallback for biofeedback. If you later want full posture/blink inference:
1. Bundle `@tensorflow/tfjs-core`, `@tensorflow/tfjs-backend-webgl`, and `@tensorflow-models/face-landmarks-detection` locally.
2. Load lazily only when biofeedback is enabled.
3. Keep processing <= 1fps and sample every 3-5s.
4. Never fetch remote scripts (CSP disallows it).

## Future license validation hook
`background.js` currently uses local placeholder validation (`HM-...`).
For production licensing, replace `activateLicense()` with a signed token validation flow when backend is ready.
