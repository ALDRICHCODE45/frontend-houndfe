# Proposal: Standardize Admin Employees Table

## Intent

Bring `EmployeesListView.vue` (the Empleados list) to Fase 3 parity with the Fase 2 gold standard (`standardize-admin-users-table` / `standardize-admin-roles-table` / `standardize-admin-tenants-table` / `standardize-admin-tenant-members-table`). The named gap is the data layer: `useEmployeesList` hand-rolls `page`/`pageSize`/`search`/`statusTab` instead of the shared `useServerTable` — a code comment (`useEmployeesList.ts:18-22`) literally deferred this migration. Consequence gaps: no error surfacing (a failed request renders as "No se encontraron colaboradores"), a custom inline header instead of `AdminPageHeader`, no column visibility, and a card view rendered OUTSIDE `AppDataTable` with duplicated pagination.

## Scope

### In Scope

- **G1 migrate to `useServerTable` (HIGH)**: replace the custom pagination/`page`/`pageSize` refs with `useServerTable`; keep `statusTab`/`managerId` as feature-local refs feeding `queryKey`/`queryFn` closures (Approach C). Do NOT modify the shared `useServerTable` composable.
- **G2 error surfacing (HIGH)**: destructure `isError`/`error`; compute `employeesErrorMessage`; pass `:error`/`:error-message` to `AppDataTable`. Never render the empty state on a failed request.
- **G3 `AdminPageHeader` (MED)**: replace the custom inline `<h1>Colaboradores</h1>` header with `AdminPageHeader`; keep the `Nuevo colaborador` button gated by `canCreate`.
- **G5 column visibility (MED)**: `enable-column-visibility` on `AppDataTable` + `enableHiding` on the 7 data columns (`colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado`); `actions` stays non-hideable.
- **G6/G7 card view into `#cards` slot (MED)**: add the `displayMode` bridge + `isEmployeeViewMode` guard to `useEmployeeViewMode`; render `EmployeeCardGrid` inside `AppDataTable`'s `#cards` slot via `:display-mode`; delete the sibling `v-else` branch + hand-rolled prev/next pagination (`EmployeesListView.vue:586-611`).
- **G9 dead-UI cleanup (LOW)**: remove disabled placeholders — Importar/Exportar buttons, "Filtros" button, "Todos los departamentos" / "Cualquier modalidad" selects, and the "Más recientes" sort select. Not wired (no backend params / no sort support).
- **Status tabs into `#filters` slot**: fold `EmployeeFilters`' status tabs (Todos/Activos/Bajas) into `AppDataTable`'s `#filters` slot; search maps to `globalFilter` (keeps the toolbar search box).
- **Tests (HIGH)**: port/strip `useEmployeesList.spec.ts` to the `useServerTable` contract; add error-surfacing, column-visibility, and `displayMode` bridge coverage.

### Out of Scope

- **G4 sorting — descoped, pending backend confirmation**: do NOT enable `SortableHeader`/`enableSorting`; keep all columns non-sortable; remove the disabled "Más recientes" select as dead UI. Ship as a follow-up when the backend confirms `sortBy`/`sortOrder`.
- **Card kebab + card-click→detail (G8) — PRESERVED by explicit decision**: employees has a real detail route (`admin-employee-detail`) and richer per-row actions (edit/terminate/reactivate). Diverges from the Fase 2 no-kebab card contract intentionally. `EmployeeCard`/`EmployeeCardGrid` internals unchanged; only their render location moves into `#cards`.
- **Bulk actions — PRESERVED**: the employees-only bulk-action bar (batch terminate/reactivate, `BATCH_OPS_CAP = 100`, CASL `batch_delete`/`update`) is a differentiator; do NOT delete it. Row selection via `useServerTable.selectedRows` stays index-based (matches WU-12 semantics).
- **`managerId` UI**: stays latent (backend-supported but not exposed); carried as open question.
- No `Employee` type change, no new route, no backend change, no `ExpiringDocumentsView`/`PendingApprovalsView` work (separate Fase 3 candidates).

### Already in Place (do NOT redo)

- `EmployeeCard`/`EmployeeCardGrid` (article + `EntityAvatar` + `DotBadge`/`StatusDotBadge` + dashed divider + 2-col body) ✅.
- `useManagerResolution` (batch `useQueries`, N+1-safe) ✅.
- Bulk ops: `AppDataTable.bulkActions` + `ConfirmModal`/`BatchTerminateModal`, CASL-gated ✅.
- `useEmployeeViewMode` wrapping `useViewMode('employee-view-mode', ['table','card'], 'table')` ✅.
- `normalizeEmployee` + `computeSeniority` + `buildCardData` (no-salary slice) ✅.
- CASL `canCreate` gate on the create button ✅.

