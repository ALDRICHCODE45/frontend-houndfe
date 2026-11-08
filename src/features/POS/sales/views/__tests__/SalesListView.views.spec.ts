/**
 * Premium tables T8 (S6): saved views on the sales list. «Todas», «Cobranza» and «Entregas» are the
 * one row of tabs above the toolbar: each applies its layout, its sorting and the status filter the
 * old «Todas / Pagos pendientes / No entregadas» tabs set. Real view, real AppDataTable and real
 * views; only the data sources, auth and router are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, nextTick, ref, type Component } from 'vue'
import SalesListView from '../SalesListView.vue'
import { AppDataTable } from '@/core/shared/components/DataTable'
import type { ConfirmedSaleRow } from '../../interfaces/sale.types'

const isMobile = ref(false)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(() => ({ data: computed(() => undefined), isLoading: computed(() => false) })),
}))

const push = vi.fn()
const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace }),
  useRoute: () => ({ query: {}, path: '/pos/ventas' }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: () => true, currentTenantId: 'tenant-1' }),
}))

const row: ConfirmedSaleRow = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: null,
  customer: { id: 'c-1', name: 'Ada Lovelace' },
  paymentStatus: 'PARTIAL',
  totalCents: 127000,
  debtCents: 5000,
  deliveryStatus: 'PENDING',
  cashier: { id: 'cash-1', name: 'César' },
  seller: null,
  paymentMethods: [],
}

const state = {
  sorting: ref([{ id: 'confirmedAt', desc: true }]),
  columnOrder: ref<string[]>([]),
  columnPinning: ref<{ left?: string[]; right?: string[] }>({ left: [], right: [] }),
  columnSizing: ref<Record<string, number>>({}),
  columnVisibility: ref<Record<string, boolean>>({}),
  density: ref<'compact' | 'normal' | 'comfortable'>('comfortable'),
  setTabFilter: vi.fn(),
}

vi.mock('../../composables/useConfirmedSales', () => {
  return {
    useConfirmedSales: () => ({
      pagination: ref({ pageIndex: 0, pageSize: 20 }),
      sorting: state.sorting,
      globalFilter: ref(''),
      rowSelection: ref({}),
      columnPinning: state.columnPinning,
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      columnSizing: state.columnSizing,
      density: state.density,
      resetLayout: vi.fn(),
      data: computed(() => [row]),
      totalCount: computed(() => 50),
      pageCount: computed(() => 3),
      isLoading: computed(() => false),
      isFetching: computed(() => false),
      isError: computed(() => false),
      error: computed(() => null),
      refresh: vi.fn(),
      pageSizeOptions: [10, 20, 50],
      showingFrom: computed(() => 1),
      showingTo: computed(() => 20),
      counts: computed(() => ({ all: 50, pendingPayments: 3, notDelivered: 1 })),
      setTabFilter: state.setTabFilter,
      filterErrors: computed(() => ({})),
    }),
  }
})

const mounted: VueWrapper[] = []
function mountList() {
  const wrapper = mount(SalesListView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableFilters: {
          props: ['state'],
          emits: ['update:state'],
          template: `<button data-testid="set-status-filter" @click="$emit('update:state', { ...state, status: ['CONFIRMED'] })" />`,
        },
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

type Wrapper = ReturnType<typeof mountList>
const appTable = (wrapper: Wrapper) =>
  wrapper.getComponent(AppDataTable as unknown as Component) as unknown as VueWrapper
const tableProp = (wrapper: Wrapper, name: string) => (appTable(wrapper).props() as Record<string, unknown>)[name]
const tab = (wrapper: Wrapper, id: string) => wrapper.get(`[data-testid="table-views-tab-${id}"]`)
const resetState = async () => {
  const { defaultColumnVisibility } = await import('../../composables/useSalesColumns')
  state.sorting.value = [{ id: 'confirmedAt', desc: true }]
  state.columnOrder.value = []
  state.columnPinning.value = { left: [], right: [] }
  state.columnSizing.value = {}
  state.columnVisibility.value = { ...defaultColumnVisibility }
  state.density.value = 'comfortable'
}

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
  isMobile.value = false
  await resetState()
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('SalesListView — saved views', () => {
  it('shows one row of view tabs with the status counts, and no separate status tabs', async () => {
    const wrapper = mountList()
    await flushPromises()

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map(t => t.find('.hf-views__name').text())).toEqual(['Todas', 'Cobranza', 'Entregas'])
    expect(tabs.map(t => t.find('.hf-views__count').text())).toEqual(['50', '3', '1'])
    expect(wrapper.find('[data-testid^="sales-tab-"]').exists()).toBe(false)
    expect(tab(wrapper, 'todas').attributes('aria-selected')).toBe('true')
  })

  it('labels the table region as the panel of the active view tab', async () => {
    const wrapper = mountList()
    await flushPromises()

    const panel = wrapper.get('[role="tabpanel"]')
    expect(panel.attributes('aria-labelledby')).toBe(tab(wrapper, 'todas').attributes('id'))
    expect(tab(wrapper, 'todas').attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.find('[data-testid="table-views"]').exists()).toBe(false)
  })

  it('«Cobranza» moves Deuda after Cliente, pins both left, shows Vence, oldest first, pending payments', async () => {
    const wrapper = mountList()
    await flushPromises()
    await tab(wrapper, 'cobranza').trigger('click')
    await flushPromises()

    expect(state.columnOrder.value.slice(0, 3)).toEqual(['venta', 'customer', 'debtCents'])
    expect(state.columnPinning.value).toEqual({ left: ['customer', 'debtCents'], right: [] })
    expect(state.columnVisibility.value.dueDate).toBe(true)
    expect(state.sorting.value).toEqual([{ id: 'confirmedAt', desc: false }])
    expect(state.setTabFilter).toHaveBeenLastCalledWith({ paymentStatus: 'PARTIAL,CREDIT' })
    expect(tableProp(wrapper, 'columnOrder')).toEqual(state.columnOrder.value)
    expect(wrapper.find('[data-testid="table-views-unsaved"]').exists()).toBe(false)
  })

  it('«Entregas» puts Entrega and Fecha first and filters the undelivered sales', async () => {
    const wrapper = mountList()
    await flushPromises()
    await tab(wrapper, 'entregas').trigger('click')
    await flushPromises()

    expect(state.columnOrder.value.slice(0, 2)).toEqual(['deliveryStatus', 'confirmedAt'])
    expect(state.columnPinning.value).toEqual({ left: [], right: [] })
    expect(state.sorting.value).toEqual([{ id: 'confirmedAt', desc: true }])
    expect(state.setTabFilter).toHaveBeenLastCalledWith({ deliveryStatus: 'PENDING' })
  })

  it('«Todas» returns to the default layout and clears the status filter', async () => {
    const wrapper = mountList()
    await flushPromises()
    await tab(wrapper, 'cobranza').trigger('click')
    await tab(wrapper, 'todas').trigger('click')
    await flushPromises()

    expect(state.columnPinning.value).toEqual({ left: [], right: [] })
    expect(state.columnVisibility.value.dueDate).toBe(false)
    expect(state.setTabFilter).toHaveBeenLastCalledWith({})
  })

  it('binds the layout v-models so a layout change marks the view «Cambios sin guardar»', async () => {
    const wrapper = mountList()
    await flushPromises()
    const table = appTable(wrapper)
    expect((table.props() as Record<string, unknown>).density).toBe('comfortable')
    expect((table.props() as Record<string, unknown>).columnSizing).toEqual({})

    table.vm.$emit('update:density', 'compact')
    await nextTick()
    expect(state.density.value).toBe('compact')
    expect(wrapper.get('[data-testid="table-views-unsaved"]').text()).toContain('Cambios sin guardar')
  })

  it('keeps the sort select in step with the view sorting', async () => {
    const wrapper = mountList()
    await flushPromises()
    await tab(wrapper, 'cobranza').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="sales-sort-select"]').text()).toContain('Más antiguas')
  })

  it('reopens on the last view with its status filter', async () => {
    const first = mountList()
    await flushPromises()
    await tab(first, 'cobranza').trigger('click')
    first.unmount()
    mounted.splice(0)
    vi.clearAllMocks()
    await resetState()

    const second = mountList()
    await flushPromises()
    expect(tab(second, 'cobranza').attributes('aria-selected')).toBe('true')
    expect(state.setTabFilter).toHaveBeenLastCalledWith({ paymentStatus: 'PARTIAL,CREDIT' })
    expect(state.sorting.value).toEqual([{ id: 'confirmedAt', desc: false }])
  })

  it('«Limpiar filtros» from a filtered view goes back to «Todas»', async () => {
    const wrapper = mountList()
    await flushPromises()
    await tab(wrapper, 'entregas').trigger('click')
    appTable(wrapper).vm.$emit('clear-filters')
    await flushPromises()

    expect(tab(wrapper, 'todas').attributes('aria-selected')).toBe('true')
    expect(state.setTabFilter).toHaveBeenLastCalledWith({})
  })

  it('keeps the filters in the URL and never writes the URL when switching views', async () => {
    const wrapper = mountList()
    await flushPromises()
    replace.mockClear()

    await tab(wrapper, 'cobranza').trigger('click')
    await flushPromises()
    expect(replace).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="set-status-filter"]').trigger('click')
    // The filters write the URL after their 250ms debounce.
    await vi.waitFor(() => expect(replace).toHaveBeenCalled(), { timeout: 1000 })
    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ status: 'CONFIRMED' }) }))
  })
})
