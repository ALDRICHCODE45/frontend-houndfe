# Tasks: standardize-quotations-table

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a
400-line budget risk: Medium

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340 (T-01: 20, T-02: 40, T-03: 280, T-04: 0) |
| Delivery strategy | structured commits, merge to main |
| Threat matrix rows | None — design marks N/A (view refactor) |

### Suggested Work Units

| Unit | Goal | Commit | Focused test command | Runtime harness | Rollback boundary |
|------|------|--------|----------------------|-----------------|-------------------|
| 1 | Optional testid props on shared DataTable | 1 | `pnpm test:unit -- AppDataTable` | `pnpm build` | AppDataTable.vue + DataTableToolbar.vue props default undefined |
| 2 | New `useQuotationsViewMode` composable | 2 | `pnpm test:unit -- useQuotationsViewMode` | `pnpm build` | Single new file deletion |
| 3 | View refactor + test updates (atomic) | 3 | `pnpm test:unit -- QuotationsListView` | `pnpm dev` → `/pos/quotations` | view + test + composable revert together |
| 4 | Backend `sortBy` allowlist verification | 4 (notes) | `pnpm test:unit` | click each header vs staging | flip `enableSorting: false` on failing col |

---

## T-01: Add optional testid props to AppDataTable + DataTableToolbar [x]

- **Files**: `src/core/shared/components/DataTable/AppDataTable.vue`, `src/core/shared/components/DataTable/DataTableToolbar.vue`
- **Changed lines**: ~20
- **Depends on**: none
- **Work unit**: Backward-compatible optional props `refreshButtonTestId` + `addButtonTestId` on AppDataTable, forwarded to toolbar, bound to refresh/add buttons. Default `undefined` — no existing caller breaks.

## T-02: Create `useQuotationsViewMode` composable [x]

- **Files**: `src/features/POS/quotations/composables/useQuotationsViewMode.ts` (new)
- **Changed lines**: ~40
- **Depends on**: none
- **Work unit**: New isolated composable mirroring `useProductViewMode` — key `quotations-view-mode`, modes `['table','card']`, default `'table'`, exports `{ viewMode, setMode, toggleViewMode }` + `displayMode` computed bridge. Standalone, no consumer yet.

## T-03: Refactor QuotationsListView.vue + update its test [x]

- **Files**: `src/features/POS/quotations/views/QuotationsListView.vue`, `src/features/POS/quotations/views/__tests__/QuotationsListView.test.ts`
- **Changed lines**: ~280
- **Depends on**: T-01, T-02
- **Work unit**: Replace external refresh/add `UButton`s with `AppDataTable` `show-refresh`+`show-add-button` wired to `@refresh`/`@add`; pass `refreshButtonTestId="refresh-quotations-button"` + `addButtonTestId="new-quotation-button"` for REQ-QAF-016; move `DataTableFilters` into `#filters` slot; add `<template #actions><ViewToggle v-model="viewMode" /></template>` + `:display-mode`; rename column IDs (`fecha→createdAt`, `expira→expiresAt`, `cliente→customer`, `estado→status`, `total→totalCents`); flip `enableSorting: true` on 5 cols + `#<id>-header` slots rendering `<SortableHeader>`; `accessorFn` on `customer` resolving `firstName lastName`; rename all cell slots. Test: extend `appDataTableStub` props + `#actions`/`#filters`/`#<id>-header` slots; stub `SortableHeader`; flip `data-show-refresh` `'false'`→`'true'`; assert no external buttons; assert REQ-QAF-016 testids resolve.

## T-04: Verify backend `sortBy` allowlist (DESIGN GATE close-out) [x]

- **Files**: `openspec/changes/standardize-quotations-table/design.md` (gate note)
- **Changed lines**: 0 source, ~5 doc
- **Depends on**: T-03
- **Work unit**: Verification only. Click each sortable header against staging; `createdAt` already confirmed. If any column 500s or silently ignores `sortBy`, flip `enableSorting: false` on that column in the view and record reason in archive.

---

**Dependency graph**: T-01, T-02 (parallel) → T-03 → T-04

**Notes**: Status tabs stay between header and AppDataTable (REQ-10 invariant). REQ-QAF-016 testids preserved. Each task → one conventional commit. Threat matrix N/A.

**Apply-phase result**: All 4 tasks committed on `main` (`2ebbf43`, `624b8e0`, `f295bfc`, `7d83b1e`). Full test suite (`pnpm test:unit`) and build (`pnpm build`) green. The sortBy allowlist gate is **closed with caveat** in `design.md`: frontend is ready, manual staging click-through deferred to verify phase.
