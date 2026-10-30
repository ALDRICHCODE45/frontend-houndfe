import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Field from '../EditorialContractDeclarationField.vue'
import type { EditorialDeclarationValues } from '../../../interfaces/editorial-contract-declaration.types'
import { resolveEditorialDeclarationInput, type EditorialDeclarationInput } from '../../../utils/editorial-contract-declaration-input'
type Key = keyof EditorialDeclarationValues
const evidence = { sourceRef: ' fuente ', verifiedOn: '2026-01-01' }
const defaults: [Key, unknown][] = [
  ['contentMagnitude', null], ['consumable', null], ['animalApplied', null], ['fitDeterminesChoice', null],
  ['capacityDeterminesChoice', null], ['electricalApplies', null], ['relevantDimensionCodes', { codes: [], toyTypes: [] }],
  ['relevantFitCodes', []], ['relevantCapacityCodes', []], ['relevantEquipmentCodes', []],
  ['presentationKind', null], ['optionalNonpertinenceCodes', []],
]
const known = (key: Key, value: unknown): EditorialDeclarationInput => ({ key, state: 'known', value, evidence: { ...evidence }, basis: ' base ' }) as EditorialDeclarationInput
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()) })
function render(declarationKey: Key, initial: EditorialDeclarationInput = { state: 'omitted' }, disabled = false, issue?: string) {
  const raw = shallowRef(initial), key = shallowRef(0), before = JSON.stringify(initial)
  const wrapper = mount(defineComponent({ setup: () => () => h(Field, { key: key.value, id: 'field', label: 'Declaración', declarationKey,
    modelValue: raw.value, disabled, issue,
    choices: declarationKey === 'relevantDimensionCodes'
      ? [{ code: 'measure.dimensions.external_width', label: 'Ancho' }, { code: 'measure.dimensions.external_length', label: 'Largo' }]
      : declarationKey === 'relevantCapacityCodes' ? [{ code: 'measure.capacity.container', label: 'Capacidad' }]
        : declarationKey === 'relevantEquipmentCodes' ? [{ code: 'measure.equipment.power', label: 'Potencia' }]
          : declarationKey === 'optionalNonpertinenceCodes' ? [{ code: 'feature.washable', label: 'Lavable' }]
            : [{ code: 'measure.fit.chest', label: 'Pecho' }, { code: 'measure.fit.neck', label: 'Cuello' }],
    toyTypeChoices: [{ code: 'ball', label: 'Pelota' }, { code: 'rope', label: 'Cuerda' }],
    'onUpdate:modelValue': (next: EditorialDeclarationInput) => { raw.value = next } }) }))
  stops.push(() => { expect(JSON.stringify(initial)).toBe(before); wrapper.unmount() })
  return { wrapper, raw, async remount() { key.value++; await nextTick() } }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const selected = (element: Element) => Array.from((element as HTMLSelectElement).selectedOptions, o => o.value)
describe('controlled declaration field S39', () => {
  it.each(defaults)('initializes %s only on explicit known selection', async (key, value) => {
    const { wrapper, raw } = render(key)
    expect(wrapper.get('legend').text()).toBe('Declaración')
    expect(wrapper.get('#field-state').findAll('option').map(o => o.text())).toEqual(['Sin asignación', 'Desconocido', 'Valor conocido'])
    await wrapper.get('#field-state').setValue('known')
    expect(raw.value).toEqual({ key, state: 'known', value, evidence: null, basis: '' })
    expect(wrapper.find('#field-basis').exists()).toBe(true)
  })
  it('changes omitted/unknown/known explicitly without restoring old content', async () => {
    const { wrapper, raw } = render('consumable', known('consumable', false))
    await wrapper.get('#field-state').setValue('unknown'); expect(raw.value).toEqual({ key: 'consumable', state: 'unknown' })
    await wrapper.get('#field-state').setValue('omitted'); expect(raw.value).toEqual({ state: 'omitted' })
    await wrapper.get('#field-state').setValue('known')
    expect(raw.value).toEqual({ key: 'consumable', state: 'known', value: null, evidence: null, basis: '' })
  })
  it('preserves mismatched keys until explicit correction, including unknown', async () => {
    const initial = freeze(known('animalApplied', true)), { wrapper, raw } = render('consumable', initial)
    expect(wrapper.get('[role="status"]').text()).toContain('no coincide')
    expect(wrapper.find('#field-value').exists()).toBe(false); expect(raw.value).toBe(initial)
    await wrapper.get('#field-state').setValue('known'); expect(raw.value).toEqual({ key: 'consumable', state: 'known', value: null, evidence: null, basis: '' })
    raw.value = { key: 'animalApplied', state: 'unknown' }; await nextTick()
    expect(wrapper.get('[role="status"]').text()).toContain('no coincide')
  })
  it('distinguishes boolean null, false and true without mutating frozen props', async () => {
    const { wrapper, raw } = render('consumable', freeze(known('consumable', null)))
    for (const [token, value] of [['false', false], ['true', true], ['', null]] as const) {
      await wrapper.get('#field-value').setValue(token)
      expect(raw.value).toEqual(known('consumable', value))
    }
  })
  it.each([
    ['contentMagnitude', ['Masa', 'Volumen', 'Cantidad', 'Longitud', 'Área'], ['mass', 'volume', 'count', 'length', 'area']],
    ['presentationKind', ['Formulación', 'Dispositivo', 'Envase'], ['formulation', 'device', 'packaging']],
  ] as const)('uses only finite Spanish %s choices', async (key, labels, codes) => {
    const { wrapper, raw } = render(key, known(key, null))
    expect(wrapper.get('#field-value').findAll('option').map(o => o.text())).toEqual(['Selecciona un valor', ...labels])
    for (const code of [...codes, '']) {
      await wrapper.get('#field-value').setValue(code); expect(raw.value).toEqual(known(key, code || null))
    }
  })
  it('retains ordered lists and missing selection in actual DOM through rerender/remount; explicitly empties', async () => {
    const initial = freeze(known('relevantFitCodes', ['measure.fit.neck', 'lost', 'measure.fit.chest']))
    const { wrapper, raw, remount } = render('relevantFitCodes', initial)
    expect(wrapper.get('#field-value').findAll('option').map(o => o.text())).toEqual(['Pecho', 'Cuello', 'lost (No disponible)'])
    expect(wrapper.get('option[value="lost"]').attributes('disabled')).toBeDefined()
    const check = () => expect(selected(wrapper.get('#field-value').element)).toEqual(['measure.fit.chest', 'measure.fit.neck', 'lost'])
    check(); raw.value = { ...initial }; await nextTick(); check(); await remount(); check()
    expect(raw.value).toEqual(initial)
    await wrapper.get('#field-value').setValue([]); expect(raw.value).toEqual(known('relevantFitCodes', []))
  })
  it.each([
    ['relevantFitCodes', 'measure.fit.neck'], ['relevantCapacityCodes', 'measure.capacity.container'],
    ['relevantEquipmentCodes', 'measure.equipment.power'], ['optionalNonpertinenceCodes', 'feature.washable'],
  ] as const)('edits and explicitly empties %s without altering evidence/basis', async (key, code) => {
    const { wrapper, raw, remount } = render(key, freeze(known(key, [])))
    await wrapper.get('#field-value').setValue([code]); await remount()
    expect(raw.value).toEqual(known(key, [code]))
    expect(selected(wrapper.get('#field-value').element)).toEqual([code])
    await wrapper.get('#field-value').setValue([]); expect(raw.value).toEqual(known(key, []))
  })
  it('retains missing toy types selected and disabled through remount', async () => {
    const initial = freeze(known('relevantDimensionCodes', { codes: [], toyTypes: ['lost', 'rope'] }))
    const { wrapper, raw, remount } = render('relevantDimensionCodes', initial)
    expect(wrapper.get('#field-toys option[value="lost"]').text()).toBe('lost (No disponible)')
    expect(wrapper.get('#field-toys option[value="lost"]').attributes('disabled')).toBeDefined()
    await remount(); expect(selected(wrapper.get('#field-toys').element)).toEqual(['rope', 'lost'])
    expect(raw.value).toEqual(initial)
  })
  it('edits dimension codes and toy types separately without changing untouched raw data', async () => {
    const { wrapper, raw, remount } = render('relevantDimensionCodes', freeze(known('relevantDimensionCodes', { codes: ['lost'], toyTypes: ['rope', 'ball'] })))
    await wrapper.get('#field-value').setValue(['measure.dimensions.external_length'])
    expect(raw.value).toEqual(known('relevantDimensionCodes', { codes: ['measure.dimensions.external_length'], toyTypes: ['rope', 'ball'] }))
    await wrapper.get('#field-toys').setValue(['rope']); await remount()
    expect(selected(wrapper.get('#field-value').element)).toEqual(['measure.dimensions.external_length'])
    expect(selected(wrapper.get('#field-toys').element)).toEqual(['rope'])
    expect(raw.value).toEqual(known('relevantDimensionCodes', { codes: ['measure.dimensions.external_length'], toyTypes: ['rope'] }))
  })
  it('keeps partial evidence and literal multiline basis across child remount, with no old-known fallback', async () => {
    const { wrapper, raw, remount } = render('consumable', known('consumable', false))
    await wrapper.get('#field-source').setValue(' <img src=x> ')
    await wrapper.get('#field-date').setValue('2026-0')
    await wrapper.get('#field-basis').setValue(' línea\n<img src=x> '); await remount()
    expect((wrapper.get('#field-date').element as HTMLInputElement).value).toBe('2026-0')
    expect((wrapper.get('#field-source').element as HTMLInputElement).value).toBe(' <img src=x> ')
    expect((wrapper.get('#field-basis').element as HTMLTextAreaElement).value).toBe(' línea\n<img src=x> ')
    expect(resolveEditorialDeclarationInput(raw.value)).toEqual({ status: 'incomplete' }); expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('#field-date').attributes('aria-describedby')).toBe('field-issue')
    expect(wrapper.get('#field-date').attributes('aria-invalid')).toBe('true')
    await wrapper.get('[data-action="remove-evidence"]').trigger('click')
    expect(raw.value.state === 'known' && raw.value.evidence).toBe(null)
    await wrapper.get('[data-action="add-evidence"]').trigger('click')
    expect(raw.value.state === 'known' && raw.value.evidence).toEqual({ sourceRef: '', verifiedOn: '' })
  })
  it('reports caller diagnostics with associated labels without claiming complete encoding is permission', () => {
    const { wrapper, raw } = render('consumable', known('consumable', false), false, 'Revisar declaración')
    expect(resolveEditorialDeclarationInput(raw.value).status).toBe('complete')
    expect(wrapper.get('#field-issue').text()).toBe('Revisar declaración')
    for (const control of wrapper.findAll('input, select, textarea')) {
      expect(wrapper.find(`label[for="${control.attributes('id')}"]`).exists()).toBe(true)
      expect(control.attributes('aria-describedby')).toBe('field-issue')
    }
  })
  it.each([false, true])('suppresses every disabled synthetic handler (evidence present=%s)', async present => {
    const initial = known('relevantDimensionCodes', { codes: [], toyTypes: [] })
    if (initial.state === 'known' && !present) initial.evidence = null
    const { wrapper, raw } = render('relevantDimensionCodes', freeze(initial), true)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    for (const control of wrapper.findAll('input, textarea, select, button')) {
      control.element.dispatchEvent(new Event(control.element.tagName === 'BUTTON' ? 'click' : control.element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }
    await nextTick(); expect(raw.value).toBe(initial)
  })
})
