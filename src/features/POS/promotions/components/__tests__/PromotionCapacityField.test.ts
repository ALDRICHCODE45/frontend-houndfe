import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromotionCapacityField from '../PromotionCapacityField.vue'
import { PROMOTION_CAPACITY_MODE } from '../../interfaces/promotion.types'

// ── Stubs ─────────────────────────────────────────────────────────────────────
//
// Nuxt UI's USwitch / UInputNumber are single-responsibility inputs. The stubs
// keep the contract explicit: the switch emits a boolean, the number input
// emits a number-or-null and never coerces strings silently.
// Nuxt UI v4 test gotcha: `unplugin-vue-components` rewrites `<UFormField>`
// etc. to the INTERNAL component name (`FormField`, `Switch`, `InputNumber`),
// so VTU stubs only match when BOTH the U-prefixed and internal keys are
// registered (same pattern as PromotionForm.test.ts for UAlert/Alert).
const formFieldStub = {
  inheritAttrs: false,
  props: ['label', 'name', 'hint', 'error'],
  template: '<div data-testid="form-field" :data-name="name"><slot /></div>',
}
const switchStub = {
  inheritAttrs: false,
  props: ['modelValue', 'disabled', 'ariaLabel'],
  emits: ['update:modelValue'],
  template:
    '<input type="checkbox" data-testid="capacity-switch" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
}
const inputNumberStub = {
  inheritAttrs: false,
  props: ['modelValue', 'min', 'max', 'step', 'disabled', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<input type="number" data-testid="capacity-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value === \'\' ? null : Number($event.target.value))" />',
}

const STUBS = {
  UFormField: formFieldStub,
  FormField: formFieldStub,
  USwitch: switchStub,
  Switch: switchStub,
  UInputNumber: inputNumberStub,
  InputNumber: inputNumberStub,
  PromotionCapacityStatus: {
    name: 'PromotionCapacityStatus',
    props: ['maxProductUnits', 'consumedProductUnits', 'remainingProductUnits', 'compact'],
    template:
      '<span data-testid="capacity-status-stub" :data-max="maxProductUnits" :data-consumed="consumedProductUnits" :data-remaining="remainingProductUnits" />',
  },
}

// Everything except UInputNumber is stubbed for the touch-target assertion: the
// real Nuxt UI component is globally registered, so `[data-slot="base"]` (the
// actual spinbutton) renders and can be measured against the 44px policy.
const STUBS_WITH_REAL_INPUT_NUMBER = {
  UFormField: formFieldStub,
  FormField: formFieldStub,
  USwitch: switchStub,
  Switch: switchStub,
  PromotionCapacityStatus: STUBS.PromotionCapacityStatus,
}

function mountField(props: Record<string, unknown> = {}) {
  return mount(PromotionCapacityField, {
    props: {
      modelValue: PROMOTION_CAPACITY_MODE.UNLIMITED,
      maxProductUnits: null,
      consumedProductUnits: 0,
      remainingProductUnits: null,
      editing: false,
      ...props,
    },
    global: { stubs: STUBS },
  })
}

describe('PromotionCapacityField', () => {
  it('renders the switch off when unlimited', () => {
    const wrapper = mountField({ modelValue: PROMOTION_CAPACITY_MODE.UNLIMITED })
    const input = wrapper.find('[data-testid="capacity-switch"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).checked).toBe(false)
  })

  it('emits limited when the user turns the switch on', async () => {
    const wrapper = mountField({ modelValue: PROMOTION_CAPACITY_MODE.UNLIMITED })
    await wrapper.find('[data-testid="capacity-switch"]').setValue(true)
    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted[0]![0]).toBe(PROMOTION_CAPACITY_MODE.LIMITED)
  })

  it('emits unlimited when the user turns the switch off', async () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
    })
    await wrapper.find('[data-testid="capacity-switch"]').setValue(false)
    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted[0]![0]).toBe(PROMOTION_CAPACITY_MODE.UNLIMITED)
  })

  it('shows the number input only when limited', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
    })
    expect(wrapper.find('[data-testid="capacity-input"]').exists()).toBe(true)
  })

  it('hides the number input when unlimited', () => {
    const wrapper = mountField({ modelValue: PROMOTION_CAPACITY_MODE.UNLIMITED })
    expect(wrapper.find('[data-testid="capacity-input"]').exists()).toBe(false)
  })

  it('gives the rendered spinbutton a 44px minimum touch target', () => {
    const wrapper = mount(PromotionCapacityField, {
      props: {
        modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
        maxProductUnits: 100,
        consumedProductUnits: 0,
        remainingProductUnits: null,
        editing: false,
      },
      global: { stubs: STUBS_WITH_REAL_INPUT_NUMBER },
    })

    // `[data-slot="base"]` is Nuxt UI's real input element, not a wrapper.
    const spinbutton = wrapper.get('input[data-slot="base"]')
    expect(spinbutton.classes()).toContain('min-h-11')
  })

  it('emits the numeric value without coercing strings', async () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
    })
    await wrapper.find('[data-testid="capacity-input"]').setValue('250')
    const emittedValue = wrapper.emitted('update:maxProductUnits')!
    expect(emittedValue[0]![0]).toBe(250)
    expect(typeof emittedValue[0]![0]).toBe('number')
  })

  it('promotes an untouched edit value to limited once the number changes', async () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.UNCHANGED,
      maxProductUnits: 100,
    })
    await wrapper.find('[data-testid="capacity-input"]').setValue('150')
    const emittedMode = wrapper.emitted('update:modelValue')!
    expect(emittedMode[0]![0]).toBe(PROMOTION_CAPACITY_MODE.LIMITED)
  })

  it('reflects the server cap when untouched in edit mode (unchanged)', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.UNCHANGED,
      maxProductUnits: 40,
    })
    const input = wrapper.find('[data-testid="capacity-switch"]')
    expect((input.element as HTMLInputElement).checked).toBe(true)
  })

  it('shows read-only consumed context while editing', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
      consumedProductUnits: 30,
      editing: true,
    })
    expect(wrapper.find('[data-testid="capacity-consumed-context"]').text()).toContain('30')
  })

  it('renders the server status in finite edit mode without altering its counters', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
      consumedProductUnits: 30,
      remainingProductUnits: 70,
      editing: true,
    })
    const status = wrapper.find('[data-testid="capacity-status-stub"]')
    expect(status.exists()).toBe(true)
    expect(status.attributes('data-max')).toBe('100')
    expect(status.attributes('data-consumed')).toBe('30')
    expect(status.attributes('data-remaining')).toBe('70')
  })

  it('renders the server status in unlimited edit mode', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.UNLIMITED,
      maxProductUnits: null,
      consumedProductUnits: 4,
      remainingProductUnits: null,
      editing: true,
    })
    expect(wrapper.find('[data-testid="capacity-status-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="capacity-input"]').exists()).toBe(false)
  })

  it('hides the server status outside edit mode', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 100,
      editing: false,
    })
    expect(wrapper.find('[data-testid="capacity-status-stub"]').exists()).toBe(false)
  })

  it('surfaces a limit-below-consumed warning when server values are available', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 10,
      consumedProductUnits: 30,
      editing: true,
    })
    expect(wrapper.find('[data-testid="capacity-limit-error"]').exists()).toBe(true)
  })

  it('does not warn when the limit is above consumed', () => {
    const wrapper = mountField({
      modelValue: PROMOTION_CAPACITY_MODE.LIMITED,
      maxProductUnits: 50,
      consumedProductUnits: 30,
      editing: true,
    })
    expect(wrapper.find('[data-testid="capacity-limit-error"]').exists()).toBe(false)
  })

  it('names the field for UForm error binding', () => {
    const wrapper = mountField()
    expect(wrapper.find('[data-testid="form-field"]').attributes('data-name')).toBe(
      'maxProductUnits',
    )
  })
})
