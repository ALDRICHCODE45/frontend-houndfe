/**
 * Shared test double for the admin list views (S10 four-state specs).
 *
 * The view runs against the REAL AppDataTable; only its data source
 * (`useServerTable`) and the viewport breakpoint are replaced. Wire it from a
 * spec with:
 *
 *   vi.mock('@/core/shared/composables/useServerTable', async () =>
 *     (await import('@/features/admin/__tests__/helpers/serverTableMock')).serverTableModule)
 *   vi.mock('@vueuse/core', async (importOriginal) =>
 *     (await import('@/features/admin/__tests__/helpers/serverTableMock')).withBreakpointMock(await importOriginal()))
 */
import { computed, ref } from 'vue'
import { vi } from 'vitest'

export const isBelowBreakpoint = ref(false)

export const tableState = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: [] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  columnOrder: ref<string[]>([]),
  columnSizing: ref<Record<string, number>>({}),
  density: ref<string>('comfortable'),
  resetLayout: vi.fn(),
  data: ref<unknown[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
}

/** The config each `useServerTable` call received (persistKey, defaults…). */
export const serverTableConfig = vi.fn()

export const serverTableModule = {
  useServerTable: (config: unknown) => (serverTableConfig(config), {
    pagination: tableState.pagination,
    sorting: tableState.sorting,
    globalFilter: tableState.globalFilter,
    columnPinning: tableState.columnPinning,
    columnVisibility: tableState.columnVisibility,
    columnOrder: tableState.columnOrder,
    columnSizing: tableState.columnSizing,
    density: tableState.density,
    resetLayout: tableState.resetLayout,
    data: computed(() => tableState.data.value),
    totalCount: computed(() => tableState.data.value.length),
    pageCount: computed(() => (tableState.data.value.length ? 1 : 0)),
    isLoading: computed(() => tableState.isLoading.value),
    isFetching: computed(() => tableState.isFetching.value),
    isError: computed(() => tableState.isError.value),
    error: computed(() => tableState.error.value),
    refresh: tableState.refresh,
    pageSizeOptions: [10, 20, 50],
    showingFrom: computed(() => 0),
    showingTo: computed(() => 0),
  }),
}

export function withBreakpointMock<T extends object>(actual: T) {
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
}

export function resetTableState() {
  isBelowBreakpoint.value = false
  tableState.pagination.value = { pageIndex: 0, pageSize: 10 }
  tableState.sorting.value = []
  tableState.globalFilter.value = ''
  tableState.columnPinning.value = { left: [], right: [] }
  tableState.columnVisibility.value = {}
  tableState.columnOrder.value = []
  tableState.columnSizing.value = {}
  tableState.density.value = 'comfortable'
  tableState.resetLayout.mockReset()
  serverTableConfig.mockReset()
  tableState.data.value = []
  tableState.isLoading.value = false
  tableState.isFetching.value = false
  tableState.isError.value = false
  tableState.error.value = null
  tableState.refresh.mockReset()
}
