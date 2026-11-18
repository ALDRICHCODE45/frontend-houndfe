# Cash-live run 2 — 2026-11-18 (run id `run-20261118-2`)

Backend: isolated `http://127.0.0.1:44885`, resource `eecfefbe-5517-4c64-9477-f966fb976837` (pin unchanged). FE origin `http://127.0.0.1:4189` (`vite.cash-live.config.ts`, started and stopped by the Playwright webServer; port free after the run).
Fixture passed by path only (`artifacts/cash-live/fixture.json`). Its contents were never read. Token grep (`eyJ|bearer|authorization`) on the log and error context: 0.

## Harness changes (selectors only; guards, pin and redaction unchanged)
- `registers-empty`: the AppDataTable shared empty state inside `cash-registers-panel` (`.hf-empty-state[data-kind="empty"]` with «Aún no hay cajas»), plus zero `cash-register-open-*` / `cash-register-name` rows.
- Register row: `cash-register-open-<id>` (name button, text = name) and `cash-register-status-<id>` «Activa». Used both before and after reload.
- Opening: the fund is typed in pesos (`500.00` = 50_000 cents). «Confirmar fondo de $500.00» (`cash-opening-confirmed`, a button now) → `cash-opening-confirmation` «Fondo de $500.00 confirmado» → `cash-open-submit` «Abrir caja con $500.00».
- Session detail: the summary is embedded in `cash-workspace-shift-card`; status from `cash-shift-status` and register from `cash-shift-register`, fund from `cash-session-opening`.

## create-and-open.spec.ts (ran once): FAIL at the final guard assertion (recorded under step `foreign-tenant-read`)
Every functional step passed: preflight, registers-empty, create-register (`POST /cash-registers` → 201), register-visible, register-persisted (after reload), open-session (`POST /cash-registers/:id/sessions` → 201 OPEN, openingCents 50000, `sessionId=2ee7e345-8ac8-4e12-9555-c35e7278e6da`), session-persisted (`GET /cash-sessions/:id` → 200 OPEN), session-detail-ui (Abierta, $500.00, register name), and foreign-tenant-read (`GET /cash-sessions/:id` as the foreign tenant → 422 with the exact flat `CASH_SESSION_NOT_FOUND` body).
The failure is step 12, `expect(guard.violations()).toEqual([])`. The step name was still `foreign-tenant-read`, so the evidence shows a pass and then a fail for that step. The violation entries are not persisted by the spec.
Likely cause (inferred from the code, not observed): the app makes off-origin requests on every page, and the guard aborts and records them. `src/assets/main.css:1` imports `https://fonts.googleapis.com`, and Nuxt UI's `UIcon` uses `@iconify/vue`, which fetches from the Iconify API because no `@iconify-json` collection is installed. Icons are missing in the screenshots. This is a gap between the harness and the environment, not a Caja defect.

## foreign-session-diagnostic.spec.ts: NOT RUN
The precondition "create-and-open passes" was not met. The cross-tenant read was observed inside create-and-open (422). The diagnostic has the same `violations()==[]` assertion, so it would fail the same way (after persisting its record).

## Backend state left
One register «Caja live 1795019362753» (tenant A) with one OPEN session `2ee7e345-…` (fund $500.00). A rerun of create-and-open will fail at `registers-empty` by design until the backend is reset.

## UI observation
After a successful open, the opening form stays mounted with the same register, «Fondo de $500.00 confirmado» and an enabled «Abrir caja con $500.00» (screenshot). Cause: `CashRegisterView.vue:489-491`, keyed on `selectedRegisterId`, which `handleOpenSession` (`:317-327`) does not clear. A second click would request another open on the same register.

## Files
- `create-and-open.playwright.log`: line-reporter output (redacted evidence records only).
- `create-and-open-session-detail-ui.png`, `create-and-open-failed-foreign-tenant-read.png`: UI screenshots.
