/**
 * useQuotationsList — S3 / REQ-QTN-002.
 *
 * Wires TanStack Vue Query for the paginated list of quotations exposed at
 * `GET /quotations`. Mirrors the `useEmployeesList` pattern (filter state as
 * local refs → `buildQuotationsQueryParams` pure helper → `useQuery` with
 * `keepPreviousData`), but the public surface differs:
 *
 *   - The backend uses 1-indexed `page` / `limit` (not 0-indexed
 *     `pageIndex` / `pageSize`). Exposed field names match the API contract.
 *   - The status filter is an `ALL` sentinel, not the absence of a filter,
 *     because the list view's tab bar always has one tab selected.
 *
 * Cache key: `['quotations', tenantId, 'list', params]` from
 * `quotationQueryKeys.list(...)`. Different filter combinations live in
 * distinct cache slots; TanStack auto-bumps the key as reactive params change.
 *
 * The composable is also the single source of truth for "is this page ready
 * to fetch" — it disables the query when `authStore.currentTenantId` is
 * empty (auth bootstrap not complete) so the table never fires against an
 * anonymous tenant context.
 */

import { computed, ref } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import { quotationApi } from '../api/quotation.api'
import type {
  PaginatedQuotations,
  QuotationListParams,
  QuotationResponseDto,
  QuotationStatus,
} from '../interfaces/quotation.types'

// ─── Status filter ────────────────────────────────────────────────────────────

/** List-view tab bar values. `ALL` is the no-filter sentinel; the rest are
 *  the exact `QuotationStatus` literals from the backend. */
export type QuotationStatusFilter = 'ALL' | QuotationStatus

// ─── Pure helper (exported for test access) ───────────────────────────────────

export interface QuotationsQueryInput {
  status: QuotationStatusFilter
  search?: string
  customerId?: string
  page: number
  limit: number
}

/**
 * Pure function: maps UI filter state → API query params. No tenantId, no
 * side effects — fully testable in isolation.
 */
export function buildQuotationsQueryParams(input: QuotationsQueryInput): QuotationListParams {
  const params: QuotationListParams = {
    page: input.page,
    limit: input.limit,
  }

  if (input.status !== 'ALL') {
    params.status = input.status
  }

  if (input.search && input.search.trim() !== '') {
    params.search = input.search.trim()
  }

  if (input.customerId) {
    params.customerId = input.customerId
  }

  return params
}

// ─── Composable ──────────────────────────────────────────────────────────────

export interface UseQuotationsListOptions {
  defaultLimit?: number
  debounceMs?: number
}

export function useQuotationsList(options: UseQuotationsListOptions = {}) {
  const { defaultLimit = 10, debounceMs = 300 } = options

  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  // ── Filter state ──────────────────────────────────────────────────────────
  const status = ref<QuotationStatusFilter>('ALL')
  const search = ref('')
  const customerId = ref<string | undefined>(undefined)
  const page = ref(1)
  const limit = ref(defaultLimit)

  // Debounced search — avoids query storm on every keystroke
  const debouncedSearch = refDebounced(search, debounceMs)

  // ── Query params (derived from filter state) ───────────────────────────────
  const queryParams = computed<QuotationListParams>(() =>
    buildQuotationsQueryParams({
      status: status.value,
      search: debouncedSearch.value as string | undefined,
      customerId: customerId.value,
      page: page.value,
      limit: limit.value,
    }),
  )

  // ── Query key — scoped to tenant ───────────────────────────────────────────
  const queryKey = computed(() => [
    ...quotationQueryKeys.list(tenantId.value),
    queryParams.value,
  ])

  // ── Query gating — do not fire before auth/tenant context is ready ──────────
  // Symmetric with useEmployeesList / useNotificationConfigQuery.
  const isReady = computed(() => !!tenantId.value)

  // ── TanStack Query ─────────────────────────────────────────────────────────
  const {
    data: queryData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<PaginatedQuotations>({
    queryKey,
    queryFn: () => quotationApi.list(queryParams.value),
    enabled: isReady,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  // ── Derived data ───────────────────────────────────────────────────────────
  const quotations = computed<QuotationResponseDto[]>(() => queryData.value?.data ?? [])
  const total = computed(() => queryData.value?.pagination.total ?? 0)
  const totalPages = computed(() => queryData.value?.pagination.totalPages ?? 0)

  // ── Actions ────────────────────────────────────────────────────────────────
  function setStatus(next: QuotationStatusFilter): void {
    status.value = next
    page.value = 1 // reset pagination on filter change
  }

  function setSearch(value: string): void {
    search.value = value
    page.value = 1
  }

  function setCustomerId(id: string | undefined): void {
    customerId.value = id
    page.value = 1
  }

  function setPage(p: number): void {
    page.value = p
  }

  function setLimit(size: number): void {
    limit.value = size
    page.value = 1
  }

  function refresh(): void {
    void refetch()
  }

  return {
    // Filter state (readable / writable refs)
    status,
    search,
    customerId,
    page,
    limit,
    // Derived data
    quotations,
    total,
    totalPages,
    // TanStack Query state passthroughs
    isLoading,
    isFetching,
    isError,
    error,
    // Actions
    setStatus,
    setSearch,
    setCustomerId,
    setPage,
    setLimit,
    refresh,
  }
}
