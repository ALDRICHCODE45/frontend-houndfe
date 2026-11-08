import type { TableColumn } from '@nuxt/ui'
import type {
  RowData,
  ColumnPinningState,
  VisibilityState,
  SortingState,
  PaginationState,
  RowSelectionState,
} from '@tanstack/vue-table'

declare module '@tanstack/vue-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Marks the column that gets priority width in `AppDataTable` (the record's name). Default: the
     * first data column after the selection column.
     */
    primary?: boolean
    /**
     * The column's name in the header menu, the announcements and the width tooltip. Default: a
     * string header or the `SortableHeader` label, else the column id.
     */
    label?: string
    /**
     * Opts the table into the totals row (`AppDataTable`) and says what this column adds up. A
     * `count` is the row's label in the first arrangeable column («14 ventas»), wherever the column
     * that declares it is; `sum` and `custom` show in their own column and leave with it when hidden.
     */
    total?: TableColumnTotal<TData>
  }
}

/** What a column contributes to the totals row of `AppDataTable`. */
export type TableColumnTotal<TData> =
  | {
      kind: 'count'
      /** The label for `n` rows: `n => \`${n} ventas\``. */
      label: (count: number) => string
      /** The label for `n` selected rows. Default: `n` and the table's `selectedLabel`. */
      selectedLabel?: (count: number) => string
    }
  | {
      kind: 'sum'
      /** The row's amount, in the unit `format` expects (cents with `formatCentsMXN`). */
      value: (row: TData) => number
      format: (total: number) => string
    }
  | {
      kind: 'custom'
      /** The text for these rows (e.g. one sum per tax basis). */
      compute: (rows: TData[]) => string
      /** Formats a numeric server total for this column. Default: the number as is. */
      format?: (total: number) => string
    }

/**
 * Server totals of the whole filter, keyed by column id (e.g. from an API summary). A number goes
 * through the column's `format`; a string is shown as is. The `count` column's entry is the count
 * (default: the table's `totalCount`).
 */
export type TableTotals = Record<string, number | string>

// Server response shape for paginated endpoints
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

interface PaginationMeta {
  pageIndex: number
  pageSize: number
  totalCount: number
  pageCount: number
}

// Sorting parameter sent to the server
export interface SortingParam {
  id: string
  desc: boolean
}

// Server query parameters derived from table state
export interface ServerTableParams {
  pageIndex: number
  pageSize: number
  sorting?: SortingParam[]
  globalFilter?: string
}

// Configuration for useServerTable composable
export interface ServerTableConfig<T> {
  queryKey: readonly unknown[] | ((...args: unknown[]) => readonly unknown[])
  /** Parameters and key belong to the executing query, including inactive refetches. */
  queryFn: (
    params: ServerTableParams,
    context: { readonly queryKey: readonly unknown[] },
  ) => Promise<PaginatedResponse<T>>
  defaultPageSize?: number
  pageSizeOptions?: number[]
  defaultSorting?: SortingState
  defaultPinning?: ColumnPinningState
  defaultColumnVisibility?: VisibilityState
  persistKey?: string // for localStorage persistence + URL sync
  debounceMs?: number // search debounce, default 300
  staleTime?: number // TanStack Query stale time, default 30000
  urlSync?: boolean // enable URL state sync, default true
}

// Bulk action definition
export interface BulkAction<T> {
  id: string
  label: string
  icon?: string
  variant?: 'default' | 'destructive' | 'warning' | 'primary'
  disabled?: boolean
  onClick: (selectedRows: T[]) => void | Promise<void>
}

// Re-export TanStack types for convenience
export type {
  TableColumn,
  ColumnPinningState,
  VisibilityState,
  SortingState,
  PaginationState,
  RowSelectionState,
}
