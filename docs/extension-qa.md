# Holmeta Extension QA Checklist

## 1) Input Reliability + Persistence
- Open popup.
- Type in `WHY SAVE THIS?`, `TAGS`, `SEARCH`, and `LICENSE KEY`.
- Confirm text does not reset while focused.
- Close popup and reopen; confirm values persist.
- Restart browser; confirm values persist.

## 2) Quick Save (Primary Action)
- Open any HTTP/HTTPS tab.
- Click `SAVE THIS TAB`.
- Confirm `SAVED ✓` appears.
- Click `UNDO SAVE` within 5 seconds and confirm item disappears.

## 3) Inbox Search + Filters
- Save multiple tabs.
- Search by title/domain/note and verify filtering.
- Apply tag filter and `HAS REMINDER` filter.
- Verify sort is newest first (pinned first when pinned).

## 4) Item Actions
- `OPEN` opens the saved URL.
- `EDIT` saves note changes (and tags when premium active).
- `REMOVE` deletes item and stays deleted after popup reopen.

## 5) Reminders (Premium)
- Set `IN 30 MIN` and verify a notification fires.
- Set `NEXT SITE VISIT` and then visit the domain; verify notification fires.
- Click reminder notification and verify tab opens.

## 6) Session Bundles (Premium)
- Click `SAVE SESSION` in a window with multiple tabs.
- Confirm session appears in list.
- Click `OPEN` to restore tabs.
- Remove session and verify it stays removed after reopen.

## 7) Resume Queue (Premium)
- Add 3 items with `ADD RESUME`.
- Verify queue order and max cap (7).
- Click `OPEN NEXT` and verify first item opens and is removed from queue.
- Click `CLEAR` and verify queue empties.

## 8) Export Link Pack (Premium)
- Select source: current inbox, tag, or session.
- Click `COPY LINK PACK`.
- Paste into a text editor and verify markdown links are correct.

## 9) Premium Gating
- Free mode: `SAVE THIS TAB` and basic inbox must work.
- Free mode: reminder/session/resume/export/tag-edit actions must be disabled with premium lock cue.
- Enter valid license and activate.
- Confirm premium controls unlock immediately.

## 10) Stability
- Popup DevTools console: no uncaught exceptions during save/edit/remind/session flows.
- Service worker console: no repeated runtime message errors.
