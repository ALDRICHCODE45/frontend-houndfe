# Tasks: Standardize Sales List Table

Derived from `proposal.md`, `design.md`, and `specs/sales/spec.md`.

- Execution mode: interactive
- Delivery strategy: no PRs — structured conventional commits on `main`
- Review budget: 400 lines per work unit
- Rule: tests ship in the same commit as the behavior they verify

## Verified Preconditions

Confirmed against the codebase before task breakdown (no guessing):

| Assumption | Status | Evidence |
|---|---|---|
| `useServerTable` returns `isError`/`error` | Confirmed | `src/core/shared/composables/useServerTable.ts:35-36,153-154,211-212` |
| `useConfirmedSales` spreads `...table` | Confirmed | `src/features/POS/sales/composables/useConfirmedSales.ts:127` |
| `AppDataTable` accepts `error`, `errorMessage`, `showAddButton`, `addButtonText`, `addButtonTestId`, `displayMode` | Confirmed | `src/core/shared/components/DataTable/AppDataTable.vue:27-28,41-43,58,62` |
| `SortableHeader` props are `{ column, label }` | Confirmed | `src/core/shared/components/DataTable/SortableHeader.vue` |
| `ViewToggle` contract is `modelValue` / `options` / `ariaLabel` + `update:modelValue` | Confirmed | `src/core/shared/components/ViewToggle.vue` |
| Filter reset method is `clearAll()` (proposal said `clear()`) | Corrected | `useDataTableFilters.ts:35,81` — use `clearAll()` |
| `useViewMode` returns `toggleMode` (not `toggleViewMode`) | Confirmed | `src/core/shared/composables/useViewMode.ts` — alias in the wrapper, as `useProductViewMode` does |
| "Limpiar" is currently plain text, not a button | Confirmed | `SalesListView.vue:132-134` (`extended-filters-indicator`) |
| `useProductViewMode` exposes no `displayMode` | Confirmed | `useProductViewMode.ts` — the `displayMode` bridge is new to sales |

Paths (actual, not the ones in the task prompt):
- View: `src/features/POS/sales/views/SalesListView.vue` (262 lines)
- Columns: `src/features/POS/sales/composables/useSalesColumns.ts` (41 lines)
- View test: `src/features/POS/sales/views/__tests__/SalesListView.test.ts` (377 lines)

---

## T1 — Surface confirmed-sales request errors

Satisfies **REQ-12**. Smallest diff, biggest UX win — ship first.

- [x] Destructure `isError` and `error` from `useConfirmedSales(...)` in `SalesListView.vue`.
- [x] Bind `:error="isError"` and `:error-message` on `AppDataTable` (derive a string from `error`, fall back to the component default).
- [x] Add `isError: ref(false)` / `error: ref(null)` to the `useConfirmedSales` mock in the view test so every existing case stays green.
- [x] Test: `isError=true` → `table-error-state` renders and `"No hay ventas todavía"` is absent.
- [x] Test: retry control emits `refresh` and refetches.

Files: `SalesListView.vue`, `views/__tests__/SalesListView.test.ts`
Commit: `fix(sales): surface confirmed sales request errors in the list table`
Estimate: **~45 lines** (impl ~10, tests ~35) — within budget
Rollback boundary: revert the two `AppDataTable` error props, the destructure, and the two new test cases. Nothing else depends on them.

## T2 — `useSalesViewMode` composable

Satisfies **REQ-14** (composable half). New, isolated, no view changes.

- [x] Create `src/features/POS/sales/composables/useSalesViewMode.ts` mirroring `useProductViewMode`: key `pos-sales-view-mode`, modes `['table','card'] as const`, default `'table'`.
- [x] Export `SalesViewMode` type and `isSalesViewMode` guard.
- [x] Return `{ viewMode, setMode, toggleViewMode, displayMode }` where `displayMode` is a `computed` bridging `'card' → 'cards'`, `'table' → 'table'` (this bridge is new — `useProductViewMode` has no equivalent).
- [x] Test: localStorage roundtrip; default is `table`; invalid stored value falls back to `table`; `displayMode` bridge maps both modes.

Files: `composables/useSalesViewMode.ts` (new), `composables/__tests__/useSalesViewMode.test.ts` (new)
Commit: `feat(sales): add useSalesViewMode with persisted view mode and display bridge`
Estimate: **~90 lines** (impl ~35, tests ~55) — within budget
Rollback boundary: delete both new files. Nothing imports them until T4.

## T3 — Sortable column headers

