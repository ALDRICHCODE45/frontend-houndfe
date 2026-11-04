import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import FactsRow from '../EditorialContractFactsRow.vue'
import List from '../EditorialDeclarationList.vue'
import Field from '../EditorialContractDeclarationField.vue'
import Care from '../EditorialCareReviewField.vue'
import { EditorialSelectStub, stubEditorialSelect } from './editorialSelectStub'
import type { EditorialFactsEditingRow as Row } from '../../../utils/editorial-contract-facts-editing'
import type { EditorialDeclarationChoice } from '../../../utils/editorial-contract-declaration-choices'
beforeAll(stubEditorialSelect)
const allowed: EditorialDeclarationChoice[] = [{ key: 'consumable', label: 'Consumible', choices: [], toyTypeChoices: [] }]
function initial(): Row { return { id: 'facts', variantId: null, presentation: '', declarations: [
  { id: 'd1', declarationKey: 'consumable', input: { key: 'consumable', state: 'known', value: false, evidence: { sourceRef: '', verifiedOn: '2026-' }, basis: '' } },
  { id: 'd2', declarationKey: 'consumable', input: { state: 'omitted' } },
], careReview: { state: 'prepared', jurisdiction: '', intendedUse: '', determination: null, basis: '', evidence: [],
  requirements: [0, 1].map(() => ({ key: 'same', description: '', disposition: null, basis: '', evidence: [] })),
  warnings: [{ key: '', text: '', requirementKeys: ['same', '', 'same'], disclosure: null, handlingBasis: '', evidence: [] }] },
  careRowIds: { requirements: ['r1', 'r2'], warnings: ['w1'] } } }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks() })
