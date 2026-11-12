// HoursSection — weekly chat hours: switch rows, ranges (max 6), «Copiar a…», pickup copy, read-only.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Time } from '@internationalized/date'
import HoursSection from '../HoursSection.vue'
import { defaultsFixture, settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

function mountHours(props: Record<string, unknown> = {}) {
  return mount(HoursSection, { props: { draft: settingsFixture(), readonly: false, errors: {}, ...props } })
}
// Reka mirrors time/select fields into `aria-hidden`, `tabindex=-1` native inputs (form mirror); they are not controls.
const VISIBLE_NATIVE = 'select:not([aria-hidden="true"]), input[type="time"]:not([aria-hidden="true"])'
const timeField = (w: ReturnType<typeof mountHours>, testid: string) =>
  // The field renders a fragment, so the component is matched by its id (`t-DAY-n-open|close`).
  w.findAllComponents({ name: 'InputTime' }).find((c) => c.props('id') === idOf(testid))!
const idOf = (testid: string) => {
  const [part, day, index] = testid.split('-')
  return `t-${day}-${index}-${part}`
}
const field = (w: ReturnType<typeof mountHours>, testid: string) => w.get(`[data-testid="${testid}"]`)
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

    timeField(w, 'open-MONDAY-0').vm.$emit('update:modelValue', new Time(8, 30))
    expect(emitted(w, 'set-time')[0]).toEqual(['MONDAY', 0, 'open', '08:30'])
  })

  it('the range times are the system time field: HH:mm in, HH:mm out, labelled, no native time input', () => {
    const w = mountHours()
    expect(w.find(VISIBLE_NATIVE).exists()).toBe(false)
    const open = timeField(w, 'open-WEDNESDAY-1')
    const close = timeField(w, 'close-WEDNESDAY-1')
    const openEl = field(w, 'open-WEDNESDAY-1')
    const closeEl = field(w, 'close-WEDNESDAY-1')
    expect(open.props('modelValue')).toEqual(new Time(16, 0))
    expect(close.props('modelValue')).toEqual(new Time(19, 0))
    expect(openEl.attributes('aria-label')).toBe('Miércoles, horario 2: abre')
    expect(closeEl.attributes('aria-label')).toBe('Miércoles, horario 2: cierra')
    expect(open.props('id')).toBe('t-WEDNESDAY-1-open')
    // 12 h values must not clip: the sizing class stays on the field.
    expect(openEl.classes()).toContain('cbs-time')
    expect(closeEl.classes()).toContain('cbs-time')
  })

  it('pads a time to HH:mm and reports a cleared field as an empty string', () => {
    const w = mountHours()
    timeField(w, 'close-MONDAY-0').vm.$emit('update:modelValue', new Time(7, 5))
    timeField(w, 'close-MONDAY-0').vm.$emit('update:modelValue', undefined)
    expect(emitted(w, 'set-time')).toEqual([
      ['MONDAY', 0, 'close', '07:05'],
      ['MONDAY', 0, 'close', ''],
    ])
  })

  it('marks the ranges of a day with an error as invalid', () => {
    const w = mountHours({ errors: { 'h:MONDAY': 'El cierre debe ser después de la apertura.' } })
    expect(field(w, 'open-MONDAY-0').attributes('aria-invalid')).toBe('true')
    expect(field(w, 'close-MONDAY-0').attributes('aria-invalid')).toBe('true')
    expect(field(w, 'open-TUESDAY-0').attributes('aria-invalid')).toBeUndefined()
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
    const zone = w.getComponent({ name: 'Select' })
    const options = (zone.props('items') as Array<{ value: string }>).map((o) => o.value)
    expect(options).toContain('America/Chihuahua')
    expect(zone.props('modelValue')).toBe('America/Chihuahua')
    zone.vm.$emit('update:modelValue', 'America/Tijuana')
    expect(emitted(w, 'set-zone')[0]).toEqual(['America/Tijuana'])
  })

  it('the time zone is the system select, labelled by «Zona horaria»', () => {
    const w = mountHours()
    expect(w.find(VISIBLE_NATIVE).exists()).toBe(false)
    const trigger = w.get('[data-testid="tz-select"]')
    expect(trigger.attributes('role')).toBe('combobox')
    expect(trigger.attributes('id')).toBe('cbs-tz')
    expect(w.get('label[for="cbs-tz"]').text()).toBe('Zona horaria')
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
    expect(w.find('[role="combobox"]').exists()).toBe(false)
    expect(w.findAllComponents({ name: 'InputTime' })).toHaveLength(0)
    expect(w.find('[data-testid="copy-pickup"]').exists()).toBe(false)
    expect(w.find('[data-testid="copy-WEDNESDAY"]').exists()).toBe(false)
  })
})
