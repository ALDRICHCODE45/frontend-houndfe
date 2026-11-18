import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import PromotionForm from '../PromotionForm.vue'
import type { PromotionFormState, PromotionType } from '../../interfaces/promotion.types'
import { toCreatePayload } from '../../composables/usePromotionForm'

/** A «Cómo se aplica» radio card by method value. */
const method = (wrapper: Pick<VueWrapper, 'get'>, value: string) =>
  wrapper.get(`[role="radio"][data-value="${value}"]`)
/** The «Cómo se aplica» radiogroup (the one holding the AUTOMATIC card). */
const methodGroup = (wrapper: Pick<VueWrapper, 'get'>) =>
  method(wrapper, 'AUTOMATIC').element.closest<HTMLElement>('[role="radiogroup"]')!

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
    template:
      '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
  },
  UFormField: {
    props: ['label', 'name'],
    template: '<div><label>{{ label }}</label><slot /></div>',
  },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USelect: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option></select>',
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
  // Capacity editor (PCA-1) — stubbed to keep this suite focused on the
  // form's type-specific sections instead of the shared capacity controls.
  PromotionCapacityField: {
    props: [
      'modelValue',
      'maxProductUnits',
      'consumedProductUnits',
      'remainingProductUnits',
      'editing',
    ],
    emits: ['update:modelValue', 'update:maxProductUnits'],
    template: '<div data-testid="capacity-field-stub" />',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MIN_SWITCH = '[role="switch"][data-testid="min-purchase-switch"]'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

function mountForm(type: PromotionType, props: Record<string, unknown> = {}) {
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
  it('renders the automatic and manual method cards with their explanations', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    expect(method(wrapper, 'AUTOMATIC').text()).toContain('Aplicar automáticamente')
    expect(method(wrapper, 'AUTOMATIC').text()).toContain('Se aplicará si se cumplen las condiciones')
    expect(method(wrapper, 'MANUAL').text()).toContain('Manualmente')
    expect(method(wrapper, 'MANUAL').text()).toContain('Tú eliges si deseas aplicar el descuento')
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
  // T8 D5: «Cómo se aplica» is an HfRadioCards radiogroup; the chosen card is
  // aria-checked (hover only rings the mark, it never paints the selected look).
  it('S18: «Cómo se aplica» is a radiogroup of two radio cards, AUTOMATIC chosen by default', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    const group = methodGroup(wrapper)
    const labelId = group.getAttribute('aria-labelledby')!
    expect(wrapper.get(`[id="${labelId}"]`).text()).toBe('Cómo se aplica')
    const radios = [...group.querySelectorAll('[role="radio"]')]
    expect(radios.map((radio) => radio.getAttribute('data-value'))).toEqual(['AUTOMATIC', 'MANUAL'])
    expect(method(wrapper, 'AUTOMATIC').attributes('aria-checked')).toBe('true')
    expect(method(wrapper, 'MANUAL').attributes('aria-checked')).toBe('false')
    expect(method(wrapper, 'AUTOMATIC').attributes('tabindex')).toBe('0')
    expect(method(wrapper, 'MANUAL').attributes('tabindex')).toBe('-1')
    expect(wrapper.html()).not.toContain('promotions-choice')
  })

  it('S18: AUTOMATIC is no longer checked when MANUAL is clicked', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    await method(wrapper, 'MANUAL').trigger('click')
    expect(method(wrapper, 'AUTOMATIC').attributes('aria-checked')).toBe('false')
  })

  it('S19: MANUAL is checked after click', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    await method(wrapper, 'MANUAL').trigger('click')
    expect(method(wrapper, 'MANUAL').attributes('aria-checked')).toBe('true')
  })

  it('S19: arrow keys move the choice between the radio cards', async () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    await method(wrapper, 'AUTOMATIC').trigger('keydown', { key: 'ArrowDown' })
    expect(method(wrapper, 'MANUAL').attributes('aria-checked')).toBe('true')
    await method(wrapper, 'MANUAL').trigger('keydown', { key: 'ArrowUp' })
    expect(method(wrapper, 'AUTOMATIC').attributes('aria-checked')).toBe('true')
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
    expect(wrapper.find('[role="radio"][data-value="AUTOMATIC"]').exists()).toBe(false)
    expect(wrapper.find('[role="radio"][data-value="MANUAL"]').exists()).toBe(false)
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

// ── T4 review round 1 ─────────────────────────────────────────────────────────

describe('PromotionForm — review round 1', () => {
  it('uses sentence case for field and section labels', () => {
    const product = mountForm('PRODUCT_DISCOUNT')
    expect(product.text()).toContain('Nombre de la promoción')
    expect(product.text()).toContain('Valor del descuento')
    expect(product.text()).not.toMatch(/Nombre de la Promoción|Valor del Descuento/)

    const bxgy = mountForm('BUY_X_GET_Y')
    expect(bxgy.text()).toContain('Tipo de promoción')
    expect(bxgy.text()).not.toContain('Tipo de Promoción')
  })

  it('stacks the method cards on mobile so "Aplicar automáticamente" never overflows', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    const grid = methodGroup(wrapper)
    expect(grid.classList.contains('grid-cols-1')).toBe(true)
    expect(grid.classList.contains('sm:grid-cols-2')).toBe(true)
  })

  // T8 D5: below lg the summary is not hidden; it follows the form in the stacked column.
  it('shows the summary at every width (after the form below lg, the rail at lg)', () => {
    const wrapper = mountForm('PRODUCT_DISCOUNT')
    const rail = wrapper.get('[data-testid="summary-card"]').element.parentElement!
    expect(rail.className).not.toMatch(/(^|\s)hidden(\s|$)/)
  })

  it('agrees the overlap alert count in number', () => {
    const source = readFileSync(resolve(__dirname, '../PromotionForm.vue'), 'utf8')
    expect(source).not.toContain('objetivo(s)')
  })

  it('names the quick combinations in Spanish', () => {
    const wrapper = mountForm('BUY_X_GET_Y')
    expect(wrapper.text()).toContain('Combinaciones rápidas')
    expect(wrapper.text()).not.toContain('Presets')
  })
})

