import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import Field from '../EditorialContractFamilyField.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import type { EditorialDocumentEditingState as State } from '../../../utils/editorial-contract-document-editing'

const fixture = (): State => ({ schemaVersion: 2, commercialTitle: ' Título ', description: null, mediaRefs: ['m'], familyCode: 'care',
  values: [{ id: 'a', target: { code: 'x', owner: 'product', variantId: null }, input: { state: 'known', payload: { type: 'number', value: '1e', unit: null }, evidence: { sourceRef: 'Etiqueta', verifiedOn: '2026-' } } }],
  facts: [{ id: 'f', variantId: null, presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }] })
const families = [{ code: 'care', label: 'Cuidado' }, { code: 'hygiene', label: 'Higiene' }, { code: 'none', label: '<img src=x>' }]
const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks(); document.body.innerHTML = '' })
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function render(initial = fixture(), disabled = false) {
  const state = shallowRef(freeze(initial)), choices = shallowRef(families), generation = shallowRef(0), events: State[] = [], published = JSON.stringify(initial)
  const wrapper = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h(Field, { key: generation.value, id: 'family', modelValue: state.value, families: choices.value, disabled, issue: '<img src=x> Revisar',
    'onUpdate:modelValue': (value: State) => { events.push(value); state.value = freeze(value) } }) }) }), { attachTo: document.body })
  stops.push(() => { expect(JSON.stringify(initial)).toBe(published); wrapper.unmount() })
  return { wrapper, state, choices, events, async remount() { generation.value++; await nextTick() } }
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const button = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === label)
const value = (wrapper: ReturnType<typeof render>['wrapper']) => wrapper.getComponent(HfCombobox).props('modelValue')
async function choose(wrapper: ReturnType<typeof render>['wrapper'], selected: string) { wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', selected); await tick() }

describe('controlled family selector', () => {
  it('is the shared combobox named "Familia" with the families, and "Sin familia" for none', () => {
    const { wrapper } = render()
    const select = wrapper.getComponent(HfCombobox)
    expect(select.props('label')).toBe('Familia')
    expect(select.props('items')).toEqual([{ label: 'Sin familia', value: 'none' }, { label: 'Cuidado', value: '0' }, { label: 'Higiene', value: '1' }, { label: '<img src=x>', value: '2' }])
    expect(select.props('modelValue')).toBe('0')
    expect(select.props('invalid')).toBe(true)
    expect(select.props('describedby')).toBe('family-label-message')
    expect(select.props('id')).toBe('family')
    expect(wrapper.get('#family-label').text()).toBe('Familia')
    expect(wrapper.get('#family-label-message').text()).toBe('<img src=x> Revisar')
  })

  it.each(['1', 'none'])('asks in a modal and never with window.confirm; cancelling %s keeps the family, the raw document and the selection', async selected => {
    const initial = fixture(), { wrapper, state, events, remount } = render(initial), confirm = vi.spyOn(window, 'confirm')
    await choose(wrapper, selected)
    expect(confirm).not.toHaveBeenCalled()
    expect(dialog()).not.toBeNull()
    expect(dialog()!.textContent).toContain('¿Cambiar la familia?')
    expect(dialog()!.querySelector('[data-testid="confirm-description"]')!.textContent).toBe('Se borran los datos de la familia actual en este borrador.')
    expect(button('Cambiar familia')!.className).toContain('bg-error')
    expect(button('Cancelar')).toBeDefined()
    expect(state.value).toBe(initial); expect(events).toEqual([])
    expect(value(wrapper)).toBe('0')
    button('Cancelar')!.click(); await tick()
    expect(dialog()).toBeNull()
    expect(state.value).toBe(initial); expect(events).toEqual([])
    expect(value(wrapper)).toBe('0')
    await remount(); expect(state.value).toBe(initial)
  })

  it.each(['1', 'none'])('changes to %s only when confirmed, clearing only the lists', async selected => {
    const initial = fixture(), { wrapper, state, events, remount } = render(initial)
    await choose(wrapper, selected)
    expect(events).toEqual([])
    button('Cambiar familia')!.click(); await tick()
    expect(dialog()).toBeNull()
    expect(events).toHaveLength(1)
    expect(state.value).toEqual({ ...initial, familyCode: selected === 'none' ? null : 'hygiene', values: [], facts: [] })
    expect(state.value.mediaRefs).toBe(initial.mediaRefs)
    await remount(); expect(value(wrapper)).toBe(selected)
  })

  it('a dismissed modal (Escape or the close button) is a cancel', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial)
    await choose(wrapper, '1')
    document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="Close"], [role="dialog"] [aria-label="Cerrar"]')?.click()
    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick()
    expect(dialog()).toBeNull()
    expect(state.value).toBe(initial); expect(events).toEqual([])
  })

  it.each(['assignment', 'facts'])('asks even for an empty or omitted %s wrapper', async kind => {
    const initial = fixture(); initial.values[0]!.input = { state: 'omitted' }
    if (kind === 'assignment') initial.facts = []; else initial.values = []
    const { wrapper, state, events } = render(initial)
    await choose(wrapper, '1')
    expect(dialog()).not.toBeNull()
    expect(state.value).toBe(initial); expect(events).toEqual([])
  })

  it('skips the question only when both lists are empty; null and string codes stay distinct', async () => {
    const initial = fixture(); initial.values = []; initial.facts = []; initial.familyCode = null
    const { wrapper, state, events } = render(initial)
    expect(value(wrapper)).toBe('none')
    await choose(wrapper, '2'); expect(state.value.familyCode).toBe('none')
    expect(wrapper.find('img').exists()).toBe(false)
    await choose(wrapper, 'none'); expect(state.value.familyCode).toBeNull()
    expect(events).toHaveLength(2); expect(dialog()).toBeNull()
  })

  it('does not ask or emit for the same family', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial)
    await choose(wrapper, '0')
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(dialog()).toBeNull()
  })

  it('keeps an unavailable historical family as a disabled, selected item with its note', async () => {
    const initial = fixture(), { wrapper, state, choices, events, remount } = render(initial)
    choices.value = []; await nextTick(); await remount()
    const select = wrapper.getComponent(HfCombobox)
    expect(select.props('modelValue')).toBe('unavailable')
    expect(select.props('items')).toContainEqual({ label: 'care (No disponible)', value: 'unavailable', disabled: true })
    expect(wrapper.text()).toContain('No disponible en las familias actuales')
    expect(state.value).toBe(initial); expect(events).toEqual([])
  })

  it('ignores a token that is not an offered family and keeps the current selection', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial)
    for (const token of ['unavailable', '999', '0.5', undefined, null, ['1']]) { wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', token); await tick() }
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(dialog()).toBeNull()
  })

  it('blocks a disabled field even for a synthetic pick', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial, true)
    expect(wrapper.getComponent(HfCombobox).props('disabled')).toBe(true)
    wrapper.getComponent(HfCombobox).vm.$emit('update:modelValue', '1'); await tick()
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(dialog()).toBeNull()
  })
})
