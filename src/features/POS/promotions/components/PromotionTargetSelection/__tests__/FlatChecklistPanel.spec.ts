/**
 * FlatChecklistPanel — searchable multi-select checklist for CATEGORIES,
 * BRANDS, and PRODUCTS. Each dataSource hits the appropriate API:
 *   - CATEGORIES -> productApi.getCategories() (full list, client-side filter)
 *   - BRANDS     -> productApi.getBrands()    (full list, client-side filter)
 *   - PRODUCTS   -> productApi.getPaginated({ globalFilter }) — SERVER search
 *
 * The panel is presentational: it owns a "staged" array (v-model) of
 * PromotionTargetItemFormEntry and emits `update:staged` whenever the user
 * toggles a row. Cancel/confirm lives in the parent modal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h, nextTick } from 'vue'
import FlatChecklistPanel from '../FlatChecklistPanel.vue'
import type { PromotionTargetItemFormEntry } from '../../../interfaces/promotion.types'

// ── Stubs ────────────────────────────────────────────────────────────────────

const STUBS = {
  UInput: {
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UIcon: {
    template: '<span />',
  },
  UCheckbox: defineComponent({
    name: 'UCheckbox',
    props: { modelValue: { default: false } },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          type: 'checkbox',
          'data-testid': 'checklist-checkbox',
          checked: props.modelValue,
          onChange: (e: Event) =>
            emit('update:modelValue', (e.target as HTMLInputElement).checked),
        })
    },
  }),
}

// ── productApi mocks ─────────────────────────────────────────────────────────

const getCategoriesMock = vi.fn()
const getBrandsMock = vi.fn()
const getPaginatedMock = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getCategories: (...args: unknown[]) => getCategoriesMock(...args),
    getBrands: (...args: unknown[]) => getBrandsMock(...args),
    getPaginated: (...args: unknown[]) => getPaginatedMock(...args),
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

interface MountOpts {
  dataSource: 'CATEGORIES' | 'BRANDS' | 'PRODUCTS'
  staged?: PromotionTargetItemFormEntry[]
}

function mountPanel(opts: MountOpts) {
  return mount(FlatChecklistPanel, {
    props: {
      dataSource: opts.dataSource,
      staged: opts.staged ?? [],
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
      stubs: STUBS,
    },
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FlatChecklistPanel', () => {
  beforeEach(() => {
    // Reset BOTH call history AND queued mock implementations so the
    // previous test's `mockResolvedValueOnce` responses don't leak.
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── CATEGORIES branch ─────────────────────────────────────────────────────

  it('CATEGORIES: renders checklist populated from productApi.getCategories', async () => {
    getCategoriesMock.mockResolvedValue([
      { id: 'c1', name: 'Camisetas' },
      { id: 'c2', name: 'Pantalones' },
    ])

    const wrapper = mountPanel({ dataSource: 'CATEGORIES' })
    await flushPromises()

    expect(getCategoriesMock).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('Camisetas')
    expect(text).toContain('Pantalones')
  })

  it('CATEGORIES: toggling a row emits update:staged with the entry added (multi-select)', async () => {
    getCategoriesMock.mockResolvedValue([
      { id: 'c1', name: 'Camisetas' },
      { id: 'c2', name: 'Pantalones' },
    ])

    const wrapper = mountPanel({ dataSource: 'CATEGORIES' })
    await flushPromises()

    const firstRowButton = wrapper.find('[data-testid="checklist-row-button"]')
    expect(firstRowButton.exists()).toBe(true)
    await firstRowButton.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1]![0]).toEqual([
      { targetId: 'c1', name: 'Camisetas' },
    ])
  })

  it('CATEGORIES: clicking a staged row removes it from staged (toggle off)', async () => {
    getCategoriesMock.mockResolvedValue([{ id: 'c1', name: 'Camisetas' }])

    const wrapper = mountPanel({
      dataSource: 'CATEGORIES',
      staged: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    const rowButton = wrapper.find('[data-testid="checklist-row-button"]')
    await rowButton.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted[emitted.length - 1]![0]).toEqual([])
  })

  it('CATEGORIES: client-side search filters the rendered list (no extra API call)', async () => {
    getCategoriesMock.mockResolvedValue([
      { id: 'c1', name: 'Camisetas' },
      { id: 'c2', name: 'Pantalones' },
      { id: 'c3', name: 'Camisas' },
    ])

    const wrapper = mountPanel({ dataSource: 'CATEGORIES' })
    await flushPromises()
    expect(getCategoriesMock).toHaveBeenCalledTimes(1)

    const input = wrapper.find('input[data-testid="checklist-search"]')
    expect(input.exists()).toBe(true)
    await input.setValue('cami')
    await nextTick()

    // No extra getCategories call (CATEGORIES is full-list, not server-side).
    expect(getCategoriesMock).toHaveBeenCalledTimes(1)

    const text = wrapper.text()
    expect(text).toContain('Camisetas')
    expect(text).toContain('Camisas')
    expect(text).not.toContain('Pantalones')
  })

  // ── BRANDS branch ─────────────────────────────────────────────────────────

  it('BRANDS: renders checklist populated from productApi.getBrands', async () => {
    getBrandsMock.mockResolvedValue([
      { id: 'b1', name: 'Nike' },
      { id: 'b2', name: 'Adidas' },
    ])

    const wrapper = mountPanel({ dataSource: 'BRANDS' })
    await flushPromises()

    expect(getBrandsMock).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('Nike')
    expect(text).toContain('Adidas')
  })

  it('BRANDS: client-side search filters the rendered list (no extra API call)', async () => {
    getBrandsMock.mockResolvedValue([
      { id: 'b1', name: 'Nike' },
      { id: 'b2', name: 'Adidas' },
    ])

    const wrapper = mountPanel({ dataSource: 'BRANDS' })
    await flushPromises()
    expect(getBrandsMock).toHaveBeenCalledTimes(1)

    const input = wrapper.find('input[data-testid="checklist-search"]')
    await input.setValue('nik')
    await nextTick()

    expect(getBrandsMock).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('Nike')
    expect(text).not.toContain('Adidas')
  })

  // ── PRODUCTS branch — SERVER search (REQ-5) ──────────────────────────────

  it('PRODUCTS: empty search calls getPaginated with globalFilter undefined', async () => {
    getPaginatedMock.mockResolvedValue({
      data: [
        { id: 'p1', name: 'Camisa A', hasVariants: false },
        { id: 'p2', name: 'Camisa B', hasVariants: false },
      ],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 2, pageCount: 1 },
    })

    const wrapper = mountPanel({ dataSource: 'PRODUCTS' })
    await flushPromises()

    expect(getPaginatedMock).toHaveBeenCalledTimes(1)
    const callArg = getPaginatedMock.mock.calls[0]![0] as {
      globalFilter?: string
    }
    // When the user has not typed anything, the panel must NOT send a search
    // string (it would force the backend to return an empty list).
    expect(callArg.globalFilter).toBeFalsy()
  })

  it('PRODUCTS: server-side search — typing a query calls getPaginated with globalFilter', async () => {
    vi.useFakeTimers()
    getPaginatedMock.mockResolvedValue({
      data: [{ id: 'p1', name: 'Camisa A', hasVariants: false }],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mountPanel({ dataSource: 'PRODUCTS' })
    await flushPromises()

    const input = wrapper.find('input[data-testid="checklist-search"]')
    await input.setValue('rojo')
    // The search input has a 200ms debounce; advance fake timers past it.
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    // Two calls: the initial empty-search call + the debounced 'rojo' call.
    expect(getPaginatedMock).toHaveBeenCalledTimes(2)
    const lastCall = getPaginatedMock.mock.calls[1]![0] as { globalFilter?: string }
    expect(lastCall.globalFilter).toBe('rojo')
  })

  it('PRODUCTS: results beyond the first 20 are reachable via server search (REQ-5)', async () => {
    vi.useFakeTimers()
    // First call: empty search returns the first page.
    getPaginatedMock.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'Camisa', hasVariants: false }],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 100, pageCount: 5 },
    })

    const wrapper = mountPanel({ dataSource: 'PRODUCTS' })
    await flushPromises()
    // First page rendered (1 item from the initial empty-search call).
    expect(wrapper.text()).toContain('Camisa')

    // Second call: user types a query; backend returns a result that was NOT
    // in the first page. This proves the list is server-driven, not a
    // client-side filter over the first 20.
    getPaginatedMock.mockResolvedValueOnce({
      data: [
        { id: 'p42', name: 'Remera Profunda', hasVariants: false },
        { id: 'p43', name: 'Remera Escondida', hasVariants: false },
      ],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 2, pageCount: 1 },
    })

    const input = wrapper.find('input[data-testid="checklist-search"]')
    await input.setValue('remera')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    // The deep results (ids 42/43) are now visible — they were NOT in the
    // initial first-page result.
    const text = wrapper.text()
    expect(text).toContain('Remera Profunda')
    expect(text).toContain('Remera Escondida')
    expect(getPaginatedMock.mock.calls[1]![0]).toMatchObject({
      globalFilter: 'remera',
    })
  })

  it('PRODUCTS: toggling a row emits update:staged with the entry', async () => {
    getPaginatedMock.mockResolvedValue({
      data: [{ id: 'p1', name: 'Camisa A', hasVariants: false }],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mountPanel({ dataSource: 'PRODUCTS' })
    await flushPromises()

    const rowButton = wrapper.find('[data-testid="checklist-row-button"]')
    await rowButton.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1]![0]).toEqual([
      { targetId: 'p1', name: 'Camisa A' },
    ])
  })

  // ── Staged pre-fill (REQ-2 "reopen restores confirmed selection") ─────────

  it('pre-fills: rows whose id matches a staged target render as checked', async () => {
    getCategoriesMock.mockResolvedValue([
      { id: 'c1', name: 'Camisetas' },
      { id: 'c2', name: 'Pantalones' },
    ])

    const wrapper = mountPanel({
      dataSource: 'CATEGORIES',
      staged: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    // Both rows rendered; the staged one is marked as checked. Nuxt UI's
    // UCheckbox renders a <button role="checkbox">, so we query by role +
    // aria-checked (its native checked-state attribute).
    const checkboxes = wrapper.findAll('[role="checkbox"]')
    expect(checkboxes.length).toBe(2)
    // The first row (c1) is checked, the second is not.
    expect(checkboxes[0]!.attributes('aria-checked')).toBe('true')
    expect(checkboxes[1]!.attributes('aria-checked')).toBe('false')
  })
})
