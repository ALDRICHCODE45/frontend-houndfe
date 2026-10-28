import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, defineComponent } from 'vue'
import EditorialDocumentFields from '../EditorialDocumentFields.vue'
import EditorialAttributeField from '../EditorialAttributeField.vue'
import type { EditorialDefinition, EditorialDocument, EditorialValue, EditorialVocabulary } from '../../../interfaces/product-editorial.types'
import { validateEditorialAssignments } from '../../../utils/product-editorial-assignment-validation'
const value: EditorialValue = { code: 'note', owner: 'product', variantId: null, type: 'text', value: 'CONSERVAR' }
const document: EditorialDocument = { commercialTitle: '  Original  ', description: null, mediaRefs: ['private'], familyCode: 'a', values: [value] }
const vocabulary: EditorialVocabulary = { families: [
  { id: 'a-id', code: 'a', label: 'Familia A', bindings: [{ definitionId: 'd', definitionCode: 'note', owner: 'product', sortOrder: 0 }] },
  { id: 'b-id', code: 'b', label: 'Familia B', bindings: [] },
], definitions: [{ id: 'd', code: 'note', label: 'Nota', type: 'text' }] }
function render() {
  return mount(defineComponent({ components: { EditorialDocumentFields }, setup() {
    return { doc: ref<EditorialDocument>(structuredClone(document)), vocabulary, baseline: document }
  }, template: '<EditorialDocumentFields :document="doc" :vocabulary="vocabulary" :context="{ variants: [] }" :baseline="baseline" :issues="[]" :disabled="false" @update:document="doc = $event" />' }))
}
describe('editorial correction regressions', () => {
  it('renders families in the received database order: Z then a', () => {
    const received: EditorialVocabulary = { definitions: [], families: [
      { id: 'Z', code: 'Z', label: 'Z', bindings: [] },
      { id: 'a', code: 'a', label: 'a', bindings: [] },
    ] }
    const before = JSON.stringify(received)
    const wrapper = mount(EditorialDocumentFields, { props: { document: { ...document, familyCode: null, values: [] },
      baseline: document, vocabulary: received, context: { variants: [] }, issues: [], disabled: false } })
    expect(JSON.stringify(received)).toBe(before)
    expect(wrapper.findAll('#editorial-family option').map(option => option.text())).toEqual(['Sin familia', 'Z', 'a'])
    wrapper.unmount()
  })

  it('renders binding choices in received database order despite equal sortOrder: Z then a', () => {
    const received: EditorialVocabulary = { definitions: [
      { id: 'Z', code: 'Z', label: 'Z', type: 'text' },
      { id: 'a', code: 'a', label: 'a', type: 'text' },
    ], families: [{ id: 'f', code: 'f', label: 'Familia', bindings: [
      { definitionId: 'Z', definitionCode: 'Z', owner: 'product', sortOrder: 0 },
      { definitionId: 'a', definitionCode: 'a', owner: 'product', sortOrder: 0 },
    ] }] }
    const before = JSON.stringify(received)
    const wrapper = mount(EditorialDocumentFields, { props: { document: { ...document, familyCode: 'f', values: [] },
      baseline: document, vocabulary: received, context: { variants: [] }, issues: [], disabled: false } })
    expect(JSON.stringify(received)).toBe(before)
    expect(wrapper.findAll('#editorial-add-binding option').map(option => option.text()))
      .toEqual(['Selecciona un atributo', 'Z · Producto', 'a · Producto'])
    wrapper.unmount()
  })

  it('renders options in received database order despite equal sortOrder: Z then a', () => {
    const definition: EditorialDefinition = { id: 'd', code: 'choice', label: 'Opción', type: 'single', options: [
      { code: 'Z', label: 'Z', archived: false, sortOrder: 0 },
      { code: 'a', label: 'a', archived: false, sortOrder: 0 },
    ] }
    const before = JSON.stringify(definition)
    const wrapper = mount(EditorialAttributeField, { props: { id: 'choice', definition, assignment: null,
      baseline: null, target: { owner: 'product', variantId: null }, disabled: false } })
    expect(JSON.stringify(definition)).toBe(before)
    expect(wrapper.findAll('#choice option').map(option => option.text())).toEqual(['Selecciona una opción', 'Z', 'a'])
    wrapper.unmount()
  })

  it('renders units in received database order, including the received null position', () => {
    const definition: EditorialDefinition = { id: 'd', code: 'measure', label: 'Medida', type: 'number', units: [
      { code: 'Z', label: 'Z', sortOrder: 0 },
      { code: 'a', label: 'a', sortOrder: 0 },
      { code: null, label: null, sortOrder: 0 },
    ] }
    const before = JSON.stringify(definition)
    const wrapper = mount(EditorialAttributeField, { props: { id: 'measure', definition, assignment: null,
      baseline: null, target: { owner: 'product', variantId: null }, disabled: false } })
    expect(JSON.stringify(definition)).toBe(before)
    expect(wrapper.findAll('#measure-unit option').map(option => option.text()))
      .toEqual(['Selecciona una unidad', 'Z', 'a', 'Sin unidad'])
    wrapper.unmount()
  })

  it.each(['201 assignments', '21 media'] as const)('conserves archived eligibility from history with %s without relaxing fresh caps', kind => {
    const archived: EditorialValue = { code: 'choice', owner: 'product', variantId: null, type: 'single', value: 'old' }
    const received: EditorialVocabulary = { families: [{ id: 'f', code: 'f', label: 'Familia', bindings: [
      { definitionId: 'choice', definitionCode: 'choice', owner: 'product', sortOrder: 0 },
    ] }], definitions: [{ id: 'choice', code: 'choice', label: 'Opción', type: 'single', options: [
      { code: 'old', label: 'Anterior', archived: true, sortOrder: 0 },
    ] }] }
    const baseline: EditorialDocument = { ...document, familyCode: 'f', values: [archived] }
    if (kind === '201 assignments') {
      for (let index = 0; index < 200; index++) {
        const code = `text-${index}`
        received.definitions.push({ id: code, code, label: code, type: 'text' })
        received.families[0]!.bindings.push({ definitionId: code, definitionCode: code, owner: 'product', sortOrder: index + 1 })
        baseline.values.push({ code, owner: 'product', variantId: null, type: 'text', value: 'Guardado' })
      }
    } else baseline.mediaRefs = Array.from({ length: 21 }, (_, index) => `private-${index}`)
    const candidate = { ...baseline, values: [archived] }
    const before = JSON.stringify({ baseline, candidate, received })
    const result = validateEditorialAssignments({ document: candidate, persistedBaseline: baseline,
      vocabulary: received, context: { variants: [] } })
    expect(result).toEqual(kind === '201 assignments' ? { valid: true, issues: [] }
      : { valid: false, issues: [{ code: 'limits' }] })
    const wrapper = mount(EditorialDocumentFields, { props: { document: candidate, baseline,
      vocabulary: received, context: { variants: [] }, issues: [], disabled: false } })
    expect(JSON.stringify({ baseline, candidate, received })).toBe(before)
    expect((wrapper.get('#editorial-value-0').element as HTMLSelectElement).value).toBe('old')
    expect(wrapper.get('#editorial-value-0 option[value="old"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('editorial document controls', () => {
  it('requires explicit family confirmation and cancel preserves all values', async () => {
    const wrapper = render()
    await wrapper.get('#editorial-family').setValue('b')
    expect(wrapper.text()).toContain('Confirmar cambio de familia')
    expect((wrapper.get('#editorial-value-0').element as HTMLInputElement).value).toBe('CONSERVAR')
    await wrapper.get('[data-testid="cancel-family"]').trigger('click')
    expect((wrapper.get('#editorial-family').element as HTMLSelectElement).value).toBe('a')
    expect((wrapper.get('#editorial-value-0').element as HTMLInputElement).value).toBe('CONSERVAR')
    await wrapper.get('#editorial-family').setValue('b')
    await wrapper.get('[data-testid="confirm-family"]').trigger('click')
    expect((wrapper.get('#editorial-family').element as HTMLSelectElement).value).toBe('b')
    expect(wrapper.find('[data-testid="assignment-0"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('1 referencias de medios conservadas')
    wrapper.unmount()
  })
  it('preserves missing binding values visibly and supports explicit removal without a repair promise', async () => {
    const wrapper = mount(EditorialDocumentFields, { props: { document: { ...document, values: [{ ...value, code: 'gone' }] },
      vocabulary, context: { variants: [] }, baseline: document, issues: [], disabled: false } })
    expect(wrapper.text()).toContain('Atributo huérfano')
    expect(wrapper.text()).toContain('CONSERVAR')
    expect(wrapper.text()).toContain('no garantiza')
    await wrapper.get('[data-testid="remove-0"]').trigger('click')
    expect(wrapper.emitted('update:document')?.[0]?.[0]).toEqual({ ...document, values: [] })
    wrapper.unmount()
  })
  it('adds only after an explicit binding and valid value choice, never inventing defaults', async () => {
    const wrapper = mount(EditorialDocumentFields, { props: { document: { ...document, values: [] }, vocabulary,
      context: { variants: [] }, baseline: document, issues: [], disabled: false } })
    expect(wrapper.emitted('update:document')).toBeUndefined()
    await wrapper.get('#editorial-add-binding').setValue('note')
    expect(wrapper.emitted('update:document')).toBeUndefined()
    await wrapper.get('#editorial-new-value').setValue('  Nueva nota  ')
    await wrapper.get('[data-testid="add-attribute"]').trigger('click')
    const emitted = wrapper.emitted('update:document')?.[0]?.[0] as EditorialDocument
    expect(emitted.values).toEqual([{ ...value, value: '  Nueva nota  ' }])
    wrapper.unmount()
  })
  it.each([
    [{ id: 'd', code: 'note', label: 'Nota', type: 'text' }, { ...value }, 'input', '  nuevo  ', '  nuevo  '],
    [{ id: 'd', code: 'note', label: 'Activo', type: 'boolean' }, { ...value, type: 'boolean', value: false }, 'select', 'true', true],
    [{ id: 'd', code: 'note', label: 'Medida', type: 'number', units: [{ code: null, label: null, sortOrder: 0 }] }, { ...value, type: 'number', value: 2, unit: null }, 'input', '3.5', 3.5],
    [{ id: 'd', code: 'note', label: 'Opción', type: 'single', options: [{ code: 'x', label: 'X', archived: false, sortOrder: 0 }] }, { ...value, type: 'single', value: 'x' }, 'select', 'x', 'x'],
    [{ id: 'd', code: 'note', label: 'Opciones', type: 'multi', options: [{ code: 'x', label: 'X', archived: false, sortOrder: 0 }] }, { ...value, type: 'multi', value: [] }, 'select', ['x'], ['x']],
  ])('emits typed %j values', async (definition, assignment, control, input, expected) => {
    const wrapper = mount(EditorialAttributeField, { props: { id: 'field', definition: definition as EditorialDefinition,
      assignment: assignment as EditorialValue, baseline: null, disabled: false } })
    await wrapper.get(control as string).setValue(input)
    expect((wrapper.emitted('update:assignment')?.[0]?.[0] as EditorialValue).value).toEqual(expected)
    wrapper.unmount()
  })
  it('does not leave a previous valid number saveable when its control is cleared', async () => {
    const wrapper = mount(EditorialAttributeField, { props: { id: 'number', disabled: false, baseline: null,
      definition: { id: 'n', code: 'n', label: 'Número', type: 'number', units: [{ code: null, label: null, sortOrder: 0 }] },
      assignment: { code: 'n', owner: 'product', variantId: null, type: 'number', value: 4, unit: null } } })
    await wrapper.get('input').setValue('')
    const emitted = wrapper.emitted('update:assignment')?.[0]?.[0] as EditorialValue
    expect(emitted?.type).toBe('number')
    expect(Number.isNaN(emitted?.value)).toBe(true)
    wrapper.unmount()
  })
  it('accepts a number entered before the explicit null unit choice, and reports incomplete edits', async () => {
    const definition: EditorialDefinition = { id: 'n', code: 'measure', label: 'Medida', type: 'number',
      units: [{ code: null, label: null, sortOrder: 0 }] }
    const wrapper = mount(EditorialAttributeField, { props: { id: 'number', definition, assignment: null,
      baseline: null, target: { owner: 'product', variantId: null }, disabled: false } })
    await wrapper.get('input').setValue('2.5')
    expect(wrapper.emitted('update:assignment')).toBeUndefined()
    await wrapper.get('select').setValue('null')
    expect(wrapper.emitted('update:assignment')?.[0]?.[0]).toEqual({ code: 'measure', owner: 'product', variantId: null, type: 'number', value: 2.5, unit: null })
    await wrapper.get('input').setValue('')
    expect(wrapper.emitted('validity')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })
  it('keeps archived options selectable only for the same persisted scope, even if locally removed', async () => {
    const definition: EditorialDefinition = { id: 'd', code: 'color', label: 'Color', type: 'single',
      options: [{ code: 'old', label: 'Anterior', archived: true, sortOrder: 0 }] }
    const assignment: EditorialValue = { code: 'color', owner: 'product', variantId: null, type: 'single', value: 'old' }
    const wrapper = mount(EditorialAttributeField, { props: { id: 'field', definition, assignment, baseline: assignment, disabled: false } })
    expect(wrapper.get('option[value="old"]').attributes('disabled')).toBeUndefined()
    await wrapper.setProps({ baseline: null })
    expect(wrapper.get('option[value="old"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
