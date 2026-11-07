import { computed, type Ref } from 'vue'
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from '@tanstack/vue-table'
import type { TableDensity } from '@/core/shared/components/DataTable'
import { useTableViews, type TableViewDefinition } from '@/core/shared/composables/useTableViews'
import { SALE_DELIVERY_STATUS } from '../constants/sale.constants'
import type { SaleDeliveryStatus, SalesListCounts } from '../interfaces/sale.types'
import { pendingPaymentsBadge } from '../utils/salesListTabs.utils'
import { defaultColumnVisibility } from './useSalesColumns'

/**
 * Saved views of the sales list (premium tables S6). The views carry the status filter that the
 * «Todas / Pagos pendientes / No entregadas» tabs used to set, so there is one row of tabs.
 */
export type SalesListStatus = 'all' | 'pending-payments' | 'pending-delivery'
export interface SalesViewQuery {
  status: SalesListStatus
}

/** The quick filter each status applies through `useConfirmedSales().setTabFilter`. */
export const SALES_STATUS_FILTERS: Record<
  SalesListStatus,
  { deliveryStatus?: SaleDeliveryStatus; paymentStatus?: string }
> = {
  all: {},
  'pending-payments': { paymentStatus: 'PARTIAL,CREDIT' },
  'pending-delivery': { deliveryStatus: SALE_DELIVERY_STATUS.PENDING as SaleDeliveryStatus },
}

export const SALES_DEFAULT_SORTING: SortingState = [{ id: 'confirmedAt', desc: true }]

// The backend orders sales only by confirmedAt, totalCents or createdAt (no debt), so Cobranza
// puts the oldest sales first: the debts that have waited longest.
export const SALES_VIEWS: TableViewDefinition<SalesViewQuery>[] = [
  { id: 'todas', name: 'Todas' },
  {
    id: 'cobranza',
    name: 'Cobranza',
    layout: {
      order: ['venta', 'customer', 'debtCents'],
      pinning: { left: ['customer', 'debtCents'], right: [] },
      visibility: { ...defaultColumnVisibility, dueDate: true },
    },
    sorting: [{ id: 'confirmedAt', desc: false }],
    query: { status: 'pending-payments' },
  },
  {
    id: 'entregas',
    name: 'Entregas',
    layout: { order: ['deliveryStatus', 'confirmedAt'] },
    query: { status: 'pending-delivery' },
  },
]

const STATUSES = Object.keys(SALES_STATUS_FILTERS) as SalesListStatus[]

export function sanitizeSalesViewQuery(raw: unknown): SalesViewQuery | undefined {
  const status = (raw as Partial<SalesViewQuery> | null)?.status
  return typeof status === 'string' && STATUSES.includes(status as SalesListStatus)
    ? { status: status as SalesListStatus }
    : undefined
}

/** The tab count of a status, as the old status tabs showed it (Pagos pendientes only above 0). */
export function salesStatusCount(status: SalesListStatus, counts: SalesListCounts): string | undefined {
  if (status === 'pending-payments') return pendingPaymentsBadge(counts.pendingPayments).text ?? undefined
  return String(status === 'all' ? counts.all : counts.notDelivered)
}

export function useSalesViews(options: {
  columnIds: readonly string[]
  layout: {
    order: Ref<ColumnOrderState>
    pinning: Ref<ColumnPinningState>
    sizing: Ref<ColumnSizingState>
    visibility: Ref<VisibilityState>
    density: Ref<TableDensity>
  }
  sorting: Ref<SortingState>
  status: Ref<SalesListStatus>
}) {
  const query = computed<SalesViewQuery>({
    get: () => ({ status: options.status.value }),
    set: next => {
      options.status.value = next.status
    },
  })
  return useTableViews<SalesViewQuery>({
    persistKey: 'pos-sales-list',
    builtIns: SALES_VIEWS,
    columnIds: options.columnIds,
    defaults: {
      layout: { visibility: defaultColumnVisibility, pinning: { left: [], right: [] } },
      sorting: SALES_DEFAULT_SORTING,
      query: { status: 'all' },
    },
    layout: options.layout,
    sorting: options.sorting,
    query,
    sanitizeQuery: sanitizeSalesViewQuery,
  })
}
