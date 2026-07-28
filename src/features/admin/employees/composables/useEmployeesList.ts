/**
 * useEmployeesList — WU-02
 *
 * Composable that wires TanStack Vue Query + useServerTable for the employee list.
 * Manages status tabs, search, modality filter, manager filter.
 *
 * Rules:
 * - Query params use LOWERCASE status values: 'active' | 'terminated' | 'all'
 * - NEVER pass tenantId in API params
 * - Uses employeeQueryKeys.paginated for cache scoping
 * - staleTime: 30_000, placeholderData: keepPreviousData (via useServerTable)
 *
 * WU-12 additions (employees-batch-operations):
 * - rowSelection: Ref<RowSelectionState> — v-model for AppDataTable
 * - selectedEmployees: ComputedRef<Employee[]> — derived from rowSelection × employees
 * - clearSelection(): void — empty rowSelection
 *
 * The selection is intentionally separate from useServerTable because the
 * existing EmployeesListView wires its own pagination via a local `page`
 * ref + AppDataTable forwarding — migrating to useServerTable is out of
 * scope for this SDD.
 */

import { computed, ref, watch } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { EMPLOYEE_STATUS_FILTER } from '../constants/employee.constants'
import { employeesApi, type EmployeeStatusFilter, type EmployeesListParams } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'
import type { PaginatedResponse, RowSelectionState } from '@/core/shared/types/table.types'

// ─── Pure helper (exported for test access) ───────────────────────────────────

export interface EmployeesQueryInput {
  statusTab: EmployeeStatusFilter
  search?: string
  managerId?: string
  page: number
  pageSize: number
}

/**
 * Pure function: maps UI filter state → API query params.
 * No tenantId, no side effects — fully testable.
 */
export function buildEmployeesQueryParams(input: EmployeesQueryInput): EmployeesListParams {
  const params: EmployeesListParams = {
    status: input.statusTab,
    page: input.page,
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

  // ── Filter state ──────────────────────────────────────────────────────────
  const statusTab = ref<EmployeeStatusFilter>(EMPLOYEE_STATUS_FILTER.ALL)
  const search = ref('')
  const managerId = ref<string | undefined>(undefined)
  const page = ref(1)
  const pageSize = ref(defaultPageSize)

  // Debounced search — avoids query storm on every keystroke
  const debouncedSearch = refDebounced(search, debounceMs)

  // ── Query params (derived from filter state) ───────────────────────────────
  const queryParams = computed<EmployeesListParams>(() =>
    buildEmployeesQueryParams({
      statusTab: statusTab.value,
      search: debouncedSearch.value,
      managerId: managerId.value,
      page: page.value,
      pageSize: pageSize.value,
    }),
  )

  // ── Query key — scoped to tenant ───────────────────────────────────────────
  const queryKey = computed(() => [
    ...employeeQueryKeys.paginated(tenantId.value),
    queryParams.value,
  ])

  // ── Query gating — do not fire before auth/tenant context is ready ──────────
  // tenantId comes from the JWT-derived authStore.currentTenantId.
  // An empty string means the auth bootstrap has not completed yet.
  // Symmetric with the pattern used in other admin feature composables.
  const isReady = computed(() => !!tenantId.value)

  // ── TanStack Query ─────────────────────────────────────────────────────────
  const {
    data: queryData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<PaginatedResponse<Employee>>({
    queryKey,
    queryFn: () => employeesApi.list(queryParams.value),
    enabled: isReady,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  // ── Derived data ───────────────────────────────────────────────────────────
  const employees = computed<Employee[]>(() => queryData.value?.data ?? [])
  const totalCount = computed(() => queryData.value?.pagination?.totalCount ?? 0)
  const pageCount = computed(() => queryData.value?.pagination?.pageCount ?? 0)

  // ── Row selection — WU-12 employees-batch-operations ──────────────────────
  //
  // rowSelection keys are EMPLOYEE IDs (strings) — TanStack vue-table natively
  // binds by row.id. When the underlying employees list refreshes, keys that
  // no longer exist (offending 404s) will still appear in rowSelection until
  // clearSelection() is called. The view layer clears on filter/page/view
  // change and on mutation success/error.
  const rowSelection = ref<RowSelectionState>({})

  // selectedEmployees — derived: filter employees against rowSelection keys.
  const selectedEmployees = computed<Employee[]>(() => {
    const keys = Object.keys(rowSelection.value)
    if (keys.length === 0) return []
    return employees.value.filter((e) => keys.includes(e.id))
  })

  function clearSelection(): void {
    rowSelection.value = {}
  }

  // ── Filter-clear guard (WU-12) ────────────────────────────────────────────
  //
  // Mirrors PromotionsView.vue:148 — when the user changes the status tab or
  // the search query, the underlying employees list will be re-fetched with
  // new results. Page-relative row selection cannot survive a filter switch
  // because the row indices map to different entities.
  //
  // We watch statusTab and search (NOT debouncedSearch) — the moment the user
  // commits the change, the selection must clear. We do NOT reset page here
  // because setStatusTab / setSearch already do that explicitly.
  watch([statusTab, search], () => {
    clearSelection()
  })

  // ── Actions ────────────────────────────────────────────────────────────────
  function setStatusTab(tab: EmployeeStatusFilter) {
    statusTab.value = tab
    page.value = 1 // reset pagination on filter change
  }

  function setSearch(value: string) {
    search.value = value
    page.value = 1
  }

  function setManagerId(id: string | undefined) {
    managerId.value = id
    page.value = 1
  }

  function setPage(p: number) {
    page.value = p
  }

  function setPageSize(size: number) {
    pageSize.value = size
    page.value = 1
  }

  function refresh() {
    void refetch()
  }

  return {
    // Filter state (readable)
    statusTab,
    search,
    managerId,
    page,
    pageSize,
    // Derived data
    employees,
    totalCount,
    pageCount,
    isLoading,
    isFetching,
    // Row selection — WU-12
    rowSelection,
    selectedEmployees,
    clearSelection,
    // Actions
    setStatusTab,
    setSearch,
    setManagerId,
    setPage,
    setPageSize,
    refresh,
  }
}