Satisfies **REQ-13**. Depends on nothing; independent of T1/T2.

- [x] `useSalesColumns.ts`: set `enableSorting: true` explicitly on `venta`, `confirmedAt`, `customer`, `paymentStatus`, `totalCents`, `debtCents`, `deliveryStatus`, `cashier`, `seller`.
- [x] Keep `enableSorting: false` explicit on `paymentMethods`, `dueDate`, `channel`, `invoice` (and `select`).
- [x] `SalesListView.vue`: add 9 `#<col>-header` slots rendering `SortableHeader` with the labels from the design slot map (Venta, Fecha, Cliente, Pago, Total, Deuda, Productos, Cajero, Vendedor).
- [x] Keep the `USelect` shortcut and its `watch(sortValue)` → `sorting` sync (design decision #1 — do **not** remove it).
- [x] Test: the 9 sortable headers mount `SortableHeader`; the 4 non-sortable columns render none.
- [x] Test: clicking the `Total` header updates `sorting` to `totalCents`.
- [x] Test: `USelect` shortcut still writes to the same `sorting` ref.

Files: `useSalesColumns.ts`, `SalesListView.vue`, `views/__tests__/SalesListView.test.ts`
Commit: `feat(sales): render sortable headers for the nine backend-sortable columns`
Estimate: **~105 lines** (impl ~50, tests ~55) — within budget
Rollback boundary: revert the `enableSorting` flags and the 9 header slots. The `USelect` path is untouched, so sorting keeps working after a revert.

## T4 — Consolidate the toolbar

Satisfies **REQ-15** and the view half of **REQ-14**. Largest unit — do it last before cleanup.

- [x] Move `DataTableFilters` out of the outer `div` and into the `#filters` slot, above `SalesListTabs`.
- [x] Replace the plain-text `Limpiar` in `extended-filters-indicator` with `UButton variant="link"` calling `filtersCtl.clearAll()` (**not** `clear()`). Sorting, search, and view mode must stay untouched.
- [x] Remove the `#actions` `UButton`; drive the add button with `:show-add-button="canCreateSale"`, `add-button-text="Nueva Venta"`, `add-button-test-id="toolbar-add-button"`, `@add="goToNewSale"`.
- [x] Add the `canCreateSale` computed (`authStore.userCan('create', 'Sale')`).
- [x] Render `ViewToggle` in `#actions` with `aria-label="Seleccionar vista de ventas"`, wired to `useSalesViewMode`.
- [x] Bind `:display-mode="displayMode"` and drop `mobile-render="cards"` so the persisted mode wins at every viewport (design decision #4).
- [x] Test: add button present via `add-button-test-id`, `@add` navigates to `/pos/ventas/nueva`.
- [x] Test: `ViewToggle` renders with the aria-label; selecting `card` yields `display-mode="cards"`.
- [x] Test: "Limpiar" click calls `clearAll` once and leaves `sorting`/`globalFilter` unchanged.
- [x] Test: `DataTableFilters` resolves inside the `#filters` slot.

Files: `SalesListView.vue`, `views/__tests__/SalesListView.test.ts`
Commit: `refactor(sales): consolidate the sales list toolbar to the products pattern`
Estimate: **~135 lines** (impl ~60, tests ~75) — within budget, closest to the ceiling
Rollback boundary: restore the `#actions` `UButton`, the outer `DataTableFilters` block, `mobile-render="cards"`, and the plain-text Limpiar. `useSalesViewMode` (T2) survives unused.

## T5 — Reconcile the existing view test suite

Migrates assertions the previous tasks invalidated. Kept separate **only** because it touches pre-existing cases that no single earlier task owns.

- [x] Update `renders row fallbacks and Nueva Venta button` (line ~192): assert `add-button-test-id` instead of `wrapper.text()).toContain('Nueva Venta')`.
- [x] Update the Cobrar-precedent style test (line ~363) — it queries `findAll('button')` for "Nueva Venta", which no longer exists as a slot button. Re-point at the toolbar add button; do **not** delete the styling assertion.
- [x] Confirm `renders DataTableFilters with mapped errors` (line ~264) still resolves after the slot move.
- [x] Verify `SalesListTabs`, `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields / 4 sections) and all `#<id>-cell` slots are untouched — **REQ-16**.
- [x] Run `pnpm test:unit --run` and `pnpm build`; record exact output.

Files: `views/__tests__/SalesListView.test.ts`
Commit: `test(sales): realign list view assertions with the standardized toolbar`
Estimate: **~40 lines** — within budget
Rollback boundary: test-only; revert restores the pre-T4 assertions.

---

## Review Workload Forecast

| Task | Impl | Tests | Total | Over 400? |
|---|---|---|---|---|
| T1 error wiring | ~10 | ~35 | ~45 | No |
| T2 `useSalesViewMode` | ~35 | ~55 | ~90 | No |
| T3 sortable headers | ~50 | ~55 | ~105 | No |
| T4 toolbar consolidation | ~60 | ~75 | ~135 | No |
| T5 test reconciliation | 0 | ~40 | ~40 | No |
| **Total** | ~155 | ~260 | **~415** | Cumulative only |

- **Per-unit 400-line risk: LOW.** Every commit is well under budget; the largest (T4, ~135) has ~265 lines of headroom.
- **Cumulative: ~415 lines, marginally over 400.** This matters only if the five commits were ever bundled into a single PR. The session delivery strategy is structured commits on `main` with no PRs, so the 400-line guard applies per work unit and is satisfied. No chained-PR slicing needed.
- **Decision needed: none.** If the delivery strategy later changes to a single PR, split at the T3/T4 boundary: T1–T3 (~240) and T4–T5 (~175).

## Verification Per Task

Each commit records: focused test command + exact result, and a runtime check.

```bash
pnpm test:unit --run src/features/POS/sales   # T1, T3, T4, T5
pnpm test:unit --run src/features/POS/sales/composables/__tests__/useSalesViewMode.test.ts  # T2
pnpm build                                     # T5 (final gate)
```

Runtime harness: `pnpm dev` → `/pos/ventas` — confirm the error block on a forced 500, header sorting, view toggle persistence across reload, and the single-row toolbar. T2 is composable-only: **N/A** for runtime, covered by the unit test.

## Apply Results (recorded after implementation)

Baseline before any change: `pnpm test:unit --run src/features/POS/sales` → 64 files / 810 tests passing.

| Task | Commit | Lines (add+del) | Focused test result |
|---|---|---|---|
| T1 | `62bc4ab` | 120 | `SalesListView.test.ts` 22/22 passing |
| T2 | `1979694` | 124 | `useSalesViewMode.test.ts` 9/9 passing |
| T3 | `c798c0a` | 231 | `SalesListView` + `useSalesColumns` 33/33 passing |
| T4 | `a52b42e` | 218 | `SalesListView.test.ts` 35/35 passing |
| T5 | `2067207` | 115 | `SalesListView.test.ts` 40/40 passing |

Final gates: `pnpm test:unit --run` → **247 files / 3791 tests passing**. `pnpm build` → built in 12.02s, `vue-tsc --build` clean.

Every commit landed under the 400-line per-unit budget. Actual totals ran above the forecast (796 vs ~415) because the `AppDataTable` test stub had to grow to model error/empty precedence, the 13 cell slots, and header passthrough — all test infrastructure, not production code. Production changes totalled 173 lines.

Deviations from the plan:

- **T4 absorbed one T5 assertion.** The Cobrar-precedent styling test hard-failed the moment the `#actions` `UButton` was removed, so it was re-pointed inside T4 rather than left red for a later commit. T5 kept the remaining reconciliation.
- **CTA styling dropped.** `!bg-(--brand-action) !text-black rounded-xl font-semibold shadow-sm` no longer applies to "Nueva Venta" — `DataTableToolbar` owns the add button and renders a default `UButton`. This is the same tradeoff quotations accepted in `f295bfc`, and follows from REQ-15 ("the `#actions` `UButton` SHALL be removed"), but it is a real visual change to the gold CTA and worth a design confirmation.
- **Test isolation bug found and fixed.** The suite's `beforeEach` was scoped to the first `describe`; the new blocks did not inherit it, so `data: []` leaked from the error-state cases. Hoisted to file level in T5.
- **`USelect`→header sync not asserted through the dropdown.** Driving reka-ui's select from jsdom is brittle, so the shared-source-of-truth property is asserted directly on the `sorting` ref instead, plus a guard that the shortcut still renders.

Runtime harness: **not executed** — no browser available in this environment. `pnpm dev` → `/pos/ventas` still needs a manual pass for the forced-500 error block, header sorting round-trip, view-toggle persistence across reload, and the single-row toolbar.

## Out of Scope (must stay unchanged)

`SalesListTabs`, `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema`, all `#<id>-cell` slots, `enable-row-selection="false"`, the `pos-sales-list` persist key, and the `USelect` sort shortcut.