## Capabilities

### New

- `admin-employees-list` — source-of-truth spec for the admin employees list view: surfaced backend errors, working column-visibility selector (7 data columns hideable, `actions` non-hideable), `useServerTable`-driven pagination/search with `statusTab`/`managerId` fed via closure-composition, status tabs in the `#filters` slot, `AdminPageHeader` shell, `localStorage` `employee-view-mode` table/card preference with `displayMode` bridge, card rendering in `#cards` slot preserving kebab (edit/terminate/reactivate) + card-click → `admin-employee-detail`, preserved bulk-action bar, and columns left non-sortable (sorting descoped pending backend).

> No existing `admin-employees` capability in `openspec/specs/`. Whole capability is `ADDED`; the original `EmployeesListView` pre-dates the spec system. No `MODIFIED` block needed.

### Modified

None.

## Approach

**Approach C (hybrid composition)**. Migrate table mechanics to `useServerTable` while keeping the employees-only `statusTab` (and latent `managerId`) as feature-local refs that close over `queryKey`/`queryFn`. Search maps to `useServerTable`'s `globalFilter` (300ms debounce, `keepPreviousData`, `staleTime 30_000`, `refetchOnWindowFocus: false` preserved). `employees.api.ts` adapter accepts the 0-based `pageIndex` from `ServerTableParams` and keeps `status`/`managerId` extras (no sort param). `mapPaginated` continues to bridge `{ data, total, page, limit, pageSize }` → `pageIndex`. Status tabs move into `AppDataTable`'s `#filters` slot; card view moves into `#cards` via `:display-mode`. `useEmployeeViewMode` gains `displayMode` (`card`→`cards`) + `isEmployeeViewMode` guard. `useEmployeeColumns` adds `enableHiding` on data columns only (no `enableSorting`). WU-B (card-in-slot) ships without tests, mirroring the Fase 2 WU-B lesson.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/admin/employees/composables/useEmployeesList.ts` | Modified | Compose `useServerTable`; drop hand-rolled `page`/`pageSize`; keep `statusTab`/`managerId` closure refs; destructure `isError`/`error`; keep `selectedRows`. |
| `src/features/admin/employees/views/EmployeesListView.vue` | Modified | `AdminPageHeader`; `:error`/`:error-message`; `enable-column-visibility`; `:display-mode` + `#cards` slot; remove duplicate card pagination; remove dead controls + sort select. |
| `src/features/admin/employees/composables/useEmployeeColumns.ts` | Modified | `enableHiding: true` on 7 data columns; `actions` non-hideable; NO `enableSorting` (descoped). |
| `src/features/admin/employees/composables/useEmployeeViewMode.ts` | Modified | Add `displayMode` bridge (`card`→`cards`) + `isEmployeeViewMode` guard; keep `computeSeniority`/`buildCardData`. |
| `src/features/admin/employees/components/EmployeeFilters.vue` | Modified | Fold status tabs into `AppDataTable` `#filters` slot; remove "Más recientes" sort select. |
| `src/features/admin/employees/api/employees.api.ts` | Modified | Accept 0-based `pageIndex`; keep `status`/`managerId`; no sort param. |
| `src/features/admin/employees/components/EmployeeCard.vue` / `EmployeeCardGrid.vue` | Unchanged | Preserved (kebab + card-click→detail); render location moves into `#cards`. |
| Tests: `useEmployeesList.spec.ts`, new `EmployeesListView` error/column-visibility/view-mode specs | Modified/New | Port to `useServerTable` contract; add error + column-visibility + `displayMode` coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `useServerTable` has no `status`/`managerId` dimension — closure-composition is a subtle pattern | Med | Keep it feature-local inside `useEmployeesList`; document the pattern; do NOT touch shared `useServerTable`. |
| Response-shape drift (`pageSize` vs `limit`, no `totalPages`) | Med | `mapPaginated` already bridges; confirm `pageSize` authority via open question before rewriting the adapter. |
| Sorting descoped leaves the view without a sort affordance | Med | Explicitly stated out-of-scope; carried as follow-up pending backend `sortBy`/`sortOrder` confirmation. |
| Card kebab + bulk actions are employees-only — a naive 1:1 mirror would delete them | Med | Explicit preservation decisions in Scope; card components marked Unchanged. |
| Status tabs in `#filters` slot + search in toolbar `globalFilter` may crowd the header | Low | Verify Fase 2 `#filters`/`DataTableToolbar` composition holds both; adjust only if visually broken. |
| `useEmployeesList.spec.ts` pins the custom-params contract (`buildEmployeesQueryParams`, `mapPaginated`, no-tenantId) | Med | Port/strip per Fase 2 WU-C precedent; do not just add new specs. |

