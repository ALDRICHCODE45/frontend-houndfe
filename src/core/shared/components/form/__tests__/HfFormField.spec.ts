import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import HfFormField from '../HfFormField.vue'

const specials = [
  { value: 'unknown', label: 'No lo sé' },
  { value: 'na', label: 'No aplica' },
]

function mountField(props: Record<string, unknown> = {}) {
  return mount(HfFormField, {
    props: { label: 'Ingredientes', for: 'f-ingredientes', ...props },
    slots: { default: () => h('textarea', { id: 'f-ingredientes' }) },
  })
}

describe('HfFormField', () => {
  it('puts a 13px label above the control, bound to it', () => {
    const wrapper = mountField()
    const label = wrapper.get('label.hf-form-field__label')
    expect(label.text()).toBe('Ingredientes')
    expect(label.attributes('for')).toBe('f-ingredientes')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('uses a plain labelled span when the control is not a native field', () => {
    const wrapper = mountField({ for: undefined, labelId: 'l-especie' })
    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.get('#l-especie').text()).toBe('Ingredientes')
  })

  it('shows the hint on the right', () => {
    const wrapper = mountField({ hint: '40 de 80' })
    expect(wrapper.get('.hf-form-field__hint').text()).toBe('40 de 80')
  })

  it('marks a required field with an amber dot and the words for assistive tech', () => {
    const wrapper = mountField({ required: true })
    const marker = wrapper.get('.hf-form-field__required')
    expect(marker.find('.hf-form-field__dot').exists()).toBe(true)
    expect(marker.text()).toBe('Requerido para publicar')
  })

  it('marks an internal field with a lock and "Interno"', () => {
    const wrapper = mountField({ internal: true })
    const marker = wrapper.get('.hf-form-field__internal')
    expect(marker.text()).toBe('Interno')
    expect(marker.find('svg, .iconify, [class*="i-lucide-lock"]').exists()).toBe(true)
  })

  it('shows the error under the control instead of the help', () => {
    const wrapper = mountField({ help: 'Escríbelos como aparecen en el empaque', error: 'Escribe al menos un ingrediente' })
    const line = wrapper.get('.hf-form-field__message')
    expect(line.text()).toBe('Escribe al menos un ingrediente')
    expect(line.attributes('data-tone')).toBe('error')
    expect(line.attributes('id')).toBe('f-ingredientes-message')
  })

  it('keeps the help in the DOM, collapsed, under the message id the control points to', () => {
    const wrapper = mountField({ help: 'Solo lo ve tu equipo; no se publica en la tienda.' })
    const help = wrapper.get('.hf-form-field__message')
    expect(help.attributes('data-tone')).toBe('help')
    expect(help.attributes('id')).toBe('f-ingredientes-message')
    expect(help.text()).toBe('Solo lo ve tu equipo; no se publica en la tienda.')
    expect(wrapper.get('.hf-form-field').attributes('data-help')).toBe('collapsed')
  })

  it('toggles the help from a small info button next to the label', async () => {
    const wrapper = mountField({ help: 'Escríbelos como aparecen en el empaque' })
    const info = wrapper.get('.hf-form-field__row button.hf-form-field__info')
    expect(info.attributes('type')).toBe('button')
    expect(info.attributes('aria-label')).toBe('Ayuda de Ingredientes')
    expect(info.attributes('aria-expanded')).toBe('false')
    expect(info.attributes('aria-controls')).toBe('f-ingredientes-message')
    expect(info.find('[class*="i-lucide-info"], svg, .iconify').exists()).toBe(true)
    await info.trigger('click')
    expect(info.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.hf-form-field').attributes('data-help')).toBe('open')
    await info.trigger('click')
    expect(info.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.hf-form-field').attributes('data-help')).toBe('collapsed')
  })

  it('offers no info button without help, or while an error takes the line', () => {
    expect(mountField().find('.hf-form-field__info').exists()).toBe(false)
    const invalid = mountField({ help: 'Escríbelos como aparecen en el empaque', error: 'Completa este dato' })
    expect(invalid.find('.hf-form-field__info').exists()).toBe(false)
    expect(invalid.get('.hf-form-field').attributes('data-help')).toBeUndefined()
  })

  it('offers the special answers as ghost actions that emit special', async () => {
    const wrapper = mountField({ specialAnswers: specials })
    const actions = wrapper.findAll('.hf-form-field__ghost')
    expect(actions.map(action => action.text())).toEqual(['No lo sé', 'No aplica'])
    expect(actions[1]!.attributes('aria-label')).toBe('Ingredientes: marcar como No aplica')
    await actions[1]!.trigger('click')
    expect(wrapper.emitted('special')).toEqual([['na']])
  })

  it('hides the ghost actions while a hint occupies the right side', () => {
    const wrapper = mountField({ specialAnswers: specials, hint: '40 de 80' })
    expect(wrapper.findAll('.hf-form-field__ghost')).toHaveLength(0)
  })

  it('puts small actions from the actions slot at the right of the label row', () => {
    const wrapper = mount(HfFormField, {
      props: { label: 'Peso neto', labelId: 'l-peso', hint: '3 de 80' },
      slots: { default: () => h('input'), actions: () => h('button', { type: 'button', 'aria-label': 'Agregar evidencia' }) },
    })
    const row = wrapper.get('.hf-form-field__row')
    const actions = row.get('.hf-form-field__actions')
    expect(actions.get('button').attributes('aria-label')).toBe('Agregar evidencia')
    expect(row.element.lastElementChild).toBe(actions.element)
  })

  it('renders no actions container without the slot', () => {
    expect(mountField().find('.hf-form-field__actions').exists()).toBe(false)
  })
})
