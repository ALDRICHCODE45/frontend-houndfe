/**
 * VariantsPanel — accordion of products for VARIANTS target selection.
 *
 * Behaviors covered (Slice 2 / REQ-4 + REQ-5):
 *   - Products list queries getPaginated({ globalFilter }) for SERVER search.
 *   - Client-side hasVariants filter strips products with no variants.
 *   - Expanding a product row fires a lazy getVariants(productId) fetch — and
 *     that fetch does NOT happen before expand (REQ-4: "expand reveals variants").
 *   - "Seleccionar todas" awaits the fetch via queryClient.ensureQueryData
 *     so it works even if the row wasn't expanded; shows a spinner in-flight.
 *   - Variants from two different products coexist in the staged array.
 *   - Chip label is "{productName} · {name}" when both are present, falls back
 *     to name or targetId otherwise (migrated from ProductVariantSelector).
 *   - Chip removal filters the entry out of staged.
 *   - Re-toggling a staged variant removes it instead of duplicating.
 *
 * Test infrastructure:
 *   - mountWithUApp wraps the panel in <UApp> so Nuxt UI's provider tree
 *     is available without manual stubs.
 *   - The product API is mocked via vi.mock so we can assert call counts
 *     for getPaginated (products list) and getVariants (lazy + select-all).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { nextTick, defineComponent, h, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import VariantsPanel from '../VariantsPanel.vue'
import type { PromotionTargetItemFormEntry } from '../../../interfaces/promotion.types'

// ── productApi mocks ──────────────────────────────────────────────────────────

const getPaginatedMock = vi.fn()
const getVariantsMock = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getPaginated: (...args: unknown[]) => getPaginatedMock(...args),
    getVariants: (...args: unknown[]) => getVariantsMock(...args),
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CAMISA = { id: 'p1', name: 'Camisa', hasVariants: true }
const REMERA = { id: 'p2', name: 'Remera', hasVariants: true }
const GORRA = { id: 'p3', name: 'Gorra', hasVariants: false }

function mockAllProducts() {
  getPaginatedMock.mockResolvedValue({
    data: [CAMISA, REMERA, GORRA],
    pagination: { pageIndex: 0, pageSize: 20, totalCount: 3, pageCount: 1 },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

interface MountOpts {
  staged?: PromotionTargetItemFormEntry[]
}

/**
 * Mount the panel via a small parent that owns `staged` as a ref and forwards
 * updates — the same pattern the production modal uses. This lets the
 * multi-product select-all test observe accumulation across two clicks:
 * VariantsPanel itself never holds state (it's controlled via props), so a
 * stand-alone mount wouldn't accumulate.
 */
