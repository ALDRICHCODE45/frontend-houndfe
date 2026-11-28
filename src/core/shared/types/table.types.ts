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
    /**
     * What this column shows in the phone list of `AppDataTable` (`mobile-render="rows"` and the
     * meta-driven `"cards"`), odd/tasks/mobile-tables.md S4. One field or several (a Total column
     * can be the row's figure and a card stat).
     */
    mobile?: TableMobileField<TData> | TableMobileField<TData>[]
  }
}

/**
 * The place a column takes in the phone list:
 * - `lead`: the 44px start of a row (initials avatar of the value, or `icon`); the selection mark
 *   takes its place in selection mode.
 * - `primary`: the record's name, full and wrapping (never cut). One per list.
 * - `secondary`: 13px line(s) under the name, joined with «·».
 * - `figure` / `figureNote`: the key number at the right of a row and its 12px note.
 * - `status`: a status badge (under the figure in a row, its own line in a card).
 * - `stat`: one cell of a card's mini grid (caption + value + note), up to three.
 * Rows show lead, primary, secondary, figure, figureNote and status; cards show primary,
 * secondary, status and stat.
 */
export type TableMobileRole = 'lead' | 'primary' | 'secondary' | 'figure' | 'figureNote' | 'status' | 'stat'

/** Ink of a mobile value (figure, note, stat) or the tone of its badge (status). */
export type TableMobileTone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info'

export interface TableMobileField<TData> {
  role: TableMobileRole
  /** The text. Default: the column's accessor value. `null`, `undefined` or `''` → not shown. */
  value?: (row: TData) => string | number | null | undefined
  tone?: (row: TData) => TableMobileTone | undefined
  /** A 12px line under a `stat` value. */
  note?: (row: TData) => string | null | undefined
  /** Caption of a `stat`. Default: the column's label. */
  label?: string
  /** `lead`: an icon instead of the initials avatar. */
  icon?: string | ((row: TData) => string | undefined)
}

/** One option of the phone «Ordenar» menu: `value` is `<column id>:asc|desc`. */
export interface TableSortOption {
  label: string
  value: string
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
  /** One of the options; a size that is not one is rounded to the nearest. */
  defaultPageSize?: number
  /** Defaults to the shared 5..50 options (`TABLE_PAGE_SIZE_OPTIONS`). */
  pageSizeOptions?: number[]
  defaultSorting?: SortingState
  defaultPinning?: ColumnPinningState
  defaultColumnVisibility?: VisibilityState
  persistKey?: string // localStorage persistence (layout and page size) + URL sync
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
