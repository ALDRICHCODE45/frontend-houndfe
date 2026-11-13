// «Ventana y plantilla» now drives the inbox filter and the «Enviar plantilla» button; «Conversaciones agendadas» is still stored only («Aún sin efecto»).
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
  it('no longer marks the template «Aún sin efecto»: «Enviar plantilla» in the live chat reads it', () => {
    const w = mountExtras()
    expect(w.findAll('[data-testid="pending-badge"]')).toHaveLength(0)
    expect(w.text()).not.toContain('Aún sin efecto')
  })

  it('no longer says the inbox filter uses a fixed 2 h; it says the filter follows this value', () => {
    const text = mountExtras().get('#cbs-window-help').text()
    expect(text).not.toContain('2 h fijas')
    expect(text).toContain('«Ventana por cerrar»')
    expect(text).toContain('0')
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

  it('edits the template language next to the name, monospace, and emits it as typed', async () => {
    const w = mountExtras()
    const input = w.get('[data-testid="template-language-input"]')
    expect((input.element as HTMLInputElement).value).toBe('es_MX')
    expect(input.classes()).toContain('cbs-mono')
    await input.setValue('en_US')
    expect(w.emitted('set-template-language')).toEqual([['en_US']])
  })

  it('edits the start timeout as whole seconds and explains it applies to the next claim', async () => {
    const w = mountExtras()
    const input = w.get('#cbs-start-timeout')
    expect((input as unknown as { element: HTMLInputElement }).element.value).toBe('120')
    await input.setValue('90')
    await input.setValue('abc')
    expect(w.emitted('set-start-timeout')).toEqual([[90], [Number.NaN]])
    const help = w.get('#cbs-start-timeout-help').text()
    expect(help).toContain('bot')
    expect(help).toContain('siguiente')
  })

  it('shows the timeout and language errors with their message', () => {
    const w = mountExtras({
      errors: { 'x:startTimeout': 'Entre 30 y 600 segundos.', 'x:templateLanguage': 'Usa el formato es o es_MX.' },
    })
    expect(w.get('[data-testid="start-timeout-error"]').text()).toBe('Entre 30 y 600 segundos.')
    expect(w.get('[data-testid="template-language-error"]').text()).toBe('Usa el formato es o es_MX.')
    expect(w.get('[data-testid="template-language-input"]').attributes('aria-invalid')).toBe('true')
    expect(w.get('#cbs-start-timeout').attributes('aria-invalid')).toBe('true')
  })

  it('the foot note says «Aplicar a todas» copies neither the template, its language, the cost nor the timeout', () => {
    const text = mountExtras().get('.cbs-foot').text()
    expect(text).toContain('«Aplicar a todas» no copia')
    for (const word of ['plantilla', 'idioma', 'costo', 'tiempo']) expect(text).toContain(word)
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
    expect(w.get('[data-testid="template-language-readonly"]').text()).toBe('es_MX')
    expect(w.get('[data-testid="start-timeout-readonly"]').text()).toBe('120 s')
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
