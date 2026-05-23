import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DateRangeFilter from '../DateRangeFilter.vue'

const UInputStub = {
  props: ['modelValue', 'type'],
  emits: ['update:modelValue'],
  template: '<input :type="type || \"text\"" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

function mountComponent(modelValue: { from?: string; to?: string } = {}) {
  return mount(DateRangeFilter, {
    props: {
      modelValue,
      label: 'Fecha de confirmación',
    },
    global: {
      stubs: {
        UInput: UInputStub,
      },
    },
  })
}

describe('DateRangeFilter', () => {
  it('emits only from when from is selected', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="date-from"]').setValue('2026-01-01')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ from: '2026-01-01T00:00:00.000Z' }])
  })

  it('emits only to with end-of-day UTC', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="date-to"]').setValue('2026-01-31')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ to: '2026-01-31T23:59:59.999Z' }])
  })

  it('emits both from/to when complete range is selected', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="date-from"]').setValue('2026-01-01')
    await wrapper.get('[data-testid="date-to"]').setValue('2026-01-31')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([
      {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
      },
    ])
  })

  it('shows error for inverted range', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="date-from"]').setValue('2026-06-01')
    await wrapper.get('[data-testid="date-to"]').setValue('2026-05-01')

    expect(wrapper.text()).toContain('El rango está invertido')
  })

  it('emits empty object when dates are cleared', async () => {
    const wrapper = mountComponent({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.999Z' })

    await wrapper.get('[data-testid="date-from"]').setValue('')
    await wrapper.get('[data-testid="date-to"]').setValue('')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{}])
  })

  it('supports end-of-day boundary precision', async () => {
    const wrapper = mountComponent()

    await wrapper.get('[data-testid="date-to"]').setValue('2026-02-15')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]?.[0]).toEqual({
      to: '2026-02-15T23:59:59.999Z',
    })
  })
})
