/**
 * T10 (S13): one card per presentation above the table. Plain questions as chips, one source for the
 * whole card, a one-line summary once answered. The saved facts keep their exact shape.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import Cards from '../EditorialPresentationCards.vue'
import type { EditorialDeclarationChoice } from '../../../utils/editorial-contract-declaration-choices'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from '../../../utils/editorial-contract-facts-editing'
import type { EditorialCardSource } from '../../../utils/editorial-presentation-card'
import { editorialToday } from '../../../utils/editorial-presentation-card'

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

function render({ family = 'food', facts = [] as EditorialFactsEditingState, subjects = [{ variantId: null as string | null, label: 'Producto' }], showErrors = false, readonly = false, disabled = false } = {}) {
  const state = shallowRef(facts), sources = shallowRef<ReadonlyMap<string, EditorialCardSource>>(new Map())
  let counter = 0
  const errors = shallowRef(showErrors)
  const wrapper = mount(defineComponent({ setup: () => () => h(Cards, { facts: state.value, subjects, choices: families[family]!, careAllowed: family === 'care',
    nextId: () => `n${++counter}`, sources: sources.value, productName: 'Croqueta', showErrors: errors.value, readonly, disabled,
    'onUpdate:facts': (value: EditorialFactsEditingState) => { state.value = value },
    'onUpdate:sources': (value: ReadonlyMap<string, EditorialCardSource>) => { sources.value = value } }) }), { attachTo: document.body })
  return { wrapper, state, errors }
}
type Wrapper = ReturnType<typeof render>['wrapper']
const questions = (wrapper: Wrapper) => wrapper.findAll('[data-testid="card-question"] legend').map(item => item.text())
const chip = (wrapper: Wrapper, question: string, text: string) => wrapper.findAll('[data-testid="card-question"]').find(item => item.get('legend').text() === question)!
  .findAll('label').find(item => item.text() === text)!.get('input')
const sourceChip = (wrapper: Wrapper, text: string) => wrapper.get('[data-testid="card-source"]').findAll('label').find(item => item.text() === text)!.get('input')
const dialogButton = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === text)!
const saved = (row: EditorialFactsEditingRow) => row.declarations.map(item => item.input)
const known = (value: unknown, extra: Partial<{ verifiedOn: string }> = {}) => ({ key: 'contentMagnitude', state: 'known', value, evidence: { ...label, ...extra }, basis: 'Según la etiqueta del empaque.' })

describe('the questions per family', () => {
  it('a product with no variants has a single card titled Producto, never "Sin presentación"', () => {
    const { wrapper } = render()
    expect(wrapper.findAll('[data-testid="presentation-card"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="presentation-card"] h4').text()).toBe('Producto')
    expect(wrapper.text()).not.toContain('Sin presentación')
    expect(questions(wrapper)).toEqual(['¿Cómo se mide el contenido?'])
    expect(wrapper.get('[data-testid="card-question"]').findAll('label').map(item => item.text())).toEqual(['Peso', 'Volumen', 'Piezas', 'Largo', 'Área', 'No sé'])
  })

  it('asks hygiene whether it is consumed and applied on the pet, and which measures apply', () => {
    expect(questions(render({ family: 'hygiene' }).wrapper)).toEqual(['¿Cómo se mide el contenido?', '¿Se consume?', '¿Se aplica sobre la mascota?', '¿Qué medidas aplican?'])
  })

  it('asks an accessory about size and electricity, and the follow-up lists only after a Sí', async () => {
    const { wrapper } = render({ family: 'accessory' })
    expect(questions(wrapper)).toEqual(['¿Cómo se mide el contenido?', '¿La talla define la compra?', '¿Usa electricidad?'])
    await chip(wrapper, '¿La talla define la compra?', 'Sí').setValue(true)
    expect(questions(wrapper)).toContain('¿Qué medidas de talla cuentan?')
    expect(wrapper.findAll('[data-testid="card-question"]').find(item => item.text().startsWith('¿Qué medidas de talla'))!.findAll('label').map(item => item.text()))
      .toEqual(['Cuello', 'Pecho', 'Ninguna', 'No sé'])
  })

  it('asks care what kind of product it is, and toys which dimensions apply', () => {
    const care = render({ family: 'care' }).wrapper
    expect(questions(care)).toEqual(['¿Cómo se mide el contenido?', '¿Qué tipo de producto es?'])
    expect(care.findAll('[data-testid="card-question"]')[1]!.findAll('label').map(item => item.text())).toEqual(['Fórmula', 'Dispositivo', 'Envase', 'No sé'])
    care.unmount()
    expect(questions(render({ family: 'toy' }).wrapper)).toEqual(['¿Cómo se mide el contenido?', '¿Qué medidas aplican?'])
  })

  it('shows one card per presentation with its name', () => {
    const { wrapper } = render({ subjects: [{ variantId: 'v1', label: 'Talla M' }, { variantId: 'v2', label: 'Talla L' }] })
    expect(wrapper.findAll('[data-testid="presentation-card"] h4').map(item => item.text())).toEqual(['Talla M', 'Talla L'])
  })
})

describe('the payload', () => {
  it('the first answer creates the row with the presentation name, and the source writes the evidence and the Fundamento', async () => {
    const { wrapper, state } = render({ subjects: [{ variantId: 'v1', label: 'Talla M' }] })
    expect(sourceChip(wrapper, 'Etiqueta del empaque').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-testid="card-source"] input[type="date"]').element.value).toBe(today)
    await chip(wrapper, '¿Cómo se mide el contenido?', 'Peso').setValue(true)
    expect(state.value).toHaveLength(1)
    expect(state.value[0]).toMatchObject({ variantId: 'v1', presentation: 'Talla M', careReview: { state: 'omitted' } })
    await sourceChip(wrapper, 'Etiqueta del empaque').setValue(true)
    expect(saved(state.value[0]!)).toEqual([known('mass')])
  })

  it('a source picked first is used by the answers that follow, and the date can change', async () => {
    const { wrapper, state } = render()
    await sourceChip(wrapper, 'Ficha del fabricante').setValue(true)
    expect(state.value).toEqual([])
    await wrapper.get('[data-testid="card-source"] input[type="date"]').setValue('2026-10-01')
    await chip(wrapper, '¿Cómo se mide el contenido?', 'Volumen').setValue(true)
    expect(state.value[0]!.presentation).toBe('Croqueta')
    expect(saved(state.value[0]!)).toEqual([{ key: 'contentMagnitude', state: 'known', value: 'volume',
      evidence: { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-10-01' }, basis: 'Según la ficha del fabricante.' }])
  })

  it('Otro reveals a short text that becomes the source', async () => {
    const { wrapper, state } = render()
    await chip(wrapper, '¿Cómo se mide el contenido?', 'Peso').setValue(true)
    await sourceChip(wrapper, 'Otro').setValue(true)
    await wrapper.get('[data-testid="card-source-other"]').setValue('Catálogo 2026')
    expect(saved(state.value[0]!)[0]).toMatchObject({ evidence: { sourceRef: 'Catálogo 2026', verifiedOn: today }, basis: 'Según catálogo 2026.' })
  })

  it('No sé writes the unknown state with no evidence', async () => {
    const { wrapper, state } = render()
    await sourceChip(wrapper, 'Etiqueta del empaque').setValue(true)
    await chip(wrapper, '¿Cómo se mide el contenido?', 'No sé').setValue(true)
    expect(saved(state.value[0]!)).toEqual([{ key: 'contentMagnitude', state: 'unknown' }])
  })

  it('a multiple choice writes the picked codes, Ninguna an empty list', async () => {
    const { wrapper, state } = render({ family: 'toy' })
    await sourceChip(wrapper, 'Etiqueta del empaque').setValue(true)
    await chip(wrapper, '¿Qué medidas aplican?', 'Ancho').setValue(true)
    await chip(wrapper, '¿Qué medidas aplican?', 'Largo').setValue(true)
    expect(saved(state.value[0]!)[0]).toMatchObject({ key: 'relevantDimensionCodes', value: { codes: ['measure.dimensions.external_length', 'measure.dimensions.external_width'], toyTypes: [] } })
    await chip(wrapper, '¿Qué medidas aplican?', 'Ninguna').setValue(true)
    expect(saved(state.value[0]!)[0]).toMatchObject({ value: { codes: [], toyTypes: [] } })
  })
})

describe('more answers', () => {
  it('Sí and No write true and false', async () => {
    const { wrapper, state } = render({ family: 'hygiene' })
    await sourceChip(wrapper, 'Etiqueta del empaque').setValue(true)
    await chip(wrapper, '¿Se consume?', 'No').setValue(true)
    await chip(wrapper, '¿Se aplica sobre la mascota?', 'Sí').setValue(true)
    expect(saved(state.value[0]!).map(item => item.state === 'known' && item.value)).toEqual([false, true])
  })

  it('toy types are asked under the dimensions, and keep the picked dimensions', async () => {
    const { wrapper, state } = render({ family: 'toy' })
    await sourceChip(wrapper, 'Etiqueta del empaque').setValue(true)
    await chip(wrapper, '¿Qué medidas aplican?', 'Largo').setValue(true)
    const toys = wrapper.get('.pcard__sub')
    expect(toys.text()).toContain('¿Qué tipo de juguete es?')
    await toys.findAll('label').find(item => item.text() === 'Cuerda')!.get('input').setValue(true)
    expect(saved(state.value[0]!)[0]).toMatchObject({ value: { codes: ['measure.dimensions.external_length'], toyTypes: ['cuerda'] } })
    await chip(wrapper, '¿Qué medidas aplican?', 'Ancho').setValue(true)
    expect(saved(state.value[0]!)[0]).toMatchObject({ value: { codes: ['measure.dimensions.external_length', 'measure.dimensions.external_width'], toyTypes: ['cuerda'] } })
  })

  it('a disabled card changes nothing', async () => {
    const { wrapper, state } = render({ disabled: true })
    expect(wrapper.findAll('input').every(item => item.element.matches(':disabled'))).toBe(true)
    await chip(wrapper, '¿Cómo se mide el contenido?', 'Peso').trigger('change')
    expect(state.value).toEqual([])
  })

  it('a stored care review in a family without care keeps its entry until it is discarded', () => {
    const facts: EditorialFactsEditingState = [{ id: 'r', variantId: null, presentation: 'Croqueta', declarations: [], careReview: { state: 'unknown' }, careRowIds: { requirements: [], warnings: [] } }]
    const { wrapper, state } = render({ facts })
    expect(wrapper.text()).toContain('No se sabe')
    expect(state.value[0]!.careReview).toEqual({ state: 'unknown' })
  })
})

describe('the missing source', () => {
  it('an answer with no source says where it is missing once the save is tried', async () => {
    const { wrapper, state, errors } = render()
    await chip(wrapper, '¿Cómo se mide el contenido?', 'Peso').setValue(true)
    expect(saved(state.value[0]!)[0]).toMatchObject({ evidence: null, basis: '' })
    expect(wrapper.text()).not.toContain('Indica de dónde sale la información')
    errors.value = true; await tick()
    const error = wrapper.get('[data-testid="card-source-error"]')
    expect(error.text()).toBe('Indica de dónde sale la información')
    expect(wrapper.get('[data-testid="card-source"] [role="radiogroup"]').attributes('aria-invalid')).toBe('true')
  })

  it('Listo with no source shows the error and keeps the card open', async () => {
    const { wrapper } = render()
    await chip(wrapper, '¿Cómo se mide el contenido?', 'Peso').setValue(true)
    await wrapper.get('[data-testid="card-done"]').trigger('click')
    expect(wrapper.find('[data-testid="card-source-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="card-summary"]').exists()).toBe(false)
  })
})

describe('the collapsed card', () => {
  const answered = (): EditorialFactsEditingState => [{ id: 'r1', variantId: null, presentation: 'Croqueta', careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] },
    declarations: [{ id: 'd1', declarationKey: 'contentMagnitude', input: { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: { sourceRef: 'Etiqueta del empaque', verifiedOn: '2026-11-04' }, basis: 'Según la etiqueta del empaque.' } }] }]

  it('an answered card is one line with an Editar link', async () => {
    const { wrapper } = render({ facts: answered() })
    expect(wrapper.get('[data-testid="card-summary"]').text()).toBe(`Se mide en peso · Etiqueta del empaque · 4 nov${new Date().getFullYear() === 2026 ? '' : ' 2026'}`)
    expect(wrapper.find('[data-testid="card-question"]').exists()).toBe(false)
    await wrapper.get('[data-testid="card-edit"]').trigger('click')
    expect(questions(wrapper)).toEqual(['¿Cómo se mide el contenido?'])
    await wrapper.get('[data-testid="card-done"]').trigger('click')
    expect(wrapper.find('[data-testid="card-summary"]').exists()).toBe(true)
  })

  it('a read-only user sees the summary with no actions', () => {
    const { wrapper } = render({ facts: answered(), readonly: true })
    expect(wrapper.get('[data-testid="card-summary"]').text()).toContain('Se mide en peso')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('Borrar respuestas asks in a modal, never the browser, and keeps the table list', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const facts = answered()
    facts[0]!.declarations.push({ id: 'd2', declarationKey: 'optionalNonpertinenceCodes', input: { key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.pack_count'], evidence: label, basis: 'Según la etiqueta del empaque.' } })
    const { wrapper, state } = render({ facts })
    await wrapper.get('[data-testid="presentation-card"] button[aria-haspopup="menu"]').trigger('click'); await tick()
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.includes('Borrar respuestas'))!.click(); await tick()
    expect(document.body.textContent).toContain('¿Borrar las respuestas de Producto?')
    dialogButton('Cancelar').click(); await tick()
    expect(state.value).toBe(facts)
    await wrapper.get('[data-testid="presentation-card"] button[aria-haspopup="menu"]').trigger('click'); await tick()
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.includes('Borrar respuestas'))!.click(); await tick()
    dialogButton('Borrar respuestas').click(); await tick()
    expect(state.value[0]!.declarations.map(item => item.declarationKey)).toEqual(['optionalNonpertinenceCodes'])
    expect(confirm).not.toHaveBeenCalled()
  })
})

describe('a stored presentation that no longer exists', () => {
  it('shows a quiet warning on a card titled with its stored text, and Quitar removes it after the modal', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const gone: EditorialFactsEditingRow = { id: 'old', variantId: 'gone', presentation: 'Bolsa 20 kg', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }
    const { wrapper, state } = render({ facts: [gone], subjects: [{ variantId: 'v1', label: 'Talla M' }] })
    const card = wrapper.findAll('[data-testid="presentation-card"]').find(item => item.get('h4').text() === 'Bolsa 20 kg')!
    expect(card.text()).toContain('Esta presentación ya no existe')
    await card.get('[data-testid="card-remove"]').trigger('click'); await tick()
    expect(document.body.textContent).toContain('¿Quitar Bolsa 20 kg?')
    dialogButton('Quitar').click(); await tick()
    expect(state.value).toEqual([])
    expect(confirm).not.toHaveBeenCalled()
  })
})