function render(value = initial(), disabled = false, careAllowed = true) {
  const original = freeze(value), state = shallowRef(original), version = shallowRef(0), entries = shallowRef(allowed)
  const events: unknown[] = [], removals: string[] = [], before = JSON.stringify(original), published = freeze({ title: 'Published' })
  let counter = 0
  const nextId = vi.fn(() => 'new-' + ++counter)
  const wrapper = mount(defineComponent({ setup: () => () => h(FactsRow, {
    key: version.value, id: 'facts', subjectLabel: 'Producto simple', modelValue: state.value,
    allowed: entries.value, careAllowed, nextId, disabled, issue: '<img src=x> Revisar',
    'onUpdate:modelValue': (row: Row) => { events.push(row); state.value = freeze(row) }, onRemove: (id: string) => removals.push(id),
  }) }))
  stops.push(() => { expect(JSON.stringify(original)).toBe(before); expect(published).toEqual({ title: 'Published' }); wrapper.unmount() })
  return { wrapper, state, entries, events, removals, nextId, async remount() { version.value++; await nextTick() } }
}
describe('controlled facts row', () => {
  it('keeps empty raw state absent without allocating on render/remount', async () => {
    const value = initial(); value.declarations = []; value.careReview = { state: 'omitted' }; value.careRowIds = { requirements: [], warnings: [] }
    const { wrapper, state, events, nextId, remount } = render(value, false, false)
    expect(wrapper.text()).toContain('Producto simple'); expect(wrapper.text()).toContain('<img src=x> Revisar')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findComponent(Care).exists()).toBe(false)
    expect(wrapper.getComponent(List).props('rows')).toEqual([])
    await remount()
    expect(state.value).toEqual(value); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it('preserves exact presentation and partial declaration evidence across remount', async () => {
    const { wrapper, state, remount } = render()
    await wrapper.get('#facts-presentation').setValue(' crudo\n ')
    await wrapper.getComponent(Field).get('input[id$="-date"]').setValue('2026-0')
    await remount()
    expect(state.value.presentation).toBe(' crudo\n ')
    expect(wrapper.getComponent(Field).get('input[id$="-date"]').element).toHaveProperty('value', '2026-0')
    expect(state.value.variantId).toBeNull(); expect(state.value.id).toBe('facts')
  })
  it('adds explicit omitted rows, preserves duplicate keys and forwards omission/mismatch unchanged', async () => {
    const { wrapper, state, nextId, remount } = render()
    await wrapper.getComponent(List).get('select[id$="-add"]').setValue('consumable')
    expect(state.value.declarations[2]).toEqual({ id: 'new-1', declarationKey: 'consumable', input: { state: 'omitted' } })
    expect(nextId).toHaveBeenCalledOnce()
    wrapper.getComponent(List).vm.$emit('update', 'd1', { key: 'animalApplied', state: 'unknown' }); await nextTick()
    expect(state.value.declarations[0]!.declarationKey).toBe('consumable')
    expect(state.value.declarations[0]!.input).toEqual({ key: 'animalApplied', state: 'unknown' })
    wrapper.getComponent(List).vm.$emit('remove', 'd2'); await nextTick(); await remount()
    expect(state.value.declarations.map(row => row.id)).toEqual(['d1', 'new-1'])
    expect(wrapper.text()).toContain('no coincide')
  })
  it('retains all declarations on metadata loss instead of pruning history', async () => {
    const { wrapper, state, entries, events } = render()
    entries.value = []; await nextTick()
    expect(wrapper.findAllComponents(Field)).toHaveLength(2)
    expect(wrapper.text()).toContain('ya no está disponible')
    expect(state.value).toEqual(initial()); expect(events).toEqual([])
  })
  it('aligns care additions/deletions and preserves duplicate warning references', async () => {
    const { wrapper, state, nextId, remount } = render()
    wrapper.getComponent(Care).vm.$emit('removeRequirement', 0); await nextTick()
    expect(state.value.careRowIds).toEqual({ requirements: ['r2'], warnings: ['w1'] })
    if (state.value.careReview.state !== 'prepared') throw Error('fixture')
    expect(state.value.careReview.warnings[0]!.requirementKeys).toEqual(['same', '', 'same'])
    wrapper.getComponent(Care).vm.$emit('addRequirement'); await nextTick()
    wrapper.getComponent(Care).vm.$emit('addWarning'); await nextTick()
    expect(state.value.careRowIds).toEqual({ requirements: ['r2', 'new-1'], warnings: ['w1', 'new-2'] })
    wrapper.getComponent(Care).vm.$emit('removeWarning', 0); await nextTick(); await remount()
    expect(state.value.careRowIds.warnings).toEqual(['new-2']); expect(nextId).toHaveBeenCalledTimes(2)
  })
  it.each(['omitted', 'unknown'])('preserves raw/DOM on cancelled discard then clears care IDs after confirmed %s', async destination => {
    const { wrapper, state, events, nextId } = render(), confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.getComponent(Care).get('select').setValue(destination)
    expect(state.value).toEqual(initial()); expect(events).toEqual([])
    expect(wrapper.getComponent(Care).get('select').element).toHaveProperty('value', 'prepared')
    confirm.mockReturnValue(true)
    await wrapper.getComponent(Care).get('select').setValue(destination)
    expect(state.value.careReview).toEqual({ state: destination })
    expect(state.value.careRowIds).toEqual({ requirements: [], warnings: [] })
    expect(confirm).toHaveBeenCalledTimes(2); expect(nextId).not.toHaveBeenCalled()
  })
  it('retains unavailable care until explicit discard', async () => {
    const { wrapper, state } = render(initial(), false, false)
    expect(wrapper.text()).toContain('Esta familia no usa revisión de cuidado')
    expect(wrapper.findComponent(Care).exists()).toBe(true)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await wrapper.getComponent(Care).get('select').setValue('omitted')
    expect(wrapper.findComponent(Care).exists()).toBe(false)
    expect(state.value.careRowIds).toEqual({ requirements: [], warnings: [] })
  })
  it('emits only a whole-row removal intent without confirming or changing state', async () => {
    const { wrapper, state, removals, events } = render(), confirm = vi.spyOn(window, 'confirm')
    await wrapper.get('[data-action="remove-facts"]').trigger('click')
    expect(removals).toEqual(['facts']); expect(events).toEqual([])
    expect(state.value).toEqual(initial()); expect(confirm).not.toHaveBeenCalled()
  })
  it('ignores stale child identities and invalid indices', async () => {
    const { wrapper, events, nextId } = render()
    wrapper.getComponent(List).vm.$emit('update', 'missing', { state: 'omitted' })
    wrapper.getComponent(List).vm.$emit('remove', 'missing')
    wrapper.getComponent(List).vm.$emit('add', 'animalApplied')
    for (const index of [-1, 0.5, 50]) wrapper.getComponent(Care).vm.$emit('removeRequirement', index)
    await nextTick(); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it('blocks disabled native and synthetic child actions without allocation or confirmation', async () => {
    const { wrapper, state, events, removals, nextId } = render(initial(), true), confirm = vi.spyOn(window, 'confirm')
    expect(wrapper.get('#facts-presentation').attributes('disabled')).toBeDefined()
    expect(wrapper.getComponent(List).props('disabled')).toBe(true); expect(wrapper.getComponent(Care).props('disabled')).toBe(true)
    wrapper.get('#facts-presentation').element.dispatchEvent(new Event('input', { bubbles: true }))
    wrapper.get('[data-action="remove-facts"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const list = wrapper.getComponent(List), care = wrapper.getComponent(Care)
    list.vm.$emit('add', 'consumable'); list.vm.$emit('update', 'd1', { state: 'omitted' }); list.vm.$emit('remove', 'd1')
    care.vm.$emit('update:modelValue', { state: 'omitted' }); care.vm.$emit('addRequirement'); care.vm.$emit('addWarning')
    care.vm.$emit('removeRequirement', 0); care.vm.$emit('removeWarning', 0)
    await nextTick()
    expect(state.value).toEqual(initial()); expect(events).toEqual([]); expect(removals).toEqual([])
    expect(nextId).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled()
  })
})
