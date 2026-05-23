import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NumericRangeFilter from '../NumericRangeFilter.vue'

const UInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

function mountComponent(modelValue: { min?: number; max?: number } = {}) {
  return mount(NumericRangeFilter, {
    props: { modelValue, label: 'Total', unit: '$' },
    global: {
      stubs: {
        UInput: UInputStub,
      },
    },
  })
}

describe('NumericRangeFilter', () => {
  it('emits cents when only min is set', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-min"]').setValue('100')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ min: 10000 }])
  })

  it('emits cents when only max is set', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-max"]').setValue('500')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ max: 50000 }])
  })

  it('emits both min and max in cents', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="numeric-min"]').setValue('100')
    await wrapper.get('[data-testid="numeric-max"]').setValue('500')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ min: 10000, max: 50000 }])
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
})
