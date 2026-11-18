import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfRadioCards from '../HfRadioCards.vue'

const items = [
  { value: 'exact', label: 'Cantidad exacta', description: 'Muestra las piezas.', preview: '12 disponibles' },
  { value: 'badge', label: 'Disponible / Agotado', description: 'Solo el estado.' },
  { value: 'hidden', label: 'Ocultar', description: 'No dice nada.', disabled: true },
  { value: 'fixed', label: 'Cantidad fija', description: 'Siempre el mismo número.' },
]

function mountCards(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(HfRadioCards, {
    attachTo: document.body,
    props: { items, label: 'Stock en el catálogo', modelValue: 'exact', ...props },
    slots,
  })
}

const radios = (wrapper: ReturnType<typeof mountCards>) => wrapper.findAll('[role="radio"]')
const last = (wrapper: ReturnType<typeof mountCards>) => {
  const calls = wrapper.emitted('update:modelValue') ?? []
  return calls[calls.length - 1]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfRadioCards', () => {
  it('is a named radiogroup with the chosen card as the only tab stop', () => {
    const wrapper = mountCards()
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Stock en el catálogo')
    expect(radios(wrapper).map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])
    expect(radios(wrapper).map((r) => r.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
    expect(radios(wrapper)[0]!.element.tagName).toBe('BUTTON')
  })

  it('makes the first enabled card the tab stop when nothing is chosen', () => {
    const wrapper = mountCards({ modelValue: null })
    expect(radios(wrapper).map((r) => r.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
  })

  it('names each card by its title and describes it with the description and preview', () => {
    const wrapper = mountCards()
    const first = radios(wrapper)[0]!
    expect(wrapper.get(`[id="${first.attributes('aria-labelledby')}"]`).text()).toBe('Cantidad exacta')
    const described = first.attributes('aria-describedby')!.split(' ').map((id) => wrapper.get(`[id="${id}"]`).text())
    expect(described).toEqual(['Muestra las piezas.', '12 disponibles'])
  })

  it('selects on a click anywhere on the card', async () => {
    const wrapper = mountCards()
    await radios(wrapper)[1]!.get('.hf-radio-card__desc').trigger('click')
    expect(last(wrapper)).toEqual(['badge'])
  })

  it('arrows move and select, skipping disabled cards and wrapping; Home and End jump', async () => {
    const wrapper = mountCards({ modelValue: 'badge' })
    await radios(wrapper)[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(last(wrapper)).toEqual(['fixed'])
    expect(document.activeElement).toBe(radios(wrapper)[3]!.element)
    await radios(wrapper)[3]!.trigger('keydown', { key: 'ArrowRight' })
    expect(last(wrapper)).toEqual(['exact'])
    await radios(wrapper)[0]!.trigger('keydown', { key: 'ArrowUp' })
    expect(last(wrapper)).toEqual(['fixed'])
    await radios(wrapper)[1]!.trigger('keydown', { key: 'End' })
    expect(last(wrapper)).toEqual(['fixed'])
    await radios(wrapper)[3]!.trigger('keydown', { key: 'Home' })
    expect(last(wrapper)).toEqual(['exact'])
  })

  it('does not choose a disabled card or anything when the group is disabled', async () => {
    const wrapper = mountCards()
    expect(radios(wrapper)[2]!.attributes('aria-disabled')).toBe('true')
    await radios(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ disabled: true })
    await radios(wrapper)[1]!.trigger('click')
    await radios(wrapper)[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('marks the chosen card in more than color: data-selected, a check mark and a word', () => {
    const wrapper = mountCards()
    const card = wrapper.findAll('.hf-radio-card')[0]!
    expect(card.attributes('data-selected')).toBe('true')
    expect(card.get('.hf-sel-mark').attributes('data-state')).toBe('checked')
    expect(card.text()).toContain('Seleccionado')
  })

  it('reveals the #selected slot only inside the chosen card', async () => {
    const wrapper = mountCards({}, { selected: '<input data-testid="qty" :data-value="item.value" />' })
    expect(wrapper.findAll('[data-testid="qty"]')).toHaveLength(1)
    expect(wrapper.findAll('.hf-radio-card')[0]!.find('[data-testid="qty"]').exists()).toBe(true)
    await wrapper.setProps({ modelValue: 'fixed' })
    expect(wrapper.findAll('.hf-radio-card')[3]!.find('[data-testid="qty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="qty"]')).toHaveLength(1)
  })
})
