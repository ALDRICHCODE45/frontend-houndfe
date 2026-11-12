import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import ClosedDatesSection from '../ClosedDatesSection.vue'

function mountDates(props: Record<string, unknown> = {}) {
  return mount(ClosedDatesSection, {
    props: {
      dates: ['2026-09-16', '2026-12-25'],
      today: '2026-11-12',
      readonly: false,
      addError: null,
      ...props,
    },
  })
}

// Reka mirrors a date field into an `aria-hidden` native input (form mirror); it is not a control.
const VISIBLE_NATIVE = 'input[type="date"]:not([aria-hidden="true"]), select:not([aria-hidden="true"])'
const dateField = (w: ReturnType<typeof mountDates>) => w.getComponent({ name: 'InputDate' })
const pick = (w: ReturnType<typeof mountDates>, value: CalendarDate | undefined) =>
  dateField(w).vm.$emit('update:modelValue', value)

describe('ClosedDatesSection', () => {
  it('lists the dates with their weekday and how far they are; past ones are marked', () => {
    const w = mountDates()
    expect(w.get('[data-testid="date-2026-12-25"]').text()).toContain('vie 25 dic 2026')
    expect(w.get('[data-testid="date-2026-12-25"]').text()).toContain('en 43 días')
    expect(w.get('[data-testid="date-2026-09-16"]').text()).toContain('Pasada')
    expect(w.get('[data-testid="date-2026-09-16"]').attributes('data-past')).toBe('true')
  })

  it('adds the picked date', async () => {
    const w = mountDates()
    pick(w, new CalendarDate(2027, 1, 1))
    await w.get('[data-testid="date-add"]').trigger('click')
    expect(w.emitted('add')![0]).toEqual(['2027-01-01'])
  })

  it('uses the system date field, labelled, with no native date input', () => {
    const w = mountDates()
    expect(w.find(VISIBLE_NATIVE).exists()).toBe(false)
    const field = w.get('[data-testid="date-input"]')
    expect(field.attributes('role')).toBe('group')
    expect(field.attributes('aria-labelledby')).toBe(w.get('label').attributes('id'))
    expect(w.get('label').text()).toBe('Nueva fecha cerrada')
    expect(field.attributes('aria-describedby')).toBe('cbs-date-help cbs-date-error')
    expect(dateField(w).props('modelValue')).toBeUndefined()
  })

  it('an incomplete or cleared field sends an empty string (the parent answers «elige una fecha»)', async () => {
    const w = mountDates()
    pick(w, new CalendarDate(2027, 1, 1))
    pick(w, undefined)
    await w.get('[data-testid="date-add"]').trigger('click')
    expect(w.emitted('add')![0]).toEqual([''])
  })

  it('offers the system calendar in a popover next to the field', async () => {
    const w = mountDates()
    const popover = w.getComponent({ name: 'Popover' })
    expect(popover.props('open')).toBe(false)
    popover.vm.$emit('update:open', true)
    await w.vm.$nextTick()
    expect(popover.props('open')).toBe(true)
    pick(w, new CalendarDate(2027, 1, 1))
    await w.vm.$nextTick()
    expect(popover.props('open')).toBe(false)
  })

  it('shows the refusal from the parent (duplicate, empty, impossible) and keeps the input', async () => {
    const w = mountDates({ addError: 'Esa fecha ya está en la lista.' })
    expect(w.get('[data-testid="date-error"]').text()).toContain('ya está en la lista')
    expect(w.get('[data-testid="date-input"]').attributes('aria-invalid')).toBe('true')
    pick(w, new CalendarDate(2026, 12, 25))
    await w.setProps({ addError: 'Esa fecha ya está en la lista.' })
    expect(dateField(w).props('modelValue')).toEqual(new CalendarDate(2026, 12, 25))
  })

  it('clears the input once a date is added', async () => {
    const w = mountDates()
    pick(w, new CalendarDate(2027, 1, 1))
    await w.setProps({ dates: ['2026-09-16', '2026-12-25', '2027-01-01'] })
    expect(dateField(w).props('modelValue')).toBeUndefined()
  })

  it('removes one date and all the past ones', async () => {
    const w = mountDates()
    await w.get('[data-testid="date-remove-2026-12-25"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['2026-12-25'])
    expect(w.get('[data-testid="date-remove-past"]').text()).toBe('Quitar 1 pasada')
    await w.get('[data-testid="date-remove-past"]').trigger('click')
    expect(w.emitted('remove-past')).toHaveLength(1)
  })

  it('shows the empty state with no dates', () => {
    const w = mountDates({ dates: [] })
    expect(w.get('[data-testid="dates-empty"]').text()).toContain('Sin fechas cerradas')
    expect(w.find('[data-testid="date-remove-past"]').exists()).toBe(false)
  })

  it('read-only shows the list without add or remove', () => {
    const w = mountDates({ readonly: true })
    expect(w.find('[data-testid="date-input"]').exists()).toBe(false)
    expect(w.find('[data-testid="date-add"]').exists()).toBe(false)
    expect(w.find('[data-testid="date-remove-2026-12-25"]').exists()).toBe(false)
    expect(w.find('[data-testid="date-remove-past"]').exists()).toBe(false)
    expect(w.findAll('li.cbs-date')).toHaveLength(2)
  })
})

describe('ClosedDatesSection reasons', () => {
  const reasonInput = (w: ReturnType<typeof mountDates>, date: string) => w.get(`[data-testid="date-reason-${date}"] input, input[data-testid="date-reason-${date}"]`)

  it('shows an optional reason input per date with the current reason, labelled by the date', () => {
    const w = mountDates({ reasons: { '2026-12-25': 'Navidad' } })
    const christmas = reasonInput(w, '2026-12-25')
    expect((christmas.element as HTMLInputElement).value).toBe('Navidad')
    expect(christmas.attributes('aria-label')).toBe('Motivo de vie 25 dic 2026 (opcional)')
    expect(christmas.attributes('id')).toBe('r-2026-12-25')
    expect((reasonInput(w, '2026-09-16').element as HTMLInputElement).value).toBe('')
    expect(reasonInput(w, '2026-09-16').attributes('placeholder')).toBe('Motivo (opcional)')
  })

  it('emits the typed text for its date, untouched (the draft trims on send)', async () => {
    const w = mountDates()
    await reasonInput(w, '2026-12-25').setValue('Navidad ')
    expect(w.emitted('set-reason')![0]).toEqual(['2026-12-25', 'Navidad '])
  })

  it('shows the reason error under its date and marks the input invalid', () => {
    const w = mountDates({ reasons: { '2026-12-25': 'x' }, errors: { 'r:2026-12-25': 'El motivo admite hasta 80 caracteres.' } })
    expect(w.get('[data-testid="date-2026-12-25"]').text()).toContain('El motivo admite hasta 80 caracteres.')
    expect(reasonInput(w, '2026-12-25').attributes('aria-invalid')).toBe('true')
    expect(w.get('[data-testid="date-2026-09-16"]').text()).not.toContain('80 caracteres')
  })

  it('read-only prints the reason in the list and has no reason input', () => {
    const w = mountDates({ readonly: true, reasons: { '2026-12-25': 'Navidad' } })
    expect(w.get('[data-testid="date-2026-12-25"]').text()).toContain('Navidad')
    expect(w.get('[data-testid="date-reason-text-2026-12-25"]').text()).toBe('Navidad')
    expect(w.find('[data-testid="date-reason-2026-12-25"]').exists()).toBe(false)
    expect(w.find('[data-testid="date-reason-text-2026-09-16"]').exists()).toBe(false)
  })

  it('the help text no longer says only the date is saved', () => {
    expect(mountDates().get('#cbs-date-help').text()).not.toContain('sin motivo')
  })
})
