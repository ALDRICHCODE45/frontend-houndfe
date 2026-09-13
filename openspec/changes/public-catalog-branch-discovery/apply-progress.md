# Apply Progress: Public catalog branch discovery

## WU-1 — complete (runtime core; WU-2 untouched)

All WU-1 checkboxes in `tasks.md` are checked (`- [x]`); WU-2 rows remain deferred. This apply-progress was corrected by the `wu1-verification-gaps` completion objective: true non-array API fixture, responsive loading/empty/generic-error+retry coverage at both viewports, and the recovered RED evidence below.

## TDD Cycle Evidence

| Stage | Command | Result |
|---|---|---|
| RED | `pnpm test:unit --run <3 focused catalog specs>` | Failed (exit 1) — see recovered transcript. |
| GREEN | Same focused command | Passed (7 tests). |
| TRIANGULATE | Same focused command after adjacent tests | Passed (13 tests, 3 files). |
| REFACTOR | Same focused command after refactor review | Passed (13 tests, no behavior change). |

## RED evidence — recovered from the original writer-session transcript

Recovered from the writer transcript of this apply; not independently reproduced. Observed verbatim by the writer:

- Command: `pnpm test:unit --run src/features/catalog/api/__tests__/catalog-branches.api.spec.ts src/features/catalog/composables/__tests__/useCatalogBranches.spec.ts src/features/catalog/views/__tests__/CatalogView.spec.ts`
- Exit code: `1` (`ELIFECYCLE  Command failed with exit code 1.`)
- Suite failures (2): `Error: Failed to resolve import "../catalog-branches.api" … Does the file exist?` and `Error: Failed to resolve import "../useCatalogBranches" … Does the file exist?` — the production modules did not exist yet.
- Test failure (1): `renders a returned branch as an explicit unselected choice without product requests` — `AssertionError: Unable to get button[aria-label="Sucursal Centro"]` (chooser did not exist yet).
- Summary: `Test Files 3 failed (3)` / `Tests 1 failed | 3 passed (4)`; vitest `Start at 08:31:58`.
- Ordering: the RED run occurred before any production-file write in that session (tests written first; `catalog-branches.api.ts`, `useCatalogBranches.ts`, `CatalogView.vue`, `CatalogHeader.vue` written/modified after).

## Verification evidence (after corrections)

- `pnpm test:unit --run <3 focused catalog specs>`: 13/13 passed (true non-array fixture `{"branches": []}` now rejects).
- `pnpm type-check:responsive`: passed.
- `pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts`: **8/8 passed** (375×812 and 1440×900 × populated/loading/empty-retry/error-retry); manual retry reissues the isolated GET (2 requests observed), URL unchanged, screenshots attached under `artifacts/responsive/local-run/`. WU-1 semantics only: generic recoverable error copy; no 429/5xx/network split, no retry-pending guard, no cancellation/remount, no slug behavior.
- One intermediate restructuring failure occurred during correction (`test.use()` inside test bodies — 8 failures); fixed by moving `test.use` to sync describe scope before any settlement.

## Runtime and workload

- Native `gentle-ai.sdd-status` v2 consumed; generation-3 `wu1-verification-gaps` objective acquired with state `proceed` (token retained); settled exactly once after all commands.
- Final recount against `14938cb` (excluding `openspec/changes/online-catalog-publishing/.gentle-ai-instance`): **342 additions+deletions, below the 380-line cap** (previous reported 284 was stale; superseded by this figure).
- No source behavior change beyond the two accessible retry-button `aria-label`s required by the tests; no WU-2 semantics, no commit/push/PR/sync/archive, no historical-state or `.gentle-ai-instance` mutation.

## Remaining tasks

- All WU-0 and WU-1 checkboxes are checked. WU-2 (six unchecked `- [ ]` rows) remains deferred and out of this apply.