// T22/S18: the value and the minimum purchase are typed as text and read with
// the one money rule (`70,55` is 70.55, never 7055); a percent reads the same way.
describe('PromotionForm — typed amounts', () => {
  // The real UForm validates the schema before emitting; give it the other required answers.
  async function submitted(wrapper: ReturnType<typeof mountForm>) {
    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    const state = wrapper.emitted<[PromotionFormState]>('submit')?.[0]?.[0]
    if (!state) throw new Error('submit not emitted')
    return toCreatePayload(state) as unknown as Record<string, unknown>
  }

  // The discount type comes hydrated (a saved promotion), because the real
  // USelect listbox cannot be driven from jsdom.
  function mountWithDiscountType(type: 'PRODUCT_DISCOUNT' | 'ORDER_DISCOUNT', discountType: 'FIXED' | 'PERCENTAGE') {
    return mountForm(type, {
      mode: 'edit' as const,
      initialData: {
        id: 'promo-1',
        title: 'Promo de prueba',
        type,
        method: 'AUTOMATIC' as const,
        status: 'ACTIVE' as const,
        startDate: null,
        endDate: null,
        customerScope: 'ALL' as const,
        discountType,
        discountValue: null,
        minPurchaseAmountCents: null,
        appliesTo: type === 'PRODUCT_DISCOUNT' ? ('CATEGORIES' as const) : null,
        buyQuantity: null,
        getQuantity: null,
        getDiscountPercent: null,
        buyTargetType: null,
        getTargetType: null,
        targetItems:
          type === 'PRODUCT_DISCOUNT'
            ? [{ id: 'ti-1', side: 'DEFAULT' as const, targetType: 'CATEGORIES' as const, targetId: 'cat-A' }]
            : [],
        customers: [],
        priceLists: [],
        daysOfWeek: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
  }

  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('PRODUCT_DISCOUNT sends a fixed value typed as %j as %i cents', async (text, cents) => {
    const wrapper = mountWithDiscountType('PRODUCT_DISCOUNT', 'FIXED')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue(text)
    expect((await submitted(wrapper)).discountValue).toBe(cents)
  })

  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('ORDER_DISCOUNT sends a fixed value and a minimum typed as %j as %i cents', async (text, cents) => {
    const wrapper = mountWithDiscountType('ORDER_DISCOUNT', 'FIXED')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue(text)
    await wrapper.get(MIN_SWITCH).trigger('click')
    await wrapper.get('[data-testid="promotion-min-purchase"]').setValue(text)
    const payload = await submitted(wrapper)
    expect(payload.discountValue).toBe(cents)
    expect(payload.minPurchaseAmountCents).toBe(cents)
  })

  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['15', 15],
  ])('sends a percent typed as %j as %d', async (text, percent) => {
    const wrapper = mountWithDiscountType('PRODUCT_DISCOUNT', 'PERCENTAGE')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue(text)
    expect((await submitted(wrapper)).discountValue).toBe(percent)
  })

  it('does not submit while a typed amount does not parse', async () => {
    const wrapper = mountWithDiscountType('PRODUCT_DISCOUNT', 'FIXED')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue('1,23,4')
    await wrapper.get('[data-testid="promotion-discount-value"]').trigger('blur')
    expect(wrapper.text()).toContain('Escribe el monto con punto para los centavos, por ejemplo 70.55.')
    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  // A hidden money field remounts clean, so its last parse error must go with it.
  it('drops the fixed value error when the field is hidden and shown again', async () => {
    const wrapper = mountWithDiscountType('PRODUCT_DISCOUNT', 'FIXED')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue('150')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue('1,23,4')
    await wrapper.get('[data-testid="promotion-discount-value"]').trigger('blur')

    const vm = wrapper.vm as unknown as { formState: { discountType: string } }
    vm.formState.discountType = 'PERCENTAGE'
    await flushPromises()
    vm.formState.discountType = 'FIXED'
    await flushPromises()

    expect((wrapper.get('[data-testid="promotion-discount-value"]').element as HTMLInputElement).value).toBe('150.00')
    expect((await submitted(wrapper)).discountValue).toBe(15000)
  })

  it('drops the minimum purchase error when the field is hidden and shown again', async () => {
    const wrapper = mountWithDiscountType('ORDER_DISCOUNT', 'FIXED')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue('150')
    await wrapper.get(MIN_SWITCH).trigger('click')
    await wrapper.get('[data-testid="promotion-min-purchase"]').setValue('1000')
    await wrapper.get('[data-testid="promotion-min-purchase"]').setValue('1,23,4')
    await wrapper.get('[data-testid="promotion-min-purchase"]').trigger('blur')

    await wrapper.get(MIN_SWITCH).trigger('click')
    await flushPromises()
    await wrapper.get(MIN_SWITCH).trigger('click')
    await flushPromises()

    expect((wrapper.get('[data-testid="promotion-min-purchase"]').element as HTMLInputElement).value).toBe('1000.00')
    expect((await submitted(wrapper)).minPurchaseAmountCents).toBe(100000)
  })

  it('does not submit while a typed percent does not parse', async () => {
    const wrapper = mountWithDiscountType('PRODUCT_DISCOUNT', 'PERCENTAGE')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue('0,100')
    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  // T4b/S1: the minimum is a whole-row switch; the payload is the one the checkbox sent.
  it('sends the same ORDER_DISCOUNT payload after turning the minimum on with its switch row', async () => {
    const wrapper = mountWithDiscountType('ORDER_DISCOUNT', 'FIXED')
    await wrapper.get('[data-testid="promotion-discount-value"]').setValue('150')
    await wrapper.get(MIN_SWITCH).trigger('click')
    await wrapper.get('[data-testid="promotion-min-purchase"]').setValue('1,000.50')
    expect(await submitted(wrapper)).toEqual({
      title: 'Promo de prueba',
      method: 'AUTOMATIC',
      maxProductUnits: null,
      customerIds: [],
      priceListIds: [],
      daysOfWeek: [],
      type: 'ORDER_DISCOUNT',
      discountType: 'FIXED',
      discountValue: 15000,
      minPurchaseAmountCents: 100050,
    })
  })
})

describe('PromotionForm — selection without checkboxes (T4b)', () => {
  it('shows the minimum purchase as a whole-row switch that reveals the amount', async () => {
    const wrapper = mountForm('ORDER_DISCOUNT')
    const row = wrapper.get(MIN_SWITCH)
    expect(row.element.tagName).toBe('BUTTON')
    expect(row.attributes('aria-checked')).toBe('false')
    expect(row.text()).toContain('Añadir monto mínimo de compra')
    expect(wrapper.find('[data-testid="promotion-min-purchase"]').exists()).toBe(false)

    await row.trigger('click')
    expect(wrapper.get(MIN_SWITCH).attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="promotion-min-purchase"]').exists()).toBe(true)
    expect(wrapper.html()).not.toMatch(/\bpl-6\b/)
  })

  it.each(['PRODUCT_DISCOUNT', 'ORDER_DISCOUNT', 'BUY_X_GET_Y', 'ADVANCED'] as const)(
    '%s leaves no checkbox and groups its fields in section cards',
    async (type) => {
      const wrapper = mountForm(type)
      if (type === 'ORDER_DISCOUNT') await wrapper.get(MIN_SWITCH).trigger('click')
      // T6d: the WhatsApp option is a whole-row switch too, so no checkbox input is left at all.
      expect(wrapper.findAll('[role="checkbox"], input[type="checkbox"]')).toHaveLength(0)
      expect(wrapper.get('[role="switch"][data-testid="bot-eligible-switch"]').element.tagName).toBe('BUTTON')
      const cards = wrapper.findAll('section.hf-section-card')
      expect(cards.length).toBe(2)
      expect(cards[0]!.find('[data-testid="type-badge"]').exists()).toBe(true)
    },
  )
})
