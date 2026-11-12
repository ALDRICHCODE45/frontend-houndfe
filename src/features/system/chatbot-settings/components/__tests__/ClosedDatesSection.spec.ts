import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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
    await w.get('[data-testid="date-input"]').setValue('2027-01-01')
    await w.get('[data-testid="date-add"]').trigger('click')
    expect(w.emitted('add')![0]).toEqual(['2027-01-01'])
  })

  it('shows the refusal from the parent (duplicate, empty, impossible) and keeps the input', async () => {
    const w = mountDates({ addError: 'Esa fecha ya está en la lista.' })
    expect(w.get('[data-testid="date-error"]').text()).toContain('ya está en la lista')
    expect(w.get('[data-testid="date-input"]').attributes('aria-invalid')).toBe('true')
    await w.get('[data-testid="date-input"]').setValue('2026-12-25')
    await w.setProps({ addError: 'Esa fecha ya está en la lista.' })
    expect((w.get('[data-testid="date-input"]').element as HTMLInputElement).value).toBe('2026-12-25')
  })

  it('clears the input once a date is added', async () => {
    const w = mountDates()
    await w.get('[data-testid="date-input"]').setValue('2027-01-01')
    await w.setProps({ dates: ['2026-09-16', '2026-12-25', '2027-01-01'] })
    expect((w.get('[data-testid="date-input"]').element as HTMLInputElement).value).toBe('')
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
