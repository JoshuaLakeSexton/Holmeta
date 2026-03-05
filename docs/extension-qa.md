# Holmeta Extension QA Checklist (Launch)

## 1) Typing + Persistence (Critical)
- Open popup.
- Type in `WHY SAVE THIS?`, `SEARCH`, `LICENSE KEY`.
- Type in `LIGHT INTENSITY` slider + drawer controls.
- Confirm typing/deleting works and does not reset while focused.
- Close popup and reopen: drafts persist.
- Restart browser: drafts still persist.

## 2) Quick Save (Primary)
- Open any HTTP/HTTPS tab.
- Click `SAVE THIS TAB`.
- Confirm `SAVED ✓` appears.
- Click `UNDO SAVE` in 5 seconds and confirm item is removed.
- Trigger shortcut (`save_current_tab`) and verify save works.

## 3) Workboard + Minimal Actions
- Save multiple tabs.
- Search by title/domain/note and verify filtering.
- Use tag filter, group filter, and `HAS REMINDER`.
- Open item action menu (`⋯`) and verify:
  - `EDIT NOTE`
  - `SAVE SNIPPET` (premium)
  - `REMIND` (premium)
  - `ADD/REMOVE RESUME` (premium)
  - `REMOVE`

## 4) Reminders
- Set reminder `IN 30 MIN` and verify notification.
- Set reminder `NEXT SITE VISIT`, revisit domain, verify notification.
- Click reminder notification and verify target page opens.

## 5) Resume Queue
- Add 3 items to resume.
- Verify queue order.
- `OPEN NEXT` opens first queued item and removes it.
- `CLEAR` empties queue.

## 6) Sessions + Export
- Open `SETTINGS` drawer.
- `SAVE SESSION` captures current window tabs.
- `OPEN` on a session restores tabs.
- `COPY LINK PACK` copies markdown links for selected source (workboard/tag/session/daily workflow).

## 6b) Daily Workflow + Snippets
- Click `ADD TO DAILY WORKFLOW` from quick save panel.
- Verify entry appears in `DAILY WORKFLOW`.
- `OPEN ALL` opens each saved workflow tab.
- `CLEAR` removes all workflow tabs.
- Save snippet via `SAVE SNIPPET` in settings drawer or from item menu.
- Verify snippet can be copied and deleted.

## 7) Light Controls (Premium)
- Open `LIGHT` drawer.
- Toggle filters on/off.
- Switch modes (Warm, Red Monochrome, Deep Red Overlay, Dim, Grayscale).
- Move intensity slider and click `APPLY`.
- Verify visible effect on active web page.
- Save site profile and verify reapplying on that hostname.
- Clear site profile and verify fallback to global profile.

## 8) Wellness Nudges (Premium, Opt-in)
- Open `WELLNESS` drawer.
- Enable micro-break and eye prompts.
- Save wellness settings.
- Confirm alarms trigger reminder overlays/notifications.
- Click `SNOOZE 15M` and verify alerts pause.

## 9) Premium Gating
- Without valid license:
  - `SAVE THIS TAB` + basic inbox work.
  - premium controls are disabled/locked.
- Activate valid license.
- Confirm premium controls unlock.
- Run `REFRESH` and verify status remains active.

## 10) Stability + Performance
- Popup console: no uncaught errors.
- Service worker console: no repeated message-port errors.
- Content script console on normal sites: no overlay/input interference.
- Rapidly open/close popup 10+ times: no state corruption.
