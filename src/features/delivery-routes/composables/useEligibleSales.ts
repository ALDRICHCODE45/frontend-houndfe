/**
 * useEligibleSales — server-searched, server-paginated eligible-sales query
 * (T3 S3, backend contract `GET /delivery-routes/eligible-sales`).
 *
 * Replaces the previous thin wrapper over `useConfirmedSales`: the backend now
 * owns eligibility AND availability authoritatively, so the picker requests a
 * single page from the dedicated endpoint instead of over-fetching the whole
 * confirmed-sales list and filtering locally.
 *
 * Contract:
 *   - GET /delivery-routes/eligible-sales with { page, limit, q?, contextRouteId? }.
 *   - page defaults to 1; limit defaults to 20 and is clamped to 1..100;
 *     q is trimmed and clamped to 200 chars.
 *   - Never fabricates availability — the response's `availability` union is the
 *     only source of truth (see `interfaces/eligible-sales.types.ts`).
 *   - Exposes the authoritative `{ data, pagination }` envelope plus
 *     isLoading/isFetching/isError/error/refresh.
 *   - Cache key prefix `['delivery-routes', tenantId, 'eligible-sales']` is the
 *     slot `useCreateDeliveryRoute` invalidates on a 409 conflict so the picker
 *     refetches the now-authoritative availability.
 *
 * Uses the project's reactive `MaybeRefOrGetter` option contract so callers can
 * pass a plain object, a `Ref`, or a getter without breaking reactivity.
 */

import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { http } from '@/core/shared/api/http'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import type {
  ConfirmedSaleRow,
  ConfirmedSalesListResponse,
  ListSalesParams,
} from '@/features/POS/sales/interfaces/sale.types'
import type {
  EligibleSaleRow,
  EligibleSalesPagination,
  EligibleSalesQuery,
  EligibleSalesResponse,
} from '../interfaces/eligible-sales.types'

export const DEFAULT_ELIGIBLE_SALES_PAGE_SIZE = 20
export const ELIGIBLE_SALES_MAX_LIMIT = 100
export const ELIGIBLE_SALES_MAX_QUERY_LENGTH = 200

