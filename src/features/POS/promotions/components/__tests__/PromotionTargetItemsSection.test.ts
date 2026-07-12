import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { defineComponent, h, ref } from 'vue'
import type { PromotionTargetItemFormEntry, PromotionTargetType } from '../../interfaces/promotion.types'

// ── Stubs ─────────────────────────────────────────────────────────────────────

const FULL_STUBS = {
  URadioGroup: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input v-bind="$attrs" />',
  },
  UBadge: {
    template: '<span><slot /></span>',
  },
  UIcon: {
    template: '<span />',
  },
  UButton: {
    template: '<button type="button"><slot /></button>',
  },
}

// ── Import after mocks ────────────────────────────────────────────────────────

import PromotionTargetItemsSection from '../PromotionTargetItemsSection.vue'
import ProductVariantSelector from '../ProductVariantSelector.vue'

const getPaginatedMockForVariantSection = vi.fn()
const getVariantsMockForVariantSection = vi.fn()
vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getPaginated: (...args: unknown[]) => getPaginatedMockForVariantSection(...args),
    getVariants: (...args: unknown[]) => getVariantsMockForVariantSection(...args),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

function mountSection(props: {
  targetType: PromotionTargetType
  selectedItems?: PromotionTargetItemFormEntry[]
  side?: 'DEFAULT' | 'BUY' | 'GET'
  label?: string
  allowVariants?: boolean
}) {
  const queryClient = makeQueryClient()
  return mount(PromotionTargetItemsSection, {
    props: {
      targetType: props.targetType,
      selectedItems: props.selectedItems ?? [],
      side: props.side ?? 'DEFAULT',
      label: props.label,
      allowVariants: props.allowVariants,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: FULL_STUBS,
    },
  })
}

