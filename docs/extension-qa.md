# Holmeta Extension QA Checklist

## 1) Typing Reliability
- Open popup.
- Type into `LICENSE KEY`, `CHECKOUT SESSION ID`, `DISTRACTOR DOMAINS (CSV)`, and `QUICK NOTES`.
- Confirm text does not disappear while typing.
- Confirm paste works in `LICENSE KEY` and `CHECKOUT SESSION ID`.

## 2) Persistence Across Popup Reopen
- Enter a license draft (do not activate), domains text, and notes.
- Close popup and reopen popup.
- Confirm all draft values are still present.

## 3) Persistence Across Browser Restart
- With license draft, domains, and notes entered, close browser fully and reopen.
- Open popup.
- Confirm values remain.

## 4) Domains Save + Restore
- In popup, enter domains as CSV (for example `youtube.com, x.com, reddit.com`).
- Wait ~1 second for autosave status.
- Reopen popup and confirm domains still exist.
- Start a focus session and verify blocker status reflects configured domains.

## 5) License Activation + Persistence
- Enter a valid key and click `ACTIVATE LICENSE`.
- Confirm status switches to active/trial active.
- Close popup and reopen.
- Confirm license remains stored and entitlement state remains visible.

## 6) Offline Grace
- Activate a valid license.
- Disconnect network.
- Refresh entitlement.
- Confirm extension remains usable during grace period (up to 72 hours).

## 7) Stability / Console
- Popup DevTools: no uncaught exceptions while typing, saving, or activating.
- Service worker logs: no repeated message-port-close errors during popup actions.
