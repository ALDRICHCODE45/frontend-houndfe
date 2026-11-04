import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import List from '../EditorialDeclarationList.vue'
import Field from '../EditorialContractDeclarationField.vue'
import type { EditorialDeclarationValues } from '../../../interfaces/editorial-contract-declaration.types'
import type { EditorialDeclarationInput } from '../../../utils/editorial-contract-declaration-input'

type Key = keyof EditorialDeclarationValues
type Row = { id: string; declarationKey: Key; input: EditorialDeclarationInput }
type Allowed = { key: Key; label: string; choices?: readonly { code: string; label: string }[]; toyTypeChoices?: readonly { code: string; label: string }[] }
const allowed: Allowed[] = [
  { key: 'consumable', label: 'Consumible' },
  { key: 'relevantFitCodes', label: 'Ajustes', choices: [{ code: 'measure.fit.neck', label: 'Cuello' }] },
  { key: 'relevantDimensionCodes', label: 'Dimensiones', choices: [{ code: 'measure.dimensions.external_width', label: 'Ancho' }], toyTypeChoices: [{ code: 'ball', label: 'Pelota' }] },
]
const known = (value = false): EditorialDeclarationInput => ({ key: 'consumable', state: 'known', value,
  evidence: { sourceRef: ' fuente ', verifiedOn: '2026-01-01' }, basis: ' base ' })
const row = (id: string, input = known(), declarationKey: Key = 'consumable'): Row => ({ id, declarationKey, input })
const stops: (() => void)[] = []
afterEach(() => stops.splice(0).forEach(stop => stop()))
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function render(initial: Row[] = [], disabled = false, metadata = allowed) {
  const rows = shallowRef<readonly Row[]>(freeze(initial)), entries = shallowRef<readonly Allowed[]>(metadata), generation = shallowRef(0)
  const before = JSON.stringify(initial), events: unknown[][] = []
  const wrapper = mount(defineComponent({ setup: () => () => h(List, {
    key: generation.value, id: 'list', rows: rows.value, allowed: entries.value, disabled, issue: '<img src=x> Revisar',
    onUpdate: (id: string, input: EditorialDeclarationInput) => {
      events.push(['update', id, input]); rows.value = rows.value.map(item => item.id === id ? { ...item, input } : item)
    },
    onAdd: (key: Key) => {
      events.push(['add', key]); rows.value = [...rows.value, row(`new-${rows.value.length}`, { state: 'omitted' }, key)]
    },
    onRemove: (id: string) => { events.push(['remove', id]); rows.value = rows.value.filter(item => item.id !== id) },
  }) }))
  stops.push(() => { expect(JSON.stringify(initial)).toBe(before); wrapper.unmount() })
  return { wrapper, rows, entries, events, async remount() { generation.value++; await nextTick() } }
}
const selected = (element: Element) => Array.from((element as HTMLSelectElement).selectedOptions, option => option.value)