## Rollback Plan

Revert the merge commit. Error handling is additive (`employeesErrorMessage` falls back to the existing empty state when `error` is `null`). Card view relocation into `#cards` is reversible by restoring the `v-else` branch + `displayMode` removal. Column visibility is opt-in (toolbar menu). Dead-UI removal restores the disabled placeholders. The `useEmployeesList` → `useServerTable` migration is the only non-additive step; its prior contract is pinned in `useEmployeesList.spec.ts` (git history). Bulk-action bar and card components are untouched by the revert. Tests live next to the code they pin.

## Dependencies

`useServerTable` (already returns `isError`/`error`/`selectedRows`/`globalFilter`/`columnVisibility`); `useViewMode`/`ViewToggle`; `AdminPageHeader` (shared with `AdminUsersView` etc.); `EntityAvatar`/`DotBadge`/`StatusDotBadge`/`AppDataTable`/`DataTableToolbar`; `employeeQueryKeys.paginated`; `useManagerResolution`. No new dependency on `houndfe-backend` (frontend-only — backend folder forbidden).

## Open Questions (backend team — relay to orchestrator)

1. **Sort support**: does `GET /admin/employees` support `sortBy`/`sortOrder` (like `GET /admin/users`)? Gates G4 (sorting follow-up).
2. **Response shape**: is `pageSize` authoritative or `limit`? Does the endpoint return `totalPages`?
3. **Search minimum length**: does `search` reject <2 chars (users' `SEARCH_QUERY_TOO_SHORT`)? Employees sends `search` unguarded.
4. **Manager filter**: `managerId` is a supported list param but not exposed in UI — intended to stay latent?

## Success Criteria

- [ ] Failed list requests render a backend-derived error with retry; empty placeholder only on empty success.
- [ ] `useEmployeesList` no longer hand-rolls `page`/`pageSize`; `useServerTable` drives pagination/search/error/selection.
- [ ] `statusTab` (Todos/Activos/Bajas) still filters via the `#filters` slot; search still works via `globalFilter`.
- [ ] `AdminPageHeader` replaces the custom header; `Nuevo colaborador` button still gated by `canCreate`.
- [ ] All 7 data columns hideable; `actions` non-hideable.
- [ ] Card view renders inside `#cards`; duplicate prev/next pagination removed; `employee-view-mode` preference persists.
- [ ] Card kebab (edit/terminate/reactivate) + card-click → `admin-employee-detail` unchanged.
- [ ] Bulk-action bar (batch terminate/reactivate) unchanged.
- [ ] Dead UI removed: Importar/Exportar, "Filtros", department/modality selects, "Más recientes" sort select.
- [ ] No `enableSorting`/`SortableHeader` introduced; columns non-sortable.
- [ ] `pnpm test:unit --run` passes with new/ported specs green; `pnpm build` clean.
- [ ] No `Employee` type change; no new route; no backend change.

## Work Units (forecast)

- **WU-A — `useServerTable` migration + error surfacing + header + column visibility (~150-180 lines)**: `useEmployeesList` compose + `isError`/`error`; `useEmployeeColumns` `enableHiding`; `EmployeesListView` `AdminPageHeader` + `:error`/`:error-message` + `enable-column-visibility`; dead-UI cleanup; `employees.api.ts` adapter.
- **WU-B — card into `#cards` + status tabs into `#filters` (~120-150 lines). No tests** (Fase 2 WU-B lesson): `displayMode` bridge + `isEmployeeViewMode` guard; `#cards` slot + `:display-mode`; remove duplicate pagination; `EmployeeFilters` status tabs into `#filters`.
- **WU-C — tests (~200-250 lines)**: port/strip `useEmployeesList.spec.ts` to `useServerTable` contract; add error-surfacing, column-visibility, and `displayMode` bridge specs.

Review Workload Forecast: `Decision needed before apply: No`, `Chained PRs recommended: No` (NO PRs — conventional commits on branch, manual merge to main), `400-line budget risk: Medium` — WU-A is heaviest but stays under 400.
