/**
 * EditorialPublishChecklist — Issue checklist grouped by issue family (design-system.md): each family once,
 * a family of N > 1 reads «{message} · N campos» and discloses its links; blocking problems first, then evidence.
 * Data shaped like the real readiness of «Alimento para Cachorro Raza Mediana 3 kg» (BE :3003): 18 items, 16 of them evidence.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditorialPublishChecklist, { type EditorialChecklistEntry } from '../EditorialPublishChecklist.vue'
import type { EditorialReadinessItem } from '../../../interfaces/editorial-contract-readiness.types'

const EVIDENCE = 'Agrega de dónde sale este dato.'
const definition = (code: string, sectionCode: string, problem: string, message: string, variantId: string | null = null): EditorialReadinessItem =>
  ({ scope: 'definition', definitionCode: code, variantId, sectionCode, problem, message })
const evidenceFields: [string, string, string][] = [
  ['food.format', 'que-es', 'Formato'], ['food.line', 'que-es', 'Línea'], ['animal.target', 'para-quien', 'Especie'],
  ['animal.life_stage', 'para-quien', 'Etapa de vida'], ['animal.breed_size', 'para-quien', 'Tamaño de raza'],
  ['food.protein_source', 'nutricion', 'Proteína principal'], ['food.ingredients', 'nutricion', 'Ingredientes'],
  ['food.guaranteed_analysis', 'nutricion', 'Análisis garantizado'], ['food.special_diet', 'nutricion', 'Dieta especial'],
  ['food.kibble_size', 'nutricion', 'Tamaño de croqueta'], ['food.flavor', 'nutricion', 'Sabor'],
  ['food.feeding_guide', 'uso', 'Guía de alimentación'], ['food.storage', 'uso', 'Conservación'],
  ['origin.country', 'origen', 'País de origen'], ['origin.brand', 'origen', 'Marca'], ['measure.net_mass', 'empaque', 'Peso neto'],
]
const realShaped = (): EditorialChecklistEntry[] => [
  ...evidenceFields.map(([code, section, label]) => ({ item: definition(code, section, 'EVIDENCE_REQUIRED', EVIDENCE, code === 'measure.net_mass' ? 'v1' : null), label })),
  { item: definition('animal.target', 'para-quien', 'NA_NOT_ALLOWED', 'Este dato sí aplica: no lo marques como «No aplica».'), label: 'Especie' },
  { item: { scope: 'product', definitionCode: null, variantId: null, sectionCode: null, problem: 'NO_OFFERED_PRESENTATION',
    message: 'El producto no se ofrece en ninguna lista de precios en línea.' } satisfies EditorialReadinessItem, label: null },
].map((entry, index) => ({ key: `${index}`, ...entry }))

const render = (entries = realShaped(), stale = false) => mount(EditorialPublishChecklist, { props: { entries, stale }, global: { stubs: { UIcon: true } } })
const lines = (wrapper: ReturnType<typeof render>) => wrapper.findAll('ul[aria-label="Pendientes para publicar"] > li')

describe('EditorialPublishChecklist — grouped by issue family', () => {
  it('renders 18 real-shaped items as 3 lines: blocking first, then evidence, then the rest', () => {
    const wrapper = render()
    expect(lines(wrapper)).toHaveLength(3)
    expect(lines(wrapper).map(line => line.attributes('data-problem'))).toEqual(['NA_NOT_ALLOWED', 'EVIDENCE_REQUIRED', 'NO_OFFERED_PRESENTATION'])
    expect(wrapper.text().split(EVIDENCE)).toHaveLength(2)
    expect(lines(wrapper)[1]!.get('.publish-checklist__message').text()).toBe(`${EVIDENCE} · 16 campos`)
  })
  it('the header counts distinct fields, not items', () => {
    // 16 evidence fields (Especie also has NA_NOT_ALLOWED) plus the product item.
    expect(render().get('[data-testid="publish-checklist-head"]').text()).toBe('Para publicar, resuelve: 17 campos')
    expect(render(realShaped().slice(16, 17)).get('[data-testid="publish-checklist-head"]').text()).toBe('Para publicar, resuelve: 1 campo')
  })
  it('a family of one stays a single line with «Ir a {campo}»; an item off the page has no link', () => {
    const wrapper = render()
    const [blocking, , product] = lines(wrapper)
    expect(blocking!.findAll('button').map(button => button.text())).toEqual(['Ir a Especie'])
    expect(product!.text()).toBe('El producto no se ofrece en ninguna lista de precios en línea.')
    expect(product!.find('button').exists()).toBe(false)
  })
  it('a family of N discloses its field links and each link emits goto with its own item', async () => {
    const wrapper = render()
    const toggle = wrapper.get('[data-testid="publish-checklist-toggle"]')
    const fields = wrapper.get(`#${toggle.attributes('aria-controls')}`)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(fields.attributes('style')).toContain('display: none')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(fields.attributes('style') ?? '').not.toContain('display: none')
    const links = fields.findAll('button')
    expect(links).toHaveLength(16)
    expect(links[2]!.text()).toBe('Ir a Especie')
    await links[15]!.trigger('click')
    expect(wrapper.emitted('goto')).toEqual([[expect.objectContaining({ definitionCode: 'measure.net_mass', variantId: 'v1', problem: 'EVIDENCE_REQUIRED' })]])
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
  it('groups by problem AND message, and renders unknown codes through their message after evidence', () => {
    const entries: EditorialChecklistEntry[] = [
      { key: 'a', item: definition('x.future', 's', 'SOMETHING_NEW', 'Un problema nuevo.'), label: 'Futuro' },
      { key: 'b', item: definition('food.ingredients', 's', 'REQUIRED_MISSING', 'Faltan los ingredientes.'), label: 'Ingredientes' },
      { key: 'c', item: definition('measure.net_mass', 's', 'REQUIRED_MISSING', 'Falta el peso neto.'), label: 'Peso neto' },
      { key: 'd', item: definition('food.format', 's', 'EVIDENCE_REQUIRED', EVIDENCE), label: 'Formato' },
    ]
    const wrapper = render(entries)
    expect(lines(wrapper).map(line => line.get('.publish-checklist__message').text()))
      .toEqual(['Faltan los ingredientes.', 'Falta el peso neto.', EVIDENCE, 'Un problema nuevo.'])
    expect(wrapper.find('[data-testid="publish-checklist-toggle"]').exists()).toBe(false)
  })
  it('keeps the «last save» note when stale', () => {
    expect(render(realShaped(), true).text()).toContain('Según lo último que guardaste')
    expect(render().text()).not.toContain('Según lo último que guardaste')
  })
})

describe('EditorialPublishChecklist — one source for all (S19)', () => {
  const bulk = (entries = realShaped(), bulkEvidence = true) => mount(EditorialPublishChecklist, { props: { entries, stale: false, bulkEvidence }, global: { stubs: { UIcon: true } } })
  const action = (wrapper: ReturnType<typeof bulk>) => wrapper.findAll('button').find(item => item.text() === 'Usar una fuente para todos')
  it('the evidence group offers «Usar una fuente para todos», and only that group', () => {
    const wrapper = bulk()
    const button = action(wrapper)!
    expect(button.element.closest('li')!.getAttribute('data-problem')).toBe('EVIDENCE_REQUIRED')
    expect(wrapper.findAll('button').filter(item => item.text() === 'Usar una fuente para todos')).toHaveLength(1)
  })
  it('asks the owner to open the panel', async () => {
    const wrapper = bulk()
    await action(wrapper)!.trigger('click')
    expect(wrapper.emitted('bulk-evidence')).toEqual([[]])
    expect(wrapper.emitted('goto')).toBeUndefined()
  })
  it('is not offered when the owner has nothing to apply it to', () => {
    expect(action(bulk(realShaped(), false))).toBeUndefined()
  })
})
