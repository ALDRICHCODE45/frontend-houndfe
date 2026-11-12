// Stored-only sections: «Ventana y plantilla» and «Conversaciones agendadas» carry «Aún sin efecto».
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExtrasSection from '../ExtrasSection.vue'
import SchedulingSection from '../SchedulingSection.vue'
import { settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

function mountExtras(props: Record<string, unknown> = {}) {
  return mount(ExtrasSection, { props: { draft: settingsFixture(), readonly: false, errors: {}, ...props } })
}
function mountSched(props: Record<string, unknown> = {}) {
  return mount(SchedulingSection, {
    props: { scheduling: settingsFixture().scheduling, readonly: false, errors: {}, ...props },
  })
}

describe('ExtrasSection', () => {
  it('marks the window warning and the template «Aún sin efecto», not the cost text', () => {
    const w = mountExtras()
    expect(w.findAll('[data-testid="pending-badge"]')).toHaveLength(2)
    expect(w.text()).toContain('Aún sin efecto')
    expect(w.text()).toContain('«Aplicar a todas» no los copia')
  })

  it('emits the window in minutes, the template (blank = null) and the cost text', async () => {
    const w = mountExtras()
    // 120 min shows as hours, so «2» is 2 h; switch to minutes to type 30 min.
    w.getComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'min')
    await w.vm.$nextTick()
    await w.get('[data-testid="duration-input"]').setValue('30')
    expect(w.emitted('set-window')![0]).toEqual([30])
    expect(w.getComponent({ name: 'Select' }).props('items')).toHaveLength(2)

    await w.get('[data-testid="template-input"]').setValue('aviso_1')
    await w.get('[data-testid="template-input"]').setValue('')
    expect(w.emitted('set-template-name')).toEqual([['aviso_1'], [null]])

    await w.get('[data-testid="cost-input"]').setValue('Cuesta')
    expect(w.emitted('set-template-cost')![0]).toEqual(['Cuesta'])
  })

  it('shows the cost counter and the errors', () => {
    const w = mountExtras({
      errors: { 'x:window': 'Usa un valor entre 0 min y 24 h.', 'x:template': 'Solo minúsculas.', 'x:templateCost': 'Escribe un texto.' },
    })
    expect(w.text()).toContain(`${settingsFixture().templateCostText.length} / 200`)
    expect(w.find('[data-testid="window-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="template-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="cost-error"]').exists()).toBe(true)
    expect(w.get('[data-testid="template-input"]').attributes('aria-invalid')).toBe('true')
  })

  it('read-only prints the values', () => {
    const w = mountExtras({ readonly: true })
    expect(w.get('[data-testid="window-readonly"]').text()).toBe('2 h')
    expect(w.get('[data-testid="template-readonly"]').text()).toBe('Sin configurar')
    expect(w.get('[data-testid="cost-readonly"]').text()).toContain('costo para el negocio')
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
  })
})

describe('SchedulingSection', () => {
  it('explains that it is stored only and the switch is a row, not a checkbox', async () => {
    const w = mountSched()
    expect(w.text()).toContain('todavía no cambia al chatbot')
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
    const toggle = w.get('[data-testid="sched-toggle"]')
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('false')
    await toggle.trigger('click')
    expect(w.emitted('set-enabled')![0]).toEqual([true])
  })

  it('emits each slot cap as a number, NaN while the text is not a whole number', async () => {
    const w = mountSched()
    const inputs = w.findAll('[data-testid="number-input"]')
    expect(inputs.map((i) => (i.element as HTMLInputElement).value)).toEqual(['30', '3', '3'])
    await inputs[0]!.setValue('45')
    await inputs[1]!.setValue('5')
    await inputs[2]!.setValue('x')
    expect(w.emitted('set-field')).toEqual([
      ['slotMinutes', 45],
      ['slotsOffered', 5],
      ['maxScheduledPerSlot', Number.NaN],
    ])
  })

  it('shows the bound errors', () => {
    const w = mountSched({ errors: { 'c:slot': 'Entre 5 y 240 minutos.', 'c:max': 'Entre 1 y 50 conversaciones.' } })
    expect(w.get('[data-testid="error-slotMinutes"]').text()).toBe('Entre 5 y 240 minutos.')
    expect(w.find('[data-testid="error-maxScheduledPerSlot"]').exists()).toBe(true)
    expect(w.find('[data-testid="error-slotsOffered"]').exists()).toBe(false)
  })

  it('read-only prints the state and the caps', () => {
    const w = mountSched({ readonly: true })
    expect(w.get('[data-testid="sched-state"]').text()).toBe('Desactivadas')
    expect(w.get('[data-testid="slotMinutes-readonly"]').text()).toBe('30')
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('[data-testid="sched-toggle"]').exists()).toBe(false)
  })
})
