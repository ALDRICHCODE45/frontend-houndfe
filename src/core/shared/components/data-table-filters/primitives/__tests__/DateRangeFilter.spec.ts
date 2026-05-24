import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import DateRangeFilter from '../DateRangeFilter.vue'

const CalendarStub = {
  name: 'Calendar',
  props: ['modelValue', 'range'],
  emits: ['update:modelValue'],
  template: '<div data-testid="calendar-stub" />',
}

function mountComponent(modelValue: { from?: string; to?: string } = {}) {
  return mount(DateRangeFilter, {
    props: {
      modelValue,
      label: 'Fecha de confirmación',
    },
    global: {
      stubs: {
        UCalendar: CalendarStub,
        Calendar: CalendarStub,
        'u-calendar': CalendarStub,
        UPopover: { template: '<div><slot /><slot name="content" /></div>' },
        Popover: { template: '<div><slot /><slot name="content" /></div>' },
        UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
        Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
        UFormField: { template: '<div><slot /></div>' },
        FormField: { template: '<div><slot /></div>' },
        UCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
      },
    },
  })
}

describe('DateRangeFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits only from when from is selected', async () => {
    const wrapper = mountComponent()

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 1, 1) })
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ from: '2026-01-01T00:00:00.000Z' }])
  })

  it('emits only to with end-of-day UTC', async () => {
    const wrapper = mountComponent()

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { end: new CalendarDate(2026, 1, 31) })
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ to: '2026-01-31T23:59:59.999Z' }])
  })

  it('emits both from/to when complete range is selected', async () => {
    const wrapper = mountComponent()

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 1, 1) })
    calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 1, 1), end: new CalendarDate(2026, 1, 31) })
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([
      {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
      },
    ])
  })

  it('emits empty object when dates are cleared', async () => {
    const wrapper = mountComponent({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.999Z' })

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', undefined)
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{}])
  })

  it('supports end-of-day boundary precision', async () => {
    const wrapper = mountComponent()

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { end: new CalendarDate(2026, 2, 15) })
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]?.[0]).toEqual({
      to: '2026-02-15T23:59:59.999Z',
    })
  })

  it('shows formatted range placeholder/label in trigger', async () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Seleccionar fechas')

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 2, 15), end: new CalendarDate(2026, 2, 20) })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('15 feb 2026')
  })

  it('applies today preset and emits start/end in ISO', async () => {
    const wrapper = mount(DateRangeFilter, {
      props: { modelValue: {}, label: 'Fecha', presets: true },
      global: { stubs: { UCalendar: CalendarStub, UPopover: { template: '<div><slot /><slot name="content" /></div>' }, Popover: { template: '<div><slot /><slot name="content" /></div>' }, UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }, Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }, UFormField: { template: '<div><slot /></div>' } } },
    })

    const presets = wrapper.findAll('[data-testid="date-preset"]')
    expect(presets.length).toBeGreaterThan(0)
    await presets[0]!.trigger('click')
    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]?.[0]).toEqual({ from: '2026-03-15T00:00:00.000Z', to: '2026-03-15T23:59:59.999Z' })
  })
})
