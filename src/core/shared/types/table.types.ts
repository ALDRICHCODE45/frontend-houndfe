import type { TableColumn } from '@nuxt/ui'
import type {
  ColumnPinningState,
  VisibilityState,
  SortingState,
  PaginationState,
  RowSelectionState,
  ExpandedState,
} from '@tanstack/vue-table'

// Server response shape for paginated endpoints
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface PaginationMeta {
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
  queryFn: (params: ServerTableParams) => Promise<PaginatedResponse<T>>
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
  variant?: 'default' | 'destructive'
  onClick: (selectedRows: T[]) => void | Promise<void>
}

// AppDataTable component props
export interface AppDataTableProps<T> {
  columns: TableColumn<T, unknown>[]
  data: T[]
  loading?: boolean
  fetching?: boolean
  empty?: string
  // Pagination
  pageCount?: number
  totalCount?: number
  pageSizeOptions?: number[]
  // Features
  enableSorting?: boolean
  enableColumnVisibility?: boolean
  enableRowSelection?: boolean
  enableColumnPinning?: boolean
  // Bulk actions
  bulkActions?: BulkAction<T>[]
  // Actions slot
  showAddButton?: boolean
  addButtonText?: string
  addButtonIcon?: string
}

// Re-export TanStack types for convenience
export type {
  TableColumn,
  ColumnPinningState,
  VisibilityState,
  SortingState,
  PaginationState,
  RowSelectionState,
  ExpandedState,
}
