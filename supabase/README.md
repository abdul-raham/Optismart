# Database

- `migrations/` — changes still to apply, newest last. Run each once in the Supabase SQL Editor (they are safe to re-run).
- `history/` — every SQL file that was run before October 2026, renamed with the date it was added so the order is
  clear. They are already applied; keep them for reference, don't re-run them.
- `history/one-off/` — single-use fixes and seeds (making someone admin, deleting a mistaken expense, test policies).
  Never re-run these.

Scripts in `/scripts` read credentials from the environment (`PORTAL_SCRIPT_PASSWORD`, etc.), never from the code.
