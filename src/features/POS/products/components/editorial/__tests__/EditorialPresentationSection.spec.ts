/**
 * T13 (S15): the «Presentación» card. The T10 questions and their saved facts are unchanged; they now
 * show for the presentation picked in the switcher, as segments (with «No sé») or a combobox, with one
 * source and its date. Ported from the T10 presentation cards spec.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import Section from '../EditorialPresentationSection.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import type { EditorialDeclarationChoice } from '../../../utils/editorial-contract-declaration-choices'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from '../../../utils/editorial-contract-facts-editing'
import type { EditorialCardSource } from '../../../utils/editorial-presentation-card'
import { editorialSourceKey, editorialToday } from '../../../utils/editorial-presentation-card'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
const tick = () => new Promise(resolve => setTimeout(resolve, 60))
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
const choice = (key: EditorialDeclarationChoice['key'], choices: { code: string; label: string }[] = []): EditorialDeclarationChoice => ({ key, label: key, choices, toyTypeChoices: [] })
const families: Record<string, EditorialDeclarationChoice[]> = {
  food: [choice('contentMagnitude'), choice('optionalNonpertinenceCodes', [{ code: 'measure.pack_count', label: 'Piezas por paquete' }])],
  hygiene: [choice('contentMagnitude'), choice('consumable'), choice('animalApplied'), choice('relevantDimensionCodes', [{ code: 'measure.dimensions.external_length', label: 'Largo' }])],
  accessory: [choice('contentMagnitude'), choice('fitDeterminesChoice'), choice('electricalApplies'),
    choice('relevantFitCodes', [{ code: 'measure.fit.neck', label: 'Cuello' }, { code: 'measure.fit.chest', label: 'Pecho' }]),
    choice('relevantEquipmentCodes', [{ code: 'measure.equipment.power', label: 'Potencia' }])],
  care: [choice('contentMagnitude'), choice('presentationKind')],
  toy: [choice('contentMagnitude'), { ...choice('relevantDimensionCodes', [{ code: 'measure.dimensions.external_length', label: 'Largo' }, { code: 'measure.dimensions.external_width', label: 'Ancho' }]),
    toyTypeChoices: [{ code: 'pelota', label: 'Pelota' }, { code: 'cuerda', label: 'Cuerda' }] }],
}
const today = editorialToday()
const label = { sourceRef: 'Etiqueta del empaque', verifiedOn: today }
type Subject = { variantId: string | null; label: string }
const single: Subject[] = [{ variantId: null, label: 'Presentación' }]
const collar: Subject[] = [{ variantId: 'v1', label: 'Chico · Azul' }, { variantId: 'v2', label: 'Mediano · Rojo' }, { variantId: 'v3', label: 'Grande · Negro' }]

function render({ family = 'food', facts = [] as EditorialFactsEditingState, subjects = single, showErrors = false, readonly = false, disabled = false } = {}) {
  const state = shallowRef(facts), sources = shallowRef<ReadonlyMap<string, EditorialCardSource>>(new Map()), errors = shallowRef(showErrors)
  const selected = shallowRef(editorialSourceKey(subjects[0]?.variantId ?? null))
  let counter = 0
  const wrapper = mount(defineComponent({ setup: () => () => h(Section, { id: 'p', facts: state.value, subjects, choices: families[family]!, careAllowed: family === 'care',
    nextId: () => `n${++counter}`, sources: sources.value, productName: 'Croqueta', selected: selected.value, showErrors: errors.value, readonly, disabled,
    'onUpdate:facts': (value: EditorialFactsEditingState) => { state.value = value },
    'onUpdate:sources': (value: ReadonlyMap<string, EditorialCardSource>) => { sources.value = value },
    'onUpdate:selected': (value: string) => { selected.value = value } }) }), { attachTo: document.body })
  return { wrapper, state, errors, selected }
}
type Wrapper = ReturnType<typeof render>['wrapper']
const questions = (wrapper: Wrapper) => wrapper.findAll('[data-question]').map(item => item.get('.hf-form-field__label').text())
const question = (wrapper: Wrapper, text: string) => wrapper.findAll('[data-question]').find(item => item.get('.hf-form-field__label').text() === text)!
const segments = (wrapper: Wrapper, text: string) => question(wrapper, text).getComponent(HfSegmented)
const list = (wrapper: Wrapper, text: string) => question(wrapper, text).getComponent(HfCombobox)
const pick = async (wrapper: Wrapper, text: string, value: string) => { segments(wrapper, text).vm.$emit('update:modelValue', value); await tick() }
const source = (wrapper: Wrapper) => wrapper.get('[data-testid="card-source"]').getComponent(HfCombobox)
const pickSource = async (wrapper: Wrapper, code: string) => { source(wrapper).vm.$emit('update:modelValue', code); await tick() }
const dateField = (wrapper: Wrapper) => wrapper.findComponent({ name: 'InputDate' })
const dialogButton = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === text)!
const menuItem = (text: string) => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.includes(text))!
const saved = (row: EditorialFactsEditingRow) => row.declarations.map(item => item.input)
const known = (value: unknown) => ({ key: 'contentMagnitude', state: 'known', value, evidence: label, basis: 'Según la etiqueta del empaque.' })

describe('the questions per family', () => {
  it('asks how the content is measured as segments ending in «No sé», with no switcher for a single presentation', () => {
    const { wrapper } = render()
    expect(wrapper.find('[data-testid="presentation-switcher"]').exists()).toBe(false)
    expect(questions(wrapper)).toEqual(['¿Cómo se mide el contenido?'])
    expect(segments(wrapper, '¿Cómo se mide el contenido?').props('items').map((item: { label: string }) => item.label)).toEqual(['Peso', 'Volumen', 'Piezas', 'Largo', 'Área', 'No sé'])
    expect(wrapper.text()).not.toContain('Sin presentación')
  })

  it('asks hygiene whether it is consumed and applied on the pet (Sí, No, No sé), and which measures apply (a combobox)', () => {
    const { wrapper } = render({ family: 'hygiene' })
    expect(questions(wrapper)).toEqual(['¿Cómo se mide el contenido?', '¿Se consume?', '¿Se aplica sobre la mascota?', '¿Qué medidas aplican?'])
    expect(segments(wrapper, '¿Se consume?').props('items').map((item: { label: string }) => item.label)).toEqual(['Sí', 'No', 'No sé'])
    expect(list(wrapper, '¿Qué medidas aplican?').props('specialAnswers')!.map((item: { label: string }) => item.label)).toEqual(['Ninguna', 'No sé'])
  })

  it('shows a follow-up list only after a Sí, and drops it on No', async () => {
    const { wrapper } = render({ family: 'accessory' })
    expect(questions(wrapper)).toEqual(['¿Cómo se mide el contenido?', '¿La talla define la compra?', '¿Usa electricidad?'])
    await pick(wrapper, '¿La talla define la compra?', 'true')
    expect(questions(wrapper)).toContain('¿Qué medidas de talla cuentan?')
    expect(list(wrapper, '¿Qué medidas de talla cuentan?').props('items').map((item: { label: string }) => item.label)).toEqual(['Cuello', 'Pecho'])
    await pick(wrapper, '¿La talla define la compra?', 'false')
    expect(questions(wrapper)).not.toContain('¿Qué medidas de talla cuentan?')
  })

  it('asks care what kind of product it is, and offers the care review', () => {
    const { wrapper } = render({ family: 'care' })
    expect(segments(wrapper, '¿Qué tipo de producto es?').props('items').map((item: { label: string }) => item.label)).toEqual(['Fórmula', 'Dispositivo', 'Envase', 'No sé'])
    expect(wrapper.get('[data-testid="card-open-care"]').text()).toBe('Revisar')
    expect(wrapper.text()).toContain('Sin revisar')
  })
})

describe('the payload (same facts as T10)', () => {
  it('the first answer creates the row with the presentation name, and the source writes the evidence and the Fundamento', async () => {
    const { wrapper, state } = render({ subjects: [{ variantId: 'v1', label: 'Talla M' }] })
    expect(source(wrapper).props('modelValue')).toBeNull()
    expect(String(dateField(wrapper).props('modelValue'))).toBe(today)
    await pick(wrapper, '¿Cómo se mide el contenido?', 'mass')
    expect(state.value[0]).toMatchObject({ variantId: 'v1', presentation: 'Talla M', careReview: { state: 'omitted' } })
    await pickSource(wrapper, 'label')
    expect(saved(state.value[0]!)).toEqual([known('mass')])
  })

  it('a source picked first is used by the answers that follow, and the date can change', async () => {
    const { wrapper, state } = render()
    await pickSource(wrapper, 'maker')
    expect(state.value).toEqual([])
    dateField(wrapper).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 1)); await tick()
    await pick(wrapper, '¿Cómo se mide el contenido?', 'volume')
    expect(state.value[0]!.presentation).toBe('Croqueta')
    expect(saved(state.value[0]!)).toEqual([{ key: 'contentMagnitude', state: 'known', value: 'volume',
      evidence: { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-10-01' }, basis: 'Según la ficha del fabricante.' }])
  })

  it('Otro reveals a short text that becomes the source', async () => {
    const { wrapper, state } = render()
    await pick(wrapper, '¿Cómo se mide el contenido?', 'mass')
    await pickSource(wrapper, 'other')
    await wrapper.get('[data-testid="card-source-other"]').setValue('Catálogo 2026')
    expect(saved(state.value[0]!)[0]).toMatchObject({ evidence: { sourceRef: 'Catálogo 2026', verifiedOn: today }, basis: 'Según catálogo 2026.' })
  })

  it('«No sé» writes the unknown state with no evidence', async () => {
    const { wrapper, state } = render()
    await pickSource(wrapper, 'label')
    await pick(wrapper, '¿Cómo se mide el contenido?', 'unknown')
    expect(saved(state.value[0]!)).toEqual([{ key: 'contentMagnitude', state: 'unknown' }])
  })

  it('Sí and No write true and false', async () => {
    const { wrapper, state } = render({ family: 'hygiene' })
    await pickSource(wrapper, 'label')
    await pick(wrapper, '¿Se consume?', 'false')
    await pick(wrapper, '¿Se aplica sobre la mascota?', 'true')
    expect(saved(state.value[0]!).map(item => item.state === 'known' && item.value)).toEqual([false, true])
  })

  it('a list writes the picked codes in option order, «Ninguna» an empty list and «No sé» the unknown state', async () => {
    const { wrapper, state } = render({ family: 'toy' })
    await pickSource(wrapper, 'label')
    list(wrapper, '¿Qué medidas aplican?').vm.$emit('update:modelValue', ['measure.dimensions.external_width', 'measure.dimensions.external_length']); await tick()
    expect(saved(state.value[0]!)[0]).toMatchObject({ key: 'relevantDimensionCodes', value: { codes: ['measure.dimensions.external_length', 'measure.dimensions.external_width'], toyTypes: [] } })
    list(wrapper, '¿Qué medidas aplican?').vm.$emit('update:special', 'none'); await tick()
    expect(saved(state.value[0]!)[0]).toMatchObject({ value: { codes: [], toyTypes: [] } })
    expect(list(wrapper, '¿Qué medidas aplican?').props('special')).toBe('none')
    list(wrapper, '¿Qué medidas aplican?').vm.$emit('update:special', 'unknown'); await tick()
    expect(saved(state.value[0]!)[0]).toEqual({ key: 'relevantDimensionCodes', state: 'unknown' })
  })

  it('toy types are asked under the dimensions, and keep the picked dimensions', async () => {
    const { wrapper, state } = render({ family: 'toy' })
    await pickSource(wrapper, 'label')
    list(wrapper, '¿Qué medidas aplican?').vm.$emit('update:modelValue', ['measure.dimensions.external_length']); await tick()
    list(wrapper, '¿Qué tipo de juguete es?').vm.$emit('update:modelValue', ['cuerda']); await tick()
    expect(saved(state.value[0]!)[0]).toMatchObject({ value: { codes: ['measure.dimensions.external_length'], toyTypes: ['cuerda'] } })
    list(wrapper, '¿Qué medidas aplican?').vm.$emit('update:modelValue', ['measure.dimensions.external_length', 'measure.dimensions.external_width']); await tick()
    expect(saved(state.value[0]!)[0]).toMatchObject({ value: { codes: ['measure.dimensions.external_length', 'measure.dimensions.external_width'], toyTypes: ['cuerda'] } })
  })

  it('a disabled card changes nothing', async () => {
    const { wrapper, state } = render({ disabled: true })
    expect(segments(wrapper, '¿Cómo se mide el contenido?').props('disabled')).toBe(true)
    await pick(wrapper, '¿Cómo se mide el contenido?', 'mass')
    expect(state.value).toEqual([])
  })
})

describe('the missing source', () => {
  it('an answer with no source says where it is missing once the save is tried', async () => {
    const { wrapper, state, errors } = render()
    await pick(wrapper, '¿Cómo se mide el contenido?', 'mass')
    expect(saved(state.value[0]!)[0]).toMatchObject({ evidence: null, basis: '' })
    expect(wrapper.text()).not.toContain('Indica de dónde sale la información')
    errors.value = true; await tick()
    expect(wrapper.get('[data-testid="card-source"] .hf-form-field__message').text()).toBe('Indica de dónde sale la información')
    expect(source(wrapper).props('invalid')).toBe(true)
  })
})

describe('several presentations: the switcher', () => {
  it('lists the presentations as segments and edits the chosen one only', async () => {
    const { wrapper, state, selected } = render({ subjects: collar })
    const switcher = wrapper.get('[data-testid="presentation-switcher"]').getComponent(HfSegmented)
    expect(switcher.props('items').map((item: { label: string }) => item.label)).toEqual(['Chico · Azul', 'Mediano · Rojo', 'Grande · Negro'])
    switcher.vm.$emit('update:modelValue', 'variant:v3'); await tick()
    expect(selected.value).toBe('variant:v3')
    await pick(wrapper, '¿Cómo se mide el contenido?', 'unknown')
    expect(state.value.map(row => [row.variantId, row.presentation])).toEqual([['v3', 'Grande · Negro']])
  })

  it('uses a scrolling tab row beyond four presentations', () => {
    const many = [...collar, { variantId: 'v4', label: 'Extra · Verde' }, { variantId: 'v5', label: 'Mini · Rosa' }]
    const { wrapper } = render({ subjects: many })
    const tabs = wrapper.get('[data-testid="presentation-switcher"]').findAll('[role="radio"]')
    expect(tabs.map(item => item.text())).toEqual(many.map(item => item.label))
    expect(tabs[0]!.attributes('aria-checked')).toBe('true')
  })

  it('offers «Copiar respuestas de …» on a presentation with no answers, and copies with the same mapping', async () => {
    const maker = { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-10-01' }
    const first: EditorialFactsEditingRow = { id: 'r1', variantId: 'v1', presentation: 'Chico · Azul', careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] },
      declarations: [{ id: 'd1', declarationKey: 'contentMagnitude', input: { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: maker, basis: 'Según la ficha del fabricante.' } }] }
    const { wrapper, state } = render({ subjects: collar, facts: [first] })
    expect(wrapper.find('[data-testid="card-copy"]').exists()).toBe(false)
    wrapper.get('[data-testid="presentation-switcher"]').getComponent(HfSegmented).vm.$emit('update:modelValue', 'variant:v2'); await tick()
    expect(wrapper.get('[data-testid="card-copy"]').text()).toBe('Copiar respuestas de Chico · Azul')
    await wrapper.get('[data-testid="card-copy"]').trigger('click'); await tick()
    const copied = state.value.find(row => row.variantId === 'v2')!
    expect(copied.presentation).toBe('Mediano · Rojo')
    expect(saved(copied)).toEqual(saved(first))
    expect(wrapper.find('[data-testid="card-copy"]').exists()).toBe(false)
  })
})

describe('the presentation actions', () => {
  const answered = (): EditorialFactsEditingState => [{ id: 'r1', variantId: null, presentation: 'Croqueta', careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] },
    declarations: [{ id: 'd1', declarationKey: 'contentMagnitude', input: { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: label, basis: 'Según la etiqueta del empaque.' } }] }]

  it('reads back a saved answer and its source', () => {
    const { wrapper } = render({ facts: answered() })
    expect(segments(wrapper, '¿Cómo se mide el contenido?').props('modelValue')).toBe('mass')
    expect(source(wrapper).props('modelValue')).toBe('label')
  })

  it('a read-only user sees the answers as words, with no controls', () => {
    const { wrapper } = render({ facts: answered(), readonly: true })
    expect(wrapper.get('[data-testid="presentation-summary"]').text()).toContain('Se mide en peso')
    expect(wrapper.find('button, input').exists()).toBe(false)
  })

  it('Borrar respuestas asks in a modal, keeps the «No aplica» list and clears the source', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const facts = answered()
    facts[0]!.declarations.push({ id: 'd2', declarationKey: 'optionalNonpertinenceCodes', input: { key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.pack_count'], evidence: label, basis: 'Según la etiqueta del empaque.' } })
    const { wrapper, state } = render({ facts })
    await wrapper.get('.hf-section-card__meta button[aria-haspopup="menu"]').trigger('click'); await tick()
    menuItem('Borrar respuestas').click(); await tick()
    expect(document.body.textContent).toContain('¿Borrar las respuestas de Producto?')
    dialogButton('Cancelar').click(); await tick()
    expect(state.value).toBe(facts)
    await wrapper.get('.hf-section-card__meta button[aria-haspopup="menu"]').trigger('click'); await tick()
    menuItem('Borrar respuestas').click(); await tick()
    dialogButton('Borrar respuestas').click(); await tick()
    expect(state.value[0]!.declarations.map(item => item.declarationKey)).toEqual(['optionalNonpertinenceCodes'])
    expect(source(wrapper).props('modelValue')).toBeNull()
    expect(String(dateField(wrapper).props('modelValue'))).toBe(today)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('a stored presentation that no longer exists shows a quiet warning, and Quitar removes it after the modal', async () => {
    const gone: EditorialFactsEditingRow = { id: 'old', variantId: 'gone', presentation: 'Bolsa 20 kg', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }
    const { wrapper, state } = render({ facts: [gone], subjects: [{ variantId: 'v1', label: 'Talla M' }] })
    const warning = wrapper.get('[data-testid="presentation-gone"]')
    expect(warning.text()).toContain('Bolsa 20 kg ya no existe')
    await warning.get('[data-testid="card-remove"]').trigger('click'); await tick()
    expect(document.body.textContent).toContain('¿Quitar Bolsa 20 kg?')
    dialogButton('Quitar').click(); await tick()
    expect(state.value).toEqual([])
  })

  it('a stored care review in a family without care keeps its entry', () => {
    const facts: EditorialFactsEditingState = [{ id: 'r', variantId: null, presentation: 'Croqueta', declarations: [], careReview: { state: 'unknown' }, careRowIds: { requirements: [], warnings: [] } }]
    const { wrapper, state } = render({ facts })
    expect(wrapper.text()).toContain('No se sabe')
    expect(state.value[0]!.careReview).toEqual({ state: 'unknown' })
  })
})

describe('the date of the source', () => {
  it('uses the calendar field, defaults to today and keeps AAAA-MM-DD; an incomplete date changes nothing', async () => {
    const { wrapper, state } = render()
    expect(wrapper.findAll('input[type="date"]').filter(item => item.attributes('aria-hidden') !== 'true')).toHaveLength(0)
    await pickSource(wrapper, 'label')
    dateField(wrapper).vm.$emit('update:modelValue', undefined); await tick()
    await pick(wrapper, '¿Cómo se mide el contenido?', 'mass')
    expect(saved(state.value[0]!)[0]).toMatchObject({ evidence: { verifiedOn: today } })
    dateField(wrapper).vm.$emit('update:modelValue', new CalendarDate(2026, 9, 15)); await tick()
    expect(saved(state.value[0]!)[0]).toMatchObject({ evidence: { sourceRef: 'Etiqueta del empaque', verifiedOn: '2026-09-15' } })
  })
})

describe('one source for all (S19)', () => {
  const withBulk = (bulkEvidence: boolean) => {
    const emitted: unknown[] = []
    const wrapper = mount(defineComponent({ setup: () => () => h(Section, { id: 'p', facts: [], subjects: single, choices: families.food!, careAllowed: false,
      nextId: () => 'n', sources: new Map(), productName: 'Croqueta', selected: editorialSourceKey(null), bulkEvidence,
      'onBulk-evidence': () => emitted.push(true) }) }), { attachTo: document.body })
    return { wrapper, emitted }
  }
  it('the ⋯ menu offers «Usar una fuente para todos…» when there are known data without a source', async () => {
    const { wrapper, emitted } = withBulk(true)
    await wrapper.get('.hf-section-card__meta button[aria-haspopup="menu"]').trigger('click'); await tick()
    menuItem('Usar una fuente para todos').click(); await tick()
    expect(emitted).toHaveLength(1)
  })
  it('without such data the menu does not offer it', async () => {
    const { wrapper } = withBulk(false)
    await wrapper.get('.hf-section-card__meta button[aria-haspopup="menu"]').trigger('click'); await tick()
    expect(Array.from(document.querySelectorAll('[role="menuitem"]')).some(item => item.textContent?.includes('Usar una fuente para todos'))).toBe(false)
  })
})
