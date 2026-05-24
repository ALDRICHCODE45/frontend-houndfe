import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import NumericRangeFilter from '../NumericRangeFilter.vue'

const UInputNumberStub = defineComponent({
  name: 'InputNumber',
  props: { modelValue: Number },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-testid': 'input-number',
      value: props.modelValue ?? '',
      onInput: (event: Event) => {
        const value = (event.target as HTMLInputElement).value
        emit('update:modelValue', value === '' ? undefined : Number(value))
      },
    })
  },
})

function mountComponent(modelValue: { min?: number; max?: number } = {}, overrideProps: Record<string, unknown> = {}) {
  return mount(NumericRangeFilter, {
    props: { modelValue, label: 'Total', unit: '$', ...overrideProps },
    global: {
      stubs: {
        UInputNumber: UInputNumberStub,
        InputNumber: UInputNumberStub,
        UFormField: { props: ['error'], template: '<div><slot /><p data-testid="error">{{ error }}</p></div>' },
      },
    },
  })
}

describe('NumericRangeFilter', () => {
  it('renders with default props', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="numeric-range-filter"]').exists()).toBe(true)
  })

  it('emits raw numeric value when only min is set', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-min"]').setValue('100')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ min: 100 }])
  })

  it('emits raw numeric value when only max is set', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-max"]').setValue('500')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ max: 500 }])
  })

  it('supports displayDivisor mapping for display↔emit', async () => {
    const wrapper = mountComponent({}, { displayDivisor: 100 })

    await wrapper.get('[data-testid="numeric-min"]').setValue('100')
    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ min: 10000 }])
  })

  it('emits both min and max raw values', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-min"]').setValue('100')
    await wrapper.get('[data-testid="numeric-max"]').setValue('500')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ min: 100, max: 500 }])
  })

  it('shows validation error for inverted range', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-min"]').setValue('500')
    await wrapper.get('[data-testid="numeric-max"]').setValue('100')

    expect(wrapper.text()).toContain('El rango está invertido')
  })

  it('emits empty object when both inputs are empty', async () => {
    const wrapper = mountComponent({ min: 10000, max: 50000 })

    await wrapper.get('[data-testid="numeric-min"]').setValue('')
    await wrapper.get('[data-testid="numeric-max"]').setValue('')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{}])
  })

  it('treats zero as valid numeric bound', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-min"]').setValue('0')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ min: 0 }])
  })

  it('passes ARS currency format options to UInputNumber', () => {
    const wrapper = mount(NumericRangeFilter, {
      props: { modelValue: {}, label: 'Total' },
    })

    const numbers = wrapper.findAllComponents({ name: 'InputNumber' })
    expect(numbers.length).toBe(2)
    expect(numbers[0]?.props('formatOptions')).toEqual({ style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
  })

  it('disables increment/decrement buttons and shows range separator', () => {
    const wrapper = mount(NumericRangeFilter, { props: { modelValue: {}, label: 'Total' } })
    const numbers = wrapper.findAllComponents({ name: 'InputNumber' })
    expect(numbers[0]?.props('increment')).toBe(false)
    expect(numbers[0]?.props('decrement')).toBe(false)
    expect(wrapper.get('[data-testid="numeric-separator"]').text()).toBe('—')
  })

  it('uses w-full on both input roots', () => {
    const wrapper = mountComponent()
    const numbers = wrapper.findAllComponents({ name: 'InputNumber' })
    expect(numbers[0]?.classes()).toContain('w-full')
    expect(numbers[1]?.classes()).toContain('w-full')
  })
})
