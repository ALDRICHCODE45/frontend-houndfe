import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import List from '../EditorialContractFactsList.vue'
import Row from '../EditorialContractFactsRow.vue'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from '../../../utils/editorial-contract-facts-editing'
const empty = (id = 'a', variantId: string | null = null): EditorialFactsEditingRow => ({ id, variantId, presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } })
const subjects = [{ variantId: null, label: 'Producto simple' }, { variantId: 'v', label: '<img src=x> Variante' }]
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.restoreAllMocks() })
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function render(initial: EditorialFactsEditingState = [], disabled = false) {
  const state = shallowRef(freeze(initial)), choices = shallowRef(subjects), version = shallowRef(0), events: EditorialFactsEditingState[] = []
  const published = JSON.stringify(initial), nextId = vi.fn(() => 'new-' + (events.length + 1))
  const wrapper = mount(defineComponent({ setup: () => () => h(List, { key: version.value, id: 'facts', modelValue: state.value,
    subjects: choices.value, allowed: [], careAllowed: false, disabled, nextId, issue: '<img src=x> Revisar',
    'onUpdate:modelValue': (value: EditorialFactsEditingState) => { events.push(value); state.value = freeze(value) },
  }) }))
  stops.push(() => { expect(JSON.stringify(initial)).toBe(published); wrapper.unmount() })
  return { wrapper, state, choices, events, nextId, async remount() { version.value++; await nextTick() } }
}
describe('controlled facts collection', () => {
  it('keeps absence on render/remount, creates only explicit nullable/variant subjects and resets native selection', async () => {
    const { wrapper, state, events, nextId, remount } = render()
    await remount(); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.get('#facts-add').setValue('0')
    expect(state.value).toEqual([empty('new-1')]); expect(nextId).toHaveBeenCalledOnce()
    expect(wrapper.get('#facts-add').element).toHaveProperty('value', '')
    expect(wrapper.find('#facts-add option[value="0"]').exists()).toBe(false)
    await wrapper.get('#facts-add').setValue('1')
    expect(state.value).toEqual([empty('new-1'), empty('new-2', 'v')]); expect(nextId).toHaveBeenCalledTimes(2)
    expect(wrapper.get('#facts-add').element).toHaveProperty('value', '')
    expect(wrapper.findAll('#facts-add option')).toHaveLength(1)
    await remount(); expect(events).toHaveLength(2); expect(nextId).toHaveBeenCalledTimes(2)
  })
  it('retains exact raw child updates and survivor objects across remount without subject substitution', async () => {
    const survivor = empty('b', 'v'), { wrapper, state, events, remount } = render([empty(), survivor])
    await wrapper.get('#facts-row-a-presentation').setValue(' incompleto\n ')
    expect(state.value[0]!.presentation).toBe(' incompleto\n '); expect(state.value[1]).toBe(survivor)
    const payload = { ...empty(), presentation: 'separado' }
    wrapper.getComponent(Row).vm.$emit('update:modelValue', payload); await nextTick()
    expect(state.value[0]).not.toBe(payload); expect(state.value[1]).toBe(survivor)
    payload.presentation = 'mutado'; expect(state.value[0]!.presentation).toBe('separado')
    await remount(); expect(wrapper.get('#facts-row-a-presentation').element).toHaveProperty('value', 'separado')
    const before = state.value, count = events.length
    wrapper.getComponent(Row).vm.$emit('update:modelValue', { ...empty(), id: 'missing' })
    wrapper.getComponent(Row).vm.$emit('update:modelValue', { ...empty(), variantId: 'v' })
    wrapper.getComponent(Row).vm.$emit('remove', 'missing'); await nextTick()
    expect(state.value).toBe(before); expect(events).toHaveLength(count)
  })
  it('retains unavailable and duplicate subject history on metadata changes without allocating or pruning', async () => {
    const initial = [empty(), empty('duplicate'), empty('orphan', 'gone')]
    const { wrapper, state, choices, events, nextId } = render(initial)
    choices.value = []; await nextTick()
    expect(wrapper.findAllComponents(Row)).toHaveLength(3)
    expect(wrapper.text()).not.toContain('gone'); expect(wrapper.text()).toContain('Presentación'); expect(wrapper.text()).toContain('ya no existe')
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it.each(['whitespace', 'omitted declaration', 'unknown care', 'prepared care'])('confirms %s deletion by UI ID, cancelling exactly and preserving survivors', async kind => {
    const first = empty(), second = empty('duplicate')
    if (kind === 'whitespace') first.presentation = ' \n '
    if (kind === 'omitted declaration') first.declarations = [{ id: 'd', declarationKey: 'consumable', input: { state: 'omitted' } }]
    if (kind === 'unknown care') first.careReview = { state: 'unknown' }
    if (kind === 'prepared care') first.careReview = { state: 'prepared', jurisdiction: '', intendedUse: '', determination: null, basis: '', evidence: [], requirements: [], warnings: [] }
    const initial = [first, second], { wrapper, state, events, nextId } = render(initial)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.findAllComponents(Row)[0]!.get('[data-action="remove-facts"]').trigger('click')
    expect(confirm).toHaveBeenCalledWith('¿Quitar lo declarado para esta presentación? Se perderán los cambios sin guardar.')
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await wrapper.findAllComponents(Row)[0]!.get('[data-action="remove-facts"]').trigger('click')
    expect(confirm).toHaveBeenCalledTimes(2); expect(events).toHaveLength(1)
    expect(state.value).toEqual([second]); expect(state.value[0]).toBe(second); expect(nextId).not.toHaveBeenCalled()
  })
  it.each([null, 'v'])('removes empty subject %s without confirmation and preserves other rows', async subject => {
    const survivor = empty('b', 'v'), { wrapper, state, events, nextId } = render([empty('a', subject), survivor])
    const confirm = vi.spyOn(window, 'confirm')
    await wrapper.findAllComponents(Row)[0]!.get('[data-action="remove-facts"]').trigger('click')
    expect(confirm).not.toHaveBeenCalled(); expect(state.value).toEqual([survivor]); expect(state.value[0]).toBe(survivor)
    expect(events).toHaveLength(1); expect(nextId).not.toHaveBeenCalled()
  })
  it('ignores unavailable/already-used synthetic subject selections and resets the control', async () => {
    const { wrapper, state, events, nextId } = render([empty()])
    const select = wrapper.get('#facts-add').element as HTMLSelectElement
    for (const value of ['0', '999', '-1', '0.5']) {
      select.add(new Option('stale', value)); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
      expect(select.value).toBe('')
    }
    expect(state.value).toEqual([empty()]); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled()
  })
  it('blocks disabled native and synthetic actions without allocation, dialog or emission', async () => {
    const initial = [{ ...empty(), presentation: 'populated' }], { wrapper, state, events, nextId } = render(initial, true)
    const confirm = vi.spyOn(window, 'confirm'), select = wrapper.get('#facts-add').element as HTMLSelectElement
    expect(select.disabled).toBe(true); select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true }))
    const row = wrapper.getComponent(Row); expect(row.props('disabled')).toBe(true)
    row.vm.$emit('update:modelValue', { ...empty(), presentation: 'ignored' }); row.vm.$emit('remove', 'a'); await nextTick()
    expect(state.value).toBe(initial); expect(events).toEqual([]); expect(nextId).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled()
    expect(select.value).toBe('')
  })
})
