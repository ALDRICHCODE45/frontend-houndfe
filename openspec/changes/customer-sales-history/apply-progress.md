# Apply Progress — customer-sales-history

## S1 — Contract (work unit `tdd-rebuild-s1-contract`)

Isolated rebuild in worktree `frontend-houndfe-worktrees/customer-sales-history-tdd-rebuild`,
branch `feat/customer-sales-history-tdd-rebuild`, baseline main `28270da`, fixture-fix base `d06d67b`.
Source reference (final-content only, NOT cherry-picked): `57fbf02`.

### TDD Cycle Evidence (strict TDD)

| Step | When (local) | Commit | Tree | Command | Exit | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 03:49 | `d06d67b` (base) | — | `pnpm test:unit --run` (full) | 0 | 364 files / 5789 tests passed |
| RED | 03:56 | `5de64dd` `test(sales): define customer history summary contract` | `25649d5` | focused `pnpm test:unit --run <7 files>` | 1 | 24 failed \| 329 passed (353); key TypeErrors (`customerHistory(Prefix) is not a function`), `undefined.safeParse`, null-render failures (`null.split`, missing fallbacks) |
| GREEN | 03:59 | `7bbf4e3` `feat(sales): add customer history summary contract` | `f5c3078` | identical focused command | 0 | 7 files / 353 tests passed |
| TRIANGULATE | 04:00 | `28cb5c0` `test(sales): triangulate customer history summary contract` | `bc8561d` | identical focused command | 0 | 358 passed (358); +5 held-back cases, **no production change required** |
| REFACTOR | 04:03 | (no separate commit; test-only type hygiene amended into `28cb5c0`) | `bc8561d` | identical focused command + `npx vue-tsc --build` | 0 / 0 | 358 passed; type-check clean |
| Full suite | 04:03 | `28cb5c0` (candidate) | `bc8561d` | `pnpm test:unit --run` (full) | 0 | 364 files / 5821 tests passed (+32 S1 tests) |

REFACTOR disposition: **no refactor warranted** — guards are single-use computeds/helpers, no duplication introduced; RED-time indentation noise was normalized before the GREEN commit. Two test-only type fixes (it.each callback arity; missing `summary` in the line-267 response fixture literal) were amended into the TRIANGULATE commit.

### Notes

- RED run had 3 collateral failures in pre-existing `SalesListView.test.ts` cases (unhandled render-throw fallout from the unguarded mounts); all pass at GREEN without touching those tests. Verified by stash run: 42/42 pass at base without RED tests.
- Files (all within allowed surface): `query-keys.ts` + tests, `sale.types.ts` + tests, `SaleCard.vue` + test, `SalesListView.vue` + 2 tests, `sale.api.test.ts`, `useConfirmedSales.test.ts`, `SalesListView.persistence.test.ts`.
- Pre-existing quirk preserved (behavior-identical to source reference): `extractFolioNumber` already returns `#15`, so SaleCard shows `##15` before and after this slice; changing it would exceed the null-safety scope.
- Net work-unit diff from `d06d67b`: +386/−16 (net +370 lines; 402 churn) — within the 400-line net budget.
- Source-reference comparison: same paths/content intent; RED and TRIANGULATE are split into separate commits vs the single `57fbf02` commit, and new describes use clean top-level nesting instead of the reference's mid-file deep indentation. Final behavior/content matches without scope growth.
- Remaining unchecked S1 tasks: RED/GREEN/TRIANGULATE/REFACTOR checkboxes in `tasks.md` (owned by parent gate).
