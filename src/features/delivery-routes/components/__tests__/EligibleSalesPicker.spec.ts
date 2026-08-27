// EligibleSalesPicker.spec.ts — STRICT-TDD tests for the delivery-route
// eligible-sales multi-select.
//
// Component contract (sdd delivery-routes, design.md §4.1, §6.2):
//   - Multi-select over `useEligibleSales` (PENDING + SHIPPED confirmed sales).
//   - v-model + update:selected emit shape (string[]).
//   - Empty state: "No hay ventas pendientes o enviadas".
//   - Loading + error states surfaced.
//   - The picker is a thin presentation layer — it does NOT apply additional
//     client-side filtering beyond what useEligibleSales already does (the
//     backend re-validates eligibility per design.md §7.2).
//
// TRIANGULATE — REQ-SALES-DR-001 regression pin: SHIPPED rows from
// useEligibleSales must pass through verbatim. Removing SHIPPED from the
// inner composable would silently hide every in-transit sale from the picker
// (per the S1a + S4a invariant). The chip label below the trigger renders
// the SHIPPED row's folio + delivery status, so the spec can assert the
// passthrough without navigating USelectMenu internals.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref, computed, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import EligibleSalesPicker from '../EligibleSalesPicker.vue'

// Mock useEligibleSales so the spec owns the assignable sale fixture list.
// The inner composable's data is exposed via the same `data` computed the
// production picker consumes — so the picker forwards it verbatim.
const mockStateRefs = {
  pagination: ref({ pageIndex: 0, pageSize: 20 }) as Ref<{ pageIndex: number; pageSize: number }>,
  sorting: ref<Array<{ id: string; desc: boolean }>>([]) as Ref<Array<{ id: string; desc: boolean }>>,
  globalFilter: ref<string>('') as Ref<string>,
  data: ref<unknown[]>([]) as Ref<unknown[]>,
  totalCount: ref(0) as Ref<number>,
  pageCount: ref(0) as Ref<number>,
  isLoading: ref(false) as Ref<boolean>,
  isFetching: ref(false) as Ref<boolean>,
  isError: ref(false) as Ref<boolean>,
  error: ref<unknown>(null) as Ref<unknown>,
  counts: ref({ all: 0, pendingPayments: 0, notDelivered: 0 }),
  filterErrors: ref<Record<string, string>>({}),
}

vi.mock('../../composables/useEligibleSales', () => ({
  useEligibleSales: vi.fn(() => ({
    pagination: mockStateRefs.pagination,
    sorting: mockStateRefs.sorting,
    globalFilter: mockStateRefs.globalFilter,
    data: computed(() => mockStateRefs.data.value),
    totalCount: computed(() => mockStateRefs.totalCount.value),
    pageCount: computed(() => mockStateRefs.pageCount.value),
    isLoading: computed(() => mockStateRefs.isLoading.value),
    isFetching: computed(() => mockStateRefs.isFetching.value),
    isError: computed(() => mockStateRefs.isError.value),
    error: computed(() => mockStateRefs.error.value),
    counts: computed(() => mockStateRefs.counts.value),
    filterErrors: computed(() => mockStateRefs.filterErrors.value),
    refresh: vi.fn(),
    setTabFilter: vi.fn(),
    setDeliveryStatusFilter: vi.fn(),
  })),
}))

import { useEligibleSales } from '../../composables/useEligibleSales'

const SALE_PENDING = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'PENDING',
  totalCents: 127000,
  customer: { id: 'cust-1', name: 'Cliente A' },
}

const SALE_SHIPPED = {
  id: 'sale-2',
  folio: 'A-202605-000013',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'SHIPPED',
  totalCents: 99900,
  customer: { id: 'cust-2', name: 'Cliente B' },
}

function mountPicker(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  const Wrapper = defineComponent({
    components: { UApp, EligibleSalesPicker },
    setup() {
      return () =>
        h(UApp, null, {
          default: () => h(EligibleSalesPicker, { modelValue: [], ...props }),
        })
    },
  })

  return mount(Wrapper, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  }).findComponent(EligibleSalesPicker)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStateRefs.data.value = []
  mockStateRefs.isLoading.value = false
  mockStateRefs.isError.value = false
  mockStateRefs.error.value = null
})

describe('EligibleSalesPicker — uses useEligibleSales', () => {
  it('consumes the useEligibleSales composable as its data source', () => {
    mountPicker()
    expect(useEligibleSales).toHaveBeenCalled()
  })
})

describe('EligibleSalesPicker — multi-select + emit contract', () => {
  it('renders SHIPPED sales verbatim from useEligibleSales (REQ-SALES-DR-001)', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ modelValue: ['sale-2'] })
    await nextTick()
    // The chip label includes the SHIPPED row's folio + delivery status
    // (Enviada), proving the SHIPPED row passes through verbatim.
    expect(wrapper.text()).toContain('A-202605-000013')
    expect(wrapper.text()).toContain('Enviada')
  })

  it('renders the PENDING sale chip with its folio + Pendiente label', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ modelValue: ['sale-1'] })
    await nextTick()
    expect(wrapper.text()).toContain('A-202605-000012')
    expect(wrapper.text()).toContain('Pendiente')
  })

  it('renders one chip per selected sale id', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ modelValue: ['sale-1', 'sale-2'] })
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-sale-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker-chip-sale-2"]').exists()).toBe(true)
  })

  it('emits update:selected without the removed id when a chip is cleared', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ modelValue: ['sale-1', 'sale-2'] })
    await nextTick()
    await wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]').trigger('click')
    await nextTick()
    const events = wrapper.emitted('update:selected')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([['sale-2']])
  })

  it('emits update:selected with an empty array when the last chip is cleared', async () => {
    mockStateRefs.data.value = [SALE_PENDING]
    const wrapper = mountPicker({ modelValue: ['sale-1'] })
    await nextTick()
    await wrapper.find('[data-testid="eligible-sales-picker-chip-clear-sale-1"]').trigger('click')
    await nextTick()
    const events = wrapper.emitted('update:selected')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([[]])
  })

  it('does NOT render chips when modelValue is empty', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ modelValue: [] })
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-chips"]').exists()).toBe(false)
  })
})

describe('EligibleSalesPicker — empty / loading / error states', () => {
  it('renders "No hay ventas pendientes o enviadas" when the eligible list is empty', async () => {
    mockStateRefs.data.value = []
    const wrapper = mountPicker()
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-empty-inline"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No hay ventas pendientes o enviadas')
  })

  it('exposes a loading indicator while the eligible list is being fetched', async () => {
    mockStateRefs.isLoading.value = true
    const wrapper = mountPicker()
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-loading"]').exists()).toBe(true)
  })

  it('renders an error block when the eligible list fails to load', async () => {
    mockStateRefs.isError.value = true
    mockStateRefs.error.value = new Error('boom')
    const wrapper = mountPicker()
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('boom')
  })
})

describe('EligibleSalesPicker — required marker', () => {
  it('renders the required marker when :required is true', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ required: true })
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-required"]').exists()).toBe(true)
  })

  it('does not render the required marker when :required is false', async () => {
    mockStateRefs.data.value = [SALE_PENDING, SALE_SHIPPED]
    const wrapper = mountPicker({ required: false })
    await nextTick()
    expect(wrapper.find('[data-testid="eligible-sales-picker-required"]').exists()).toBe(false)
  })
})

// Tiny no-op to silence linter about unused vi in test file.
vi.fn()
