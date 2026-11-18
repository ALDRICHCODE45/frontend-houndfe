# Cash-live run 4: 2026-11-18 (run id `run-20261118-4`)

Backend: isolated `http://127.0.0.1:44071`, resource `d7e8a0a1-f01d-4c67-9d16-6ccb92e80281`. FE origin `http://127.0.0.1:4189` (`vite.cash-live.config.ts` dev server, started and stopped by the Playwright webServer; port free after each run). FE includes the dev icon fix e0b14931.
The fixture was passed by path only (`artifacts/cash-live/fixture.json`); nobody read it, and it was not deleted. Token grep (`eyJ|bearer|authorization`) on both logs and the diagnostic JSON: 0.

## Harness changes (uncommitted)
- Re-pinned the backend origin and resource id in `create-and-open.spec.ts`, `support/foreign-diagnostic.ts` and `__tests__/foreign-diagnostic.spec.ts`. The ownership check is unchanged.
- `foreign-session-diagnostic.spec.ts`: the stale `44885 / eecfefbe…` comment now reads `44071 / d7e8a0a1…`. The spec now prints the redacted summary before the guard check. On a guard violation it fails with the distinct blocked origins only (`METHOD origin` reduced to the origin, like create-and-open).
- `pnpm test:cash-live:unit`: 7 files / 143 tests pass.

## create-and-open.spec.ts (ran once): PASS (12.6s)
- `preflight` and `registers-empty` passed.
- `create-register`: `POST /cash-registers` → 201. The register was then visible, and still visible after a reload.
- `open-session`: `POST /cash-registers/:id/sessions` → 201 OPEN, `sessionId=66252d9a-d44a-4a79-8d08-d64d7ec97bbe`.
- `session-persisted`: `GET /cash-sessions/:id` → 200 OPEN.
- `open-form-dismissed`: the form and its submit are gone.
- `session-detail-ui`: OPEN with the opening fund.
- `foreign-tenant-read`: → 422.
- `outbound-guard`: no request reached an unlisted origin. 0 blocked origins.

## foreign-session-diagnostic.spec.ts (ran once, target 66252d9a-…): PASS (7.2s)
The foreign actor landed on `/pos/caja` with the registers panel visible (no redirect). It made one GET: 422 `{"error":"CASH_SESSION_NOT_FOUND","message":"Cash session not found"}`. 0 blocked origins.

## Backend state left
Tenant A has one register with one OPEN session `66252d9a-…`.

## Files
- `create-and-open.playwright.log`, `foreign-session-diagnostic.playwright.log`: line-reporter output (redacted).
- `foreign-session-diagnostic.json`: copy of the allowlisted, redacted record from `artifacts/cash-live/run-20261118-4/`.
