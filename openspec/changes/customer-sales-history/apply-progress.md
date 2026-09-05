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

REFACTOR disposition: **no refactor warranted at GREEN** — guards are single-use computeds/helpers; RED-time indentation noise was normalized before the GREEN commit. Two test-only type fixes (it.each callback arity; missing `summary` in the line-267 response fixture literal) were amended into the TRIANGULATE commit. A later budget-driven compaction commit `refactor(tests): compact S1 contract evidence` applied semantic compression only (shared `historyParams`/typed `pair` helper, merged rejects table, tuple-typed it.each rows, base-indentation restore in `SalesListView.test.ts`, notes compaction). RED/GREEN/TRIANGULATE facts, all 358 assertions, and the S1 contract are unchanged: focused suite still 358/358, full suite 364 files / 5821 tests, `npx vue-tsc --build` exit 0.

### Notes

- RED run had 3 collateral failures in pre-existing `SalesListView.test.ts` cases (unhandled render-throw fallout from the unguarded mounts); all pass at GREEN without touching those tests. Verified by stash run: 42/42 pass at base without RED tests.
- Files (all within allowed surface): `query-keys.ts` + tests, `sale.types.ts` + tests, `SaleCard.vue` + test, `SalesListView.vue` + 2 tests, `sale.api.test.ts`, `useConfirmedSales.test.ts`, `SalesListView.persistence.test.ts`.
- Pre-existing quirk preserved (behavior-identical to source reference): `extractFolioNumber` already returns `#15`, so SaleCard shows `##15` before and after this slice; changing it would exceed the null-safety scope.
- Source-reference comparison: same paths/content intent; RED and TRIANGULATE are split into separate commits vs the single `57fbf02` commit, and new describes use clean top-level nesting instead of the reference's mid-file deep indentation. Final behavior/content matches without scope growth.
- Work-unit diff from `d06d67b` (authoritative budget = additions + deletions, not net): **+311/−11 = 322 ≤ 400** (pre-compaction was +415/−16 = 431; corrected accounting by the parent review gate). Post-correction total: **+320/−11 = 331 ≤ 400**.
### Verification correction (S1 page-key identity)

Independent verification flagged one blocking S1 triangulation defect: a compressed `it.each` row in `query-keys.test.ts` cast numeric pairs (`[1,10]`/`[2,10]` as `[string,string]`) while `historyParams.page` stayed 1, so the differing-tenant/customer/page requirement (`tasks.md:68`) covered tenant/customer but not page variation. Correction commit `a12bd66 test(sales): cover customer history page key identity` (+6/−1) removed the bogus numeric-pair row and added an explicit `page is part of the key identity` test: identical tenant/customer, `{ ...historyParams, page: 1 }` vs `{ ...historyParams, page: 2 }`, keys proven different. All tenant/customer/limit/stability/prefix/confirmed-isolation assertions and all schema/nullability cases preserved. Re-run: focused 7 files 358/358 passed (−1 bogus row, +1 page test); `npx vue-tsc --build` exit 0; full `pnpm test:unit --run` 364 files / 5821 tests passed, exit 0 (first full run reported one transient unhandled jsdom "Not implemented: navigation" error; clean on rerun). Validation-generated `auto-imports.d.ts`/`components.d.ts` drift was restored after git confirmed those were the only generated changes; parent worktree untouched.

- Remaining unchecked S1 tasks: RED/GREEN/TRIANGULATE/REFACTOR checkboxes in `tasks.md` (owned by parent gate).