function getRadioValues(wrapper: ReturnType<typeof mountSection>): string[] {
  // Nuxt UI's URadioGroup renders <button role="radio" value="..."> for each
  // item. Extract the values to assert against the rendered options — this is
  // what the user actually sees in the radio group, independent of the internal
  // option-source shape.
  return wrapper
    .findAll('[role="radio"]')
    .map((node) => node.attributes('value') ?? '')
    .filter(Boolean)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PromotionTargetItemsSection', () => {
  it('mounts without error', () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS' })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders search input', () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS' })
    expect(wrapper.find('[data-testid="target-search-input"]').exists()).toBe(true)
  })

  it('renders empty state when no items selected', () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS', selectedItems: [] })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('shows selected items list when items are provided', () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      selectedItems: [{ targetId: 'p1', name: 'Camisa Azul' }],
    })
    expect(wrapper.find('[data-testid="selected-items"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Camisa Azul')
  })

  it('does not show empty state when items are selected', () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      selectedItems: [{ targetId: 'p1', name: 'Camisa Azul' }],
    })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('emits update:selectedItems when removeItem is called', async () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      selectedItems: [
        { targetId: 'p1', name: 'Camisa Azul' },
        { targetId: 'p2', name: 'Zapato Negro' },
      ],
    })
    await (
      wrapper.vm as unknown as { removeItem: (id: string) => void }
    ).removeItem('p1')
    expect(wrapper.emitted('update:selectedItems')).toBeTruthy()
    const emitted = wrapper.emitted('update:selectedItems') as [PromotionTargetItemFormEntry[]][]
    expect(emitted[0]![0]!).toHaveLength(1)
    expect(emitted[0]![0]![0]!.targetId).toBe('p2')
  })

  it('emits update:selectedItems with item added when addItem is called', async () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      selectedItems: [],
    })
    await (
      wrapper.vm as unknown as {
        addItem: (id: string, name: string) => void
      }
    ).addItem('p1', 'Camisa Azul')
    expect(wrapper.emitted('update:selectedItems')).toBeTruthy()
    const emitted = wrapper.emitted('update:selectedItems') as [PromotionTargetItemFormEntry[]][]
    expect(emitted[0]![0]!).toHaveLength(1)
    expect(emitted[0]![0]![0]!.targetId).toBe('p1')
    expect(emitted[0]![0]![0]!.name).toBe('Camisa Azul')
  })

  it('does not add duplicate items', async () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      selectedItems: [{ targetId: 'p1', name: 'Camisa Azul' }],
    })
    await (
      wrapper.vm as unknown as { addItem: (id: string, name: string) => void }
    ).addItem('p1', 'Camisa Azul')
    // No emit if duplicate
    expect(wrapper.emitted('update:selectedItems')).toBeFalsy()
  })

  it('emits update:targetType when radio group changes', async () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS' })
    await (
      wrapper.vm as unknown as {
        onTargetTypeChange: (t: PromotionTargetType) => void
      }
    ).onTargetTypeChange('CATEGORIES')
    expect(wrapper.emitted('update:targetType')).toBeTruthy()
    expect(wrapper.emitted('update:targetType')![0]).toEqual(['CATEGORIES'])
  })

  it('displays custom label when provided', () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      label: 'Aplica a estos productos',
    })
    expect(wrapper.text()).toContain('Aplica a estos productos')
  })

  // ── VARIANTS branch (REQ-2 / REQ-3) ──────────────────────────────────────

  it('renders the ProductVariantSelector when targetType is VARIANTS', () => {
    const wrapper = mountSection({
      targetType: 'VARIANTS',
      selectedItems: [],
    })
    expect(wrapper.findComponent(ProductVariantSelector).exists()).toBe(true)
    // The plain search/catalog inputs for the legacy branches must NOT render.
    expect(wrapper.find('[data-testid="target-search-input"]').exists()).toBe(false)
  })

  it('does not render ProductVariantSelector when targetType is not VARIANTS', () => {
    const wrapper = mountSection({
      targetType: 'PRODUCTS',
      selectedItems: [],
    })
    expect(wrapper.findComponent(ProductVariantSelector).exists()).toBe(false)
  })

  it('switching from VARIANTS to another targetType clears items (REQ-2)', async () => {
    const wrapper = mountSection({
      targetType: 'VARIANTS',
      selectedItems: [
        { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
      ],
    })
    await (
      wrapper.vm as unknown as {
        onTargetTypeChange: (t: PromotionTargetType) => void
      }
    ).onTargetTypeChange('PRODUCTS')
    const emitted = wrapper.emitted('update:selectedItems') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    expect(emitted[0]![0]).toEqual([])
  })

  it('forwards update:selectedItems from ProductVariantSelector unchanged', async () => {
    // Stub productApi so the selector can render its product list without 404.
    getPaginatedMockForVariantSection.mockResolvedValue({
      data: [{ id: 'p1', name: 'Camisa', hasVariants: true }],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mountSection({
      targetType: 'VARIANTS',
      selectedItems: [],
    })
    const innerSelector = wrapper.findComponent(ProductVariantSelector)
    expect(innerSelector.exists()).toBe(true)
    await innerSelector.vm.$emit('update:selectedItems', [
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
    ])

    const emitted = wrapper.emitted('update:selectedItems') as [
      PromotionTargetItemFormEntry[],
    ][]
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1]![0]).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
    ])
  })

  it('chip label for VARIANTS renders "{productName} · {name}" when productName is present', async () => {
    // Stub productApi so the selector can render its product list.
    getPaginatedMockForVariantSection.mockResolvedValue({
      data: [],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 },
    })

    const wrapper = mount(ProductVariantSelector, {
      props: {
        selectedItems: [
          { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
        ],
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
        stubs: FULL_STUBS,
      },
    })

    // Verify the chip label rendered by the selector itself (the section just
    // forwards events unchanged — verifying the contract at the source).
    expect(wrapper.text()).toContain('Camisa')
    expect(wrapper.text()).toContain('Talle M')
    expect(wrapper.text()).toContain('·')
  })

  // ── REQ-1 second scenario: VARIANTS hidden under BUY_X_GET_Y / ADVANCED ──
  // The global TARGET_TYPE_OPTIONS constant lists all four options
  // (CATEGORIES/BRANDS/PRODUCTS/VARIANTS). The section must NOT leak VARIANTS
  // into BUY_X_GET_Y / ADVANCED instances. The section exposes a boolean
  // `allowVariants` prop (default false) — only the PRODUCT_DISCOUNT instance
  // sets it to true.

  it('does NOT render VARIANTS option when allowVariants is omitted (default — BUY_X_GET_Y/ADVANCED)', () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS' })
    const values = getRadioValues(wrapper)
    expect(values).not.toContain('VARIANTS')
    expect(values).toEqual(expect.arrayContaining(['CATEGORIES', 'BRANDS', 'PRODUCTS']))
  })

  it('does NOT render VARIANTS option when allowVariants is explicitly false', () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS', allowVariants: false })
    const values = getRadioValues(wrapper)
    expect(values).not.toContain('VARIANTS')
  })

  it('renders VARIANTS option when allowVariants is true (PRODUCT_DISCOUNT)', () => {
    const wrapper = mountSection({ targetType: 'PRODUCTS', allowVariants: true })
    const values = getRadioValues(wrapper)
    expect(values).toEqual(
      expect.arrayContaining(['CATEGORIES', 'BRANDS', 'PRODUCTS', 'VARIANTS']),
    )
  })
})
