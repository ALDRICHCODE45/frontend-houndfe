import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

function mountSection(props: {
  targetType: PromotionTargetType
  selectedItems?: PromotionTargetItemFormEntry[]
  side?: 'DEFAULT' | 'BUY' | 'GET'
  label?: string
}) {
  const queryClient = makeQueryClient()
  return mount(PromotionTargetItemsSection, {
    props: {
      targetType: props.targetType,
      selectedItems: props.selectedItems ?? [],
      side: props.side ?? 'DEFAULT',
      label: props.label,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: FULL_STUBS,
    },
  })
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
})
