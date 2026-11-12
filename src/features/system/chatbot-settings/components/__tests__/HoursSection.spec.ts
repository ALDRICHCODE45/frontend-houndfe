// HoursSection — weekly chat hours: switch rows, ranges (max 6), «Copiar a…», pickup copy, read-only.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HoursSection from '../HoursSection.vue'
import { defaultsFixture, settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

function mountHours(props: Record<string, unknown> = {}) {
  return mount(HoursSection, { props: { draft: settingsFixture(), readonly: false, errors: {}, ...props } })
}
const emitted = (w: ReturnType<typeof mountHours>, name: string) => w.emitted(name)!

describe('HoursSection', () => {
  it('says this is the chat schedule, separate from the store pickup hours', () => {
    const text = mountHours().get('[data-testid="pickup-note"]').text()
    expect(text).toContain('solo para el chatbot')
    expect(text).toContain('No cambia el horario de recolección en tienda')
  })

  it('renders seven day rows with their state and no classic checkbox', () => {
    const w = mountHours()
    expect(w.findAll('li.cbs-day')).toHaveLength(7)
    expect(w.get('[data-testid="toggle-MONDAY"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-testid="toggle-SUNDAY"]').attributes('aria-checked')).toBe('false')
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('toggling a day, adding, removing and editing a range emit the draft intents', async () => {
    const w = mountHours()
    await w.get('[data-testid="toggle-SUNDAY"]').trigger('click')
    expect(emitted(w, 'toggle-day')[0]).toEqual(['SUNDAY'])

    await w.get('[data-testid="add-MONDAY"]').trigger('click')
    expect(emitted(w, 'add-range')[0]).toEqual(['MONDAY'])

    await w.get('[data-testid="remove-WEDNESDAY-1"]').trigger('click')
    expect(emitted(w, 'remove-range')[0]).toEqual(['WEDNESDAY', 1])

    const input = w.get('[data-testid="open-MONDAY-0"]')
    ;(input.element as HTMLInputElement).value = '08:30'
    await input.trigger('change')
    expect(emitted(w, 'set-time')[0]).toEqual(['MONDAY', 0, 'open', '08:30'])
  })

  it('hides «Agregar horario» at 6 ranges', () => {
    const draft = settingsFixture()
    draft.openingHours.days[0]!.ranges = Array.from({ length: 6 }, (_, n) => ({
      open: `${String(n * 3 + 1).padStart(2, '0')}:00`,
      close: `${String(n * 3 + 2).padStart(2, '0')}:00`,
    }))
    const w = mountHours({ draft })
    expect(w.find('[data-testid="add-MONDAY"]').exists()).toBe(false)
    expect(w.find('[data-testid="add-TUESDAY"]').exists()).toBe(true)
  })

  it('«Copiar a…» picks target days (quick sets included) and emits one copy', async () => {
    const w = mountHours()
    await w.get('[data-testid="copy-WEDNESDAY"]').trigger('click')
    expect(w.find('[data-testid="copy-panel"]').exists()).toBe(true)
    expect(w.get('[data-testid="copy-apply"]').attributes('disabled')).toBeDefined()

    await w.get('[data-testid="pick-weekdays"]').trigger('click')
    expect(w.get('[data-testid="copy-apply"]').text()).toBe('Copiar a 4 días')
    await w.get('[data-testid="target-MONDAY"]').trigger('click')
    expect(w.get('[data-testid="copy-apply"]').text()).toBe('Copiar a 3 días')
    await w.get('[data-testid="target-SUNDAY"]').trigger('click')

    await w.get('[data-testid="copy-apply"]').trigger('click')

    expect(emitted(w, 'copy-days')[0]![0]).toBe('WEDNESDAY')
    expect([...(emitted(w, 'copy-days')[0]![1] as string[])].sort()).toEqual(['FRIDAY', 'SUNDAY', 'THURSDAY', 'TUESDAY'])
    expect(w.find('[data-testid="copy-panel"]').exists()).toBe(false)
  })

  it('«Todos» and «Ninguno» and Cancelar leave nothing emitted', async () => {
    const w = mountHours()
    await w.get('[data-testid="copy-MONDAY"]').trigger('click')
    await w.get('[data-testid="pick-all"]').trigger('click')
    expect(w.get('[data-testid="copy-apply"]').text()).toBe('Copiar a 6 días')
    await w.get('[data-testid="pick-none"]').trigger('click')
    expect(w.get('[data-testid="copy-apply"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="copy-cancel"]').trigger('click')
    expect(w.find('[data-testid="copy-panel"]').exists()).toBe(false)
    expect(w.emitted('copy-days')).toBeUndefined()
  })

  it('«Copiar horario de recolección» is disabled with no pickup hours and emits otherwise', async () => {
    const without = mountHours({ draft: defaultsFixture() })
    expect(without.get('[data-testid="copy-pickup"]').attributes('disabled')).toBeDefined()
    expect(without.text()).toContain('no tiene horario de recolección')

    const w = mountHours()
    await w.get('[data-testid="copy-pickup"]').trigger('click')
    expect(w.emitted('copy-pickup')).toHaveLength(1)
  })

  it('emits the new time zone and keeps a saved zone the fixed list does not know', async () => {
    const draft = settingsFixture()
    draft.openingHours.timeZone = 'America/Chihuahua'
    const w = mountHours({ draft })
    const options = w.findAll('[data-testid="tz-select"] option').map((o) => o.attributes('value'))
    expect(options).toContain('America/Chihuahua')
    await w.get('[data-testid="tz-select"]').setValue('America/Tijuana')
    expect(emitted(w, 'set-zone')[0]).toEqual(['America/Tijuana'])
  })

  it('shows the day and week errors', () => {
    const w = mountHours({
      errors: { 'h:MONDAY': 'El cierre debe ser después de la apertura.', 'h:week': 'Deja al menos un día con horario abierto.' },
    })
    expect(w.get('[data-testid="error-MONDAY"]').text()).toContain('después de la apertura')
    expect(w.get('[data-testid="week-error"]').text()).toContain('al menos un día')
    expect(w.get('[data-testid="day-MONDAY"]').attributes('data-invalid')).toBe('true')
  })

  it('read-only shows the ranges as text and no controls', () => {
    const w = mountHours({ readonly: true })
    expect(w.get('[data-testid="ranges-WEDNESDAY"]').text()).toBe('09:00 – 14:00 · 16:00 – 19:00')
    expect(w.find('[data-testid="toggle-MONDAY"]').exists()).toBe(false)
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('select').exists()).toBe(false)
    expect(w.find('[data-testid="copy-pickup"]').exists()).toBe(false)
    expect(w.find('[data-testid="copy-WEDNESDAY"]').exists()).toBe(false)
  })
})
