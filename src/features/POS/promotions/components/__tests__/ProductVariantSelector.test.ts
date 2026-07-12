/**
 * ProductVariantSelector — two-step product → variant picker.
 *
 * Tests cover the user-facing contract:
 *  - product list filters to hasVariants === true (REQ-3)
 *  - picking a product loads its variants via productApi.getVariants
 *  - picking a variant emits update:selectedItems with the extended entry shape
 *    { targetId, name, productId, productName }
 *  - multiple products can contribute variants to a single selection
 *  - removing a chip filters the entry out of the emitted array
 *  - the empty state copy is in neutral Spanish
 *
 * Mounted via a tiny UApp parent so Nuxt UI's provide/inject tree is available
 * and the wrapper still supports `setProps` (required to simulate the parent
 * updating `selectedItems` after a child emit).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductVariantSelector from '../ProductVariantSelector.vue'
import type { PromotionTargetItemFormEntry } from '../../interfaces/promotion.types'

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUBS = {
  UInput: {
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UButton: {
    props: ['disabled'],
    template: '<button type="button" :disabled="disabled"><slot /></button>',
  },
  UIcon: {
    template: '<span />',
  },
  AppBadge: {
    template: '<span class="badge"><slot /></span>',
  },
}

// ── productApi mocks ─────────────────────────────────────────────────────────

const getPaginatedMock = vi.fn()
const getVariantsMock = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getPaginated: (...args: unknown[]) => getPaginatedMock(...args),
    getVariants: (...args: unknown[]) => getVariantsMock(...args),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const CAMISA = { id: 'p1', name: 'Camisa', hasVariants: true }
const REMERA = { id: 'p2', name: 'Remera', hasVariants: true }
const GORRA = { id: 'p3', name: 'Gorra', hasVariants: false }

function mockAllProducts() {
  // Selector uses pageSize 20, pageIndex 0, sorting by name asc, globalFilter empty.
  getPaginatedMock.mockResolvedValue({
    data: [CAMISA, REMERA, GORRA],
    pagination: { pageIndex: 0, pageSize: 20, totalCount: 3, pageCount: 1 },
  })
}

interface MountOpts {
  selectedItems?: PromotionTargetItemFormEntry[]
}

/**
 * Mount the selector inside a UApp parent that owns `selectedItems` as its
 * own ref. The wrapper returned is the OUTER parent wrapper, so `setProps`
 * works as expected and `findComponent(ProductVariantSelector)` gives us the
 * inner component for scoped assertions and emit reads.
 */
