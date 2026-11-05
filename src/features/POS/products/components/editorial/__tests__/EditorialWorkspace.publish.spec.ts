/**
 * EditorialWorkspace — T23 (S15): «Publicar». Readiness of the saved draft feeds the section index and an
 * Issue checklist; the save bar's primary is «Guardar» with changes and «Publicar» when clean (enabled only
 * when ready); Cuidado asks first; after publishing the header reads «Publicado».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import HfSectionNav from '@/core/shared/components/form/HfSectionNav.vue'
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

const binding = (code: string, owner: 'product' | 'sellable', section?: string): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'when_asserted',
  policy: { route: 'pending' }, ...(section ? { sectionCode: section, sectionSortOrder: 1 } : {}),
})
const vocabulary = (): EditorialContractVocabulary => ({
  semanticsVersion: 'editorial-production-1',
  families: [
    { id: 'food', code: 'food', label: 'Alimento', sections: [{ code: 'who', label: 'Para quién', sortOrder: 10 }, { code: 'pack', label: 'Contenido y empaque', sortOrder: 40 }],
      bindings: [binding('measure.net_mass', 'sellable', 'pack'), binding('animal.target', 'product', 'who')] },
    { id: 'care', code: 'care', label: 'Cuidado', bindings: [] },
  ],
  definitions: [
    { id: 'animal.target', code: 'animal.target', label: 'Especie', type: 'single', groups: [], aliases: [], options: [{ code: 'dog', label: 'Perro', archived: false, sortOrder: 0 }] },
    { id: 'measure.net_mass', code: 'measure.net_mass', label: 'Peso neto', type: 'text' },
  ],
})
const doc = (patch: Partial<EditorialContractDocument> = {}): EditorialContractDocument => ({ ...emptyDocument(), commercialTitle: 'Croqueta', familyCode: 'food', ...patch })
const item = (patch: Record<string, unknown> = {}) => ({ scope: 'definition', definitionCode: 'measure.net_mass', variantId: null,
  sectionCode: 'pack', problem: 'REQUIRED_MISSING', message: 'Falta el peso neto.', ...patch })
const careItem = item({ scope: 'care', definitionCode: null, sectionCode: null, problem: 'CARE_REVIEW_INCOMPLETE', message: 'Completa la revisión de cuidado de esta presentación.' })
const noDraft = { ready: false, cycle: 2, draftRevision: null, vocabularyRevision: R, bySection: {},
  items: [item({ scope: 'product', definitionCode: null, sectionCode: null, problem: 'NO_DRAFT', message: 'Todavía no hay un borrador guardado.' })] }
const readiness = (items: unknown[] = [], bySection: Record<string, number> = {}, draftRevision: number | null = 3) =>
  ({ ready: items.length === 0, cycle: 2, draftRevision, vocabularyRevision: R, items, bySection })
const ok = (data: unknown) => ({ status: 200, data, headers: { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': R } })

let current: { snapshot: EditorialContractState; readiness: unknown; variants?: { id: string; name: string }[]; vocabulary?: EditorialContractVocabulary }
function serve() {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(current.vocabulary ?? vocabulary()) }
    : url.endsWith('/context') ? { status: 200, data: { variants: current.variants ?? [] } }
      : url.endsWith('/draft/readiness') ? ok(current.readiness) : success(current.snapshot)))
}
let wrapper: VueWrapper
const render = async () => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
  await flushPromises()
}
const publishButton = () => wrapper.find('[data-testid="publish"]')
const navCounts = () => Object.fromEntries(wrapper.getComponent(HfSectionNav).props('sections').map(section => [section.label, section.missing]))
const checklist = () => wrapper.find('[data-testid="publish-checklist"]')
const headStatus = () => wrapper.get('[data-testid="publication-status"]').text()

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update, publish] })
  current = { snapshot: state(doc()), readiness: readiness() }
  serve()
})
afterEach(() => { useConfirm().cancelAll(); wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — publish bar', () => {
  it('clean and ready: «Publicar» is the primary, enabled', async () => {
    await render()
    expect(wrapper.findComponent(HfSaveBar).exists()).toBe(false)
    expect(publishButton().text()).toBe('Publicar')
    expect(publishButton().classes()).toContain('hf-primary-control')
    expect(publishButton().attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="editorial-save-bar"]').text()).toContain('Listo para publicar')
    expect(checklist().exists()).toBe(false)
  })
  it('clean and not ready: «Publicar» is disabled and the checklist explains why', async () => {
    current.readiness = readiness([careItem, item()], { pack: 1 })
    await render()
    expect(publishButton().attributes('disabled')).toBeDefined()
    expect(publishButton().attributes('aria-describedby')).toBe('editorial-publish-checklist')
    expect(publishButton().attributes('title')).toBeUndefined()
    expect(checklist().attributes('id')).toBe('editorial-publish-checklist')
    expect(checklist().text()).toContain('Completa la revisión de cuidado de esta presentación.')
    expect(checklist().text()).toContain('Falta el peso neto.')
    expect(checklist().text()).not.toContain('Según lo último que guardaste')
  })
  it('with unsaved changes, «Guardar» is the primary and the checklist says it is from the last save', async () => {
    current.readiness = readiness([item()], { pack: 1 })
    await render()
    await wrapper.get('#editorial-title').setValue('Otra croqueta')
    expect(wrapper.findComponent(HfSaveBar).exists()).toBe(true)
    expect(publishButton().exists()).toBe(false)
    expect(checklist().text()).toContain('Según lo último que guardaste')
  })
  it('without the publish grant there is no «Publicar»: the save bar stays', async () => {
    auth.permissionCodes = [read, update]
    await render()
    expect(publishButton().exists()).toBe(false)
    expect(wrapper.findComponent(HfSaveBar).exists()).toBe(true)
  })
  it('a definition item links to its field', async () => {
    current.readiness = readiness([item()], { pack: 1 })
    await render()
    const link = checklist().get('button')
    expect(link.text()).toBe('Ir a Peso neto')
    await link.trigger('click')
    await flushPromises()
    expect(document.activeElement?.id).toBe('attr-measure.net_mass-sellable-value')
  })
})

describe('EditorialWorkspace — per-presentation items (D9)', () => {
  it('an EVIDENCE_REQUIRED item of an offered presentation switches to it before focusing the field', async () => {
    current.variants = [{ id: 'v1', name: 'Chico' }, { id: 'v2', name: 'Grande' }]
    current.readiness = readiness([item({ variantId: 'v2', problem: 'EVIDENCE_REQUIRED', message: 'Agrega de dónde sale este dato.' })], { pack: 1 })
    await render()
    await checklist().get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="presentation-switcher"]').text()).toContain('Grande')
    expect(wrapper.findAll('[data-testid="attribute-section"]').find(card => card.text().includes('Contenido y empaque'))!.text()).toContain('Para: Grande')
    expect(document.activeElement?.id).toBe('attr-measure.net_mass-sellable-value')
  })
})

describe('EditorialWorkspace — section counts', () => {
  it('clean: «falta N» per section comes from readiness bySection, and the header agrees', async () => {
    current.readiness = readiness([item(), item({ definitionCode: 'x' })], { pack: 2 })
    await render()
    expect(navCounts()).toMatchObject({ 'Para quién': 0, 'Contenido y empaque': 2 })
    expect(wrapper.get('[data-testid="editorial-progress"]').text()).toContain('Faltan 2')
  })
  it('with unsaved edits: the live local count', async () => {
    current.readiness = readiness([item(), item({ definitionCode: 'x' })], { pack: 2 })
    await render()
    await wrapper.get('#editorial-title').setValue('Otra croqueta')
    expect(navCounts()).toMatchObject({ 'Para quién': 1, 'Contenido y empaque': 1 })
    expect(wrapper.get('[data-testid="editorial-progress"]').text()).toContain('Faltan 2')
  })
  it('counts distinct fields, not items: the real 18-item shape where «Tipo de contenido» has 2 items reads 17 everywhere', async () => {
    // «Alimento para Cachorro Raza Mediana 3 kg» on BE :3003: bySection counts items (4+5+3+5+1 = 18).
    const fields: Record<string, string[]> = {
      'que-es': ['food.content_type', 'food.format', 'food.line'], 'para-quien': ['animal.target', 'animal.life_stage', 'animal.breed_size', 'animal.activity', 'animal.condition'],
      nutricion: ['food.protein_source', 'food.ingredients', 'food.flavor'], uso: ['food.feeding_guide', 'food.storage', 'food.serving', 'food.transition', 'food.warnings'],
      empaque: ['measure.net_mass'],
    }
    const labels: Record<string, string> = { 'que-es': 'Qué es', 'para-quien': 'Para quién', nutricion: 'Nutrición', uso: 'Uso', empaque: 'Empaque' }
    const base = vocabulary()
    current.vocabulary = { ...base,
      families: [{ id: 'food', code: 'food', label: 'Alimento', sections: Object.keys(fields).map((code, index) => ({ code, label: labels[code]!, sortOrder: index })),
        bindings: Object.entries(fields).flatMap(([section, codes]) => codes.map(code => binding(code, 'product', section))) }, base.families[1]!],
      definitions: Object.values(fields).flat().map(code => ({ id: code, code, label: code, type: 'text' as const })) }
    const evidence = { problem: 'EVIDENCE_REQUIRED', message: 'Agrega de dónde sale este dato.' }
    const items = [
      ...Object.entries(fields).flatMap(([sectionCode, codes]) => codes.map(definitionCode => item({ definitionCode, sectionCode, ...evidence }))),
      item({ definitionCode: 'food.content_type', sectionCode: 'que-es', problem: 'CONTENT_TYPE_MISMATCH', message: 'El tipo de contenido no coincide con la familia.' }),
    ]
    expect(items).toHaveLength(18)
    current.readiness = readiness(items, { 'que-es': 4, 'para-quien': 5, nutricion: 3, uso: 5, empaque: 1 })
    await render()
    expect(wrapper.get('[data-testid="editorial-progress"]').text()).toContain('Faltan 17')
    expect(wrapper.get('[data-testid="publish-checklist-head"]').text()).toBe('Para publicar, resuelve: 17 campos')
    const counts = navCounts()
    expect(counts).toMatchObject({ 'Qué es': 3, 'Para quién': 5, Nutrición: 3, Uso: 5, Empaque: 1 })
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(17)
  })
  it('reads readiness again after a save', async () => {
    await render()
    await wrapper.get('#editorial-title').setValue('Otra croqueta')
    current.snapshot = state(doc({ commercialTitle: 'Otra croqueta' }), 4)
    current.readiness = readiness([item()], { pack: 1 }, 4)
    http.put.mockResolvedValue(success(current.snapshot))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(http.get.mock.calls.filter(([url]) => String(url).endsWith('/draft/readiness'))).toHaveLength(2)
    expect(navCounts()).toMatchObject({ 'Contenido y empaque': 1, 'Para quién': 0 })
  })
})

describe('EditorialWorkspace — publishing', () => {
  it('publishes, says «Publicado.» and then reads «Publicado» with no checklist', async () => {
    await render()
    expect(headStatus()).toBe('Borrador')
    http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: { revision: 1, document: doc() } }))
    current = { snapshot: { cycle: 2, draft: null, published: { revision: 1, document: doc() } }, readiness: noDraft }
    await publishButton().trigger('click')
    await flushPromises()
    expect(http.post.mock.calls[0]![2].headers['Editorial-Care-Confirmation']).toBeUndefined()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Publicado.' }))
    expect(headStatus()).toMatch(/^Publicado · \d{1,2} \w+/)
    expect(checklist().exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
  it('Cuidado asks «Confirmo que revisé la información de cuidado.» and sends review-v1 after «Publicar»', async () => {
    current.snapshot = state(doc({ familyCode: 'care' }))
    await render()
    http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: { revision: 1, document: doc({ familyCode: 'care' }) } }))
    await publishButton().trigger('click')
    await flushPromises()
    const { pending, settle } = useConfirm()
    expect(pending.value?.options).toMatchObject({ description: 'Confirmo que revisé la información de cuidado.', confirmLabel: 'Publicar' })
    expect(http.post).not.toHaveBeenCalled()
    settle(true)
    await flushPromises()
    expect(http.post.mock.calls[0]![2].headers['Editorial-Care-Confirmation']).toBe('review-v1')
  })
  it('the header reads «Cambios sin publicar» when the draft differs from the published version', async () => {
    current.snapshot = { ...state(doc({ commercialTitle: 'Nueva' })), published: { revision: 2, document: doc() } }
    await render()
    expect(headStatus()).toBe('Cambios sin publicar')
  })
  it('with nothing to edit after publishing, it reads «Publicado» and offers Historial', async () => {
    current = { snapshot: { cycle: 2, draft: null, published: { revision: 2, document: doc() } }, readiness: noDraft }
    await render()
    expect(headStatus()).toBe('Publicado')
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('La ficha está publicada')
    expect(wrapper.find('[data-testid="open-history"]').exists()).toBe(true)
    expect(checklist().exists()).toBe(false)
  })
  it('a 409 CONFLICT reloads and says so in the bar', async () => {
    await render()
    http.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { statusCode: 409, error: 'CONFLICT' } } })
    await publishButton().trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="editorial-save-bar"]').text()).toContain('Alguien más cambió el contenido')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
  })
})
