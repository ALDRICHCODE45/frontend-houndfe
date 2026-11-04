/**
 * Test double for the employees list views (S10 four-state specs).
 *
 * `useEmployeesList` runs for real on top of this `useServerTable`: only the
 * data source and the viewport breakpoint are replaced, so the view renders
 * through the REAL AppDataTable. The selection surface that the shared admin
 * helper omits (`rowSelection`, `selectedRows`, `clearSelection`) lives here.
 * Wire it from a spec with:
 *
 *   vi.mock('@/core/shared/composables/useServerTable', async () =>
 *     (await import('./helpers/employeesServerTable')).serverTableModule)
 *   vi.mock('@vueuse/core', async (importOriginal) =>
 *     (await import('./helpers/employeesServerTable')).withBreakpointMock(await importOriginal()))
 */
import { computed, ref } from 'vue'
import { vi } from 'vitest'

export const isBelowBreakpoint = ref(false)

export const serverTableConfig = vi.fn()

export const tableState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [] as string[], right: ['actions'] as string[] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  rowSelection: ref<Record<string, boolean>>({}),
  data: ref<unknown[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
  clearSelection: vi.fn(),
}

export const serverTableModule = {
  useServerTable: (config: unknown) => {
    serverTableConfig(config)
    return {
      pagination: tableState.pagination,
      sorting: tableState.sorting,
      globalFilter: tableState.globalFilter,
      columnPinning: tableState.columnPinning,
      columnVisibility: tableState.columnVisibility,
      rowSelection: tableState.rowSelection,
      data: computed(() => tableState.data.value),
      totalCount: computed(() => tableState.data.value.length),
      pageCount: computed(() => (tableState.data.value.length ? 1 : 0)),
      isLoading: computed(() => tableState.isLoading.value),
      isFetching: computed(() => tableState.isFetching.value),
      isError: computed(() => tableState.isError.value),
      error: computed(() => tableState.error.value),
      refresh: tableState.refresh,
      resetFilters: vi.fn(),
      selectedRows: computed(() => []),
      clearSelection: tableState.clearSelection,
      pageSizeOptions: [10, 20, 50],
      showingFrom: computed(() => 0),
      showingTo: computed(() => 0),
    }
  },
}

export function withBreakpointMock<T extends object>(actual: T) {
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
}

export function resetTableState() {
  isBelowBreakpoint.value = false
  tableState.pagination.value = { pageIndex: 0, pageSize: 10 }
  tableState.sorting.value = []
  tableState.globalFilter.value = ''
  tableState.columnPinning.value = { left: [], right: ['actions'] }
  tableState.columnVisibility.value = {}
  tableState.rowSelection.value = {}
  tableState.data.value = []
  tableState.isLoading.value = false
  tableState.isFetching.value = false
  tableState.isError.value = false
  tableState.error.value = null
  tableState.refresh.mockReset()
  tableState.clearSelection.mockReset()
  serverTableConfig.mockReset()
}
