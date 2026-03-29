import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { useTablePreferences } from './useTablePreferences'
import { useTableUrlSync } from './useTableUrlSync'
import type {
  ServerTableConfig,
  ServerTableParams,
  PaginatedResponse,
  SortingState,
  PaginationState,
  RowSelectionState,
  ColumnPinningState,
  VisibilityState,
} from '../types/table.types'

export interface UseServerTableReturn<T> {
  // State (writable refs — needed for v-model on UTable)
  pagination: Ref<PaginationState>
  sorting: Ref<SortingState>
  globalFilter: Ref<string>
  rowSelection: Ref<RowSelectionState>
  columnPinning: Ref<ColumnPinningState>
  columnVisibility: Ref<VisibilityState>

  // Derived data
  data: ComputedRef<T[]>
  totalCount: ComputedRef<number>
  pageCount: ComputedRef<number>
  isLoading: ComputedRef<boolean>
  isFetching: ComputedRef<boolean>

  // UTable config objects
  paginationOptions: ComputedRef<Record<string, unknown>>
  sortingOptions: ComputedRef<Record<string, unknown>>

  // Actions
  refresh: () => void
  resetFilters: () => void
  selectedRows: ComputedRef<T[]>
  clearSelection: () => void

  // Pagination info
  pageSizeOptions: number[]
  showingFrom: ComputedRef<number>
  showingTo: ComputedRef<number>
}

export function useServerTable<T>(config: ServerTableConfig<T>): UseServerTableReturn<T> {
  const {
    defaultPageSize = 10,
    pageSizeOptions = [5, 10, 20, 50],
    defaultSorting = [],
    defaultPinning = { left: [], right: [] },
    defaultColumnVisibility = {},
    debounceMs = 300,
    staleTime = 30_000,
    persistKey,
    urlSync = true,
  } = config

  // --- Core State ---
  const pagination = ref<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })

  const sorting = ref<SortingState>([...defaultSorting])
  const globalFilter = ref<string>('')
  const rowSelection = ref<RowSelectionState>({})

  // Debounced search (300ms default)
  const debouncedFilter = refDebounced(globalFilter, debounceMs)

  // --- Preferences (localStorage) ---
  const preferences = persistKey
    ? useTablePreferences({
        persistKey,
        defaultPinning,
        defaultVisibility: defaultColumnVisibility,
      })
    : null

  const columnPinning = preferences?.columnPinning ?? ref<ColumnPinningState>(defaultPinning)
  const columnVisibility =
    preferences?.columnVisibility ?? ref<VisibilityState>(defaultColumnVisibility)

  // --- URL Sync (opt-in) ---
  if (urlSync && persistKey) {
    useTableUrlSync({
      pagination,
      sorting,
      globalFilter,
      defaultPageSize,
    })
  }

  // --- Smart Page Resets ---
  // Reset to page 0 when sorting or search changes
  watch(
    [sorting, debouncedFilter],
    () => {
      pagination.value = { ...pagination.value, pageIndex: 0 }
    },
    { deep: true },
  )

  // --- Server Params (computed for query key) ---
  const serverParams = computed<ServerTableParams>(() => ({
    pageIndex: pagination.value.pageIndex,
    pageSize: pagination.value.pageSize,
    sorting:
      sorting.value.length > 0 ? sorting.value.map((s) => ({ id: s.id, desc: s.desc })) : undefined,
    globalFilter: debouncedFilter.value || undefined,
  }))

  // --- Query Key ---
  const queryKey = computed(() => {
    const base = typeof config.queryKey === 'function' ? config.queryKey() : config.queryKey
    return [...base, serverParams.value]
  })

  // --- TanStack Query ---
  const {
    data: queryData,
    isLoading: queryIsLoading,
    isFetching: queryIsFetching,
    refetch,
  } = useQuery<PaginatedResponse<T>>({
    queryKey,
    queryFn: () => config.queryFn(serverParams.value),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime,
  })

  // --- Derived Data ---
  const data = computed<T[]>(() => queryData.value?.data ?? [])
  const totalCount = computed(() => queryData.value?.pagination?.totalCount ?? 0)
  const pageCount = computed(() => queryData.value?.pagination?.pageCount ?? 0)
  const isLoading = computed(() => queryIsLoading.value && !queryData.value)
  const isFetching = computed(() => queryIsFetching.value && !isLoading.value)

  // --- Pagination Info ---
  const showingFrom = computed(() => {
    if (totalCount.value === 0) return 0
    return pagination.value.pageIndex * pagination.value.pageSize + 1
  })
  const showingTo = computed(() => {
    const to = (pagination.value.pageIndex + 1) * pagination.value.pageSize
    return Math.min(to, totalCount.value)
  })

  // --- UTable Config Objects ---
  const paginationOptions = computed(() => ({
    manualPagination: true,
    pageCount: pageCount.value,
  }))

  const sortingOptions = computed(() => ({
    manualSorting: true,
  }))

  // --- Selected Rows ---
  const selectedRows = computed<T[]>(() => {
    const selected = rowSelection.value
    return data.value.filter((_, index) => selected[index])
  })

  // --- Actions ---
  function refresh() {
    refetch()
  }

  function resetFilters() {
    globalFilter.value = ''
    sorting.value = [...defaultSorting]
    pagination.value = { pageIndex: 0, pageSize: defaultPageSize }
  }

  function clearSelection() {
    rowSelection.value = {}
  }

  return {
    // State
    pagination,
    sorting,
    globalFilter,
    rowSelection,
    columnPinning,
    columnVisibility,
    // Derived
    data,
    totalCount,
    pageCount,
    isLoading,
    isFetching,
    // UTable config
    paginationOptions,
    sortingOptions,
    // Actions
    refresh,
    resetFilters,
    selectedRows,
    clearSelection,
    // Info
    pageSizeOptions,
    showingFrom,
    showingTo,
  }
}
