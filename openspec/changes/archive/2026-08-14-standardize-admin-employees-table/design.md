# Design: Standardize Admin Employees Table

## Technical Approach

Approach C (hybrid closure-composition) per proposal. Rewrite `useEmployeesList` to compose `useServerTable` (untouched) for pagination/search/error/selection, keeping `statusTab`/`managerId` as feature-local refs closed over by `queryKey`/`queryFn`. Mirror the Fase 2 gold standard (AdminUsersView/AdminTenantMembersView): `employeesErrorMessage` → `:error`/`:error-message`, `AdminPageHeader` + toolbar add button (`canCreate`), `enable-column-visibility`, `displayMode` bridge + `#cards`, status tabs in `#filters`. Preserve employees-only bulk actions, card kebab, card-click → `admin-employee-detail`. **Discovery**: AppDataTable's W3 fix already renders `cards-error-state` ahead of the `#cards` slot — REQ-1 error surfacing works in BOTH modes, resolving the Fase 2 card-mode-error open question for free.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| `persistKey` | Gold standard persists column state; `urlSync` would mutate the address bar | `persistKey: 'admin-employees'`, `urlSync: false` — visibility/pinning persist; no URL scope creep |
| `enabled` gate | Old code gated on `!!tenantId`; `useServerTable` has no `enabled` option | Drop it — gold-standard parity; backend derives tenant from JWT, early fetch is safe |
| `buildEmployeesQueryParams` | Spec tests pin it; closure needs a pure mapper | **Rewrite, don't delete**: input `page` → `pageIndex` (0-based), maps `page: pageIndex + 1`; keeps no-tenantId/lowercase guards; used inside `queryFn` |
| `pageSizeOptions` | `useServerTable` default `[5,10,20,50]`; view uses `[10,20,50]` | Pass `pageSizeOptions: [10, 20, 50]` — preserve current UX |
| `selectedRows` naming | View bulk code references `selectedEmployees` (~8 sites) | Destructure `selectedRows: selectedEmployees` — bulk code byte-identical; `EmployeesListView.batch.spec.ts` untouched |
| `defaultPinning` | Employees currently has none (AppDataTable default `[]`) | `defaultPinning: { left: [], right: ['actions'] }` — REQ-10 mandates pinned-right actions |
| Add button placement | Custom header button → gold-standard toolbar | `:show-add-button="canCreate"` + `@add` (REQ-3 scenario pins "toolbar renders") |
| `EmployeeFilters.vue` | Search input duplicated by toolbar `globalFilter` | Strip search + `search` prop; keep status tabs only, rendered in `#filters` |
| Selection-clear watcher | `watch([viewMode, page])`; `page` ref removed | `watch([viewMode, () => pagination.value.pageIndex], clearSelection)`; composable watches `[statusTab, globalFilter]` |
| `v-model:sorting` | All columns non-sortable (REQ-9) | Include for gold-standard parity — inert |
| WU-B tests | Fase 2 lesson | None in WU-B; all in WU-C |

## Data Flow

```
statusTab/managerId refs ──closure──▶ queryKey/queryFn ──▶ useServerTable (pageIndex 0-based)
useServerTable ──isError/error──▶ employeesErrorMessage ──▶ AppDataTable :error/:error-message
globalFilter (300ms debounce) ──▶ search=juan ──▶ employeesApi.list
useEmployeeViewMode ──▶ ViewToggle(#actions) ──▶ :display-mode ──▶ #cards ──▶ EmployeeCardGrid
EmployeeCard kebab ──▶ edit/terminate/reactivate dialogs · card-click ──▶ router.push(admin-employee-detail)
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `employees/composables/useEmployeesList.ts` | Modify | A | Compose `useServerTable`; closure refs `statusTab`/`managerId`; surface `isError`/`error`/`selectedRows`/`refresh`; drop `page`/`pageSize`/`search` refs; rewrite `buildEmployeesQueryParams` to 0-based |
| `employees/api/employees.api.ts` | Modify | A | `EmployeesListParams.page` → `pageIndex` (0-based); `list` sends `page: pageIndex + 1`; keeps `status`/`search`/`managerId`; no sort |
| `employees/composables/useEmployeeColumns.ts` | Modify | A | `enableHiding: true` on 7 data columns; `actions` stays `false/false`; all `enableSorting: false` |
| `employees/composables/useEmployeeViewMode.ts` | Modify | A | Add `isEmployeeViewMode` guard + `displayMode` (`card`→`cards`); keep `computeSeniority`/`buildCardData` |
| `employees/components/EmployeeFilters.vue` | Modify | B | Status tabs only (search removed) |
| `employees/views/EmployeesListView.vue` | Modify | A+B | A: `AdminPageHeader` + toolbar add/refresh, error wiring, `v-model:global-filter/sorting/column-pinning/column-visibility`, `enable-column-visibility`, dead-UI removal, ViewToggle → `#actions`. B: `:display-mode` + `#cards` slot, delete `v-else` card branch + duplicate pagination |
| `employees/__tests__/useEmployeesList.spec.ts` | Modify | C | Port `buildEmployeesQueryParams`/`list` spy to `pageIndex`; keep pure adapter/badge/date/salary tests |
| `employees/views/__tests__/EmployeesListView.test.ts` | Create | C | View tests (below) |
| `employees/composables/__tests__/useEmployeeColumns.test.ts` | Create | C | Order, headers, hide/sort flags |
| `employees/composables/__tests__/useEmployeeViewMode.test.ts` | Create | C | Guard, bridge, storage round-trip |
| `EmployeeCard.vue`/`EmployeeCardGrid.vue`, `useManagerResolution`, modals, batch composables, `EmployeesListView.batch.spec.ts`, `wu03-card-view.spec.ts` | Unchanged | — | Preserved (REQ-7/8/10) |

