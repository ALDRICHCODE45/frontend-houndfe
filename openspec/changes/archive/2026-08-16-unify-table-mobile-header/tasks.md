# Tasks: Unify Table Mobile Header

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220–320 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-A | Shared toolbar contract (rewrite + prop) | PR 1 | `pnpm test:unit src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts` | N/A — Vue unit tests cover 360px via stubbed `useBreakpoints`; visual smoke manual per REQ-QAF-016 | Revert `DataTableToolbar.vue` + `AppDataTable.vue`; views keep prior layout |
| WU-B | 8 view bindings of `active-filter-count` | PR 1 | `pnpm test:unit` | N/A — binding-only edits | Revert 8 view edits; count defaults 0 |
| WU-C | Build + full-test gate | PR 1 | `pnpm build && pnpm test:unit` | N/A — gate step | N/A |

## Phase 1: WU-A — Toolbar contract (TDD: RED → GREEN)

- [x] 1.1 RED — Append failing tests to `src/core/shared/components/DataTable/__tests__/DataTableToolbar.spec.ts` covering every spec scenario: three-region order at `< md` (full toolbar 360px), search-only row, actions cluster `flex-wrap` no clip, card mode hides "Columnas", "Filtros" opens `USlideover side="bottom"` scrollable (landscape overflow), `UBadge` count when `activeFilterCount > 0`, no badge when count 0, button hidden when `#filters` slot empty, button visible when slot populated but count 0, desktop inline invariance, `showToolbar=false` renders nothing. Stub `useBreakpoints` like `AppDataTable.spec.ts`. Confirm RED.
- [x] 1.2 GREEN — Rewrite `src/core/shared/components/DataTable/DataTableToolbar.vue`: import `breakpointsTailwind, useBreakpoints` from `@vueuse/core`; compute `isMobile = breakpoints.smaller('md')`. Below `md` render row 1 search full-width, row 2 actions cluster with `flex-wrap gap-2` in fixed order (add → refresh → "Columnas" → `<slot name="actions" />`), row 3 "Filtros" button + `<UBadge>` (only when count > 0) wrapping `#filters` slot in `USlideover side="bottom"` with `h-[85vh] max-h-[85vh] overflow-y-auto`. At `md`+ keep current horizontal layout. Confirm GREEN.
- [x] 1.3 GREEN — Add `activeFilterCount?: number` (default `0`) to `DataTableToolbar.vue` props; detect `hasFiltersSlot` via `useSlots()`; render "Filtros" only when `hasFiltersSlot`. Forward same prop from `AppDataTable.vue` to `DataTableToolbar`. Existing testid tests must still pass.

## Phase 2: WU-B — View bindings (no filter-logic migration)

- [x] 2.1 `src/features/admin/employees/views/EmployeesListView.vue` — add `:active-filter-count="statusTab !== 'all' ? 1 : 0"` on `<AppDataTable>`.
- [x] 2.2 `src/features/admin/employees/views/ExpiringDocumentsView.vue` — add `:active-filter-count="threshold !== DEFAULT_THRESHOLD ? 1 : 0"`. (NOTE: `DEFAULT_THRESHOLD` constant does not exist; implementation uses inline literal `30` — composable default. Functional, but a named constant is recommended. Tracked as SUGGESTION in verify-report.)
- [x] 2.3 `src/features/admin/tenants/views/AdminTenantsView.vue` — add `:active-filter-count="includeInactive ? 1 : 0"`.
- [x] 2.4 `src/features/admin/employees/views/PendingApprovalsView.vue`, `src/features/admin/users/views/AdminUsersView.vue`, `src/features/admin/roles/views/AdminRolesView.vue`, `src/features/admin/tenants/memberships/views/AdminTenantMembersView.vue`, `src/features/POS/products/views/ProductsView.vue` — omit binding (no `#filters` slot; count defaults to 0).

## Phase 3: WU-C — Verification gate

- [x] 3.1 Run `pnpm test:unit`; all green. Update `AppDataTable.spec.ts` stub props list if markup change breaks pass-through tests.
- [x] 3.2 Run `pnpm build`; clean exit.
- [ ] 3.3 Manual smoke at 360px on each of the 8 views: search → actions → "Filtros" (or absent) order, bottom-sheet opens, badge count matches derived value. — **N/A**: no browser runtime available in this environment. Stubbed `useBreakpoints` simulates viewport in unit tests; pixel-level no-clip is not visually confirmed. Recorded as WARNING #1 in `verify-report.md`.