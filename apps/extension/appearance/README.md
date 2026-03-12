# Holmeta Day / Night Appearance (Tool 2)

This directory contains Holmeta's production Day / Night Appearance system.

## Runtime architecture

- `palette-presets.js`: user-facing preset families (`Black`, `Coal`, `Iron ore`, `dark Brown`, `Grey`, `Sepia`, `Teal`, `dark Purple`, `dark Green`, and light families).
- `token-generator.js`: derives full structural token sets from preset mood + site class.
- `ui-surface-classifier.js`: finds themeable UI candidates.
- `component-normalizer.js`: normalizes component anatomy and applies contrast/logo repair markers.
- `token-remapper.js`: injects CSS using engine tokens and marker attributes.
- `appearance-engine.js`: orchestrates detection, tokenization, normalization, coherence pass, and lifecycle.
- `darklight-settings.js`: local/sync setting persistence for optional Day/Night floating widget state.
- `darklight-engine.js`: action API (`toggle`, `setDark`, `setLight`, `setAuto`, `getState`, `resetSite`, `showWidget`, `hideWidget`, `excludeSite`).
- `darklight-switch.js`: optional draggable in-page widget, closed Shadow DOM.

## Contrast rules (hard)

- No black text/logo on dark backgrounds.
- No white text/logo on light backgrounds.
- Header/nav and dependent text/icons are solved together.
- After parent surface translation, descendants are re-evaluated in coherence pass.

## Message actions

Use `holmeta:daynight-action` via background bridge with payload:

```json
{
  "type": "holmeta:daynight-action",
  "tabId": 123,
  "action": "setDark",
  "payload": {}
}
```

Supported actions:

- `toggle`
- `setDark`
- `setLight`
- `setAuto`
- `getState`
- `resetSite`
- `showWidget`
- `hideWidget`
- `excludeSite`

## QA focus

- No large white structural slabs in dark mode.
- No black text or black logos left on dark surfaces.
- Header/nav harmonization works on source-colored bars.
- Commerce modules/cards are translated as coherent dark surfaces.
- Protected media (`img`, `video`, `canvas`, `iframe`) remains functional.
