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
  }
}

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
