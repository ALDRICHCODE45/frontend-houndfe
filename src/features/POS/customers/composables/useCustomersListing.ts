/**
 * customers-module T6: the customers table on GET /customers/listing (handoff 32 §1-§2) through the
 * shared `useServerTable` — server paging and sorting, the filters of the sheet, the totals of the
 * whole filter (`filterSummary`) and the listing 400s in Spanish.
 *
 * Without read:Sale no metric param ever leaves the browser: the money filters and sorts are dropped
 * here as well as hidden in the UI (a stale saved view or URL would otherwise get a 400).
 */
import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import type { ServerTableParams, TableTotals } from '@/core/shared/types/table.types'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerApi } from '../api/customer.api'
import { customersListingError } from '../config/customersListingErrors'
import { CUSTOMERS_DEFAULT_COLUMN_VISIBILITY } from './useCustomerColumns'
import type {
  CustomerListingFilterSummary,
  CustomerListingPage,
  CustomerListingParams,
  CustomerListingRow,
  CustomerListingSortBy,
  CustomerListingSortOrder,
} from '../interfaces/customer-listing.types'

/** Page size of the customers table (the backend default; max 100). */
export const CUSTOMERS_LISTING_LIMIT = 50
const CUSTOMERS_LISTING_MAX_LIMIT = 100

export const CUSTOMERS_DEFAULT_SORTING: SortingState = [{ id: 'name', desc: false }]

const SORT_BY: ReadonlySet<string> = new Set<CustomerListingSortBy>([
  'name',
  'createdAt',
  'openDebt',
  'oldestOverdue',
  'lastPurchaseAt',
  'totalSold',
  'salesCount',
  'averageTicket',
])

/** Sorts that need read:Sale (handoff 32 §2.6). */
export const CUSTOMERS_METRIC_SORTS: ReadonlySet<string> = new Set<CustomerListingSortBy>([
  'openDebt',
  'oldestOverdue',
  'lastPurchaseAt',
  'totalSold',
  'salesCount',
  'averageTicket',
])

/** The 16 metric filter params (handoff 32 §2.6), in the backend's order. */
export const CUSTOMERS_METRIC_PARAMS: readonly string[] = [
  'hasDebt',
  'openDebtMin',
  'openDebtMax',
  'hasOverdue',
  'overdueMoreThanDays',
  'oldestOverdueFrom',
  'oldestOverdueTo',
  'totalSoldMin',
  'totalSoldMax',
  'salesCountMin',
  'salesCountMax',
  'averageTicketMin',
  'averageTicketMax',
  'lastPurchaseFrom',
  'lastPurchaseTo',
  'noPurchaseMoreThanDays',
]
const METRIC_PARAMS = new Set(CUSTOMERS_METRIC_PARAMS)

interface Access {
  canReadSales: boolean
}

/** The table's sort as sortBy/sortOrder; the column ids are the backend's sortBy values. */
export function mapCustomersSort(
  sorting: ServerTableParams['sorting'],
  { canReadSales }: Access,
): { sortBy: CustomerListingSortBy; sortOrder: CustomerListingSortOrder } {
  const first = sorting?.[0]
  const allowed = first && SORT_BY.has(first.id) && (canReadSales || !CUSTOMERS_METRIC_SORTS.has(first.id))
  if (!first || !allowed) return { sortBy: 'name', sortOrder: 'asc' }
  return { sortBy: first.id as CustomerListingSortBy, sortOrder: first.desc ? 'desc' : 'asc' }
}

export function buildCustomersListingParams(
  params: ServerTableParams,
  filters: Record<string, string>,
  access: Access,
): CustomerListingParams {
  const search = params.globalFilter?.trim() ?? ''
  const allowedFilters = Object.fromEntries(
    Object.entries(filters).filter(([param, value]) => value !== '' && (access.canReadSales || !METRIC_PARAMS.has(param))),
  )
  return {
    page: params.pageIndex + 1,
    limit: Math.min(params.pageSize, CUSTOMERS_LISTING_MAX_LIMIT),
    ...(search ? { search } : {}),
    ...mapCustomersSort(params.sorting, access),
    ...allowedFilters,
  }
}

/**
 * Server totals of the whole filter for the totals row: the count on the Cliente column and, with
 * read:Sale, «$X (vencida $Y)» on Deuda. Never summed from the rows of the page.
 */
export function customersFilterTotals(
  summary: CustomerListingFilterSummary | undefined,
  { canReadSales }: Access,
): TableTotals | undefined {
  if (!summary) return undefined
  const totals: TableTotals = { name: summary.count }
  if (canReadSales && typeof summary.openDebtCents === 'number') {
    totals.openDebt = `${formatCentsMXN(summary.openDebtCents)} (vencida ${formatCentsMXN(summary.overdueDebtCents ?? 0)})`
  }
  return totals
}

export function useCustomersListing(options: {
  filters: MaybeRefOrGetter<Record<string, string>>
  canReadSales: MaybeRefOrGetter<boolean>
}) {
  const authStore = useAuthStore()
  const filterErrors = ref<Record<string, string>>({})
  const listingErrorMessage = ref<string | null>(null)
  const access = () => ({ canReadSales: toValue(options.canReadSales) })

  const table = useServerTable<CustomerListingRow>({
    // Under the customers list key: every customer write (create, edit, delete, pets) already
    // invalidates it by prefix.
    queryKey: () => [
      ...customerQueryKeys.paginated(authStore.currentTenantId ?? ''),
      'listing',
      toValue(options.filters),
      access(),
    ],
    queryFn: async params => {
      try {
        const page = await customerApi.listCustomersListing(
          buildCustomersListingParams(params, toValue(options.filters), access()),
        )
        filterErrors.value = {}
        listingErrorMessage.value = null
        return page
      } catch (error) {
        const mapped = customersListingError(error)
        filterErrors.value = mapped?.filterId ? { [mapped.filterId]: mapped.message } : {}
        listingErrorMessage.value = mapped?.message ?? null
        throw error
      }
    },
    // The shared 5..50 sizes (page-size-memory S2; 50 is one of them), remembered under persistKey.
    defaultPageSize: CUSTOMERS_LISTING_LIMIT,
    // A new key: the old 'pos-customers' layout had other columns.
    persistKey: 'pos-customers-listing',
    defaultSorting: CUSTOMERS_DEFAULT_SORTING,
    defaultColumnVisibility: CUSTOMERS_DEFAULT_COLUMN_VISIBILITY,
    defaultPinning: { left: [], right: [] },
    // owner-ideas-batch S6: page, sort, search and page size live in the URL next to the filters.
    // Safe since the filters adapter reacts only to its own params (style-cleanup U7), so the
    // table's write can no longer drop a just-applied view's filters (customers-module L15).
    urlSync: true,
  })

  return {
    ...table,
    /**
     * The search the listing request carries (the table's debounced one), for anything that must
     * describe the same rows as the listing — the bulk «filter» selection. A partial table double
     * without it (older view specs) falls back to the raw search.
     */
    appliedSearch: computed(() => (table.debouncedGlobalFilter ?? table.globalFilter).value),
    // The totals travel with their page in the query cache, so a cached page brings its own.
    filterTotals: computed(() =>
      customersFilterTotals((table.response.value as CustomerListingPage | undefined)?.filterSummary, access()),
    ),
    filterErrors: computed(() => filterErrors.value),
    listingErrorMessage: computed(() => listingErrorMessage.value),
  }
}
