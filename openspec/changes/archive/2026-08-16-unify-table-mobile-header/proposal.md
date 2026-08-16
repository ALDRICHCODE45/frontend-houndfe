# Proposal: Unify Table Mobile Header

## Why

1. **Mobile toolbar broken.** On `< sm`, `DataTableToolbar` renders `#filters` and `#actions` as rigid `flex` rows without `flex-wrap` → buttons hidden, filters "amontonados". All 8 list views inherit the bug.
2. **Bottom-sheet is the agreed pattern.** `DataTableFilters` v2 already collapses to `USlideover side="bottom"` on mobile. Filters → single "Filtros" button + active-count badge.

## What Changes

1. **Single choke point.** `DataTableToolbar` becomes the unified mobile toolbar for all 8 views. No per-view migration.
2. **Mobile layout (`< md`), fixed regions:**
   - Row 1: search full-width.
   - Row 2: actions cluster, `flex-wrap`, fixed order (add → refresh → "Columnas" → ViewToggle).
   - Row 3: "Filtros" button + active-count badge → `USlideover side="bottom"` holding the `#filters` slot.
3. **Desktop unchanged.** Filters inline next to search.
4. **New contract.** `activeFilterCount: number` prop on `AppDataTable`/`DataTableToolbar`. Each view derives it from its existing filter state.

## Scope

**In scope:**
- `src/core/shared/components/DataTable/DataTableToolbar.vue` — rewrite mobile layout.
- `src/core/shared/components/DataTable/AppDataTable.vue` — forward `activeFilterCount`.
- 8 views binding the prop: `EmployeesListView`, `PendingApprovalsView`, `ExpiringDocumentsView`, `AdminUsersView`, `AdminRolesView`, `AdminTenantsView`, `AdminTenantMembersView`, `ProductsView`.

**Out of scope:** migrating inline filters to `DataTableFilters` v2 schema; desktop layout; the dead `<slot name="actions">` in `EmployeesListView.vue:383` and `ProductsView` `px-10` wrapper.

## Approach

`DataTableToolbar` uses `useBreakpoints(breakpointsTailwind).smaller('md')` → `isMobile`. On mobile: three rows; `#filters` slot moves inside the slideover; on desktop it stays inline. "Filtros" button hides when `activeFilterCount` is undefined AND slot is empty; otherwise renders with `UBadge` active-count. Actions row: `flex-wrap`, `gap-2`, icon-only `UButton color="neutral" variant="ghost"` for refresh / columns / view-toggle.

## Affected Specs

**New capability.** `data-table-toolbar` — unified mobile layout, active-filter-count contract, bottom-sheet pattern.
**Modified: None.**

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bottom-sheet overflows on landscape mobile | Med | `h-[85vh] max-h-[85vh] overflow-y-auto` inside slideover. |
| `activeFilterCount` falls out of sync with filter state | Med | Co-locate count with the filter ref in the same composable. |
| `ProductsView` `px-10` keeps toolbar cramped | Low | Separate cleanup; `min-w-0` inner row lets wrap win. |
| Existing `AppDataTable` tests break on markup change | Low | Tests target props/events, not DOM shape. |

## Rollback Plan

`git revert` the merge. Structural markup + a new optional prop defaulting to `0`. Revert restores prior layout with no API or data-shape impact.

## Dependencies

None. Nuxt UI 4, `@vueuse/core`, Vue 3.5 — already in `package.json`.

## Success Criteria

- [ ] At 360px width, every list view shows: search → actions cluster → "Filtros" button (or none), in the same order.
- [ ] No control cut off or hidden on any of the 8 views at 360px.
- [ ] Bottom-sheet opens with the same widgets the view provides; state preserved on close.
- [ ] `pnpm build` clean; `pnpm test:unit` passes.
