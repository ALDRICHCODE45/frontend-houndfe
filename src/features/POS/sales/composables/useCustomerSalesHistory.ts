import { computed, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { SALE_DELIVERY_STATUS, SALE_PAYMENT_STATUS } from '../constants/sale.constants'
import {
  SaleListSummarySchema,
  type ConfirmedSalesListResponse,
  type CustomerSalesHistoryParams,
  type SaleDeliveryStatus,
  type SaleListSummary,
  type SalePaymentStatus,
  type SalesListCounts,
} from '../interfaces/sale.types'

/** Sales history redesign T1: the single-choice status chips of the customer history. */
export type CustomerHistoryStatusFilter = 'all' | 'with-debt' | 'not-delivered'

type StatusParams = { paymentStatus?: SalePaymentStatus[]; deliveryStatus?: SaleDeliveryStatus[] }

// L3 (backend 2026-11-24): both combine with `customerId` (+`petId`) by AND and leave `summary` and
// `counts` customer-wide. Same values as the Ventas «Cobranza» / «Entregas» views.
const STATUS_PARAMS: Record<CustomerHistoryStatusFilter, StatusParams> = {
  all: {},
  'with-debt': { paymentStatus: [SALE_PAYMENT_STATUS.PARTIAL, SALE_PAYMENT_STATUS.CREDIT] },
  'not-delivered': { deliveryStatus: [SALE_DELIVERY_STATUS.PENDING as SaleDeliveryStatus] },
}

export interface UseCustomerSalesHistoryOptions {
  customerId: MaybeRefOrGetter<string | null | undefined>
  page: MaybeRefOrGetter<number>
  open: MaybeRefOrGetter<boolean>
  q?: MaybeRefOrGetter<string | undefined>
  /** Customer pets §7: sales of one pet of this customer; only ever sent with the single `customerId`. */
  petId?: MaybeRefOrGetter<string | null | undefined>
  /** «Con saldo» / «Sin entregar»; `'all'` (default) sends neither param. */
  status?: MaybeRefOrGetter<CustomerHistoryStatusFilter | undefined>
}

// `petId` is new on `GET /sales` (handoff 27 §7). It is added here rather than in sale.types.ts so the
// shared `ListSalesParams` stays untouched; it is omitted entirely when no pet is selected.
type HistoryKeyParams = CustomerSalesHistoryParams & { petId?: string } & StatusParams
type HistoryApiParams = Parameters<typeof saleApi.listConfirmed>[0] & { petId?: string }

// Cache entries stamp the requesting customer so cross-customer placeholder
// data from `keepPreviousData` can't leak into the exposed response.
interface CustomerHistoryCacheEntry {
  ownerCustomerId: string
  response: ConfirmedSalesListResponse
  /** `q` was sent: the backend narrows `summary` and `counts` to the search too (L3). */
  narrowedAggregates: boolean
}

interface CustomerAggregates {
  customerId: string
  summary: SaleListSummary
  counts: SalesListCounts
}

function httpStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return e?.response?.status ?? e?.status ?? e?.statusCode
}

/** `404 PET_NOT_FOUND` (§7): the pet is gone, retrying cannot bring it back. */
function isPetNotFoundError(error: unknown): boolean {
  const e = error as { response?: { status?: number; data?: { error?: unknown } } } | null
  return e?.response?.status === 404 && e.response.data?.error === 'PET_NOT_FOUND'
}

export function useCustomerSalesHistory(options: UseCustomerSalesHistoryOptions) {
  const authStore = useAuthStore()

  const customerId = computed(() => toValue(options.customerId))
  const page = computed(() => toValue(options.page))
  const open = computed(() => toValue(options.open))
  const q = computed(() => toValue(options.q))
  const petId = computed(() => toValue(options.petId) || undefined)
  const statusParams = computed(() => STATUS_PARAMS[toValue(options.status) ?? 'all'])
  const tenantId = computed(() => authStore.currentTenantId)
  const enabled = computed(
    () => open.value && Boolean(tenantId.value) && Boolean(customerId.value),
  )

  const params = computed<HistoryKeyParams>(() => {
    const normalizedQ = q.value?.trim() || undefined
    return {
      page: toValue(page),
      limit: 10,
      sortBy: 'confirmedAt',
      sortOrder: 'desc',
      ...(normalizedQ && { q: normalizedQ }),
      ...(petId.value && { petId: petId.value }),
      ...statusParams.value,
    }
  })

  const queryKey = computed(() =>
    saleQueryKeys.customerHistory(tenantId.value, customerId.value as string, params.value),
  )

  const query = useQuery<CustomerHistoryCacheEntry>({
    queryKey,
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      const status = httpStatus(error)
      if (status !== undefined && [400, 401, 403].includes(status)) return false
      if (isPetNotFoundError(error)) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const id = customerId.value as string
      const normalizedQ = q.value?.trim() || undefined
      const selectedPetId = petId.value
      const selectedStatus = statusParams.value
      const apiParams: HistoryApiParams = {
        customerId: [id],
        // Exactly one customerId always travels with petId (never `PET_FILTER_REQUIRES_CUSTOMER`).
        ...(selectedPetId && { petId: selectedPetId }),
        page: toValue(page),
        limit: 10,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        // Never confirmedFrom/To or cashierUserId here: they would narrow the customer-wide KPIs.
        ...selectedStatus,
      }
      if (normalizedQ) {
        apiParams.q = normalizedQ
      }
      const response = await saleApi.listConfirmed(apiParams)
      SaleListSummarySchema.parse(response.summary)
      return { ownerCustomerId: id, response, narrowedAggregates: Boolean(normalizedQ) }
    },
  })

  const response = computed<ConfirmedSalesListResponse | undefined>(() => {
    const entry = query.data.value
    return entry && entry.ownerCustomerId === customerId.value ? entry.response : undefined
  })

  // The metric strip and the chip counts stay customer-wide (customer pets S6, L3): pet and status
  // filters never narrow them, `q` does, so a searched response keeps the last unsearched aggregates.
  const pinnedAggregates = shallowRef<CustomerAggregates | null>(null)
  watch(
    () => query.data.value,
    (entry) => {
      if (!entry || entry.narrowedAggregates) return
      pinnedAggregates.value = {
        customerId: entry.ownerCustomerId,
        summary: entry.response.summary,
        counts: entry.response.counts,
      }
    },
    { immediate: true },
  )
  const customerAggregates = computed(() => {
    const pinned = pinnedAggregates.value
    if (pinned && pinned.customerId === customerId.value) return pinned
    const current = response.value
    return current ? { summary: current.summary, counts: current.counts } : undefined
  })
  const customerSummary = computed(() => customerAggregates.value?.summary)
  const customerCounts = computed(() => customerAggregates.value?.counts)

  const isPageTransition = computed(
    () => response.value !== undefined && query.isFetching.value && !query.isLoading.value,
  )

  return {
    response,
    customerSummary,
    customerCounts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPageTransition,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
