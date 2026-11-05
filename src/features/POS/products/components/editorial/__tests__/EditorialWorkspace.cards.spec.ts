/**
 * EditorialWorkspace — T13 (S15): the Contenido tab as section cards (design/content-editor-v3/02-section-cards.html).
 * Sections come from the BE vocabulary, a switcher picks the presentation being edited, «No lo sé» and
 * «No aplica» live inside the controls, and HfSaveBar counts the changed fields. The saved payload is the
 * one the table used to send for the same edits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import HfSectionNav from '@/core/shared/components/form/HfSectionNav.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import HfUnitField from '@/core/shared/components/form/HfUnitField.vue'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialBinding, EditorialContractVocabulary } from '../../../interfaces/editorial-contract-vocabulary.types'
import { editorialToday } from '../../../utils/editorial-presentation-card'
import { document as emptyDocument, read, update, state, success, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const binding = (code: string, owner: 'product' | 'sellable', section?: [string, number?], policy: EditorialBinding['policy'] = { route: 'pending' }): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'when_asserted', policy,
  ...(section ? { sectionCode: section[0], ...(section[1] === undefined ? {} : { sectionSortOrder: section[1] }) } : {}),
})
const optional = { route: 'fact_rule' as const, rule: { family: 'food' as const, ruleId: 'optional' as const, parameter: 'measure.net_mass' as const } }
const vocabulary = (massPolicy: EditorialBinding['policy'] = { route: 'pending' }): EditorialContractVocabulary => ({
  semanticsVersion: 'editorial-production-1',
  families: [
    { id: 'food', code: 'food', label: 'Alimento', sections: [{ code: 'pack', label: 'Contenido y empaque', sortOrder: 40 }, { code: 'who', label: 'Para quién', sortOrder: 10 }],
      bindings: [binding('measure.net_mass', 'sellable', ['pack', 1], massPolicy), binding('animal.target', 'product', ['who', 1]), binding('material', 'product')] },
    { id: 'toy', code: 'toy', label: 'Juguete', bindings: [binding('material', 'product')] },
  ],
  definitions: [
    { id: 'animal.target', code: 'animal.target', label: 'Especie', type: 'single', groups: [], aliases: [], options: [{ code: 'dog', label: 'Perro', archived: false, sortOrder: 0 }, { code: 'cat', label: 'Gato', archived: false, sortOrder: 1 }] },
    { id: 'material', code: 'material', label: 'Material', type: 'text', description: 'Lo que dice el empaque.' },
    { id: 'measure.net_mass', code: 'measure.net_mass', label: 'Peso neto', type: 'number', units: [{ code: 'kg', label: 'kg', sortOrder: 0 }, { code: 'g', label: 'g', sortOrder: 1 }], numericPolicy: { status: 'pending' } },
  ],
})
const collar = [{ id: 'v1', name: 'Chico · Azul' }, { id: 'v2', name: 'Mediano · Rojo' }, { id: 'v3', name: 'Grande · Negro' }]
const today = editorialToday()
const material = (value: string) => ({ code: 'material', owner: 'product' as const, variantId: null, state: 'known' as const, payload: { type: 'text' as const, value }, evidence: null })
const mass = (variantId: string | null, value: number) => ({ code: 'measure.net_mass', owner: 'sellable' as const, variantId, state: 'known' as const, payload: { type: 'number' as const, value, unit: 'kg' }, evidence: null })
const doc = (patch: Partial<EditorialContractDocument> = {}): EditorialContractDocument => ({ ...emptyDocument(), commercialTitle: 'Croqueta', familyCode: 'food', ...patch })
let wrapper: VueWrapper

function reads(snapshot = state(doc()), variants: { id: string; name: string }[] = [], vocab = vocabulary()) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocab) }
    : url.endsWith('/context') ? { status: 200, data: { variants } } : success(snapshot)))
}
const render = async () => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
  await flushPromises()
}
const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const field = (label: string) => wrapper.findAll('[data-testid="attribute-field"]').find(item => item.get('.hf-form-field__label').text() === label)!
const combo = (label: string) => wrapper.findAllComponents(HfCombobox).find(item => item.props('label') === label)!
const unit = (label: string) => wrapper.findAllComponents(HfUnitField).find(item => item.props('label') === label)!
const switcher = () => wrapper.get('[data-testid="presentation-switcher"]').findComponent(HfSegmented)
const question = (key: string) => wrapper.get(`[data-question="${key}"]`).findComponent(HfSegmented)
const cards = () => wrapper.findAll('.hf-section-card__title').map(item => item.text())
const submit = async () => { await wrapper.get('form').trigger('submit'); await flushPromises() }
const sent = (call = 0) => http.put.mock.calls[call]![1]

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update], isAuthenticated: true, authPhase: 'authenticated', permissionsLoaded: true })
  reads()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — header and sections', () => {
  it('has a calm header: «Contenido», one progress badge and Historial', async () => {
    await render()
    const head = wrapper.get('[data-testid="editorial-head"]')
    expect(head.get('h2').text()).toBe('Contenido')
    expect(head.get('[data-testid="editorial-progress"]').text()).toContain('Faltan 3')
    expect(head.get('[data-testid="open-history"]').text()).toBe('Historial')
    expect(wrapper.text()).not.toMatch(/Ficha para el catálogo|Solo faltantes|Publicación próximamente/)
  })

  it('orders the cards: Presentación, Título y descripción, then the BE sections by sortOrder and «Otros datos» last', async () => {
    await render()
    expect(cards()).toEqual(['Presentación', 'Título y descripción', 'Para quién', 'Contenido y empaque', 'Otros datos'])
    expect(wrapper.findComponent(HfSectionNav).props('sections').map((item: { label: string }) => item.label)).toEqual(cards())
  })

  it('uses one «Datos» card when the family has no sections', async () => {
    reads(state(doc({ familyCode: 'toy' })))
    await render()
    expect(cards()).toEqual(['Presentación', 'Título y descripción', 'Datos'])
  })

  it('counts what is missing per section and says «Completo» once nothing is', async () => {
    reads(state(doc({ values: [material('Nylon'), { code: 'animal.target', owner: 'product', variantId: null, state: 'unknown', evidence: null }] })))
    await render()
    const nav = wrapper.findComponent(HfSectionNav).props('sections') as readonly { label: string; missing: number }[]
    expect(Object.fromEntries(nav.map(item => [item.label, item.missing]))).toMatchObject({ 'Para quién': 0, 'Contenido y empaque': 1, 'Otros datos': 0 })
    expect(wrapper.get('[data-testid="editorial-progress"]').text()).toContain('Faltan 1')
    unit('Peso neto').vm.$emit('update:special', 'unknown'); await tick()
    expect(wrapper.get('[data-testid="editorial-progress"]').text()).toContain('Completo')
  })

  it('the collar counts a per-presentation field until every presentation answers it', async () => {
    reads(state(doc({ values: [material('Nylon'), { code: 'animal.target', owner: 'product', variantId: null, state: 'unknown', evidence: null }, mass('v1', 1), mass('v2', 2)] })), collar)
    await render()
    expect(wrapper.get('[data-testid="editorial-progress"]').text()).toContain('Faltan 1')
  })
})

describe('EditorialWorkspace — the presentation switcher', () => {
  it('shows no switcher for a single presentation', async () => {
    await render()
    expect(wrapper.find('[data-testid="presentation-switcher"]').exists()).toBe(false)
  })

  it('picks the presentation whose answers and per-presentation data are edited; product data is shared', async () => {
    reads(state(doc({ values: [material('Nylon'), mass('v1', 1), mass('v2', 2)] })), collar)
    await render()
    expect(switcher().props('items').map((item: { label: string }) => item.label)).toEqual(['Chico · Azul', 'Mediano · Rojo', 'Grande · Negro'])
    expect(unit('Peso neto').props('modelValue')).toMatchObject({ value: 1 })
    const packCard = () => wrapper.findAll('.hf-section-card').find(item => item.get('.hf-section-card__title').text() === 'Contenido y empaque')!
    expect(packCard().get('.hf-section-card__meta').text()).toBe('Para: Chico · Azul')
    switcher().vm.$emit('update:modelValue', 'variant:v2'); await tick()
    expect(unit('Peso neto').props('modelValue')).toMatchObject({ value: 2 })
    expect(packCard().get('.hf-section-card__meta').text()).toBe('Para: Mediano · Rojo')
    expect((field('Material').get('input[type="text"]').element as HTMLInputElement).value).toBe('Nylon')
    const forWho = wrapper.findAll('.hf-section-card').find(item => item.get('.hf-section-card__title').text() === 'Para quién')!
    expect(forWho.find('.hf-section-card__meta').exists()).toBe(false)
  })

  it('an edit after switching targets the chosen presentation', async () => {
    http.put.mockResolvedValue(success())
    reads(state(doc()), collar)
    await render()
    switcher().vm.$emit('update:modelValue', 'variant:v3'); await tick()
    unit('Peso neto').vm.$emit('update:modelValue', { value: undefined, unit: JSON.stringify('kg') }); await tick()
    unit('Peso neto').vm.$emit('update:text', 'value', '4'); await tick()
    await submit()
    expect(sent().document.values).toEqual([mass('v3', 4)])
  })

  it('a presentation answer goes to the chosen presentation, with the same facts row as before', async () => {
    http.put.mockResolvedValue(success())
    reads(state(doc()), collar)
    await render()
    switcher().vm.$emit('update:modelValue', 'variant:v2'); await tick()
    question('contentMagnitude').vm.$emit('update:modelValue', 'mass'); await tick()
    combo('Fuente').vm.$emit('update:modelValue', 'label'); await tick()
    await submit()
    expect(sent().document.facts).toEqual([{ variantId: 'v2', presentation: 'Mediano · Rojo', careReview: null, declarations: [
      { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: { sourceRef: 'Etiqueta del empaque', verifiedOn: today }, basis: 'Según la etiqueta del empaque.' }] }])
  })
})

describe('EditorialWorkspace — special answers inside the controls', () => {
  it('offers «No lo sé» everywhere and «No aplica» only where the policy admits it', async () => {
    reads(state(doc()), [], vocabulary(optional))
    await render()
    const labels = (answers: readonly { label: string }[] | undefined) => (answers ?? []).map(item => item.label)
    expect(labels(combo('Especie').props('specialAnswers'))).toEqual(['No lo sé'])
    expect(labels(unit('Peso neto').props('specialAnswers'))).toEqual(['No lo sé', 'No aplica'])
  })

  it('«No lo sé» from a list saves the unknown state', async () => {
    http.put.mockResolvedValue(success())
    await render()
    combo('Especie').vm.$emit('update:special', 'unknown'); await tick()
    await submit()
    expect(sent().document.values).toEqual([{ code: 'animal.target', owner: 'product', variantId: null, state: 'unknown', evidence: null }])
  })

  it('«No aplica» on a text field comes from its ghost action and saves the not-applicable state', async () => {
    http.put.mockResolvedValue(success())
    reads(state(doc()), [], { ...vocabulary(), families: [{ ...vocabulary().families[0]!, bindings: [binding('material', 'product', undefined,
      { route: 'option_cases', cases: [{ code: 'c', when: [], applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'resolved' }] })] }] })
    await render()
    const ghost = field('Material').findAll('.hf-form-field__ghost').find(item => item.text() === 'No aplica')!
    await ghost.trigger('click')
    expect(field('Material').get('[data-action="write"]').text()).toContain('No aplica')
    await submit()
    expect(sent().document.values).toEqual([{ code: 'material', owner: 'product', variantId: null, state: 'not_applicable', evidence: null }])
  })

  it('«No aplica» on an optional per-presentation datum also declares its code for that presentation', async () => {
    http.put.mockResolvedValue(success())
    reads(state(doc()), collar, vocabulary(optional))
    await render()
    combo('Fuente').vm.$emit('update:modelValue', 'label'); await tick()
    unit('Peso neto').vm.$emit('update:special', 'not_applicable'); await tick()
    await submit()
    expect(sent().document.values).toEqual([{ code: 'measure.net_mass', owner: 'sellable', variantId: 'v1', state: 'not_applicable', evidence: null }])
    expect(sent().document.facts).toEqual([{ variantId: 'v1', presentation: 'Chico · Azul', careReview: null, declarations: [
      { key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.net_mass'], evidence: { sourceRef: 'Etiqueta del empaque', verifiedOn: today }, basis: 'Según la etiqueta del empaque.' }] }])
  })

  it('a stored «No aplica» the policy refuses is reported on its field and can be removed', async () => {
    reads(state(doc({ values: [{ code: 'animal.target', owner: 'product', variantId: null, state: 'not_applicable', evidence: null }] })))
    await render()
    await submit()
    expect(http.put).not.toHaveBeenCalled()
    expect(field('Especie').get('.hf-form-field__message').text()).toBe('Este dato no admite «No aplica».')
    await field('Especie').get('[data-action="clear"]').trigger('click')
    expect(combo('Especie').props('special')).toBeNull()
  })
})

describe('EditorialWorkspace — payload and save bar', () => {
  it('a text edit creates the same assignment the table sent', async () => {
    http.put.mockResolvedValue(success(state(doc({ values: [material('Nylon')] }), 4)))
    await render()
    await field('Material').get('input[type="text"]').setValue('Nylon')
    await submit()
    expect(sent()).toEqual({ expectedCycle: 2, expectedRevision: 3, document: doc({ values: [material('Nylon')] }) })
  })

  it('a choice, a number with its unit and a title edit send the same document as before', async () => {
    http.put.mockResolvedValue(success())
    await render()
    combo('Especie').vm.$emit('update:modelValue', 'dog'); await tick()
    unit('Peso neto').vm.$emit('update:modelValue', { value: undefined, unit: JSON.stringify('g') }); await tick()
    unit('Peso neto').vm.$emit('update:text', 'value', '300'); await tick()
    await wrapper.get('#editorial-title').setValue('Croqueta premium')
    await submit()
    expect(sent().document).toEqual(doc({ commercialTitle: 'Croqueta premium', values: [
      { code: 'animal.target', owner: 'product', variantId: null, state: 'known', payload: { type: 'single', value: 'dog' }, evidence: null },
      { code: 'measure.net_mass', owner: 'sellable', variantId: null, state: 'known', payload: { type: 'number', value: 300, unit: 'g' }, evidence: null }] }))
  })

  it('a value that is not a number is refused next to its field', async () => {
    await render()
    unit('Peso neto').vm.$emit('update:text', 'value', '5x'); await tick()
    await submit()
    expect(http.put).not.toHaveBeenCalled()
    expect(field('Peso neto').get('.hf-form-field__message').text()).toBe('Escribe solo números')
    expect(wrapper.findComponent(HfSaveBar).props('error')).toContain('No se guardó')
  })

  it('counts the changed fields in the save bar, and Descartar asks before loading the saved version', async () => {
    await render()
    const bar = () => wrapper.findComponent(HfSaveBar)
    expect(bar().props('dirtyCount')).toBe(0)
    await field('Material').get('input[type="text"]').setValue('Nylon')
    combo('Especie').vm.$emit('update:modelValue', 'dog'); await tick()
    expect(bar().props('dirtyCount')).toBe(2)
    expect(bar().text()).toContain('2 cambios sin guardar')
    bar().vm.$emit('discard'); await tick()
    expect(wrapper.text()).toContain('¿Reemplazar tus cambios sin guardar con la versión más reciente?')
  })

  it('keeps «Descartar borrador» reachable and drops the publication placeholder and the loose ⋮', async () => {
    await render()
    expect(wrapper.get('[data-testid="discard-draft"]').text()).toBe('Descartar borrador')
    expect(wrapper.find('[data-testid="editorial-footer"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Más acciones de la ficha"]').exists()).toBe(false)
  })

  it('shows the description of a definition as the help of its field, and «Interno» from the binding', async () => {
    reads(state(doc()), [], { ...vocabulary(), families: [{ ...vocabulary().families[0]!, bindings: [{ ...binding('material', 'product'), exposure: 'INTERNAL' }] }] })
    await render()
    expect(field('Material').get('.hf-form-field__message').text()).toBe('Lo que dice el empaque.')
    expect(field('Material').get('.hf-form-field__internal').text()).toBe('Interno')
  })
})
