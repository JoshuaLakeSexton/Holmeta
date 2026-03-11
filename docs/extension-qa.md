# Holmeta Extension QA Checklist (Launch)

## Latest Execution Record
- Date: March 10, 2026
- Command: `npm run qa:extension-runtime`
- Result: PASS for popup typing persistence, screenshot start, color picker start, and health alert sound path.
- Sites covered by runtime pass: GitHub, Stripe, YouTube, NYTimes, Amazon.
- Note: This checklist remains the manual signoff source for visual readability and nuanced UX behavior.

## 1) Typing + Persistence (Critical)
- Open popup.
- Type in `WHY SAVE THIS?`, `SEARCH`, `LICENSE KEY`.
- Type in `LIGHT INTENSITY` slider + drawer controls.
- Confirm typing/deleting works and does not reset while focused.
- Close popup and reopen: drafts persist.
- Restart browser: drafts still persist.

## 2) Quick Save (Primary)
- Open any HTTP/HTTPS tab.
- Enable `CAPTURE PAGE PREVIEW` (premium) and save.
- Switch preview mode (`FULL PAGE SNAP` / `FOCUS CROP`) and verify each mode saves.
- Click `SAVE THIS TAB`.
- Confirm `SAVED ✓` appears.
- Confirm preview thumbnail appears on the saved card (when capture enabled).
- Click `UNDO SAVE` in 5 seconds and confirm item is removed.
- Trigger shortcut (`save_current_tab`) and verify save works.

## 3) Workboard + Context Filtering
- Save multiple tabs.
- Search by title/domain/note/decision/ref and verify filtering.
- Use tag filter, group filter, context filter, and `HAS REMINDER`.
- Toggle `DEBUG TRAIL ONLY` and verify only debug-marked items remain.
- Open item action menu (`⋯`) and verify:
  - `EDIT NOTE` (note + decision + visual refs + priority + pin + debug + today triage toggle)
  - `SAVE SNIPPET` (premium)
  - `CAPTURE PREVIEW` (premium; requires active page for that item)
  - `OPEN CONTEXT` (premium)
  - `ADD TODAY / REMOVE TODAY` (premium)
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
- Toggle `DONE/UNDO` and verify state updates.
- `OPEN ALL` opens each saved workflow tab.
- `CLEAR` removes all workflow tabs.
- Save snippet via `SAVE SNIPPET` in settings drawer or from item menu.
- Verify snippet can be copied and deleted.

## 6c) Boards + Dossiers
- In `REFERENCE BOARDS`, choose each board type:
  - Group board
  - Context board
  - Client dossier
  - Debug trail
- `OPEN BOARD` opens tabs for the selected source.
- `OPEN NEXT` rotates through the board one page at a time.
- `RESET BOARD ORDER` resets progression.
- `SAVE AS SESSION` creates a session entry.
- `COPY BOARD PACK` copies markdown links for that board.
- Board preview list renders top boards with one-click open/next/copy.

## 6d) Today Triage Lane
- Add at least 3 items to `TODAY TRIAGE`.
- Set priorities (HIGH/MED/LOW) and confirm lane sort order.
- Click `OPEN TOP 3` and confirm first three open.
- Mark item `DONE`, then `UNDO`.
- Use `CLEAR DONE` and confirm done items leave the lane.

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
- Onboarding regression: click `Finish`, reload popup, and confirm onboarding stays completed.

## 11) Translate Tool (New)
- Open popup `9) Translate Tool`.
- Verify source/target language selectors persist after popup close/reopen.
- Select text on a normal web page and click `Translate Selection`.
- Confirm on-page translation card shows original + translated text and copy/save actions.
- Click `Page`, `Section`, and `Visible` and verify text updates while layout remains intact.
- Click `Restore Original` and verify all translated text nodes revert exactly.
- Click `Overlay` and verify side panel appears with source/translated rows, then closes cleanly.
- Verify `Preserve code blocks` keeps `code/pre` content unchanged during page translation.
- Save a phrase; confirm it appears under `Saved Phrases` in popup and persists across restart.
- Confirm `Recent Translations` records new translations and `Clear History` removes entries.
- Enable `Disable on this site`; verify translate actions return disabled state on that hostname.
