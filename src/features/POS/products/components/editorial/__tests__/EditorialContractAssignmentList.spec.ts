import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import List from '../EditorialContractAssignmentList.vue'
import Field from '../EditorialContractAttributeField.vue'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import type { EditorialFamily, EditorialBinding } from '../../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentEditingRow as Row } from '../../../utils/editorial-contract-document-editing'
import { resolveEditorialDocumentEditingState } from '../../../utils/editorial-contract-document-editing'
const definitions: EditorialDefinition[] = [
  { id: 'n', code: 'mass', label: 'Masa', type: 'number', units: [{ code: 'g', label: 'Gramos', sortOrder: 0 }], numericPolicy: { status: 'pending' } },
  { id: 's', code: 'none', label: 'Opción', type: 'single', options: [{ code: 'old', label: 'Anterior', archived: true, sortOrder: 0 }], groups: [], aliases: [] },
]
const binding = (definitionId: string, definitionCode: string, owner: EditorialBinding['owner']): EditorialBinding =>
  ({ definitionId, definitionCode, owner, sortOrder: 0, exposure: 'INTERNAL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' } })
const family: EditorialFamily = { id: 'f', code: 'custom', label: 'Familia', bindings: [binding('n', 'mass', 'product'), binding('s', 'none', 'sellable')] }
const subjects = [{ variantId: null, label: 'Producto simple' }, { variantId: 'none', label: '<img src=x> Variante' }]
const row = (id = 'a'): Row => ({ id, target: { code: 'mass', owner: 'product', variantId: null }, input: { state: 'omitted' } })
const populated = (id = 'a'): Row => ({ ...row(id), input: { state: 'known', payload: { type: 'number', value: '1e-', unit: 'g' }, evidence: { sourceRef: ' ', verifiedOn: '2026-' } } })
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks() })
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function render(initial: Row[] = [], disabled = false) {
  const state = shallowRef(freeze(initial)), currentFamily = shallowRef<EditorialFamily | null>(family), currentDefinitions = shallowRef(definitions)
  const currentSubjects = shallowRef(subjects), version = shallowRef(0), events: Row[][] = [], nextId = vi.fn(() => 'new-' + (events.length + 1))
  const feedback = new Map([['a', { issue: '<img src=x> Revisar', conservedOptions: ['old'] }]])
  const published = JSON.stringify(initial)
  const wrapper = mount(defineComponent({ setup: () => () => h(List, { key: version.value, id: 'attributes', modelValue: state.value,
    family: currentFamily.value, definitions: currentDefinitions.value, subjects: currentSubjects.value, disabled, nextId, feedback,
    'onUpdate:modelValue': (value: Row[]) => { events.push(value); state.value = freeze(value) },
  }) }))
  stops.push(() => { expect(JSON.stringify(initial)).toBe(published); wrapper.unmount() })
  return { wrapper, state, currentFamily, currentDefinitions, currentSubjects, events, nextId, async remount() { version.value++; await nextTick() } }
}
describe('controlled assignment collection', () => {
  it('adds only explicit exact targets, preserving binding/subject order and nullable versus literal none', async () => {
    const { wrapper, state, events, nextId, remount } = render()
    await remount(); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
    expect(wrapper.findAll('#attributes-add option').map(o => o.attributes('value'))).toEqual(['', '0', '1', '2'])
    await wrapper.get('#attributes-add').setValue('0')
    expect(state.value).toEqual([row('new-1')]); expect(nextId).toHaveBeenCalledOnce()
    expect(wrapper.get('#attributes-add').element).toHaveProperty('value', '')
    expect(wrapper.find('#attributes-add option[value="0"]').exists()).toBe(false)
    await wrapper.get('#attributes-add').setValue('1'); await wrapper.get('#attributes-add').setValue('2')
    expect(state.value.slice(1)).toEqual([null, 'none'].map((variantId, i) => ({ id: 'new-' + (i + 2), target: { code: 'none', owner: 'sellable', variantId }, input: { state: 'omitted' } })))
    expect(nextId).toHaveBeenCalledTimes(3); expect(wrapper.findAll('#attributes-add option')).toHaveLength(1)
    expect(wrapper.find('img').exists()).toBe(false); await remount(); expect(events).toHaveLength(3)
  })
  it('keeps product independent of sellable subjects without inventing an offered subject', async () => {
    const { wrapper, currentSubjects, state } = render()
    currentSubjects.value = []; await nextTick()
    expect(wrapper.findAll('#attributes-add option').map(o => o.attributes('value'))).toEqual(['', '0'])
    await wrapper.get('#attributes-add').setValue('0'); expect(state.value).toEqual([row('new-1')])
  })
  it('targets duplicate historical rows by UI ID and retains partial edits, evidence and survivor DOM through removal/remount', async () => {
    const first = row(), { wrapper, state, events, nextId, remount } = render([first, populated('b')])
    const field = wrapper.findAllComponents(Field)[1]!, target = state.value[1]!.target
    await field.get('input[id$="-value"]').setValue('1e+')
    expect(state.value[0]).toBe(first); expect(state.value[1]!.target).toBe(target)
    const expected = { ...populated('b'), input: { ...populated('b').input, payload: { type: 'number', value: '1e+', unit: 'g' } } }
    expect(state.value[1]).toEqual(expected)
    const element = field.get('input[id$="-value"]').element, confirm = vi.spyOn(window, 'confirm')
    await wrapper.findAll('[data-action="remove-assignment"]')[0]!.trigger('click')
    expect(confirm).not.toHaveBeenCalled(); expect(state.value).toEqual([expected])
    expect(wrapper.getComponent(Field).get('input[id$="-value"]').element).toBe(element)
    expect(wrapper.find('#attributes-add option[value="0"]').exists()).toBe(false)
    await remount(); expect(wrapper.get('input[id$="-value"]').element).toHaveProperty('value', '1e+')
    expect(wrapper.get('input[id$="-date"]').element).toHaveProperty('value', '2026-')
    expect(events).toHaveLength(2); expect(nextId).not.toHaveBeenCalled()
  })
  it('detaches child updates without letting payloads replace wrapper target or survivor identity', async () => {
    const survivor = row('b'), { wrapper, state } = render([row(), survivor]), input = populated().input
    wrapper.getComponent(Field).vm.$emit('update:modelValue', input); await nextTick()
    expect(state.value[0]!.input).toEqual(input); expect(state.value[0]!.input).not.toBe(input); expect(state.value[1]).toBe(survivor)
    expect(state.value[0]!.target).toEqual(row().target)
    if (input.state === 'known' && input.payload.type === 'number') input.payload.value = 'mutated'
    expect(state.value[0]).toEqual(populated())
  })
  it.each(['family', 'definition ID', 'definition code', 'binding owner', 'subject'])('retains unavailable %s history literally without guessed editors, allocation or pruning', async kind => {
    const initial = kind === 'subject' ? [{ id: 'a', target: { code: 'none', owner: 'sellable' as const, variantId: 'gone' }, input: { state: 'unknown' as const } }] : [populated()]
    const { wrapper, state, currentFamily, currentDefinitions, events, nextId, remount } = render(initial)
    if (kind === 'family') currentFamily.value = null
    if (kind === 'definition ID') currentDefinitions.value = [{ ...definitions[0]!, id: 'other' }]
    if (kind === 'definition code') currentDefinitions.value = [{ ...definitions[0]!, code: 'other' }]
    if (kind === 'binding owner') currentFamily.value = { ...family, bindings: [binding('n', 'mass', 'sellable')] }
    await nextTick(); expect(wrapper.findComponent(Field).exists()).toBe(false)
    expect(wrapper.text()).toContain('No disponible'); expect(wrapper.get('pre').text()).toContain(JSON.stringify(initial[0]!.input))
    await remount(); expect(state.value).toBe(initial); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
    await wrapper.get('[data-action="remove-assignment"]').trigger('click'); expect(state.value).toEqual([])
    expect(events).toHaveLength(1); expect(nextId).not.toHaveBeenCalled()
  })
  it('delegates a real metadata/payload mismatch without converting it and passes feedback by UI ID', async () => {
    const first: Row = { ...row(), target: { code: 'none', owner: 'sellable', variantId: null }, input: { state: 'known', payload: { type: 'single', value: 'old' }, evidence: null } }
    const mismatch: Row = { ...row('b'), input: { state: 'known', payload: { type: 'text', value: 'historic' }, evidence: null } }
    const { wrapper, state, events } = render([first, mismatch])
    const fields = wrapper.findAllComponents(Field)
    expect(fields[0]!.props('conservedOptions')).toEqual(['old']); expect(fields[1]!.props('conservedOptions')).toBeUndefined()
    expect(fields[0]!.get('option[value="old"]').element).toHaveProperty('disabled', false)
    expect(fields[0]!.text()).toContain('<img src=x> Revisar'); expect(wrapper.find('img').exists()).toBe(false)
    expect(fields[1]!.text()).toContain('El tipo guardado no coincide'); expect(state.value[1]).toBe(mismatch); expect(events).toEqual([])
    await fields[1]!.get('select[id$="-state"]').setValue('known')
    expect(state.value[1]!.input).toEqual({ state: 'known', payload: { type: 'number', value: '' }, evidence: null })
  })
  it('ignores already-used/invalid synthetic additions and stale child/removal callbacks', async () => {
    const { wrapper, state, events, nextId } = render([row()])
    const select = wrapper.get('#attributes-add').element as HTMLSelectElement
    for (const value of ['0', '99', '-1', '0.5']) {
      select.add(new Option('stale', value)); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
      expect(select.value).toBe('')
    }
    expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
    const field = wrapper.getComponent(Field), remove = wrapper.get('[data-action="remove-assignment"]').element
    state.value = []; await nextTick()
    field.vm.$emit('update:modelValue', { state: 'unknown' }); remove.dispatchEvent(new Event('click', { bubbles: true })); await nextTick()
    expect(state.value).toEqual([]); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it('suppresses disabled native and synthetic actions with unchanged raw state and no allocations', async () => {
    const initial = [populated()], { wrapper, state, events, nextId } = render(initial, true)
    const select = wrapper.get('#attributes-add').element as HTMLSelectElement
    expect(select.matches(':disabled')).toBe(true)
    select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true }))
    wrapper.getComponent(Field).vm.$emit('update:modelValue', { state: 'unknown' })
    wrapper.get('[data-action="remove-assignment"]').element.dispatchEvent(new Event('click', { bubbles: true })); await nextTick()
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled(); expect(select.value).toBe('')
  })
  it('leaves atomic document encoding derived: incomplete child rejects candidate, omission does not erase its raw wrapper', async () => {
    const { wrapper, state } = render([populated()])
    const document = () => ({ schemaVersion: 2 as const, commercialTitle: 'Título', description: null, mediaRefs: [], familyCode: 'custom', values: state.value, facts: [] })
    expect(resolveEditorialDocumentEditingState(document())).toEqual({ status: 'incomplete' })
    await wrapper.getComponent(Field).get('select[id$="-state"]').setValue('omitted')
    expect(state.value).toEqual([row()])
    const result = resolveEditorialDocumentEditingState(document())
    expect(result.status).toBe('complete')
    if (result.status === 'complete') { expect(result.document.values).toEqual([]); expect(JSON.stringify(result.document)).not.toContain('"id"') }
  })
})
