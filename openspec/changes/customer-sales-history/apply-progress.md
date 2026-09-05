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

## S2 — Query (work unit `tdd-rebuild-s2-query`)

Same worktree/branch as S1; S1 baseline `aae622f` (clean). Source reference (final-content only, NOT cherry-picked): `a9507a6`.
Focused command throughout: `pnpm test:unit --run src/features/POS/sales/composables/__tests__/useCustomerSalesHistory.test.ts`.

### TDD Cycle Evidence (strict TDD)

| Step | When (local) | Commit | Tree | Command | Exit | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 04:54 | `aae622f` (base) | — | focused | 1 | `No test files found` (S2 test file absent); tree clean |
| RED | 04:55 | `6e9fe48` `test(sales): define customer sales history query contract` | `5c45417` | focused | 1 | 1 file failed: `Failed to resolve import "../useCustomerSalesHistory"` (module absent). Contract: disabled open/null/undefined/empty-tenant inputs, exact request `{customerId:[id],page,limit:10,sortBy:'confirmedAt',sortOrder:'desc'}` w/o `status`/`customerIncludeNull`, authoritative summary exposure, absent+malformed summary → error |
| GREEN | 04:57 | `c7bc581` `feat(sales): add customer history query` | `435130b` | identical | 0 | 1 file / 8 tests passed. Minimal composable: options object, centralized `customerHistory` key, `enabled`, `staleTime:30_000`, `keepPreviousData`, `SaleListSummarySchema.parse`, no owner guard/retry/isPageTransition (held back) |
| TRIANGULATE | 04:58 | `6e9ced2` `test(sales): triangulate customer history query` | `edcf1f6` | identical | 0 | 1 file / 15 tests passed. First run after adding held-back cases: exit 1, 5 genuine failures (A→B data leak; `isPageTransition` missing; retry ×3 under a deliberately retry-enabled client `retry:3, retryDelay:0`) |
| REFACTOR | 04:59 | (no commit) | `edcf1f6` | identical + `npx vue-tsc --build` | 0 / 0 | 15 passed; type-check clean. `no refactor warranted`: params built once in one `params` computed, owner projection in one computed, request literal kept explicit to pin the exact wire shape (matches reference) |
| Full suite | 05:01 | `6e9ced2` (candidate) | `edcf1f6` | `pnpm test:unit --run` (full) | 0 | 365 files / 5836 tests passed (+1 file, +15 S2 tests vs S1's 364/5821) |

### Notes

- Production correction during TRIANGULATE (driven solely by failing held-back tests): owner-stamped `CustomerHistoryCacheEntry` + `ownerCustomerId === customerId` render guard, `isPageTransition`, and 400/401/403 retry exclusion. Final composable is byte-identical to reference `a9507a6`'s file.
- RED-harness fix inside GREEN commit: the `run()` helper originally conflated explicit `customerId: undefined` with "not provided", making that row vacuous (it mounted with the default customer); switched to `'customerId' in opts` + ref support so the contract case is real. No assertion weakened; enabled-guard production behavior confirmed.
- Held-back cases that passed without production change: exact centralized key/parameter identity (cache key deep-equals `['sales',tenant,'customer-history',customer,params]`), close/reopen cache reuse within `staleTime` (no extra fetch, no invalidation).
- Intentional test deltas vs reference `a9507a6` (no scope growth): "distinct cache key per page" case replaced by the stronger exact-key-identity test (page-key identity also covered at factory level in S1); no-retry cases run under an explicitly retry-enabled client, making the 400/401/403 exclusion observable rather than masked by `retry:false`; two explanatory comments dropped; import style inlined.
- Work-unit diff from S1 HEAD `aae622f` (additions+deletions, excluding generated files which were restored): **+349/−0 = 349 ≤ 400** (test 254, composable 95). With this evidence section (24 lines): +373/−0 = 373 ≤ 400.
## S3a — Surface presentation (work unit `tdd-rebuild-s3a-presentation`)

Same worktree/branch; S2 baseline `01dfe87` (clean, S3a files absent). Source reference (final-content only, NOT cherry-picked): `027b93c`.
Focused command throughout: `pnpm test:unit --run src/features/POS/customers/components/SalesHistoryMetrics.spec.ts src/features/POS/customers/components/SalesHistoryList.spec.ts`.

### TDD Cycle Evidence (strict TDD)

| Step | When (local) | Commit | Tree | Command | Exit | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 05:07 | `01dfe87` (base) | `01dfe87` | focused | — | clean tree; no `SalesHistory*` files present |
| RED | 05:07 | `4fc5795` `test(customers): define sales history presentation contract` | `811ea11` | focused | 1 | 2 files failed: `Failed to resolve import "./SalesHistoryMetrics.vue"` / `./SalesHistoryList.vue` (components absent). Contract: one `<dl>` with exact summary values (`salesCount`, MXN totals/debt), semantic `<ul>` of native `button[type=button]`, `formatCentsMXN` values, `Sin folio`/`Fecha no disponible`/`Sin estado` fallbacks, one typed `select` per activation |
| GREEN | 05:08 | `87b26b1` `feat(customers): add sales history presentation` | `7545db8` | identical | 0 | 2 files / 5 tests passed. Minimal typed `<script setup lang="ts">` components: metrics `<dl>` with debt/`Al corriente` treatment + `aria-live="polite"`; list `<ul>` with null-safe labels, accessible names, `defineEmits<{ select: [sale] }>`; no query/router/pagination logic |
| TRIANGULATE | 05:09 | `9017ebc` `test(customers): triangulate sales history presentation` | `fbe9180` | identical | 0 | 2 files / 13 tests passed on first run — **no production correction driven**. Held-back cases: positive vs zero debt (+`aria-live`), zero sales (no badge), integer-cent currency ($1,250,000.01 / $0.01), all-nullable sale fields, accessible-name fallbacks, exactly-one emit across 3 rows/clicks, status→badge/tone mapping |
| REFACTOR | 05:10–05:11 | `17d9233` `test(customers): satisfy strict index access in triangulation specs` | `792dde9` | identical + `npx vue-tsc --build` | 0 | 13 passed; type-check clean. `no production refactor warranted`: derivations already centralized (metrics computeds `hasDebt`/`showAlCorriente`/`formattedTotal`/`formattedDebt`; list helpers `dateLabel`/`statusBadge`/`accessibleName`). Considered and rejected a `v-bind` dedupe of the twice-called `statusBadge(sale)` — the alternative is less explicit for two props. `17d9233` is test-only: `noUncheckedIndexedAccess` fixes (mapped-array access, `clickedOrder[i]!`) |
| Full suite | 05:12 | `17d9233` (candidate) | `792dde9` | `pnpm test:unit --run` (full) | 0 | 367 files / 5849 tests passed (+2 files, +13 S3a tests vs S2's 365/5836) |

### Notes

- Declaration drift observed after test runs (`auto-imports.d.ts`, `components.d.ts`, +55/−55): proven validation-generated worktree-relative path churn (`./node_modules/...` → `../../frontend-houndfe/node_modules/...`), unrelated to S3a; restored via `git checkout --`. Post-restore `npx vue-tsc --build` exit 0; tree clean.
- Intentional deltas vs reference `027b93c` (compaction, no contract loss): specs compacted from 211→168 lines via table-driven factories/`mountMetrics`/`mountList` helpers; metrics zero-debt `Al corriente`/badge cases triangulated rather than in RED; `<ul role="list">` rendered as plain `<ul>` (list semantics retained); row separator dot span and `divide-y` on `sm` only dropped (cosmetic). Reference's accessible-name pattern, fallbacks, tones, emits, and summary authority are preserved.
- Work-unit diff from `01dfe87` (additions+deletions, excluding restored generated files): **+271/−0 = 271 ≤ 400** (Metrics.vue 47, List.vue 56, Metrics.spec 63, List.spec 105). With this evidence section (21 lines): +292/−0 = 292 ≤ 400.

## S3b — Slideover integration (work unit `tdd-rebuild-s3b-slideover`)

Same worktree/branch; S3a baseline `ec9ae36` (clean, S3b files absent). Source reference (final-content only, NOT cherry-picked): `4dd5428`.
Focused command throughout: `pnpm test:unit --run src/features/POS/customers/components/CustomerSalesHistorySlideover.spec.ts`.

### TDD Cycle Evidence (strict TDD)

| Step | When (local) | Commit | Tree | Command | Exit | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 05:20 | `ec9ae36` (base) | `ec9ae36` | — | — | tree clean; both S3b files absent |
| RED | 05:20–05:21 | `25782fe` `test(customers): define sales history slideover contract` | `a35ad05` | focused | 1 | 1 file failed: `Error: Failed to resolve import "./CustomerSalesHistorySlideover.vue" from "src/features/POS/customers/components/CustomerSalesHistorySlideover.spec.ts". Does the file exist?` (component absent). Contract (5 tests): real named `[role="dialog"]` with customer identity header, `sm:!max-w-[520px]` content + `p-0` body, close control → exactly one `update:open [false]`, closed → no dialog rendered, 3 metric + 5 row skeletons under `aria-busy`, exact `role="status"` empty copy with `role="alert"` absent on 200-zero, `role="alert"` + `Reintentar` → one `refetch` |
| GREEN | 05:21–05:22 | `0cc5317` `feat(customers): add sales history slideover` | `b1bd6fc` | identical | 0 | 1 file / 5 tests passed. Minimal typed `open`/`customer` + `update:open` shell consuming the S2 composable and S3a `SalesHistoryMetrics`/`SalesHistoryList`; guarded state priority; `UPagination` at 10; sync page reset; no routes/adapters/invalidation added |
| TRIANGULATE | 05:22 | `e4dadaa` `test(customers): triangulate sales history slideover` | `d0612c1` | identical | 0 | 1 file / 8 tests passed on first run — no production correction driven. Held-back: page-transition summary stability (backend 23 stays, `opacity-50`, pagination `data-disabled=true`) + named-route navigation `{ name: 'pos-sale-detail', params: { id: 'sale-42' } }`, sync 1-based page reset on customer identity change, deduplicated 403 (one real Nuxt UI toast `Sin permiso para ver ventas`, one close across `$forceUpdate` rerender) |
| REFACTOR | 05:23 | (no commit) | `d0612c1` | identical + `npx vue-tsc --build` | 0 / 0 | 8 passed; type-check clean. `no refactor warranted`: state priority already explicit (403 watch → error → initial loading → response/empty/list); 403 dedup isolated in one watch keyed by error identity; page reset isolated in one `flush: 'sync'` watch; portal DOM cleaned in `afterEach` |
| Full suite | 05:23 | `e4dadaa` (candidate) | `d0612c1` | `pnpm test:unit --run` (full) | 0 | 368 files / 5857 tests passed (+1 file, +8 S3b tests vs S3a's 367/5849) |

### Notes

- Close/reopen cache behavior is scoped out of this unit by design: it is owned by the S2 composable (`staleTime: 30_000`, no invalidation, `keepPreviousData`) and covered by its tests; this spec mocks the composable at the unit boundary, so re-asserting cache behavior here would be vacuous.
- Remaining unchecked S3b tasks: RED/GREEN/TRIANGULATE/REFACTOR checkboxes in `tasks.md` (owned by parent gate; this unit's allowed surface excludes `tasks.md`).
- Source-reference comparison: identical two paths as `4dd5428`; content matches the reference's final intent (same contracts, state priority, width classes, exact empty copy, toast title) with compacted one-line factories/stubs and two brief comments; accents preserved; no scope growth.
- Work-unit diff from `ec9ae36` (additions+deletions): source **+359/−0** (spec 197, slideover 162); with this evidence section: **+384/−0 = 384 ≤ 400**.
