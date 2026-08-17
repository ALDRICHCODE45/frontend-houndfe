# Proposal: Polish mobile filters bottom-sheet

## Why

1. **Nested sheet-in-sheet** in `QuotationsListView` / `SalesListView`. The wrapper's `<USlideover side="bottom">` renders the entire self-contained `DataTableFilters` v2 (own trigger + own slideover), so users tap "Filtros" and land on a sheet containing *another* "Filtros" button opening a second sheet.
2. **Bare sheets** in admin tables (`EmployeesListView`, `ExpiringDocumentsView`, `AdminTenantsView`): no header, no sections, no structure.

Outcome: every list view shows ONE "Filtros" button → ONE bottom-sheet with identical design (sticky header + card sections + footer), using the `CreateEmployeeSlideover` card pattern.

## What Changes

1. **Wrapper owns the sheet.** `DataTableToolbar.vue` keeps its `USlideover side="bottom"` but rebuilds `#content` as sticky header (`Filtros` + active-count badge + `Limpiar todo` when count > 0) / scrollable body (each filter section rendered as a card, `bg-elevated/30` per the `CreateEmployeeSlideover` pattern) / sticky footer (`Cerrar`).
2. **`DataTableFilters` v2 gains `embedded: boolean` (default `false`).** When `true`, renders only filter sections + chips; suppresses trigger + own slideover. Standalone preserved. `open`/`close` exposed as no-ops.
3. **`QuotationsListView` / `SalesListView` switch to embedded mode.** Wrapper hosts the filter content inside the unified sheet.
4. **Raw-admins keep inline content.** Wrapper wraps each in a section card. Optional `#filters-title` slot (default `"Filtros"`) labels the section.

## Scope

**In scope:**
- `src/core/shared/components/DataTable/DataTableToolbar.vue` — rebuild sheet.
- `src/core/shared/data-table-filters/components/DataTableFilters.vue` — add `embedded` prop.
- `src/features/POS/quotations/views/QuotationsListView.vue`, `src/features/POS/sales/views/SalesListView.vue` — pass `:embedded="true"`.
- Unit tests + delta spec for `data-table-toolbar` REQ-3.

**Out of scope:** migrating admin filters to the `DataTableFilters` v2 schema system; desktop layout; per-view filter logic; auto-deriving wrapper header's count from embedded (future phase — phase 1 uses `activeFilterCount`).

## Approach

- Wrapper re-uses `useBreakpoints(breakpointsTailwind).smaller('md')` (already in place) to keep the sheet mobile-only. Cards consume `bg-elevated/30` (proven in `CreateEmployeeSlideover`).
- `DataTableFilters` v2 `embedded` path: same `groupsWithActivity` + chips; trigger slot + `USlideover` block are `v-if="!embedded"`.
- Testids: `toolbar-filters-header`, `toolbar-filters-body`, `toolbar-filters-footer`, `toolbar-filters-section-{id}`, `data-table-filters-embedded`. Existing `toolbar-filtros-button` / `toolbar-filtros-badge` stay.

## Affected Specs

**New capability.** `mobile-filters-sheet` — unified mobile "Filtros" bottom-sheet design (sticky header + section cards + footer) and the `embedded` rendering mode of `DataTableFilters` v2. Spec at `openspec/changes/polish-filters-bottom-sheet/specs/mobile-filters-sheet/spec.md`.

**Modified.** `data-table-toolbar` — REQ-3 amended to describe the new sticky-header + card + footer structure and the slot consumption contract.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Other consumers of `DataTableFilters` v2 break under `embedded` | Low | Default `false`; standalone preserved; grep before merge |
| Wrapper header count is `0` while embedded has actual chips | Med | Spec calls this out as phase-1 limitation; phase-2 wires the embedded count |
| Card sections look heavier than bare flex | Low | Use `bg-elevated/30` token (proven in `CreateEmployeeSlideover`) |
| Review budget > 400 lines | Med | Keep card wrapper inline in the toolbar; no new component unless card repeats 3+ times |

## Rollback Plan

Revert `DataTableToolbar.vue` to the prior `USlideover` shape (single `div` + `<slot name="filters" />`). Drop the `embedded` prop from `DataTableFilters` v2. Revert the `:embedded="true"` bindings in `QuotationsListView` / `SalesListView`. Remove the `mobile-filters-sheet` spec and the `data-table-toolbar` delta. No data loss; archived `unify-table-mobile-header` behavior is restored.

## Dependencies

Nuxt UI v4.6 `USlideover` / `UButton` / `UBadge` (already in use). `useBreakpoints(breakpointsTailwind).smaller('md')` (already in `DataTableToolbar`).

## Success Criteria

- [ ] Mobile `QuotationsListView` / `SalesListView`: one "Filtros" tap → one bottom-sheet — no nested trigger.
- [ ] Mobile admin tables: bare sheet gains sticky header + section cards + `Cerrar` footer.
- [ ] Every list view shows the SAME sheet design.
- [ ] `pnpm test:unit` passes; `pnpm build` passes; no `activeFilterCount` regression.
- [ ] `mobile-filters-sheet` spec committed; `data-table-toolbar` delta committed.
