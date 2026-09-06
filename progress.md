Original prompt: Fix the WARRING host-room flow so backing out or resetting during room creation cancels polling, closes the pending peer connection, and prevents a late join from unexpectedly entering the room. Keep the existing room-code and join-link UX.

## 2026-09-01

- Added abortable host/join setup operations with cancellation guards around ICE gathering, signaling fetches, and host answer polling.
- Back on either room setup panel now cancels setup, closes the peer, and ignores the expected cancellation error.
- Added Worker/Durable Object room cancellation so a backed-out host code cannot accept a late offer/answer.
- Verified with `node --check`, `git diff --check`, focused transport/Worker cancellation harnesses, and in-app browser lobby/deep-link smoke checks.
- Remaining QA limitation: the declared Wrangler dev command could not start because Wrangler is not installed locally; the `npx` fallback failed with `ENOSPC`.
