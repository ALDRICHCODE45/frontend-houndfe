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
  // Non-blocking overlap warning (advanced-promotion-type WU-A). The actual
  // visibility is driven by the form's `overlappingTargets` computed; the
  // stub renders the message content so the test can assert text presence.
  // Nuxt UI v4 test gotcha: stubs use INTERNAL un-prefixed names — register
  // both `UAlert` and `Alert` keys to cover Nuxt UI's naming convention.
  UAlert: {
    inheritAttrs: false,
    props: ['title', 'color', 'icon', 'description'],
    template:
      '<div data-testid="overlap-alert"><slot /><slot name="title" />{{ title }}<slot name="description" />{{ description }}</div>',
  },
  Alert: {
    inheritAttrs: false,
    props: ['title', 'color', 'icon', 'description'],
    template:
      '<div data-testid="overlap-alert"><slot /><slot name="title" />{{ title }}<slot name="description" />{{ description }}</div>',
  },
  // Child section components — stub them to avoid deep rendering
  PromotionConditionsSection: {
    props: ['modelValue', 'mode'],
    emits: ['update:modelValue'],
    template: '<div data-testid="conditions-section" />',
  },
  PromotionTargetItemsSection: {
    name: 'PromotionTargetItemsSection',
    props: ['targetType', 'selectedItems', 'side', 'label', 'allowVariants'],
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

  // ── S25/S26: BUY_X_GET_Y preset autofill (REQ-10 locked table) ────────────
  // Preset button clicks update input values reactively.
  // Per the locked REQ-10 table:
  //   2x1 → buyQuantity=1, getQuantity=1
  //   3x2 → buyQuantity=2, getQuantity=1
  it('S25: clicking 2x1 preset sets buyQuantity=1 and getQuantity=1 in inputs', async () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    await wrapper.find('[data-testid="preset-2x1"]').trigger('click')
    await wrapper.vm.$nextTick()
    // buyQuantity and getQuantity are UInputNumber, getDiscountPercent is a USelect
    const inputValues = wrapper.findAll('input').map((i) => i.element.value)
    // Both fields carry value "1" — assert at least two occurrences.
    const oneCount = inputValues.filter((v) => v === '1').length
    expect(oneCount).toBeGreaterThanOrEqual(2) // buyQuantity=1 + getQuantity=1
  })

  it('S26: clicking 3x2 preset sets buyQuantity=2 and getQuantity=1 in inputs', async () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    await wrapper.find('[data-testid="preset-3x2"]').trigger('click')
    await wrapper.vm.$nextTick()
    const inputValues = wrapper.findAll('input').map((i) => i.element.value)
    expect(inputValues).toContain('2') // buyQuantity
    expect(inputValues).toContain('1') // getQuantity
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

  // ── REQ-1 MODIFIED: BXGY card must expose VARIANTS as a target option ──────
  // PromotionTargetItemsSection only renders the variant accordion when
  // `allow-variants="true"` is passed in. BXGY previously omitted this
  // prop, hiding VARIANTS as a valid target. The form must now pass it
  // (parity with PRODUCT_DISCOUNT).
  it('REQ-1 (BXGY): BUY_X_GET_Y card passes allow-variants=true to PromotionTargetItemsSection', () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    const section = wrapper.findComponent({ name: 'PromotionTargetItemsSection' })
    expect(section.exists()).toBe(true)
    expect(section.props('allowVariants')).toBe(true)
  })

  it('REQ-1 (PRODUCT_DISCOUNT parity): PRODUCT_DISCOUNT card still passes allow-variants=true', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    const section = wrapper.findComponent({ name: 'PromotionTargetItemsSection' })
    expect(section.exists()).toBe(true)
    expect(section.props('allowVariants')).toBe(true)
  })

  // ── advanced-promotion-type WU-A: VARIANTS enabled on ADVANCED BUY + GET ───
  // Spec (Delta 1 / MODIFIED Target Type Union Includes VARIANTS):
  // ADVANCED must expose VARIANTS as a selectable target type on BOTH the
  // BUY and GET sides — previously it was hidden. The form achieves this
  // by passing `:allow-variants="true"` to BOTH `PromotionTargetItemsSection`
  // instances inside the ADVANCED card.

  it('REQ-1 (ADVANCED BUY): ADVANCED card passes allow-variants=true to the BUY-side PromotionTargetItemsSection', () => {
    const wrapper = mountForm('ADVANCED')
    const sections = wrapper.findAllComponents({ name: 'PromotionTargetItemsSection' })
    expect(sections.length).toBeGreaterThanOrEqual(2)
    const buy = sections.find((s) => s.props('side') === 'BUY')
    expect(buy).toBeDefined()
    expect(buy!.props('allowVariants')).toBe(true)
  })

  it('REQ-1 (ADVANCED GET): ADVANCED card passes allow-variants=true to the GET-side PromotionTargetItemsSection', () => {
    const wrapper = mountForm('ADVANCED')
    const sections = wrapper.findAllComponents({ name: 'PromotionTargetItemsSection' })
    const get = sections.find((s) => s.props('side') === 'GET')
    expect(get).toBeDefined()
    expect(get!.props('allowVariants')).toBe(true)
  })

  // ── Non-blocking disjoint overlap warning UI (A4.2) ─────────────────────────
  // Spec (Delta 1 / REQ: Client-Side Disjoint BUY∩GET Validation):
  // A non-blocking UAlert renders when the same {targetType, targetId} appears
  // on both BUY and GET sides. Submit is STILL allowed — the backend is the
  // authoritative gate.
  //
  // We drive state through the `initialData` (edit mode) hydration path
  // because `formState` is a `<script setup>` reactive variable that's not
  // exposed on the component instance — emitting from the stubbed
  // PromotionTargetItemsSection is the cleanest mutation channel here.

  function makeAdvancedInitialData(overlap: 'shared' | 'disjoint') {
    return {
      id: 'promo-1',
      title: 'Overlap test',
      type: 'ADVANCED' as const,
      method: 'AUTOMATIC' as const,
      status: 'ACTIVE' as const,
      startDate: null,
      endDate: null,
      customerScope: 'ALL' as const,
      discountType: null,
      discountValue: null,
      minPurchaseAmountCents: null,
      appliesTo: null,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 100,
      buyTargetType: 'CATEGORIES' as const,
      getTargetType: 'CATEGORIES' as const,
      targetItems: [
        { id: 'ti-1', side: 'BUY' as const, targetType: 'CATEGORIES' as const, targetId: 'cat-A' },
        {
          id: 'ti-2',
          side: 'GET' as const,
          targetType: 'CATEGORIES' as const,
          targetId: overlap === 'shared' ? 'cat-A' : 'cat-B',
        },
      ],
      customers: [],
      priceLists: [],
      daysOfWeek: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
  }

  it('A4.2: ADVANCED form renders a non-blocking UAlert when BUY and GET share a target', () => {
    const wrapper = mountForm('ADVANCED', {
      mode: 'edit' as const,
      initialData: makeAdvancedInitialData('shared'),
    })
    // Find by data-testid (stub-rendered attr) — most robust against stub
    // naming conventions. The stub renders `data-testid="overlap-alert"`
    // when v-if=overlappingTargets.length>0 triggers.
    const alert = wrapper.find('[data-testid="overlap-alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('superponerse')

    // The submit button MUST still be present (non-blocking).
    const submit = wrapper.find('[data-testid="submit-btn"]')
    expect(submit.exists()).toBe(true)
  })

  it('A4.2: ADVANCED form does NOT render the overlap UAlert when BUY and GET are disjoint', () => {
    const wrapper = mountForm('ADVANCED', {
      mode: 'edit' as const,
      initialData: makeAdvancedInitialData('disjoint'),
    })
    const alert = wrapper.find('[data-testid="overlap-alert"]')
    expect(alert.exists()).toBe(false)
  })
})
