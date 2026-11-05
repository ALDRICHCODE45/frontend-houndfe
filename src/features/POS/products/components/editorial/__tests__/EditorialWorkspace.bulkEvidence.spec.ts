/**
 * EditorialWorkspace — T24 (S19): «Usar una fuente para todos». From the evidence family of the checklist
 * (or the Presentación ⋯ menu), one source prefilled from a presentation goes, after an explicit
 * confirmation, to every known datum without a source, in ONE normal save; readiness is read again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import EditorialBulkEvidencePanel from '../EditorialBulkEvidencePanel.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import { useConfirm } from '@/core/shared/composables/useConfirm'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialBinding, EditorialContractVocabulary } from '../../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialContractState } from '../../../interfaces/editorial-contract-response.types'
import { document as emptyDocument, publish, R, read, state, success, update, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const toast = vi.hoisted(() => vi.fn())
vi.stubGlobal('useToast', () => ({ add: toast }))
vi.mock('@nuxt/ui/composables/useToast', async importOriginal => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return { ...actual, useToast: () => ({ ...actual.useToast(), add: toast }) }
})
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true,
  permissionCodes: [read, update, publish] as string[] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const binding = (code: string, owner: 'product' | 'sellable', section: string): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'when_asserted',
  policy: { route: 'pending' }, sectionCode: section, sectionSortOrder: 1,
})
const text = (id: string, label: string) => ({ id, code: id, label, type: 'text' as const })
const vocabulary = (): EditorialContractVocabulary => ({
  semanticsVersion: 'editorial-production-1',
  families: [{ id: 'food', code: 'food', label: 'Alimento', sections: [{ code: 'who', label: 'Para quién', sortOrder: 10 }, { code: 'pack', label: 'Contenido y empaque', sortOrder: 40 }],
    bindings: [binding('animal.target', 'product', 'who'), binding('food.line', 'product', 'who'), binding('food.flavor', 'product', 'who'), binding('measure.net_mass', 'sellable', 'pack')] }],
  definitions: [text('animal.target', 'Especie'), text('food.line', 'Línea'), text('food.flavor', 'Sabor'), text('measure.net_mass', 'Peso neto')],
})
const label = { sourceRef: 'Etiqueta del empaque', verifiedOn: '2026-11-01' }
const maker = { sourceRef: 'Catálogo del proveedor', verifiedOn: '2026-10-15' }
const declared = (variantId: string | null, presentation: string, evidence: { sourceRef: string; verifiedOn: string }) => ({ variantId, presentation, careReview: null,
  declarations: [{ key: 'contentMagnitude' as const, state: 'known' as const, value: 'mass' as const, evidence, basis: 'Dice el empaque' }] })
const known = (code: string, value: string, variantId: string | null = null, evidence: { sourceRef: string; verifiedOn: string } | null = null) => ({
  code, owner: variantId === null ? 'product' as const : 'sellable' as const, variantId, state: 'known' as const, payload: { type: 'text' as const, value }, evidence })
const doc = (patch: Partial<EditorialContractDocument> = {}): EditorialContractDocument => ({ ...emptyDocument(), commercialTitle: 'Croqueta', familyCode: 'food',
  values: [known('animal.target', 'Perro'), known('food.line', 'Adulto', null, { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-09-01' }),
    { code: 'food.flavor', owner: 'product', variantId: null, state: 'unknown', evidence: null }, known('measure.net_mass', '3 kg', 'v1'), known('measure.net_mass', '7 kg', 'v2')],
  facts: [declared('v1', 'Chico', label), declared('v2', 'Grande', maker)], ...patch })
const EVIDENCE = 'Agrega de dónde sale este dato.'
const evidenceItem = (code: string, variantId: string | null, section: string) => ({ scope: 'definition', definitionCode: code, variantId, sectionCode: section, problem: 'EVIDENCE_REQUIRED', message: EVIDENCE })
const mismatch = { scope: 'definition', definitionCode: 'measure.net_mass', variantId: 'v1', sectionCode: 'pack', problem: 'MAGNITUDE_MISMATCH',
  message: 'El tipo de contenido no coincide con cómo se mide el contenido de la presentación.' }
const readiness = (items: unknown[], draftRevision = 3) => ({ ready: items.length === 0, cycle: 2, draftRevision, vocabularyRevision: R, items, bySection: {} })
const pending = () => readiness([evidenceItem('animal.target', null, 'who'), evidenceItem('measure.net_mass', 'v1', 'pack'), evidenceItem('measure.net_mass', 'v2', 'pack'), mismatch])
const ok = (data: unknown) => ({ status: 200, data, headers: { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': R } })

let current: { snapshot: EditorialContractState; readiness: unknown }
function serve() {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocabulary()) }
    : url.endsWith('/context') ? { status: 200, data: { variants: [{ id: 'v1', name: 'Chico' }, { id: 'v2', name: 'Grande' }] } }
      : url.endsWith('/draft/readiness') ? ok(current.readiness) : success(current.snapshot)))
}
let wrapper: VueWrapper
const render = async () => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
  await flushPromises()
}
const panel = () => wrapper.getComponent(EditorialBulkEvidencePanel)
const openFromChecklist = async () => { await wrapper.get('[data-testid="publish-checklist-bulk"]').trigger('click'); await flushPromises() }
const apply = async (evidence: { sourceRef: string; verifiedOn: string }) => { panel().vm.$emit('apply', evidence); await flushPromises() }
const readinessCalls = () => http.get.mock.calls.filter(([url]) => String(url).endsWith('/draft/readiness')).length
const sentValues = () => http.put.mock.calls[0]![1].document.values as EditorialContractDocument['values']

beforeEach(() => {
  vi.resetAllMocks()
  current = { snapshot: state(doc()), readiness: pending() }
  serve()
})
afterEach(() => { useConfirm().cancelAll(); wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — one source for all: entry and panel', () => {
  it('the evidence family of the checklist opens the panel with the data that have no source', async () => {
    await render()
    expect(panel().props('open')).toBe(false)
    await openFromChecklist()
    expect(panel().props('open')).toBe(true)
    // Known values without evidence only: Especie (product) and Peso neto of each presentation; never Línea (sourced) or Sabor (unknown).
    expect(panel().props('fields')).toEqual(['Especie', 'Peso neto · Chico', 'Peso neto · Grande'])
  })
  it('prefills from the presentation being edited, and offers every presentation to choose from', async () => {
    await render()
    await openFromChecklist()
    expect(panel().props('presentations')).toEqual([{ key: expect.any(String), title: 'Chico', source: label }, { key: expect.any(String), title: 'Grande', source: maker }])
    expect(panel().props('initial')).toBe(panel().props('presentations')[0]!.key)
    expect(panel().getComponent(HfSegmented).props('modelValue')).toBe(panel().props('initial'))
  })
  it('the Presentación ⋯ menu offers the same action', async () => {
    await render()
    await wrapper.get('[data-testid="presentation-section"] .hf-section-card__meta button[aria-haspopup="menu"]').trigger('click'); await flushPromises()
    const entry = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.includes('Usar una fuente para todos'))!
    entry.click(); await flushPromises()
    expect(panel().props('open')).toBe(true)
  })
  it('with every known datum sourced there is nothing to offer', async () => {
    current.snapshot = state(doc({ values: [known('animal.target', 'Perro', null, label)] }))
    current.readiness = readiness([mismatch])
    await render()
    expect(wrapper.find('[data-testid="publish-checklist-bulk"]').exists()).toBe(false)
  })
})

describe('EditorialWorkspace — one source for all: confirmation', () => {
  it('asks «¿Todos estos datos salen de {fuente}?» before anything changes', async () => {
    await render()
    await openFromChecklist()
    await apply(maker)
    const { pending: asked } = useConfirm()
    expect(asked.value?.options).toEqual({ title: '¿Todos estos datos salen de Catálogo del proveedor?',
      description: 'Quedará registrado que estos 3 datos salen de Catálogo del proveedor, revisada el 15 oct. Si alguno sale de otro lado, cárgalo campo por campo.',
      confirmLabel: 'Sí, usar esta fuente' })
    expect(http.put).not.toHaveBeenCalled()
  })
  it('cancelling changes nothing and saves nothing', async () => {
    await render()
    await openFromChecklist()
    await apply(maker)
    useConfirm().settle(false); await flushPromises()
    expect(http.put).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="editorial-save-bar"]').text()).not.toMatch(/cambio/i)
    expect(panel().props('open')).toBe(true)
  })
})

describe('EditorialWorkspace — one source for all: the save', () => {
  it('sends ONE save with the source on known values without one, and reads readiness again', async () => {
    await render()
    await openFromChecklist()
    await apply(maker)
    const before = readinessCalls()
    current.snapshot = state(doc({ values: doc().values.map(value => (value.state === 'known' && value.evidence === null ? { ...value, evidence: maker } : value)) }), 4)
    current.readiness = readiness([mismatch], 4)
    http.put.mockResolvedValue(success(current.snapshot))
    useConfirm().settle(true); await flushPromises()

    expect(http.put).toHaveBeenCalledTimes(1)
    const [url, body, config] = http.put.mock.calls[0]!
    expect(url).toBe('/products/p1/editorial/draft')
    expect(Object.keys(body).sort()).toEqual(['document', 'expectedCycle', 'expectedRevision'])
    expect(body).toMatchObject({ expectedCycle: 2, expectedRevision: 3 })
    expect(config.headers['Idempotency-Key']).toEqual(expect.any(String))
    expect(config.headers['Editorial-Vocabulary-Revision']).toBe(R)
    expect(sentValues()).toEqual([known('animal.target', 'Perro', null, maker), known('food.line', 'Adulto', null, { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-09-01' }),
      { code: 'food.flavor', owner: 'product', variantId: null, state: 'unknown', evidence: null }, known('measure.net_mass', '3 kg', 'v1', maker), known('measure.net_mass', '7 kg', 'v2', maker)])
    // The declaration evidence is only a prefill: the facts go back as they were.
    expect(body.document.facts).toEqual(doc().facts)

    expect(readinessCalls()).toBe(before + 1)
    expect(panel().props('open')).toBe(false)
    const checklist = wrapper.get('[data-testid="publish-checklist"]')
    expect(checklist.text()).not.toContain(EVIDENCE)
    expect(checklist.text()).toContain('El tipo de contenido no coincide')
  })
  it('a 400 shows the error in the panel and changes nothing locally', async () => {
    await render()
    await openFromChecklist()
    await apply(maker)
    http.put.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { statusCode: 400, error: 'MALFORMED' } } })
    useConfirm().settle(true); await flushPromises()
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(panel().props('open')).toBe(true)
    expect(panel().props('error')).toBe('No se guardó la fuente. No cambió nada; revisa la fuente y la fecha.')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
    // Nothing to save: the buffer is the saved draft again, so «Publicar» stays the bar.
    expect(wrapper.find('[data-testid="publish"]').exists()).toBe(true)
  })
  it('a 409 goes to the usual conflict handling', async () => {
    await render()
    await openFromChecklist()
    await apply(maker)
    http.put.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { statusCode: 409, error: 'CONFLICT' } } })
    useConfirm().settle(true); await flushPromises()
    expect(panel().props('open')).toBe(false)
    expect(wrapper.get('[data-testid="reconciliation"]').text()).toContain('Alguien más guardó cambios')
  })
})
