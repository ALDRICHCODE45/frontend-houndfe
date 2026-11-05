import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { SALE_STATUS } from '@/features/POS/sales/constants/sale.constants'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'

/** Cancelled-sale page size of the join (the `/sales` limit is 1..100). */
const SALES_PAGE_SIZE = 100
/** At most this many cancelled-sale pages are scanned for one refund page. */
const MAX_SALES_PAGES = 5

const SALE_FALLBACK_FOLIO = 'Venta cancelada'
const SALE_FALLBACK_CUSTOMER = 'Sin datos de la venta'
const WALK_IN_CUSTOMER = 'Público general'

interface SaleRef {
  folio: string | null
  customerName: string | null
}

/** One pending refund plus what the screen shows of its sale. Never an id in the labels. */
export interface PendingRefundListRow extends PendingRefundRow {
  folioLabel: string
  customerLabel: string
  /** The sale was found in the cancelled list. */
  saleFound: boolean
}

export interface UsePendingRefundsListOptions {
  /** Cache isolation only; never sent (the backend reads it from the JWT). */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /** `userCan('read', 'SaleRefund')`. */
  enabled: MaybeRefOrGetter<boolean>
  page: MaybeRefOrGetter<number>
  limit: MaybeRefOrGetter<number>
  search: MaybeRefOrGetter<string>
}

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Folio and customer of the given sales, read from `GET /sales?status=CANCELED` (newest first)
 * because the pending list carries neither (handoff 06 §3). Pages are scanned until every sale is found or the cap is reached.
 */
async function loadCanceledSales(
  saleIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<Record<string, SaleRef>> {
  const wanted = new Set(saleIds)
  const found: Record<string, SaleRef> = {}
  for (let page = 1; page <= MAX_SALES_PAGES; page += 1) {
    const response = await saleApi.listConfirmed(
      {
        status: [SALE_STATUS.CANCELED],
        page,
        limit: SALES_PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      { signal },
    )
    for (const sale of response.data) {
      if (wanted.has(sale.id)) {
        found[sale.id] = { folio: sale.folio, customerName: sale.customer?.name ?? null }
      }
    }
    if (Object.keys(found).length === wanted.size || page >= response.pagination.totalPages) break
  }
  return found
}

/**
 * The «Reembolsos pendientes» page: one backend page of pending refunds (oldest first, order
 * kept), joined with their cancelled sales, plus a local search.
 *
 * `GET /sales/refunds/pending` takes only `page` and `limit`: it has no search or filters, so
 * the search runs locally over the loaded page.
 */
export function usePendingRefundsList(options: UsePendingRefundsListOptions) {
  const tenantId = computed(() => toValue(options.tenantId)?.trim() ?? '')
  const enabled = computed(() => tenantId.value.length > 0 && toValue(options.enabled) === true)
  const params = computed(() => ({ page: toValue(options.page), limit: toValue(options.limit) }))

  const refunds = useQuery({
    queryKey: computed(() => saleQueryKeys.pendingRefunds(tenantId.value, params.value)),
    queryFn: ({ signal }) => saleApi.listPendingRefunds(params.value, { signal }),
    enabled,
    // Keeps the previous page on screen while the next one loads; the tenant is in the key,
    // and the public surface below is masked by the same guard.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })

  const refundRows = computed<PendingRefundRow[]>(() =>
    enabled.value ? (refunds.data.value?.data ?? []) : [],
  )
  const saleIds = computed(() => [...new Set(refundRows.value.map((row) => row.saleId))].sort())

  const sales = useQuery({
    queryKey: computed(() => saleQueryKeys.pendingRefundSales(tenantId.value, saleIds.value)),
    queryFn: ({ signal }) => loadCanceledSales(saleIds.value, signal),
    enabled: computed(() => enabled.value && saleIds.value.length > 0),
    staleTime: 60_000,
    retry: false,
  })

  const rows = computed<PendingRefundListRow[]>(() => {
    const index = sales.data.value ?? {}
    return refundRows.value.map((row) => {
      const sale = index[row.saleId]
      return {
        ...row,
        saleFound: Boolean(sale),
        folioLabel: sale?.folio || SALE_FALLBACK_FOLIO,
        customerLabel: sale ? (sale.customerName ?? WALK_IN_CUSTOMER) : SALE_FALLBACK_CUSTOMER,
      }
    })
  })

  const searchTerm = computed(() => normalize(toValue(options.search).trim()))
  const visibleRows = computed(() =>
    searchTerm.value
      ? rows.value.filter((row) =>
          normalize(`${row.folioLabel} ${row.customerLabel}`).includes(searchTerm.value),
        )
      : rows.value,
  )

  const pagination = computed(() => (enabled.value ? refunds.data.value?.pagination : undefined))

  return {
    rows,
    visibleRows,
    total: computed(() => pagination.value?.total ?? 0),
    totalPages: computed(() => pagination.value?.totalPages ?? 0),
    /** Sum of what is still owed on the loaded page (the backend sends no grand total). */
    outstandingOnPage: computed(() =>
      refundRows.value.reduce((sum, row) => sum + row.outstandingCents, 0),
    ),
    /** First load: no rows yet, or rows whose sale labels are still on their way. */
    isInitialLoading: computed(
      () =>
        enabled.value &&
        (refunds.isLoading.value || (saleIds.value.length > 0 && sales.isLoading.value)),
    ),
    isFetching: computed(() => enabled.value && (refunds.isFetching.value || sales.isFetching.value)),
    isError: computed(() => enabled.value && refunds.isError.value),
    refetch: () => refunds.refetch(),
  }
}
