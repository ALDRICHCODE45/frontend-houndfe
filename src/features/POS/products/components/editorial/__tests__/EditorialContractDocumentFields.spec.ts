import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import DocumentFields from '../EditorialContractDocumentFields.vue'
import Family from '../EditorialContractFamilyField.vue'
import Assignments from '../EditorialContractAssignmentList.vue'
import Attribute from '../EditorialContractAttributeField.vue'
import Facts from '../EditorialContractFactsList.vue'
import Care from '../EditorialCareReviewField.vue'
import type { EditorialContractVocabulary } from '../../../interfaces/editorial-contract-vocabulary.types'
import { resolveEditorialDocumentEditingState, type EditorialDocumentEditingState as State } from '../../../utils/editorial-contract-document-editing'
import { projectEditorialDeclarationChoices } from '../../../utils/editorial-contract-declaration-choices'
const vocabulary: EditorialContractVocabulary = {
  semanticsVersion: 'editorial-production-1',
  definitions: [{ id: 'mass', code: 'measure.net_mass', label: 'Masa', type: 'number', units: [{ code: 'g', label: 'Gramos', sortOrder: 0 }], numericPolicy: { status: 'pending' } }],
  families: ['care', 'hygiene', 'custom'].map(code => ({ id: code, code, label: code, bindings: [{ definitionId: 'mass', definitionCode: 'measure.net_mass', owner: 'product', sortOrder: 0, exposure: 'INTERNAL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' } }] })),
}
const subjects = [{ variantId: null, label: 'Producto simple' }]
function initial(): State {
  return { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: ['<img src=x>', 'private-asset'], familyCode: 'care',
    values: [{ id: 'a', target: { code: 'measure.net_mass', owner: 'product', variantId: null }, input: { state: 'known', payload: { type: 'number', value: '2', unit: 'g' }, evidence: null } }],
    facts: [{ id: 'f', variantId: null, presentation: 'Original', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }],
  }
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks() })
function render(input = initial(), disabled = false) {
  const state = shallowRef(freeze(input)), metadata = shallowRef(freeze(structuredClone(vocabulary))), version = shallowRef(0)
  const events: State[] = [], nextId = vi.fn(() => `new-${events.length}`), published = freeze(structuredClone(input)), before = JSON.stringify(input)
  const assignmentFeedback = new Map([['a', { issue: '<img src=x> Revisar', conservedOptions: ['old'] }]])
  const wrapper = mount(defineComponent({ setup: () => () => h(DocumentFields, { key: version.value, id: 'document', modelValue: state.value,
    vocabulary: metadata.value, subjects, nextId, disabled, issue: '<img src=x> Diagnóstico', assignmentFeedback,
    'onUpdate:modelValue': (value: State) => { events.push(value); state.value = freeze(value) },
  }) }))
  stops.push(() => { expect(JSON.stringify(input)).toBe(before); expect(JSON.stringify(published)).toBe(before); wrapper.unmount() })
  return { wrapper, state, metadata, events, nextId, assignmentFeedback, async remount() { version.value++; await nextTick() } }
}
describe('controlled document fields', () => {
  it('renders without effects, retains null and read-only literal media, and never allocates on remount', async () => {
    const input = initial(), { wrapper, state, events, nextId, remount } = render(input)
    expect(wrapper.findComponent(Family).exists()).toBe(true)
    expect(wrapper.getComponent(Family).props('modelValue')).toBe(input)
    expect(wrapper.get('#document-title').element).toHaveProperty('value', '')
    expect(wrapper.get('#document-description').element).toHaveProperty('value', '')
    expect(wrapper.text()).toContain('Referencias de medios (2)'); expect(wrapper.text()).toContain('<img src=x>')
    expect(wrapper.find('img').exists()).toBe(false); expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-media-reference]')).toHaveLength(2)
    expect(wrapper.get('#document-title').attributes('aria-describedby')).toBe('document-issue')
    await remount(); expect(state.value).toBe(input); expect(state.value.commercialTitle).toBeNull(); expect(state.value.description).toBeNull()
    expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it('preserves exact title/description edits and explicit empty strings without replacing collections or media', async () => {
    const { wrapper, state, events, nextId } = render(), values = state.value.values, facts = state.value.facts, media = state.value.mediaRefs
    await wrapper.get('#document-title').setValue('  Título <b>  ')
    await wrapper.get('#document-description').setValue('  descripción\n ')
    expect(state.value.commercialTitle).toBe('  Título <b>  '); expect(state.value.description).toBe('  descripción\n ')
    await wrapper.get('#document-title').setValue(''); await wrapper.get('#document-description').setValue('')
    expect(state.value.commercialTitle).toBe(''); expect(state.value.description).toBe('')
    expect(state.value.values).toBe(values); expect(state.value.facts).toBe(facts); expect(state.value.mediaRefs).toBe(media)
    expect(Object.keys(state.value)).toHaveLength(7); expect(events).toHaveLength(4); expect(nextId).not.toHaveBeenCalled()
  })
  it('keeps sibling identities and incomplete raw assignment/care edits through latest-prop forwarding and remount', async () => {
    const input = initial(); input.values[0]!.input = { state: 'known', payload: { type: 'number', value: '2', unit: 'g' }, evidence: { sourceRef: '  fuente ', verifiedOn: '2026-01-01' } }
    const { wrapper, state, events, nextId, remount } = render(input), facts = state.value.facts, media = state.value.mediaRefs
    await wrapper.getComponent(Attribute).get('input[id$="-value"]').setValue('1e-')
    await wrapper.getComponent(Attribute).get('input[id$="-date"]').setValue('2026-')
    expect(state.value.facts).toBe(facts); expect(state.value.mediaRefs).toBe(media)
    const values = state.value.values
    await wrapper.get('textarea[id$="-presentation"]').setValue('  presentación ')
    expect(state.value.values).toBe(values)
    await wrapper.getComponent(Care).get('select[id$="-state"]').setValue('prepared')
    await wrapper.getComponent(Care).get('textarea[id$="-jurisdiction"]').setValue('  jurisdicción ')
    expect(state.value.values).toBe(values); expect(state.value.facts[0]!.careRowIds).toEqual({ requirements: [], warnings: [] })
    expect(resolveEditorialDocumentEditingState(state.value)).toEqual({ status: 'incomplete' })
    await remount()
    expect(wrapper.getComponent(Attribute).get('input[id$="-value"]').element).toHaveProperty('value', '1e-')
    expect(wrapper.getComponent(Care).get('textarea[id$="-jurisdiction"]').element).toHaveProperty('value', '  jurisdicción ')
    expect(wrapper.getComponent(Attribute).get('input[id$="-date"]').element).toHaveProperty('value', '2026-')
    expect(wrapper.getComponent(Attribute).get('input[id$="-source"]').element).toHaveProperty('value', '  fuente ')
    expect(state.value.facts[0]!.id).toBe('f'); expect(events).toHaveLength(5); expect(nextId).not.toHaveBeenCalled()
    await wrapper.getComponent(Attribute).get('select[id$="-state"]').setValue('omitted')
    expect(resolveEditorialDocumentEditingState(state.value)).toEqual({ status: 'incomplete' }) // care is still incomplete
    expect(state.value.values[0]!.id).toBe('a'); expect(state.value.values[0]!.input).toEqual({ state: 'omitted' })
  })
  it.each(['hygiene', null])('delegates family cancellation/confirmation to the existing selector (%s)', async destination => {
    const input = initial(); input.values[0]!.input = { state: 'known', payload: { type: 'number', value: '1e-', unit: 'g' }, evidence: { sourceRef: ' ', verifiedOn: '2026-' } }
    const { wrapper, state, events, nextId, remount } = render(input), confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const selection = destination === null ? 'none' : '1'
    await wrapper.getComponent(Family).get('select').setValue(selection)
    expect(state.value).toBe(input); expect(events).toEqual([]); expect(confirm).toHaveBeenCalledOnce()
    expect(wrapper.getComponent(Family).get('select').element).toHaveProperty('value', '0')
    await remount(); expect(state.value).toBe(input)
    confirm.mockReturnValue(true); await wrapper.getComponent(Family).get('select').setValue(selection)
    expect(state.value).toEqual({ ...input, familyCode: destination, values: [], facts: [] })
    expect(state.value.mediaRefs).toBe(input.mediaRefs); expect(events).toHaveLength(1); expect(confirm).toHaveBeenCalledTimes(2)
    await wrapper.getComponent(Family).get('select').setValue('0')
    expect(state.value.values).toEqual([]); expect(state.value.facts).toEqual([]); expect(confirm).toHaveBeenCalledTimes(2)
    expect(nextId).not.toHaveBeenCalled()
  })
  it.each(['empty', 'omitted assignment', 'empty facts'])('keeps the sole helper clearing rule for %s collections', async kind => {
    const input = initial(); input.values = []; input.facts = []
    if (kind === 'omitted assignment') input.values = [{ ...initial().values[0]!, input: { state: 'omitted' } }]
    if (kind === 'empty facts') input.facts = [{ ...initial().facts[0]!, presentation: '' }]
    const { wrapper, state, events, nextId } = render(input), confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.getComponent(Family).get('select').setValue('none')
    expect(confirm).toHaveBeenCalledTimes(kind === 'empty' ? 0 : 1)
    if (kind === 'empty') { expect(state.value).toEqual({ ...input, familyCode: null }); expect(events).toHaveLength(1) }
    else { expect(state.value).toBe(input); expect(events).toEqual([]) }
    expect(nextId).not.toHaveBeenCalled()
  })
  it('derives selected-family choices/care only and retains duplicate history, feedback and unavailable metadata', async () => {
    const input = initial(); input.values.push({ ...structuredClone(input.values[0]!), id: 'b' })
    input.facts[0]!.careReview = { state: 'unknown' }
    const { wrapper, state, metadata, events, nextId, assignmentFeedback, remount } = render(input)
    expect(wrapper.getComponent(Assignments).props('feedback')).toBe(assignmentFeedback)
    expect(wrapper.findAllComponents(Attribute)).toHaveLength(2)
    expect(wrapper.findAllComponents(Attribute)[0]!.props('issue')).toBe('<img src=x> Revisar')
    expect(wrapper.findAllComponents(Attribute)[1]!.props('issue')).toBeUndefined()
    for (const code of ['care', 'hygiene', 'custom', null, 'missing']) {
      state.value = freeze({ ...input, familyCode: code }); await nextTick()
      const family = metadata.value.families.find(f => f.code === code) ?? null
      expect(wrapper.getComponent(Assignments).props('family')).toBe(family)
      expect(wrapper.getComponent(Facts).props('allowed')).toEqual(projectEditorialDeclarationChoices({ family, definitions: metadata.value.definitions }))
      expect(wrapper.getComponent(Facts).props('careAllowed')).toBe(code === 'care')
      expect(wrapper.findComponent(Care).exists()).toBe(true) // nonomitted historical care remains editable
    }
    metadata.value = freeze({ ...metadata.value, families: [] }); await nextTick(); await remount()
    expect(state.value.values).toBe(input.values); expect(state.value.facts).toBe(input.facts)
    expect(wrapper.getComponent(Assignments).props('family')).toBeNull(); expect(wrapper.getComponent(Facts).props('allowed')).toEqual([])
    expect(wrapper.findAll('pre')).toHaveLength(2); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it('keeps absent rows absent until explicit real-child creation, allocating only requested IDs', async () => {
    const input = initial(); input.values = []; input.facts = []
    const { wrapper, state, events, nextId, remount } = render(input)
    await remount(); expect(state.value).toBe(input); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
    expect(wrapper.findComponent(Care).exists()).toBe(false)
    expect(wrapper.getComponent(Assignments).props('subjects')).toBe(subjects); expect(wrapper.getComponent(Facts).props('subjects')).toBe(subjects)
    await wrapper.get('#document-assignments-add').setValue('0')
    const values = state.value.values
    expect(values).toEqual([{ id: 'new-0', target: { code: 'measure.net_mass', owner: 'product', variantId: null }, input: { state: 'omitted' } }])
    await wrapper.get('#document-facts-add').setValue('0')
    expect(state.value.values).toBe(values); expect(state.value.facts[0]).toEqual({ id: 'new-1', variantId: null, presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } })
    expect(nextId).toHaveBeenCalledTimes(2); expect(events).toHaveLength(2)
    expect(wrapper.get('#document-assignments-add').element).toHaveProperty('value', '')
    expect(wrapper.get('#document-facts-add').element).toHaveProperty('value', '')
    state.value = freeze({ ...state.value, familyCode: null }); await nextTick()
    expect(wrapper.findComponent(Care).exists()).toBe(false); expect(state.value.values).toBe(values)
    await remount(); expect(nextId).toHaveBeenCalledTimes(2); expect(events).toHaveLength(2)
  })
  it('retains distinct assignment immediate-removal and populated-facts confirmation semantics', async () => {
    const { wrapper, state, events, nextId } = render(), facts = state.value.facts, confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('[data-action="remove-assignment"]').trigger('click')
    expect(state.value.values).toEqual([]); expect(state.value.facts).toBe(facts); expect(confirm).not.toHaveBeenCalled()
    await wrapper.get('[data-action="remove-facts"]').trigger('click')
    expect(state.value.facts).toBe(facts); expect(events).toHaveLength(1); expect(confirm).toHaveBeenCalledOnce()
    confirm.mockReturnValue(true); await wrapper.get('[data-action="remove-facts"]').trigger('click')
    expect(state.value.facts).toEqual([]); expect(events).toHaveLength(2); expect(nextId).not.toHaveBeenCalled()
  })
  it('suppresses disabled native events and synthetic forwarding from every composed child', async () => {
    const input = initial(), { wrapper, state, events, nextId } = render(input, true), confirm = vi.spyOn(window, 'confirm')
    for (const selector of ['#document-title', '#document-description']) {
      const element = wrapper.get(selector).element as HTMLInputElement
      expect(element.matches(':disabled')).toBe(true); element.value = 'synthetic'; element.dispatchEvent(new Event('input', { bubbles: true }))
    }
    wrapper.getComponent(Family).vm.$emit('update:modelValue', { ...input, familyCode: null, values: [], facts: [] })
    wrapper.getComponent(Assignments).vm.$emit('update:modelValue', [])
    wrapper.getComponent(Facts).vm.$emit('update:modelValue', [])
    await nextTick()
    expect(state.value).toBe(input); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.getComponent(Family).props('disabled')).toBe(true)
    expect(wrapper.getComponent(Assignments).props('disabled')).toBe(true); expect(wrapper.getComponent(Facts).props('disabled')).toBe(true)
  })
})