function mountPanel(opts: MountOpts = {}) {
  const initial = opts.staged ?? []
  const Outer = defineComponent({
    setup() {
      const items = ref<PromotionTargetItemFormEntry[]>(initial)
      return () =>
        h(VariantsPanel, {
          staged: items.value,
          'onUpdate:staged': (next: PromotionTargetItemFormEntry[]) => {
            items.value = next
          },
        })
    },
  })
  return mountWithUApp(Outer, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
    },
  }).findComponent(VariantsPanel)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VariantsPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAllProducts()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Products list — client-side hasVariants filter (REQ-4, REQ-5) ─────────

  it('renders the product list excluding products without variants (hasVariants filter)', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const camisaRow = wrapper.find('[data-testid="product-row-p1"]')
    const remeraRow = wrapper.find('[data-testid="product-row-p2"]')
    const gorraRow = wrapper.find('[data-testid="product-row-p3"]')

    expect(camisaRow.exists()).toBe(true)
    expect(remeraRow.exists()).toBe(true)
    expect(gorraRow.exists()).toBe(false) // GORRA has hasVariants === false
  })

  it('uses getPaginated with globalFilter for server-side product search (REQ-5)', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel()
    await flushPromises()
    expect(getPaginatedMock).toHaveBeenCalledTimes(1)
    const initialCall = getPaginatedMock.mock.calls[0]![0] as { globalFilter?: string }
    // No search typed → globalFilter must NOT be a search string (would force empty).
    expect(initialCall.globalFilter).toBeFalsy()

    // Type a query → debounced (200ms) → server search.
    const search = wrapper.find('input[data-testid="variants-search"]')
    expect(search.exists()).toBe(true)
    await search.setValue('rojo')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(getPaginatedMock).toHaveBeenCalledTimes(2)
    const lastCall = getPaginatedMock.mock.calls[1]![0] as { globalFilter?: string }
    expect(lastCall.globalFilter).toBe('rojo')
  })

  // ── Lazy load on expand (REQ-4) ───────────────────────────────────────────

  it('does NOT call getVariants before any row is expanded', async () => {
    mountPanel()
    await flushPromises()

    expect(getVariantsMock).not.toHaveBeenCalled()
  })

  it('calls getVariants(productId) ONLY when that row is expanded (lazy)', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
      { id: 'v2', productId: 'p1', name: 'Talle L' },
    ])

    const wrapper = mountPanel()
    await flushPromises()

    expect(getVariantsMock).not.toHaveBeenCalled()

    // Expand Camisa.
    const toggle = wrapper.find('[data-testid="product-toggle-p1"]')
    expect(toggle.exists()).toBe(true)
    await toggle.trigger('click')
    await flushPromises()

    expect(getVariantsMock).toHaveBeenCalledTimes(1)
    expect(getVariantsMock).toHaveBeenCalledWith('p1')
  })

  it('expanding Camisa reveals its variants with checkboxes', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
      { id: 'v2', productId: 'p1', name: 'Talle L' },
    ])

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="product-toggle-p1"]').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Talle M')
    expect(text).toContain('Talle L')

    // The checkbox rendered for each variant. Nuxt UI's UCheckbox is a button
    // with role="checkbox" + aria-checked, so we query by role.
    const checkboxes = wrapper.findAll('[role="checkbox"]')
    expect(checkboxes.length).toBe(2)
  })

  it('toggling the same product row twice collapses the variants list', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
    ])

    const wrapper = mountPanel()
    await flushPromises()

    const toggle = wrapper.find('[data-testid="product-toggle-p1"]')
    await toggle.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="variants-list-p1"]').exists()).toBe(true)

    // Collapse.
    await toggle.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="variants-list-p1"]').exists()).toBe(false)
  })

  // ── Per-variant toggle ─────────────────────────────────────────────────────

  it('toggling a variant checkbox emits update:staged with the extended entry shape', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
    ])

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="product-toggle-p1"]').trigger('click')
    await flushPromises()

    const variantButton = wrapper.find('[data-testid="variant-row-button-p1"]')
    expect(variantButton.exists()).toBe(true)
    await variantButton.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    const last = emitted[emitted.length - 1]![0]!
    expect(last).toEqual([
      {
        targetId: 'v1',
        name: 'Talle M',
        productId: 'p1',
        productName: 'Camisa',
      },
    ])
  })

  it('toggling an already-staged variant removes it from staged (no duplicates)', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
    ])

    const wrapper = mountPanel({
      staged: [{ targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' }],
    })
    await flushPromises()

    await wrapper.find('[data-testid="product-toggle-p1"]').trigger('click')
    await flushPromises()

    const variantButton = wrapper.find('[data-testid="variant-row-button-p1"]')
    await variantButton.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    const last = emitted[emitted.length - 1]![0]!
    expect(last).toEqual([])
  })

  // ── Select-all awaits fetch + spinner (REQ-4) ──────────────────────────────

  it('select-all: awaits getVariants even when row is not expanded (spinner in-flight)', async () => {
    // Return the variants asynchronously so we can observe the in-flight state.
    let resolveFetch: ((value: { id: string; productId: string; name: string }[]) => void) | null =
      null
    getVariantsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve as never
        }),
    )

    const wrapper = mountPanel()
    await flushPromises()
    expect(getVariantsMock).not.toHaveBeenCalled() // not lazy-loaded yet

    const selectAll = wrapper.find('[data-testid="select-all-p1"]')
    expect(selectAll.exists()).toBe(true)
    await selectAll.trigger('click')
    // ensureQueryData is async (vue-query v5 schedules the queryFn in a
    // microtask). flushPromises drains pending microtasks/macrotasks so
    // getVariantsMock has been called and the spinner is mounted before
    // we assert, but the mock promise stays pending until we resolve it.
    await flushPromises()

    expect(getVariantsMock).toHaveBeenCalledTimes(1)
    expect(getVariantsMock).toHaveBeenCalledWith('p1')

    // Spinner visible while in-flight.
    const spinner = wrapper.find('[data-testid="select-all-spinner"]')
    expect(spinner.exists()).toBe(true)

    // Resolve the fetch and let the promise chain settle.
    resolveFetch!([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
      { id: 'v2', productId: 'p1', name: 'Talle L' },
    ])
    await flushPromises()

    // All variant ids are now in staged.
    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    const last = emitted[emitted.length - 1]![0]!
    expect(last.map((e) => e.targetId).sort()).toEqual(['v1', 'v2'])
    // And the spinner is gone now.
    expect(wrapper.find('[data-testid="select-all-spinner"]').exists()).toBe(false)
  })

  it('select-all: stages both variants from product A and product B in one session (multi-product coexist)', async () => {
    // First call (Camisa select-all) returns 2 variants.
    getVariantsMock.mockImplementationOnce(async () => [
      { id: 'v1', productId: 'p1', name: 'Talle M' },
      { id: 'v2', productId: 'p1', name: 'Talle L' },
    ])
    // Second call (Remera select-all) returns 1 variant.
    getVariantsMock.mockImplementationOnce(async () => [
      { id: 'v3', productId: 'p2', name: 'Rojo' },
    ])

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="select-all-p1"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="select-all-p2"]').trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    const last = emitted[emitted.length - 1]![0]!
    expect(last).toHaveLength(3)
    expect(last.find((e) => e.targetId === 'v1')).toBeDefined()
    expect(last.find((e) => e.targetId === 'v2')).toBeDefined()
    expect(last.find((e) => e.targetId === 'v3')).toBeDefined()
    // The mixed entry shapes preserve both product contexts.
    expect(last.find((e) => e.targetId === 'v1')?.productName).toBe('Camisa')
    expect(last.find((e) => e.targetId === 'v3')?.productName).toBe('Remera')
  })

  // ── Selected chips (migrated from ProductVariantSelector) ────────────────

  it('renders compact chips with "{productName} · {name}" label when both are present', async () => {
    const wrapper = mountPanel({
      staged: [
        { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
      ],
    })
    await flushPromises()

    const chip = wrapper.find('[data-testid="selected-items"]')
    expect(chip.exists()).toBe(true)
    const text = chip.text()
    expect(text).toContain('Camisa')
    expect(text).toContain('Talle M')
    expect(text).toContain('·')
  })

  it('chip label falls back to targetId when name is empty', async () => {
    const wrapper = mountPanel({
      staged: [{ targetId: 'v2', name: '' }],
    })
    await flushPromises()

    const chip = wrapper.find('[data-testid="selected-items"]')
    expect(chip.text()).toContain('v2')
  })

  it('chip removal: clicking the X emits update:staged without that entry', async () => {
    const wrapper = mountPanel({
      staged: [
        { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
        { targetId: 'v2', name: 'Talle L', productId: 'p1', productName: 'Camisa' },
      ],
    })
    await flushPromises()

    const removeButtons = wrapper.findAll('[data-testid="remove-chip"]')
    expect(removeButtons.length).toBe(2)
    await removeButtons[0]!.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:staged') as [
      PromotionTargetItemFormEntry[],
    ][]
    const last = emitted[emitted.length - 1]![0]!
    expect(last).toHaveLength(1)
    expect(last[0]!.targetId).toBe('v2')
  })
})