/**
 * T10 (L64): "Sin presentación" is the product-level row (variantId null) of a product without variants.
 * With the real Nuxt UI list, the "Agregar una presentación" pick must not outlive its row: once the
 * document is read again, the list and the rows follow the document, never a pick kept in the list.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import List from '../EditorialContractFactsList.vue'
import { toEditorialFactsEditingState, type EditorialFactsEditingState } from '../../../utils/editorial-contract-facts-editing'

const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const stops: (() => void)[] = []
beforeAll(() => { HTMLElement.prototype.scrollIntoView = () => {} })
afterEach(() => { stops.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

function render() {
  const state = shallowRef<EditorialFactsEditingState>([])
  let counter = 0
  const wrapper = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h(List, { id: 'facts', modelValue: state.value,
    subjects: [{ variantId: null, label: 'Sin presentación' }], allowed: [], careAllowed: false, nextId: () => `id-${++counter}`,
    'onUpdate:modelValue': (value: EditorialFactsEditingState) => { state.value = value } }) }) }), { attachTo: document.body })
  stops.push(() => wrapper.unmount())
  return { wrapper, state }
}
const trigger = (wrapper: ReturnType<typeof render>['wrapper']) => wrapper.get('#facts-add')
async function pickSubject(wrapper: ReturnType<typeof render>['wrapper']) {
  trigger(wrapper).element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await tick()
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent?.trim() === 'Sin presentación')!
  option.focus(); option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick()
}
const form = () => document.querySelector('[data-action="remove-facts"]')

describe('EditorialContractFactsList — "Sin presentación" after the document is read again', () => {
  it('a saved row read again shows its form, and the list does not offer it again', async () => {
    const { wrapper, state } = render()
    await pickSubject(wrapper)
    expect(form()).not.toBeNull()
    // Saved, then decoded again: new row ids, same subject.
    let counter = 0
    state.value = toEditorialFactsEditingState([{ variantId: null, presentation: 'Bolsa', declarations: [], careReview: null }], () => `read-${++counter}`)
    await tick()
    expect(document.querySelector('legend')?.textContent).toBe('Sin presentación')
    expect(form()).not.toBeNull()
    expect(trigger(wrapper).text()).toBe('Elige…')
  })

  it('a row the reread document does not have leaves the list at its placeholder, and can be added again', async () => {
    const { wrapper, state } = render()
    await pickSubject(wrapper)
    expect(trigger(wrapper).text()).toBe('Elige…')
    state.value = []
    await tick()
    expect(form()).toBeNull()
    expect(trigger(wrapper).text()).toBe('Elige…')
    await pickSubject(wrapper)
    expect(state.value.map(row => row.variantId)).toEqual([null])
    expect(form()).not.toBeNull()
  })
})