describe('EditorialDeclarationList S44', () => {
  it('keeps absent rows absent across metadata changes and remount', async () => {
    const { wrapper, rows, entries, events, remount } = render()
    expect(wrapper.findAllComponents(Field)).toHaveLength(0)
    expect(wrapper.get('#list-add').element).toHaveProperty('value', '')
    entries.value = [...allowed, { key: 'animalApplied', label: 'Aplicado' }]; await nextTick(); await remount()
    expect(rows.value).toEqual([]); expect(events).toEqual([])
    expect(wrapper.findAllComponents(Field)).toHaveLength(0)
    expect(wrapper.get('#list-issue').text()).toBe('<img src=x> Revisar')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('#list-add').attributes('aria-describedby')).toBe('list-issue')
    expect(wrapper.get('label[for="list-add"]').text()).toContain('Agregar')
  })
  it('adds only the selected allowed key as a parent-created omitted row and resets the native placeholder', async () => {
    const { wrapper, rows, events } = render()
    expect(wrapper.get('#list-add').findAll('option').map(option => option.text())).toEqual(['Elige una declaración', 'Consumible', 'Ajustes', 'Dimensiones'])
    await wrapper.get('#list-add').setValue('relevantFitCodes')
    expect(events).toEqual([['add', 'relevantFitCodes']])
    expect(rows.value).toEqual([row('new-0', { state: 'omitted' }, 'relevantFitCodes')])
    expect(wrapper.get('#list-add').element).toHaveProperty('value', '')
    const child = wrapper.getComponent(Field)
    expect(child.props('declarationKey')).toBe('relevantFitCodes')
    await child.get('select').setValue('known')
    expect(rows.value[0]?.input).toEqual({ key: 'relevantFitCodes', state: 'known', value: [], evidence: null, basis: '' })
    const add = wrapper.get('#list-add').element as HTMLSelectElement
    add.appendChild(Object.assign(document.createElement('option'), { value: 'animalApplied' }))
    add.value = 'animalApplied'; await wrapper.get('#list-add').trigger('change')
    expect(events.filter(event => event[0] === 'add')).toHaveLength(1)
    expect(add.value).toBe('')
  })
  it('preserves duplicate and unavailable history in order, using wrapper metadata rather than raw identity', async () => {
    const initial = [row('a'), row('b', known(true)), row('c', { key: 'relevantFitCodes', state: 'known', value: ['measure.fit.neck'], evidence: null, basis: '' }, 'relevantFitCodes')]
    const { wrapper, rows, entries, events } = render(initial, false, [allowed[0]!])
    const children = wrapper.findAllComponents(Field)
    expect(children.map(child => child.props('label'))).toEqual(['Consumible', 'Consumible', 'Medidas de ajuste relevantes'])
    expect(wrapper.text()).toContain('ya no está disponible')
    expect(wrapper.text()).not.toContain('relevantFitCodes')
    expect(children[2]!.props('choices')).toEqual([])
    expect(selected(children[2]!.get('select[multiple]').element)).toEqual(['measure.fit.neck'])
    expect(children[2]!.get('option[value="measure.fit.neck"]').text()).toContain('No disponible')
    entries.value = []; await nextTick()
    expect(wrapper.findAllComponents(Field)).toHaveLength(3)
    expect(rows.value).toEqual(initial); expect(events).toEqual([])
  })
  it('forwards partial raw edits by exact ID and preserves remaining inputs and selected DOM after sibling removal/remount', async () => {
    const fit: EditorialDeclarationInput = { key: 'relevantFitCodes', state: 'known', value: ['measure.fit.neck'], evidence: { sourceRef: 'x', verifiedOn: '2026-01-01' }, basis: '' }
    const { wrapper, rows, events, remount } = render([row('a'), row('b', known(true)), row('fit', fit, 'relevantFitCodes')])
    const children = wrapper.findAllComponents(Field)
    await children[1]!.get('input[id$="-date"]').setValue('2026-0')
    await children[1]!.get('textarea').setValue(' crudo\n ')
    expect(events[0]?.slice(0, 2)).toEqual(['update', 'b'])
    expect(rows.value[0]?.input).toEqual(known())
    const remaining = rows.value.slice(1)
    await wrapper.get('[data-row-id="a"] [data-action="remove"]').trigger('click')
    expect(events[events.length - 1]).toEqual(['remove', 'a'])
    await remount()
    expect(rows.value).toEqual(remaining)
    expect(wrapper.findAllComponents(Field).map(child => child.props('modelValue'))).toEqual(remaining.map(item => item.input))
    expect(wrapper.get('input[id$="-date"]').element).toHaveProperty('value', '2026-0')
    expect(selected(wrapper.get('select[multiple]').element)).toEqual(['measure.fit.neck'])
  })
  it('retains wrapper identity through known→omitted→remount→known with no hidden restoration', async () => {
    const { wrapper, rows, remount } = render([row('a')])
    await wrapper.getComponent(Field).get('select').setValue('omitted'); await remount()
    expect(rows.value).toEqual([row('a', { state: 'omitted' })])
    expect(wrapper.getComponent(Field).props('declarationKey')).toBe('consumable')
    await wrapper.getComponent(Field).get('select').setValue('known')
    expect(rows.value).toEqual([row('a', { key: 'consumable', state: 'known', value: null, evidence: null, basis: '' })])
  })
  it('preserves a mismatched raw key until explicit child correction', async () => {
    const mismatched: EditorialDeclarationInput = { key: 'animalApplied', state: 'unknown' }
    const { wrapper, rows, events, remount } = render([row('a', mismatched)])
    await remount()
    expect(wrapper.getComponent(Field).props('label')).toBe('Consumible')
    expect(wrapper.text()).toContain('no coincide')
    expect(rows.value[0]?.input).toEqual(mismatched); expect(events).toEqual([])
    await wrapper.getComponent(Field).get('select').setValue('known')
    expect(rows.value[0]?.input).toEqual({ key: 'consumable', state: 'known', value: null, evidence: null, basis: '' })
  })
  it('passes qualified dimension and toy choices without expanding them', () => {
    const { wrapper } = render([row('dim', { key: 'relevantDimensionCodes', state: 'known', value: { codes: [], toyTypes: ['ball'] }, evidence: null, basis: '' }, 'relevantDimensionCodes')])
    expect(wrapper.getComponent(Field).props('choices')).toEqual(allowed[2]!.choices)
    expect(wrapper.getComponent(Field).props('toyTypeChoices')).toEqual(allowed[2]!.toyTypeChoices)
    expect(selected(wrapper.get('select[id$="-toys"]').element)).toEqual(['ball'])
  })
  it('suppresses disabled synthetic add, child updates and removal without mutating props', async () => {
    const { wrapper, rows, events } = render([row('a')], true)
    expect(wrapper.get('#list-add').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-action="remove"]').attributes('disabled')).toBeDefined()
    expect(wrapper.getComponent(Field).props('disabled')).toBe(true)
    const add = wrapper.get('#list-add').element as HTMLSelectElement
    add.value = 'consumable'; add.dispatchEvent(new Event('change', { bubbles: true }))
    wrapper.getComponent(Field).vm.$emit('update:modelValue', { state: 'omitted' })
    wrapper.get('[data-action="remove"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(events).toEqual([]); expect(rows.value).toEqual([row('a')])
  })
})
