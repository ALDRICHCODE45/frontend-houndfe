import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import PromotionForm from '../PromotionForm.vue'
import type { PromotionType } from '../../interfaces/promotion.types'

// ── Stubs ─────────────────────────────────────────────────────────────────────

const FULL_STUBS = {
  UCard: {
    inheritAttrs: false,
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  UForm: {
    inheritAttrs: false,
    props: ['state', 'schema'],
    emits: ['submit'],
    template: '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
  },
  UFormField: {
    props: ['label', 'name'],
    template: '<div><label>{{ label }}</label><slot /></div>',
  },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USelect: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option></select>',
  },
  UCheckbox: {
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  },
  UBadge: {
    props: ['color'],
    template: '<span><slot /></span>',
  },
  UIcon: { template: '<span />' },
  UButton: {
    props: ['type', 'loading'],
    template: '<button :type="type || \'button\'"><slot /></button>',
  },
  // Child section components — stub them to avoid deep rendering
  PromotionConditionsSection: {
    props: ['modelValue', 'mode'],
    emits: ['update:modelValue'],
    template: '<div data-testid="conditions-section" />',
  },
  PromotionTargetItemsSection: {
    props: ['targetType', 'selectedItems', 'side', 'label'],
    emits: ['update:targetType', 'update:selectedItems'],
    template: '<div data-testid="target-items-section" />',
  },
  PromotionSummaryCard: {
    props: ['formState'],
    template: '<div data-testid="summary-card" />',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

function mountForm(
  type: PromotionType,
  props: Record<string, unknown> = {},
) {
  const queryClient = makeQueryClient()
  return mount(PromotionForm, {
    props: {
      type,
      mode: 'create' as const,
      initialData: null,
      loading: false,
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: FULL_STUBS,
    },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PromotionForm', () => {
  // ── Shared rendering ────────────────────────────────────────────────────
  it('mounts without error for PRODUCT_DISCOUNT', () => {
    expect(mountForm('PRODUCT_DISCOUNT').exists()).toBe(true)
  })

  it('mounts without error for ORDER_DISCOUNT', () => {
    expect(mountForm('ORDER_DISCOUNT').exists()).toBe(true)
  })

  it('mounts without error for BUY_X_GET_Y', () => {
    expect(mountForm('BUY_X_GET_Y').exists()).toBe(true)
  })

  it('mounts without error for ADVANCED', () => {
    expect(mountForm('ADVANCED').exists()).toBe(true)
  })

  it('renders title input field', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="title-input"]').exists()).toBe(true)
  })

  it('renders type badge for PRODUCT_DISCOUNT', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="type-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="type-badge"]').text()).toContain('Descuento en productos')
  })

  it('renders type badge for ORDER_DISCOUNT', () => {
    const wrapper = mountForm('ORDER_DISCOUNT')
    expect(wrapper.find('[data-testid="type-badge"]').text()).toContain('Descuento en pedido')
  })

  it('renders conditions section always', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="conditions-section"]').exists()).toBe(true)
  })

  it('renders summary card always', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="summary-card"]').exists()).toBe(true)
  })

  // ── Method selector ──────────────────────────────────────────────────────
  it('renders automatic method card', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="method-card-AUTOMATIC"]').exists()).toBe(true)
  })

  it('renders manual method card', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="method-card-MANUAL"]').exists()).toBe(true)
  })

  // ── Type-specific sections ───────────────────────────────────────────────
  it('shows discount type section for PRODUCT_DISCOUNT', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="product-discount-section"]').exists()).toBe(true)
  })

  it('does NOT show product discount section for ORDER_DISCOUNT', () => {
    const wrapper = mountForm('ORDER_DISCOUNT')
    expect(wrapper.find('[data-testid="product-discount-section"]').exists()).toBe(false)
  })

  it('shows order discount section for ORDER_DISCOUNT', () => {
    const wrapper = mountForm('ORDER_DISCOUNT')
    expect(wrapper.find('[data-testid="order-discount-section"]').exists()).toBe(true)
  })

  it('shows buy x get y section for BUY_X_GET_Y', () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    expect(wrapper.find('[data-testid="buy-x-get-y-section"]').exists()).toBe(true)
  })

  it('shows advanced section for ADVANCED', () => {
    const wrapper = mountForm('ADVANCED')
    expect(wrapper.find('[data-testid="advanced-section"]').exists()).toBe(true)
  })

  it('does NOT show advanced section for PRODUCT_DISCOUNT', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="advanced-section"]').exists()).toBe(false)
  })

  // ── BUY_X_GET_Y presets ──────────────────────────────────────────────────
  it('renders 2x1 preset button for BUY_X_GET_Y', () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    expect(wrapper.find('[data-testid="preset-2x1"]').exists()).toBe(true)
  })

  it('renders 3x2 preset button for BUY_X_GET_Y', () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    expect(wrapper.find('[data-testid="preset-3x2"]').exists()).toBe(true)
  })

  // ── S18/S19: Method selection ────────────────────────────────────────────
  // Method selection is verified via DOM class changes (selected style class)
  // The form state is tested in usePromotionForm unit tests
  it('S18: AUTOMATIC method card is selected by default (initial state)', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    const automaticCard = wrapper.find('[data-testid="method-card-AUTOMATIC"]')
    // Selected card has primary border class (from PromotionForm.vue class binding)
    expect(automaticCard.classes()).toContain('border-primary')
  })

  it('S18: AUTOMATIC method card loses selected style when MANUAL is clicked', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    await wrapper.find('[data-testid="method-card-MANUAL"]').trigger('click')
    await wrapper.vm.$nextTick()
    // AUTOMATIC card no longer selected
    expect(wrapper.find('[data-testid="method-card-AUTOMATIC"]').classes()).not.toContain('border-primary')
  })

  it('S19: MANUAL method card shows selected style after click', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    const manualCard = wrapper.find('[data-testid="method-card-MANUAL"]')
    // Not selected initially
    expect(manualCard.classes()).not.toContain('border-primary')
    await manualCard.trigger('click')
    await wrapper.vm.$nextTick()
    // Now selected
    expect(manualCard.classes()).toContain('border-primary')
  })

  it('S19: clicking MANUAL then AUTOMATIC restores AUTOMATIC as selected', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    await wrapper.find('[data-testid="method-card-MANUAL"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="method-card-AUTOMATIC"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="method-card-AUTOMATIC"]').classes()).toContain('border-primary')
    expect(wrapper.find('[data-testid="method-card-MANUAL"]').classes()).not.toContain('border-primary')
  })

  // ── S25/S26: BUY_X_GET_Y preset autofill ─────────────────────────────────
  // Preset button clicks update input values reactively
  it('S25: clicking 2x1 preset sets buyQuantity and getQuantity inputs', async () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    await wrapper.find('[data-testid="preset-2x1"]').trigger('click')
    await wrapper.vm.$nextTick()
    // buyQuantity and getQuantity are UInputNumber, getDiscountPercent is now a USelect
    const inputValues = wrapper.findAll('input').map((i) => i.element.value)
    expect(inputValues).toContain('2') // buyQuantity
    expect(inputValues).toContain('1') // getQuantity
    // getDiscountPercent is a select (not an input), so we don't check input values for it
  })

  it('S26: clicking 3x2 preset sets buyQuantity=3, getQuantity=2 in input values', async () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    await wrapper.find('[data-testid="preset-3x2"]').trigger('click')
    await wrapper.vm.$nextTick()
    const inputValues = wrapper.findAll('input').map((i) => i.element.value)
    expect(inputValues).toContain('3') // buyQuantity
    expect(inputValues).toContain('2') // getQuantity
  })

  // ── S44: Edit mode shows method as read-only badge ───────────────────────
  it('S44: in edit mode, method selector cards are hidden and readonly badge is shown', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT', { mode: 'edit' as const })
    expect(wrapper.find('[data-testid="method-card-AUTOMATIC"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="method-card-MANUAL"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="method-readonly"]').exists()).toBe(true)
  })

  // ── Emit submit ──────────────────────────────────────────────────────────
  it('emits cancel when cancel button is clicked', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    await wrapper.find('[data-testid="cancel-btn"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
