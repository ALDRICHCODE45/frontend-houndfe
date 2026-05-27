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
 */

import { computed, ref } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { employeesApi, type EmployeeStatusFilter, type EmployeesListParams } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'
import type { PaginatedResponse } from '@/core/shared/types/table.types'

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
  const statusTab = ref<EmployeeStatusFilter>('all')
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
    // Actions
    setStatusTab,
    setSearch,
    setManagerId,
    setPage,
    setPageSize,
    refresh,
  }
}
