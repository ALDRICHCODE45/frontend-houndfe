import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Field from '../EditorialContractAttributeField.vue'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import { resolveEditorialAssignmentInput, type EditorialAssignmentInput, type EditorialPayloadInput } from '../../../utils/editorial-contract-assignment-input'
const target = { code: 'measure', owner: 'product' as const, variantId: null }
function definition(type: EditorialDefinition['type']): EditorialDefinition {
  const base = { id: 'id', code: 'measure', label: 'Medida' }
  if (type === 'number' || type === 'range') return { ...base, type, numericPolicy: { status: 'pending' }, units: [
    { code: 'cm', label: 'Centímetros', sortOrder: 1 }, { code: null, label: null, sortOrder: 0 }] }
  if (type === 'single' || type === 'multi') return { ...base, type, aliases: [], groups: [], options: [
    { code: 'z', label: 'Zeta', archived: false, sortOrder: 2 }, { code: 'a', label: 'Alfa', archived: true, sortOrder: 0 }] }
  return { ...base, type }
}
const known = (payload: EditorialPayloadInput): EditorialAssignmentInput => ({ state: 'known', payload, evidence: null })
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()) })
function render(type: EditorialDefinition['type'], initial: EditorialAssignmentInput = { state: 'omitted' }, disabled = false, conservedOptions: string[] = []) {
  const input = shallowRef(structuredClone(initial)), key = shallowRef(0)
  const original = JSON.stringify(initial)
  const wrapper = mount(defineComponent({ setup: () => () => h(Field, { key: key.value, id: 'field', target,
    definition: definition(type), modelValue: input.value, disabled, conservedOptions,
    'onUpdate:modelValue': (next: EditorialAssignmentInput) => { input.value = next } }) }))
  cleanup.push(() => { expect(JSON.stringify(initial)).toBe(original); wrapper.unmount() })
  return { wrapper, input, key }
}
const cases: [EditorialDefinition['type'], EditorialPayloadInput][] = [
  ['text', { type: 'text', value: '' }], ['boolean', { type: 'boolean', value: null }],
  ['single', { type: 'single', value: null }], ['multi', { type: 'multi', value: [] }],
  ['number', { type: 'number', value: '' }], ['range', { type: 'range', min: '', max: '' }],
]
describe('controlled target assignment field', () => {
  it.each(cases)('starts %s without inventing a selection', async (type, payload) => {
    const { wrapper, input } = render(type)
    expect(wrapper.get('#field-state').findAll('option').map(o => o.text())).toEqual(['Sin asignación', 'Desconocido', 'No aplica', 'Valor conocido'])
    await wrapper.get('#field-state').setValue('known')
    expect(input.value).toEqual(known(payload))
    expect(wrapper.get('legend').text()).toBe('Medida')
  })
  it.each(['omitted', 'unknown', 'not_applicable'] as const)('explicit %s removes payload/evidence, without autosave', async state => {
    const { wrapper, input } = render('text', { state: 'known', payload: { type: 'text', value: 'history' }, evidence: { sourceRef: 'source', verifiedOn: '2026-01-01' } })
    await wrapper.get('#field-state').setValue(state)
    expect(input.value).toEqual({ state }); expect(wrapper.find('#field-value').exists()).toBe(false)
  })
  it('preserves literal text and empty text', async () => {
    const { wrapper, input } = render('text', known({ type: 'text', value: 'old' }))
    for (const value of ['<img src=x> ', '']) { await wrapper.get('#field-value').setValue(value); expect(input.value).toEqual(known({ type: 'text', value })) }
    expect(wrapper.find('img').exists()).toBe(false)
  })
  it('distinguishes unselected boolean from false and true', async () => {
    const { wrapper, input } = render('boolean', known({ type: 'boolean', value: null }))
    for (const [raw, value] of [['false', false], ['true', true], ['', null]] as const) {
      await wrapper.get('#field-value').setValue(raw); expect(input.value).toEqual(known({ type: 'boolean', value }))
    }
  })
  it.each(['single', 'multi'] as const)('%s keeps order and missing selected codes, disables unconserved archive', async type => {
    const payload: EditorialPayloadInput = type === 'single' ? { type, value: 'lost' } : { type, value: ['lost'] }
    const { wrapper, input } = render(type, known(payload))
    const options = wrapper.get('#field-value').findAll('option')
    expect(options.map(o => o.text())).toEqual([...(type === 'single' ? ['Selecciona una opción'] : []), 'Zeta', 'Alfa (archivada)', 'lost (No disponible)'])
    expect(wrapper.get('option[value="a"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('option[value="lost"]').attributes('disabled')).toBeDefined()
    expect(input.value).toEqual(known(payload))
    await wrapper.get('#field-value').setValue(type === 'single' ? 'z' : ['z'])
    expect(input.value).toEqual(known(type === 'single' ? { type, value: 'z' } : { type, value: ['z'] }))
    if (type === 'multi') { await wrapper.get('#field-value').setValue([]); expect(input.value).toEqual(known({ type, value: [] })) }
  })
  it('renders multiple selections, including missing codes, across parent updates and remount', async () => {
    const { wrapper, input, key } = render('multi', known({ type: 'multi', value: ['lost', 'a', 'z'] }), false, ['a'])
    const selected = () => Array.from((wrapper.get('#field-value').element as HTMLSelectElement).selectedOptions, option => option.value)
    expect(selected()).toEqual(['z', 'a', 'lost'])
    expect(input.value).toEqual(known({ type: 'multi', value: ['lost', 'a', 'z'] }))
    await wrapper.get('#field-value').setValue(['z', 'a'])
    key.value++; await wrapper.vm.$nextTick()
    expect(selected()).toEqual(['z', 'a'])
    expect(input.value).toEqual(known({ type: 'multi', value: ['z', 'a'] }))
  })
  it('enables only exact caller-conserved option codes', () => {
    const { wrapper } = render('single', known({ type: 'single', value: 'a' }), false, ['a'])
    expect(wrapper.get('option[value="a"]').attributes('disabled')).toBeUndefined()
  })
  it('retains raw numeric input and explicit no-unit across child remount', async () => {
    const { wrapper, input, key } = render('number', known({ type: 'number', value: '12', unit: 'cm' }))
    await wrapper.get('#field-value').setValue('1e-'); await wrapper.get('#field-unit').setValue('null')
    key.value++; await wrapper.vm.$nextTick()
    expect((wrapper.get('#field-value').element as HTMLInputElement).value).toBe('1e-')
    expect(input.value).toEqual(known({ type: 'number', value: '1e-', unit: null }))
    expect(resolveEditorialAssignmentInput(target, input.value)).toEqual({ status: 'incomplete' })
    expect(wrapper.get('#field-value').attributes('aria-describedby')).toBe('field-issue')
    expect(wrapper.get('#field-value').attributes('aria-invalid')).toBe('true')
    await wrapper.get('#field-value').setValue('0'); expect(resolveEditorialAssignmentInput(target, input.value).status).toBe('complete')
    await wrapper.get('#field-unit').setValue(''); expect(resolveEditorialAssignmentInput(target, input.value).status).toBe('incomplete')
  })
  it('retains range text and does not offer null units for ranges', async () => {
    const { wrapper, input } = render('range', known({ type: 'range', min: '9', max: '1', unit: 'cm' }))
    expect(wrapper.find('#field-unit option[value="null"]').exists()).toBe(false)
    await wrapper.get('#field-min').setValue('-'); await wrapper.get('#field-max').setValue('1e')
    expect(input.value).toEqual(known({ type: 'range', min: '-', max: '1e', unit: 'cm' }))
  })
  it('shows a missing stored unit without pruning or selecting another', () => {
    const initial = known({ type: 'number', value: '1', unit: 'lost' })
    const { wrapper, input } = render('number', initial)
    expect(wrapper.get('#field-unit').text()).toContain('lost (No disponible)'); expect(input.value).toEqual(initial)
  })
  it('keeps partial evidence through remount; only explicit removal restores null', async () => {
    const { wrapper, input, key } = render('text', known({ type: 'text', value: '' }))
    await wrapper.get('[data-action="add-evidence"]').trigger('click')
    await wrapper.get('#field-source').setValue(' Informe '); await wrapper.get('#field-date').setValue('2026-')
    key.value++; await wrapper.vm.$nextTick()
    expect((wrapper.get('#field-date').element as HTMLInputElement).value).toBe('2026-')
    expect(input.value).toEqual({ state: 'known', payload: { type: 'text', value: '' }, evidence: { sourceRef: ' Informe ', verifiedOn: '2026-' } })
    expect(resolveEditorialAssignmentInput(target, input.value)).toEqual({ status: 'incomplete' })
    await wrapper.get('[data-action="remove-evidence"]').trigger('click')
    expect(input.value).toEqual(known({ type: 'text', value: '' }))
  })
  it.each(cases)('disabled %s suppresses even synthetic input/change/click events', async (type, payload) => {
    const initial: EditorialAssignmentInput = { ...known(payload), state: 'known', payload, evidence: { sourceRef: 'Old', verifiedOn: '2026-01-01' } }
    const { wrapper, input } = render(type, initial, true)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    for (const node of wrapper.findAll('input, select, button')) {
      for (const name of ['input', 'change', 'click']) node.element.dispatchEvent(new Event(name, { bubbles: true }))
    }
    await wrapper.vm.$nextTick(); expect(input.value).toEqual(initial)
    expect(wrapper.findComponent(Field).emitted('update:modelValue')).toBeUndefined()
  })
  it('reports mismatched historical payload instead of converting it', () => {
    const initial = known({ type: 'text', value: 'history' })
    const { wrapper, input } = render('number', initial)
    expect(wrapper.text()).toContain('El tipo guardado no coincide'); expect(input.value).toEqual(initial)
    expect(wrapper.find('#field-value').exists()).toBe(false)
  })
})
