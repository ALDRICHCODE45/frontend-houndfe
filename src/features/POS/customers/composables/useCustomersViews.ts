/**
 * customers-module T6 (S3, artboard 01): saved views of the customers table on the shared
 * `useTableViews`, as in Ventas. A view carries the filters of the sheet (as their query params) and
 * the sorting; a filter change marks the view «Cambios sin guardar».
 *
 * Without read:Sale the views that need money (debt, purchases) are not offered, and stored views
 * are read back through the schema, which then has no metric filter.
 */
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
import { CUSTOMERS_DEFAULT_COLUMN_VISIBILITY } from './useCustomerColumns'
import { CUSTOMERS_DEFAULT_SORTING } from './useCustomersListing'

export { CUSTOMERS_DEFAULT_SORTING }

export interface CustomersViewQuery {
  /** The filters as GET /customers/listing params (the filters schema's serialize()). */
  filters: Record<string, string>
}

/** Local midnight of the 1st of the month, as the date filters send it (an ISO instant). */
export function startOfLocalMonthIso(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString()
}

export function customersBuiltInViews({
  canReadSales,
  now = new Date(),
}: {
  canReadSales: boolean
  now?: Date
}): TableViewDefinition<CustomersViewQuery>[] {
  const all: Array<TableViewDefinition<CustomersViewQuery> & { money?: boolean }> = [
    { id: 'todos', name: 'Todos' },
    {
      id: 'con-deuda-vencida',
      name: 'Con deuda vencida',
      money: true,
      query: { filters: { hasOverdue: 'true' } },
      // Longest overdue first.
      sorting: [{ id: 'oldestOverdue', desc: false }],
    },
    {
      id: 'inactivos-90',
      name: 'Inactivos +90 días',
      money: true,
      // Includes the customers who never bought (handoff 32 §2.3.2).
      query: { filters: { noPurchaseMoreThanDays: '90' } },
    },
    { id: 'mejores-clientes', name: 'Mejores clientes', money: true, sorting: [{ id: 'totalSold', desc: true }] },
    {
      id: 'nuevos-mes',
      name: 'Nuevos este mes',
      query: { filters: { createdFrom: startOfLocalMonthIso(now) } },
      sorting: [{ id: 'createdAt', desc: true }],
      layout: { visibility: { ...CUSTOMERS_DEFAULT_COLUMN_VISIBILITY, createdAt: true } },
    },
  ]
  return all.filter(view => canReadSales || !view.money).map(({ money: _money, ...view }) => view)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A stored view's query, read back through the schema (unknown or metric params drop out). */
export function sanitizeCustomersViewQuery(
  raw: unknown,
  normalize: (filters: Record<string, string>) => Record<string, string>,
): CustomersViewQuery | undefined {
  if (!isRecord(raw) || !isRecord(raw.filters)) return undefined
  const strings = Object.fromEntries(
    Object.entries(raw.filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  return { filters: normalize(strings) }
}

export function useCustomersViews(options: {
  columnIds: readonly string[]
  layout: {
    order: Ref<ColumnOrderState>
    pinning: Ref<ColumnPinningState>
    sizing: Ref<ColumnSizingState>
    visibility: Ref<VisibilityState>
    density: Ref<TableDensity>
  }
  sorting: Ref<SortingState>
  /** The filters of the sheet as query params; writing it applies a view's filters. */
  filters: Ref<Record<string, string>>
  canReadSales: boolean
  /** Reads params back through the filters schema (serialize(deserialize(params))). */
  normalizeFilters: (filters: Record<string, string>) => Record<string, string>
  now?: Date
}) {
  const query = computed<CustomersViewQuery>({
    get: () => ({ filters: options.filters.value }),
    set: next => {
      options.filters.value = { ...next.filters }
    },
  })
  return useTableViews<CustomersViewQuery>({
    persistKey: 'pos-customers-list',
    builtIns: customersBuiltInViews({ canReadSales: options.canReadSales, now: options.now }),
    columnIds: options.columnIds,
    defaults: {
      layout: { visibility: CUSTOMERS_DEFAULT_COLUMN_VISIBILITY, pinning: { left: [], right: [] } },
      sorting: CUSTOMERS_DEFAULT_SORTING,
      query: { filters: {} },
    },
    layout: options.layout,
    sorting: options.sorting,
    query,
    sanitizeQuery: raw => sanitizeCustomersViewQuery(raw, options.normalizeFilters),
  })
}
