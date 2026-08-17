# Tasks: Polish mobile filters bottom-sheet

## Review Workload Forecast

Estimated changed lines: 580–720 (prod + tests; prior change under-shot because tests added ~370)
400-line budget risk: High
Chained PRs recommended: No (solo dev, single-pr)
Suggested split: single PR with size-exception
Delivery strategy: single-pr
Chain strategy: size-exception

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Work Units

- **WU-1 `embedded` prop.** Test: `pnpm test:unit -- DataTableFilters.spec.ts`. Rollback: revert `embedded` prop in `DataTableFilters.vue`.
- **WU-2 Toolbar rebuild.** Test: `pnpm test:unit -- DataTableToolbar.spec.ts`. Rollback: revert `DataTableToolbar.vue` sheet region.
- **WU-3 POS bind.** Test: `pnpm test:unit -- QuotationsListView SalesListView`. Rollback: remove `:embedded="true"` from both views.
- **WU-4 Admin cards.** Test: `pnpm test:unit -- EmployeesListView ExpiringDocumentsView AdminTenantsView`. Rollback: unwrap each admin `#filters`.
- **WU-5 Gates.** Test: `pnpm test:unit && pnpm build`. Runtime: `pnpm dev` → tap "Filtros" on 5 views.

## Phase 1: DataTableFilters v2 — embedded prop

- [x] 1.1 RED — `DataTableFilters.spec.ts`: with `embedded=true`, render `data-table-filters-embedded`; no `filters-trigger`; no `slideover`
- [x] 1.2 RED — `embedded=true`: exposed `open()`/`close()` are no-ops
- [x] 1.3 RED — `embedded` unset preserves current trigger + slideover
- [x] 1.4 GREEN — add `embedded: boolean` prop in `DataTableFilters.vue`; wrap trigger + `USlideover` in `v-if="!embedded"`

## Phase 2: DataTableToolbar — rebuild mobile sheet

- [x] 2.1 RED — `DataTableToolbar.spec.ts`: `toolbar-filters-header` shows "Filtros"; `activeFilterCount 2` → badge "2" + "Limpiar todo"; `0` → neither
- [x] 2.2 RED — `toolbar-filters-body` carries `h-[85vh] max-h-[85vh] overflow-y-auto`; each `#filters` child wrapped in card with `toolbar-filters-section-{id}` title
- [x] 2.3 RED — `toolbar-filters-footer` renders "Cerrar" that closes sheet
- [x] 2.4 RED — `#filters-title` slot overrides default "Filtros"
- [x] 2.5 GREEN — replace `<template #content>` in `DataTableToolbar.vue` with sticky header/body/footer; `bg-elevated/30` card pattern
- [x] 2.6 GREEN — add `<slot name="filters-title">` defaulting to "Filtros"

## Phase 3: POS views — bind embedded

- [x] 3.1 RED — `QuotationsListView.test.ts`: `DataTableFilters` receives `embedded=true`; no nested `filters-trigger` in `#filters`
- [x] 3.2 RED — `SalesListView.test.ts`: same assertions; mixed siblings (tabs + sort) survive wrap
- [x] 3.3 GREEN — add `:embedded="true"` to `DataTableFilters` in `QuotationsListView.vue` (~line 448)
- [x] 3.4 GREEN — add `:embedded="true"` to `DataTableFilters` in `SalesListView.vue` (~line 185)

## Phase 4: Admin views — wrap raw filters in card sections

- [x] 4.1 RED — `EmployeesListView.test.ts`: mobile sheet contains `toolbar-filters-section-status` wrapping `EmployeeFilters`
- [x] 4.2 RED — `ExpiringDocumentsView.test.ts`: threshold select wrapped in card with title
- [x] 4.3 RED — `AdminTenantsView.test.ts`: checkbox + label wrapped in card with title
- [x] 4.4 GREEN — wrap each admin's `#filters` in section card with `#filters-title`

## Phase 5: Gates & smoke

- [x] 5.1 RUN — `pnpm test:unit` passes; all new testids asserted (4291 tests pass, 13 new)
- [x] 5.2 RUN — `pnpm build` passes; no TS regressions; lint clean on touched files (only pre-existing `expect-expect` false-positives remain)
- [ ] 5.3 SMOKE — `pnpm dev` → tap "Filtros" on 5 views; one sheet each, sticky header + cards + Cerrar — **N/A** (no browser available in this environment; structural tests + integration stubs cover the contract)
- [x] 5.4 VERIFY — desktop (≥ md): filters inline, no sheet trigger (covered by existing DataTableToolbar desktop-layout-invariant suite + AppDataTable `mobileBreakpoint="md"`)
