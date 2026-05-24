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

const PopoverStub = {
  name: 'UPopover',
  data: () => ({ open: false }),
  template: '<div><div data-testid="popover-trigger" @click="open = !open"><slot /></div><div v-if="open" data-testid="popover-content"><slot name="content" /></div></div>',
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
        UPopover: PopoverStub,
        Popover: PopoverStub,
        UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
        Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
        UFormField: { props: ['error'], template: '<div><slot /><p data-testid="error">{{ error }}</p></div>' },
        FormField: { template: '<div><slot /></div>' },
        UCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button v-bind="$attrs" @click="$emit(\'update:modelValue\', !modelValue)" />' },
        USeparator: { template: '<hr data-testid="separator-stub" />' },
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
    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 1, 1) })
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ from: '2026-01-01T00:00:00.000Z' }])
  })

  it('emits only to with end-of-day UTC', async () => {
    const wrapper = mountComponent()
    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { end: new CalendarDate(2026, 1, 31) })
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{ to: '2026-01-31T23:59:59.999Z' }])
  })

  it('emits both from/to when complete range is selected', async () => {
    const wrapper = mountComponent()
    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

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
    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', undefined)
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]).toEqual([{}])
  })

  it('supports end-of-day boundary precision', async () => {
    const wrapper = mountComponent()
    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

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

    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

    const calendar = wrapper.findComponent(CalendarStub)
    calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 2, 15), end: new CalendarDate(2026, 2, 20) })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('15 feb 2026')
  })

  it('applies today preset and emits start/end in ISO', async () => {
    const wrapper = mount(DateRangeFilter, {
      props: { modelValue: {}, label: 'Fecha', presets: true },
      global: { stubs: { UCalendar: CalendarStub, UPopover: PopoverStub, Popover: PopoverStub, UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }, Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }, UFormField: { template: '<div><slot /></div>' } } },
    })

    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')

    const presets = wrapper.findAll('[data-testid="date-preset"]')
    expect(presets.length).toBeGreaterThan(0)
    await presets[0]!.trigger('click')
    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events[events.length - 1]?.[0]).toEqual({ from: '2026-03-15T00:00:00.000Z', to: '2026-03-15T23:59:59.999Z' })
  })

  it('renders includeNull checkbox only when popover opens and emits toggle', async () => {
    const wrapper = mountComponent()
    await wrapper.setProps({ includeNullOption: 'Incluir ventas sin vencimiento', includeNullValue: false, label: 'vence_at' })

    expect(wrapper.find('[data-testid="include-null-vence_at"]').exists()).toBe(false)

    await wrapper.find('[data-testid="popover-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="popover-content"]').find('[data-testid="include-null-vence_at"]').exists()).toBe(true)

    await wrapper.find('[data-testid="include-null-vence_at"]').trigger('click')
    expect(wrapper.emitted('update:includeNullValue')?.[0]).toEqual([true])

    await wrapper.setProps({ includeNullValue: true })
    await wrapper.find('[data-testid="include-null-vence_at"]').trigger('click')
    expect(wrapper.emitted('update:includeNullValue')?.[1]).toEqual([false])
  })

  it('renders external error message', () => {
    const wrapper = mount(DateRangeFilter, {
      props: { modelValue: {}, label: 'Fecha', error: 'Fecha inválida' },
      global: { stubs: { UCalendar: CalendarStub, UPopover: PopoverStub, UButton: { template: '<button v-bind="$attrs"><slot /></button>' }, UFormField: { props: ['error'], template: '<div><slot /><p>{{ error }}</p></div>' } } },
    })

    expect(wrapper.text()).toContain('Fecha inválida')
  })
})
  it('renders with default props and full-width trigger', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="date-range-filter"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="date-range-trigger"]').classes()).toContain('w-full')
  })