function mountSelector(opts: MountOpts = {}) {
  const queryClient = makeQueryClient()
  const initialItems = opts.selectedItems ?? []
  // Inner parent owns the items so `setProps({ selectedItems })` updates the
  // ref and re-renders the child — simulating a real parent's response to the
  // `update:selectedItems` emit.
  const Wrapper = defineComponent({
    components: { UApp, ProductVariantSelector },
    setup() {
      const items = ref<PromotionTargetItemFormEntry[]>(initialItems)
      return () =>
        h(UApp, null, {
          default: () =>
            h(ProductVariantSelector, {
              selectedItems: items.value,
              'onUpdate:selectedItems': (next: PromotionTargetItemFormEntry[]) => {
                items.value = next
              },
            }),
        })
    },
  })
  const wrapper = mount(Wrapper, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs: STUBS },
  })
  return wrapper
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProductVariantSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllProducts()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the Spanish empty state when no product is picked', async () => {
    const wrapper = mountSelector()
    await flushPromises()
    expect(wrapper.text()).toContain('Elegí un producto para ver sus variantes')
  })

  it('filters the product list to hasVariants === true (excludes Gorra)', async () => {
    const wrapper = mountSelector()
    await flushPromises()

    const buttons = wrapper.findAll('button[data-testid="product-row"]')
    expect(buttons.length).toBe(2)
    const labels = buttons.map((b) => b.text())
    expect(labels.some((t) => t.includes('Camisa'))).toBe(true)
    expect(labels.some((t) => t.includes('Remera'))).toBe(true)
    expect(labels.some((t) => t.includes('Gorra'))).toBe(false)
  })

  it('loading the variants for a product triggers getVariants(productId)', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
      { id: 'v2', productId: 'p1', name: 'Talle L' },
    ])

    const wrapper = mountSelector()
    await flushPromises()

    const camisaBtn = wrapper
      .findAll('button[data-testid="product-row"]')
      .find((b) => b.text().includes('Camisa'))
    expect(camisaBtn).toBeDefined()
    await camisaBtn!.trigger('click')
    await flushPromises()

    expect(getVariantsMock).toHaveBeenCalledWith('p1')
  })

  it('add: picking a variant emits update:selectedItems with the extended entry shape', async () => {
    getVariantsMock.mockResolvedValueOnce([{ id: 'v1', productId: 'p1', name: 'Talle M' }])

    const wrapper = mountSelector()
    await flushPromises()

    await wrapper.find('button[data-testid="product-row"]').trigger('click')
    await flushPromises()

    const variantBtn = wrapper.find('button[data-testid="variant-row"]')
    expect(variantBtn.exists()).toBe(true)
    await variantBtn.trigger('click')
    await flushPromises()

    const inner = wrapper.findComponent(ProductVariantSelector)
    const emitted = inner.emitted('update:selectedItems') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    // emitted[i] is the array of items passed to the emit (its first arg).
    const lastItems = emitted[emitted.length - 1]![0]!
    expect(lastItems).toEqual([
      {
        targetId: 'v1',
        name: 'Talle M',
        productId: 'p1',
        productName: 'Camisa',
      },
    ])
  })

  it('multi-variant across two products: second pick preserves the first', async () => {
    getVariantsMock
      .mockResolvedValueOnce([{ id: 'v1', productId: 'p1', name: 'Talle M' }])
      .mockResolvedValueOnce([{ id: 'v2', productId: 'p2', name: 'Rojo' }])

    const wrapper = mountSelector()
    await flushPromises()

    // Pick variant from Camisa.
    const camisaBtn = wrapper
      .findAll('button[data-testid="product-row"]')
      .find((b) => b.text().includes('Camisa'))!
    await camisaBtn.trigger('click')
    await flushPromises()
    await wrapper.find('button[data-testid="variant-row"]').trigger('click')
    await flushPromises()

    // After the first emit the wrapper re-renders with the chip visible and the
    // product list back (because addVariant clears pickedProduct). Now pick
    // from Remera.
    const remeraBtn = wrapper
      .findAll('button[data-testid="product-row"]')
      .find((b) => b.text().includes('Remera'))
    expect(remeraBtn).toBeDefined()
    await remeraBtn!.trigger('click')
    await flushPromises()
    await wrapper.find('button[data-testid="variant-row"]').trigger('click')
    await flushPromises()

    // Both chips visible.
    const chipLabels = wrapper.findAll('[data-testid="variant-selected-items"] .badge').map((b) =>
      b.text().trim(),
    )
    expect(chipLabels.some((l) => l.includes('Camisa') && l.includes('Talle M'))).toBe(true)
    expect(chipLabels.some((l) => l.includes('Remera') && l.includes('Rojo'))).toBe(true)
  })

  it('remove: clicking a chip filters the entry out of the rendered chips', async () => {
    const wrapper = mountSelector({
      selectedItems: [
        { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
        { targetId: 'v2', name: 'Talle L', productId: 'p1', productName: 'Camisa' },
      ],
    })
    await flushPromises()

    const removeBtns = wrapper.findAll('[data-testid="remove-chip"]')
    expect(removeBtns.length).toBe(2)
    await removeBtns[0]!.trigger('click')
    await flushPromises()

    const chipLabels = wrapper.findAll('[data-testid="variant-selected-items"] .badge').map((b) =>
      b.text().trim(),
    )
    expect(chipLabels.some((l) => l.includes('Talle M'))).toBe(false)
    expect(chipLabels.some((l) => l.includes('Talle L'))).toBe(true)
  })

  it('does not duplicate when the same variant id is picked twice', async () => {
    getVariantsMock.mockResolvedValueOnce([{ id: 'v1', productId: 'p1', name: 'Talle M' }])

    const wrapper = mountSelector()
    await flushPromises()
    await wrapper.find('button[data-testid="product-row"]').trigger('click')
    await flushPromises()

    // First pick.
    await wrapper.find('button[data-testid="variant-row"]').trigger('click')
    await flushPromises()

    // Reset to the same product to expose the variant row again (addVariant
    // collapses the picker back to the product step).
    const inner = wrapper.findComponent(ProductVariantSelector)
    expect(inner.props('selectedItems')).toHaveLength(1)

    // Now click the same product again and re-pick the same variant — the
    // de-dup branch in addVariant should prevent a duplicate.
    const camisaBtn = wrapper
      .findAll('button[data-testid="product-row"]')
      .find((b) => b.text().includes('Camisa'))!
    await camisaBtn.trigger('click')
    await flushPromises()
    await wrapper.find('button[data-testid="variant-row"]').trigger('click')
    await flushPromises()

    expect(inner.props('selectedItems')).toHaveLength(1)
  })

  it('chip label is "{productName} · {name}" when productName is present, else name or targetId', async () => {
    const wrapper = mountSelector({
      selectedItems: [
        { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
        { targetId: 'v2', name: '' }, // fallback to targetId
      ],
    })
    await flushPromises()

    const chipLabels = wrapper.findAll('[data-testid="variant-selected-items"] .badge').map((b) =>
      b.text().trim(),
    )
    expect(chipLabels[0]).toContain('Camisa')
    expect(chipLabels[0]).toContain('Talle M')
    expect(chipLabels[0]).toContain('·')
    // Fallback: empty name falls through to targetId 'v2'.
    expect(chipLabels[1]).toBe('v2')
  })
})
