# Proposal: Standardize Quotations Table

## Intent

`QuotationsListView.vue` uses shared primitives but its **toolbar assembly, sorting, and view mode** deviate from the Products gold standard (one `DataTableToolbar` row, `<SortableHeader>` per column, `useViewMode` persistence). Bring quotations to full parity while keeping REQ-QAF-009..016 invariants intact.

## Scope

### In Scope
- One toolbar row inside `DataTableToolbar`: search, Filtros, refresh, Columnas, + Nueva cotización, ViewToggle.
- `<SortableHeader>` for **Cliente, Estado, Total, Expira, Fecha** (skip ID — opaque).
- `ViewToggle` via `#actions`, persisted through new `useQuotationsViewMode` (`quotations-view-mode`, mirrors `useProductViewMode`).
- `show-refresh` + `show-add-button` on `AppDataTable`; drop external refresh + "+ Nueva cotización" UButtons. Keep REQ-QAF-016 testids.
- Update `QuotationsListView.test.ts` stub; flip `data-show-refresh` to `'true'`.

### Out of Scope
- Edits to shared components/composables; backend; detail view; draft flow; PDF; other POS modules; multi-row selection; REQ-QAF-009..016 invariants (status tabs, Filtros slideover, URL persistence, delete flow).

## Capabilities

### Modified Capabilities
- `quotations-list`: MODIFIED around toolbar, sortable columns, view mode, refresh/add wiring (REQ-11). Other REQs untouched.

## Approach

1. **New `useQuotationsViewMode`** — `useViewMode` wrapper (`'table' | 'card'`), bridges to `AppDataTable.displayMode`.
2. **Refactor `QuotationsListView.vue`**: move `DataTableFilters` into `<AppDataTable>`'s `#filters`; replace external buttons with `show-refresh` + `show-add-button` (`@refresh`/`@add`); add `<template #actions><ViewToggle ... /></template>` + `:display-mode="tableDisplayMode"`.
3. **Sortable headers**: flip `enableSorting` on the 5 columns + add `<template #<id>-header="{ column }"><SortableHeader :column="column" :label="..." /></template>`. Cells unchanged.
4. **Tests**: extend `appDataTableStub` (props + `#actions` slot); flip `data-show-refresh` to `'true'`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/features/POS/quotations/views/QuotationsListView.vue` | Major | Toolbar refactor, sortable headers, ViewToggle |
| `src/features/POS/quotations/composables/useQuotationsViewMode.ts` | **New** | `useViewMode` wrapper |
| `src/features/POS/quotations/views/__tests__/QuotationsListView.test.ts` | Modified | Stub additions + flipped refresh assertion |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Backend rejects a `sortBy` value | Med | Design verifies allowlist vs `quotation.api`; only enable SortableHeader for confirmed columns |
| Tests break on `data-show-refresh` + slot passthroughs | High | Update stubs + assertions in same work unit; REQ-QAF-016 testids unchanged |
| `cliente` sorts by raw `customer` key | Med | `accessorFn` returning resolved name; design verifies backend accepts it as `sortBy` |

## Rollback Plan

Single commit. View-layer revert of one file + its test + the new composable.

## Dependencies

- `ViewToggle.vue`, `useViewMode.ts` exist.
- `useQuotationsListTable` already maps `sorting[0].id` → backend `sortBy`.
- Backend `sortBy` allowlist (verify in design).

## Success Criteria

- [ ] One toolbar row: `[Search | Filtros] [Refresh | Columnas | Nueva cotización | Tabla/Tarjetas]`.
- [ ] Cliente, Estado, Total, Expira, Fecha have working `<SortableHeader>` click-to-sort.
- [ ] ViewToggle persists across reload (`localStorage["quotations-view-mode"]`).
- [ ] External buttons gone; `AppDataTable` emits `@refresh` + `@add`.
- [ ] REQ-QAF-016 testids still resolve; `pnpm test:unit` + `pnpm build` pass.
