import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Field from '../EditorialContractFamilyField.vue'
import type { EditorialDocumentEditingState as State } from '../../../utils/editorial-contract-document-editing'
const fixture = (): State => ({ schemaVersion: 2, commercialTitle: ' Título ', description: null, mediaRefs: ['m'], familyCode: 'care',
  values: [{ id: 'a', target: { code: 'x', owner: 'product', variantId: null }, input: { state: 'known', payload: { type: 'number', value: '1e', unit: null }, evidence: { sourceRef: 'Etiqueta', verifiedOn: '2026-' } } }],
  facts: [{ id: 'f', variantId: null, presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }] })
const families = [{ code: 'care', label: 'Cuidado' }, { code: 'hygiene', label: 'Higiene' }, { code: 'none', label: '<img src=x>' }]
const message = '¿Cambiar de familia? Se borrarán los datos y las declaraciones de este borrador. Lo publicado no cambia.'
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks() })
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function render(initial = fixture(), disabled = false) {
  const state = shallowRef(freeze(initial)), choices = shallowRef(families), generation = shallowRef(0), events: State[] = [], published = JSON.stringify(initial)
  const wrapper = mount(defineComponent({ setup: () => () => h(Field, { key: generation.value, id: 'family', modelValue: state.value, families: choices.value, disabled, issue: '<img src=x> Revisar',
    'onUpdate:modelValue': (value: State) => { events.push(value); state.value = freeze(value) } }) }))
  stops.push(() => { expect(JSON.stringify(initial)).toBe(published); wrapper.unmount() })
  return { wrapper, state, choices, events, async remount() { generation.value++; await nextTick() } }
}
describe('controlled family selector', () => {
  it.each(['1', 'none'])('cancels then confirms %s, retaining exact raw/DOM on cancel and clearing only lists on accept', async selected => {
    const initial = fixture(), { wrapper, state, events, remount } = render(initial), confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('#family').setValue(selected)
    expect(confirm).toHaveBeenCalledWith(message); expect(state.value).toBe(initial); expect(events).toEqual([])
    expect(wrapper.get('#family').element).toHaveProperty('value', '0')
    await remount(); expect(state.value).toBe(initial)
    confirm.mockReturnValue(true); await wrapper.get('#family').setValue(selected)
    expect(confirm).toHaveBeenCalledTimes(2); expect(events).toHaveLength(1)
    expect(state.value).toEqual({ ...initial, familyCode: selected === 'none' ? null : 'hygiene', values: [], facts: [] })
    expect(state.value.mediaRefs).toBe(initial.mediaRefs)
    await remount(); expect(wrapper.get('#family').element).toHaveProperty('value', selected)
  })
  it.each(['assignment', 'facts'])('requires confirmation even for an empty or omitted %s wrapper', async kind => {
    const initial = fixture(); initial.values[0]!.input = { state: 'omitted' }
    if (kind === 'assignment') initial.facts = []; else initial.values = []
    const { wrapper, state, events } = render(initial), confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('#family').setValue('1')
    expect(confirm).toHaveBeenCalledOnce(); expect(state.value).toBe(initial); expect(events).toEqual([])
  })
  it('skips confirmation only when both lists are empty; null and string codes stay distinct', async () => {
    const initial = fixture(); initial.values = []; initial.facts = []; initial.familyCode = null
    const { wrapper, state, events } = render(initial), confirm = vi.spyOn(window, 'confirm')
    expect(wrapper.get('#family').element).toHaveProperty('value', 'none')
    await wrapper.get('#family').setValue('2'); expect(state.value.familyCode).toBe('none')
    expect(wrapper.find('img').exists()).toBe(false); expect(wrapper.text()).toContain('<img src=x>')
    await wrapper.get('#family').setValue('none'); expect(state.value.familyCode).toBeNull()
    expect(events).toHaveLength(2); expect(confirm).not.toHaveBeenCalled()
  })
  it('does not confirm or emit for the same family', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial), confirm = vi.spyOn(window, 'confirm')
    await wrapper.get('#family').setValue('0')
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(confirm).not.toHaveBeenCalled()
  })
  it('preserves unavailable historical family on metadata loss/remount with a disabled selected option', async () => {
    const initial = fixture(), { wrapper, state, choices, events, remount } = render(initial)
    choices.value = []; await nextTick(); await remount()
    expect(wrapper.text()).toContain('care'); expect(wrapper.text()).toContain('No disponible')
    expect(wrapper.get('#family').element).toHaveProperty('value', 'unavailable')
    expect(wrapper.get('option[value="unavailable"]').attributes('disabled')).toBeDefined()
    expect(state.value).toBe(initial); expect(events).toEqual([])
  })
  it('rejects unknown synthetic tokens and restores the current native selection', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial), confirm = vi.spyOn(window, 'confirm')
    const select = wrapper.get('#family').element as HTMLSelectElement
    for (const token of ['unavailable', '999', '0.5', '']) { select.add(new Option('invalid', token)); select.value = token; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick(); expect(select.value).toBe('0') }
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(confirm).not.toHaveBeenCalled()
  })
  it('blocks disabled synthetic changes without confirmation or emission', async () => {
    const initial = fixture(), { wrapper, state, events } = render(initial, true), confirm = vi.spyOn(window, 'confirm')
    const select = wrapper.get('#family').element as HTMLSelectElement
    expect(select.disabled).toBe(true); select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
    expect(select.value).toBe('0'); expect(state.value).toBe(initial); expect(events).toEqual([]); expect(confirm).not.toHaveBeenCalled()
  })
})
