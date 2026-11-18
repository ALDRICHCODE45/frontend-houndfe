# Cash-live run 3: 2026-11-18 (run id `run-20261118-3`)

Backend: isolated `http://127.0.0.1:33721`, resource `09303049-565e-4aa5-9fc5-95212e471dfc`. FE origin `http://127.0.0.1:4189` (`vite.cash-live.config.ts` **dev** server, started and stopped by the Playwright webServer; port free after the run).
The fixture was passed by path only (`artifacts/cash-live/fixture.json`). Nobody read its contents, and it was not deleted. Token grep (`eyJ|bearer|authorization`) on the log and error context: 0.

## Harness changes
- Re-pinned the backend origin and resource id in `create-and-open.spec.ts`, `support/foreign-diagnostic.ts` and `__tests__/foreign-diagnostic.spec.ts`. The ownership check is unchanged. `pnpm test:cash-live:unit`: 7 files / 143 tests pass.
- New step `open-form-dismissed` (follows 259b6d05): after the open, `cash-open-session` and `cash-open-submit` must have count 0.
- The guard assertion now has its own step, `outbound-guard`. Before it asserts, it records the distinct blocked origins. The guard entries are already reduced to `METHOD origin`, so no paths and no tokens are stored. The `violations()==[]` assertions are unchanged.
- Not edited because it is outside the allowed surfaces: `specs/foreign-session-diagnostic.spec.ts:20` still says «44885 / eecfefbe…» in a comment. The spec also does not persist blocked origins.

## create-and-open.spec.ts (ran once): FAIL at `outbound-guard`
Every functional step passed:
- `preflight` and `registers-empty` passed.
- `create-register`: `POST /cash-registers` → 201. The register was then visible, and still visible after a reload.
- `open-session`: `POST /cash-registers/:id/sessions` → 201 OPEN, 50000 cents, `sessionId=059fdff4-06d0-4073-a4b0-a76172c6ece1`.
- `session-persisted`: `GET /cash-sessions/:id` → 200 OPEN.
- `open-form-dismissed`: the form and its submit are gone.
- `session-detail-ui`: «Abierta», $500.00, register name.
- `foreign-tenant-read`: `GET /cash-sessions/:id` as the foreign tenant → 422 with the exact flat `CASH_SESSION_NOT_FOUND` body.

Blocked by the guard: 39 aborted requests to `https://api.iconify.design`, `https://api.unisvg.com` and `https://api.simplesvg.com` (the Iconify API and its fallback hosts). No Google Fonts origin was blocked, so the 8031b766 font fix holds. Icons are blank in the screenshots (sidebar, search).
Likely cause (inferred, not verified): the cash-live harness serves the app with the Vite **dev** server. `local-assets-guard` / L15 verified 0 third-party requests only on `preview` (the build). In dev, `localIcons()` (`vite.config.ts:60-98`) prepends `virtual:hf-local-icons` to `main.ts`, but `@iconify/vue` still fetches every icon. One unconfirmed possibility is that the virtual module's `addCollection` and Nuxt UI's `Icon.vue` resolve to different `@iconify/vue` module instances in dev, through the dep optimizer or a `?v=` hash. Next step: open `/pos/caja` on `vite.cash-live.config.ts` and check whether `addCollection` reaches the same instance that `node_modules/@nuxt/ui/dist/runtime/vue/components/Icon.vue` uses.

## foreign-session-diagnostic.spec.ts: NOT RUN
The precondition "create-and-open passes" was not met. Its guard assertion would fail the same way.

## Backend state left
Tenant A has one register, «Caja live 1795020054933», with one OPEN session `059fdff4-…` (fund $500.00).

## Files
- `create-and-open.playwright.log`: line-reporter output (redacted evidence records only).
- `create-and-open-session-detail-ui.png`, `create-and-open-failed-outbound-guard.png`: UI screenshots.