const EMPTY_PAGINATION: EligibleSalesPagination = {
  page: 1,
  limit: DEFAULT_ELIGIBLE_SALES_PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

/**
 * eligibleSalesQueryKeys — the cache contract shared by the query and the
 * create mutation's conflict invalidation.
 */
export const eligibleSalesQueryKeys = {
  /** Cross-slot invalidation prefix (prefix-matches every page/query slot). */
  listPrefix: (tenantId: string) => ['delivery-routes', tenantId, 'eligible-sales'] as const,
  /** Exact fetch slot for a normalized query. */
  list: (tenantId: string, params: EligibleSalesQuery) =>
    [...eligibleSalesQueryKeys.listPrefix(tenantId), params] as const,
}

/**
 * normalizeEligibleSalesQuery — pure, defensive clamp of the wire params.
 *
 * page >= 1; limit ∈ 1..100 (default 20); q trimmed + truncated to 200 chars
 * and omitted when empty; contextRouteId forwarded only when provided.
 */
export function normalizeEligibleSalesQuery(input: EligibleSalesQuery): EligibleSalesQuery {
  const rawPage = Math.floor(input.page ?? 1)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const rawLimit = Math.floor(input.limit ?? DEFAULT_ELIGIBLE_SALES_PAGE_SIZE)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(ELIGIBLE_SALES_MAX_LIMIT, Math.max(1, rawLimit))
    : DEFAULT_ELIGIBLE_SALES_PAGE_SIZE

  const normalized: EligibleSalesQuery = { page, limit }

  const q = (input.q ?? '').trim().slice(0, ELIGIBLE_SALES_MAX_QUERY_LENGTH)
  if (q.length > 0) normalized.q = q

  if (input.contextRouteId) normalized.contextRouteId = input.contextRouteId

  return normalized
}

/** Pure: normalized query → axios `params` bag (omits empty q / absent route). */
export function buildEligibleSalesRequestParams(query: EligibleSalesQuery): Record<string, unknown> {
  const params: Record<string, unknown> = { page: query.page, limit: query.limit }
  if (query.q) params.q = query.q
  if (query.contextRouteId) params.contextRouteId = query.contextRouteId
  return params
}

/** Pure fetch seam — the only network call; mocked in tests. */
export async function fetchEligibleSales(query: EligibleSalesQuery): Promise<EligibleSalesResponse> {
  const { data } = await http.get<EligibleSalesResponse>('/delivery-routes/eligible-sales', {
    params: buildEligibleSalesRequestParams(query),
  })
  return data
}

/**
 * Outcome of a refresh attempt.
 *
 * `ok:false` means the authoritative data was NOT confirmed — either the
 * refetch promise rejected OR it resolved with an error result. Callers MUST NOT
 * mark a conflict reviewed / claim availability on `ok:false`.
 */
export interface RefreshOutcome<T> {
  ok: boolean
  data: T | undefined
}

/**
 * Pure: normalizes a refetch (which can REJECT or RESOLVE with an error result)
 * into an explicit outcome, so a failed refetch is never mistaken for success.
 */
export async function settleRefreshResult<T>(
  refetch: () => Promise<{ isError: boolean, data?: T }>,
): Promise<RefreshOutcome<T>> {
  try {
    const result = await refetch()
    return result.isError ? { ok: false, data: undefined } : { ok: true, data: result.data }
  } catch {
    return { ok: false, data: undefined }
  }
}

/** Refresh result at the picker boundary: ok + the fresh authoritative rows. */
export interface EligibleSalesRefreshResult {
  ok: boolean
  data: EligibleSaleRow[]
}

export function useEligibleSales(
  options?: MaybeRefOrGetter<EligibleSalesQuery>,
  config?: UseEligibleSalesConfig,
) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const enabled = computed(() => (config?.enabled !== undefined ? toValue(config.enabled) : true))

  const normalizedQuery = computed<EligibleSalesQuery>(() =>
    normalizeEligibleSalesQuery(options ? toValue(options) : {}),
  )

  const queryKey = computed(() => eligibleSalesQueryKeys.list(tenantId.value, normalizedQuery.value))

  const query = useQuery<EligibleSalesResponse>({
    queryKey,
    enabled,
    queryFn: (queryContext) => {
      // Read the params captured in the executing key, not the live ref, so a
      // late/duplicate execution can never fetch for a different page.
      const key = queryContext.queryKey
      const params = key[key.length - 1] as EligibleSalesQuery
      return fetchEligibleSales(params)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const data = computed(() => query.data.value?.data ?? [])
  const pagination = computed(() => query.data.value?.pagination ?? EMPTY_PAGINATION)
  const totalCount = computed(() => pagination.value.total)
  const pageCount = computed(() => pagination.value.totalPages)
  const isLoading = computed(() => query.isLoading.value && !query.data.value)
  const isFetching = computed(() => query.isFetching.value)
  const isError = computed(() => query.isError.value)
  const error = computed(() => query.error.value)

  function refresh(): Promise<EligibleSalesRefreshResult> {
    return settleRefreshResult(() => query.refetch()).then((outcome) => ({
      ok: outcome.ok,
      data: outcome.data?.data ?? [],
    }))
  }

  return {
    data,
    pagination,
    totalCount,
    pageCount,
    isLoading,
    isFetching,
    isError,
    error,
    refresh,
  }
}

/** Optional `enabled` gate so only the ACTIVE picker source issues a request. */
export interface UseEligibleSalesConfig {
  enabled?: MaybeRefOrGetter<boolean>
}

/**
 * Legacy append path — `GET /sales` (confirmed) with the PENDING+SHIPPED pin.
 *
 * The append flow is gated by `update:DeliveryRoute` (NOT `create:DeliveryRoute`),
 * so it MUST keep this legacy contract: the dedicated eligible-sales endpoint
 * requires `read:Sale` AND `create:DeliveryRoute` and would 403 for an
 * update-only manager. `enabled` lets the shared picker skip this query when it
 * is rendering the authoritative create source (and vice versa).
 *
 * This path has NO authoritative availability: rows carry no `availability`, so
 * the picker must not disable rows or claim a reason here.
 */
export function useLegacyConfirmedEligibleSales(
  options?: MaybeRefOrGetter<EligibleSalesQuery>,
  config?: UseEligibleSalesConfig,
) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const enabled = computed(() => (config?.enabled !== undefined ? toValue(config.enabled) : true))

  const normalizedQuery = computed<EligibleSalesQuery>(() =>
    normalizeEligibleSalesQuery(options ? toValue(options) : {}),
  )

  const legacyParams = computed<ListSalesParams>(() => buildLegacyConfirmedParams(normalizedQuery.value))
  const queryKey = computed(() => saleQueryKeys.confirmed(tenantId.value, legacyParams.value))

  const query = useQuery<ConfirmedSalesListResponse>({
    queryKey,
    enabled,
    queryFn: (queryContext) => {
      const key = queryContext.queryKey
      const params = key[key.length - 1] as ListSalesParams
      return saleApi.listConfirmed(params)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const data = computed<EligibleSaleRow[]>(() =>
    (query.data.value?.data ?? []).map(toLegacyPickerRow),
  )
  const pagination = computed<EligibleSalesPagination>(() => {
    const p = query.data.value?.pagination
    return p
      ? { page: p.page, limit: p.limit, total: p.total, totalPages: p.totalPages }
      : EMPTY_PAGINATION
  })
  const totalCount = computed(() => pagination.value.total)
  const pageCount = computed(() => pagination.value.totalPages)
  const isLoading = computed(() => query.isLoading.value && !query.data.value)
  const isFetching = computed(() => query.isFetching.value)
  const isError = computed(() => query.isError.value)
  const error = computed(() => query.error.value)

  function refresh(): Promise<EligibleSalesRefreshResult> {
    return settleRefreshResult(() => query.refetch()).then((outcome) => ({
      ok: outcome.ok,
      data: (outcome.data?.data ?? []).map(toLegacyPickerRow),
    }))
  }

  return {
    data,
    pagination,
    totalCount,
    pageCount,
    isLoading,
    isFetching,
    isError,
    error,
    refresh,
  }
}

/** Pure: normalized query → legacy confirmed-sales `ListSalesParams`. */
export function buildLegacyConfirmedParams(query: EligibleSalesQuery): ListSalesParams {
  const params: ListSalesParams = {
    page: query.page,
    limit: query.limit,
    sortBy: 'confirmedAt',
    sortOrder: 'desc',
    deliveryStatus: ['PENDING', 'SHIPPED'],
  }
  if (query.q) params.q = query.q
  return params
}

/** Map a ConfirmedSaleRow to the picker row shape — NO `availability` claim. */
function toLegacyPickerRow(row: ConfirmedSaleRow): EligibleSaleRow {
  return {
    id: row.id,
    folio: row.folio,
    status: row.status,
    paymentStatus: row.paymentStatus,
    deliveryStatus: row.deliveryStatus,
    totalCents: row.totalCents,
    debtCents: row.debtCents,
    confirmedAt: row.confirmedAt,
    dueDate: row.dueDate,
    customer: row.customer,
    shippingAddress: null,
    productSummary: [],
  }
}