## Interfaces / Contracts

```ts
// useEmployeesList.ts — closure composition (shared composable NOT modified)
export function useEmployeesList(options: UseEmployeesListOptions = {}) {
  const { defaultPageSize = 10, debounceMs = 300 } = options
  const tenantId = computed(() => useAuthStore().currentTenantId)
  const statusTab = ref<EmployeeStatusFilter>(EMPLOYEE_STATUS_FILTER.ALL)
  const managerId = ref<string | undefined>(undefined)

  const t = useServerTable<Employee>({
    queryKey: () => [...employeeQueryKeys.paginated(tenantId.value),
      { statusTab: statusTab.value, managerId: managerId.value }],
    queryFn: (params) => employeesApi.list(buildEmployeesQueryParams({
      statusTab: statusTab.value, search: params.globalFilter,
      managerId: managerId.value, pageIndex: params.pageIndex,
      pageSize: params.pageSize })),
    defaultPageSize, debounceMs, pageSizeOptions: [10, 20, 50],
    defaultPinning: { left: [], right: ['actions'] },
    persistKey: 'admin-employees', urlSync: false,
  })
  watch([statusTab, t.globalFilter], t.clearSelection)
  return { statusTab, managerId, setStatusTab, setManagerId, ...t }
}
// Return surface: pagination, sorting, globalFilter, rowSelection, columnPinning,
// columnVisibility, employees(data), totalCount, pageCount, isLoading, isFetching,
// isError, error, refresh, selectedRows, clearSelection, pageSizeOptions,
// showingFrom, showingTo — all from useServerTable, unchanged.

// View destructure: selectedRows: selectedEmployees; employeesErrorMessage = computed(
//   response.data.message string|array[0] → error.message →
//   'No se pudieron cargar los colaboradores. Reintenta.')
// useEmployeeViewMode(): { viewMode, setMode, toggleViewMode, displayMode } — membership mirror.

// employees.api.ts
export interface EmployeesListParams { status?; search?; managerId?; /** 0-based */ pageIndex?: number; pageSize?: number }
// list(): page: (params.pageIndex ?? 0) + 1  ·  no sort param  ·  mapPaginated unchanged
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Adapter | Port `employeesApi.list` spy: `page = pageIndex + 1`, no sort, no tenantId; keep `mapPaginated`/`normalizeEmployee` |
| Unit | Pure mapper | Port `buildEmployeesQueryParams` to `pageIndex` contract (status/search/managerId omission guards) |
| Unit | Columns | Order `[select?, colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado, actions]`; 7 data `enableHiding: true`; actions `false/false`; all `enableSorting: false` |
| Unit | View mode | Guard rejects invalid; `card`→`cards`; `table`→`table`; storage round-trip; invalid→`table` |
| Unit (view) | `EmployeesListView.test.ts` | Mock `useServerTable` (mockState incl. `isError`/`error`), `useAuthStore`, query, router (`push` spy); stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`/`data-display-mode`, slots), `EmployeeCardGrid`, `ViewToggle`, `AdminPageHeader`, modals; real `useEmployeeViewMode`. Cases: error precedence + retry→`refresh` + empty suppressed; `display-mode` default/stored/invalid; visibility enabled; tabs in `#filters` (Todos→all, Activos→active, Bajas→terminated); search→`globalFilter`; card-click→`router.push(admin-employee-detail)`; card kebab via `canUpdate`; bulk selection preserved |

## Threat Matrix

N/A — no routing change (`navigateToDetail` `router.push` is pre-existing, preserved), no shell/subprocess/VCS automation, no executable-file classification, no process integration.

## Migration / Rollout

No data migration. Rollback: revert merge — `employeesErrorMessage` falls back to empty-state behavior when `error` is null; card relocation reversible by restoring `v-else` + duplicate pagination; visibility is opt-in; only the `useServerTable` migration is non-additive, pinned by `useEmployeesList.spec.ts` in git history.

## Open Questions

- [ ] Sorting descoped: backend `sortBy`/`sortOrder` support gates a follow-up (G4).
- [ ] `pageSize` vs `limit` authority in `EmployeesBackendList` — `mapPaginated` uses `pageSize`; confirm before any adapter rewrite.
- [ ] `managerId` stays latent (supported, unexposed) — confirm intent with backend.
- [ ] `search` min-length guard (users rejects <2 chars) — employees sends unguarded; confirm.
