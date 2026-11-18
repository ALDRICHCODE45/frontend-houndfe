# Cash-live run 2026-11-18 (run id `run-20261118`)

Backend: isolated `http://127.0.0.1:44885`, resource `eecfefbe-5517-4c64-9477-f966fb976837`. FE origin `http://127.0.0.1:4189` (`vite.cash-live.config.ts`, started/stopped by Playwright webServer).
The fixture was passed by path only (`artifacts/cash-live/fixture.json`). Its contents were never read. No token appears in any file here (grep for `eyJ|bearer|authorization` = 0).

## create-and-open.spec.ts (ran once): FAIL at step `registers-empty`
- `preflight`: pass. Ownership pin, access-only fixture, tenants and permissions all verified.
- `navigate-caja`: pass. `/pos/caja` loaded as Cashier A (Cash Live Tenant A), and `cash-registers-panel` is visible.
- `registers-empty`: FAIL. The UI shows the correct empty state («Aún no hay cajas» / «Crea la primera para operar.»; see screenshot), but the harness waits for `data-testid="cash-registers-empty"`, which no longer exists in `src`.
- Cause: the FE moved the list to AppDataTable in `431784d8` (`CashRegistersPanel.vue`), which removed `cash-registers-empty` and `cash-register-item-<id>`. `cash-register-name` now only renders for rows that cannot be opened. This is selector drift in the harness, not a functional FE defect.
- No mutation happened: no register was created and no session was opened.

## foreign-session-diagnostic.spec.ts: NOT RUN
It needs `CASH_LIVE_FOREIGN_SESSION_ID` from a session opened by create-and-open, and no session was opened. Without the id the spec only skips by design.

## Files
- `create-and-open.playwright.log`: Playwright line-reporter output (redacted evidence records only).
- `create-and-open-failed-registers-empty.png`: UI at the failing step.
