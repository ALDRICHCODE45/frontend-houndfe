/**
 * useEmployeesList — WU-A (REQ-2 migration to useServerTable)
 *
 * Composable that wires `useServerTable` (the shared, UNTOUCHABLE composable)
 * for pagination/search/error/selection. `statusTab` (Todos / Activos / Bajas)
 * and `managerId` remain feature-local refs that close over `queryKey` and
 * `queryFn` — Approach C from proposal.md.
 *
 * Rules (preserved from WU-02):
 *  - Query params use LOWERCASE status values: 'active' | 'terminated' | 'all'
 *  - NEVER pass tenantId in API params
 *  - staleTime: 30_000, placeholderData: keepPreviousData (inside useServerTable)
 *  - selectedRows is index-based (matches useServerTable.selectedRows semantics)
 *
 * WU-A additions (migration):
 *  - Drop hand-rolled `page` / `pageSize` / `search` refs — useServerTable owns
 *    `pagination.pageIndex` (0-based), `pagination.pageSize`, and `globalFilter`.
 *  - EmployeesListParams.page renamed to `pageIndex` (0-based); `list` translates
 *    to `page = pageIndex + 1`.
 *  - No sort param sent (sorting descoped pending backend `sortBy`/`sortOrder`).
 *  - Surface `isError`, `error`, `selectedRows`, `refresh` from useServerTable.
 *  - `selectedRows` aliased to `selectedEmployees` (preserves bulk-action callers).
 *  - `clearSelection` watcher: `[statusTab, globalFilter]`.
 *  - Persist table prefs (column pinning/visibility) under `admin-employees`.
 *  - `defaultPinning: { left: [], right: ['actions'] }` (REQ-10 invariant).
 *  - `pageSizeOptions: [10, 20, 50]`.
 */

import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { EMPLOYEE_STATUS_FILTER } from '../constants/employee.constants'
import { employeesApi, type EmployeeStatusFilter, type EmployeesListParams } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'

// ─── Pure helper (exported for test access) ───────────────────────────────────

export interface EmployeesQueryInput {
  statusTab: EmployeeStatusFilter
  search?: string
  managerId?: string
  /** 0-based page index — `list()` translates to backend's 1-indexed `page`. */
  pageIndex: number
  pageSize: number
}

/**
 * Pure function: maps UI filter state → API query params.
 * No tenantId, no sort param, no side effects — fully testable.
 */
export function buildEmployeesQueryParams(input: EmployeesQueryInput): EmployeesListParams {
  const params: EmployeesListParams = {
    status: input.statusTab,
    pageIndex: input.pageIndex,
    pageSize: input.pageSize,
  }

  if (input.search && input.search.trim() !== '') {
    params.search = input.search.trim()
  }

  if (input.managerId) {
    params.managerId = input.managerId
  }

  return params
}

// ─── Composable ──────────────────────────────────────────────────────────────

export interface UseEmployeesListOptions {
  defaultPageSize?: number
  debounceMs?: number
}

export function useEmployeesList(options: UseEmployeesListOptions = {}) {
  const { defaultPageSize = 10, debounceMs = 300 } = options

  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  // ── Feature-local filter state (close over queryKey/queryFn) ───────────────
  const statusTab = ref<EmployeeStatusFilter>(EMPLOYEE_STATUS_FILTER.ALL)
  const managerId = ref<string | undefined>(undefined)

  // ── Compose the shared useServerTable (untouched) ──────────────────────────
  //
  // `queryKey` carries statusTab + managerId so cache slots change when the
  // user switches tabs or sets a managerId programmatically. `queryFn` reads
  // `params.pageIndex` / `params.pageSize` from the table composable and
  // maps the search text from `params.globalFilter`.
  const t = useServerTable<Employee>({
    queryKey: () => [
      ...employeeQueryKeys.paginated(tenantId.value),
      { statusTab: statusTab.value, managerId: managerId.value },
    ],
    queryFn: (params: ServerTableParams): Promise<PaginatedResponse<Employee>> =>
      employeesApi.list(
        buildEmployeesQueryParams({
          statusTab: statusTab.value,
          search: params.globalFilter,
          managerId: managerId.value,
          pageIndex: params.pageIndex,
          pageSize: params.pageSize,
        }),
      ),
    defaultPageSize,
    debounceMs,
    pageSizeOptions: [10, 20, 50],
    defaultPinning: { left: [], right: ['actions'] },
    persistKey: 'admin-employees',
    urlSync: false,
  })

  // ── Selection-clear guard — runs when the user switches status tabs OR
  //    when the debounced search filter changes the result list. We watch
  //    `t.globalFilter` (the ref), not the debounced value, so the moment
  //    useServerTable updates `pageIndex = 0` the selection clears too.
  watch([statusTab, t.globalFilter], () => {
    t.clearSelection()
  })

  // ── Actions (kept for batch-action callers that mutate filters) ───────────
  function setStatusTab(tab: EmployeeStatusFilter) {
    statusTab.value = tab
  }

  function setManagerId(id: string | undefined) {
    managerId.value = id
  }

  function refresh() {
    t.refresh()
  }

  return {
    // Feature-local state
    statusTab,
    managerId,
    setStatusTab,
    setManagerId,
    // useServerTable surface — see src/core/shared/composables/useServerTable.ts
    pagination: t.pagination,
    sorting: t.sorting,
    globalFilter: t.globalFilter,
    rowSelection: t.rowSelection,
    columnPinning: t.columnPinning,
    columnVisibility: t.columnVisibility,
    // Derived data — `data` is the alias for `employees` (consumed by view)
    employees: t.data,
    totalCount: t.totalCount,
    pageCount: t.pageCount,
    isLoading: t.isLoading,
    isFetching: t.isFetching,
    // Error state — surfaced from useServerTable so views can distinguish
    // a failed request from an empty result set
    isError: t.isError,
    error: t.error,
    // Actions
    refresh,
    resetFilters: t.resetFilters,
    // Row selection (WU-12 — preserved)
    selectedRows: t.selectedRows,
    selectedEmployees: t.selectedRows,
    clearSelection: t.clearSelection,
    // Pagination info
    pageSizeOptions: t.pageSizeOptions,
    showingFrom: t.showingFrom,
    showingTo: t.showingTo,
  }
}