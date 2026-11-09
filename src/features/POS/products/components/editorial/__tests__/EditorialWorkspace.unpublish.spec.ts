/**
 * EditorialWorkspace — S4: «Despublicar» in the header (handoff 07 §6). A publisher sees it while something
 * is published; it asks first (danger) and says what happens online; afterwards the header reads «Borrador»
 * or no editorial state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import { useConfirm } from '@/core/shared/composables/useConfirm'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialContractState } from '../../../interfaces/editorial-contract-response.types'
import { document as emptyDocument, publish, R, read, success, update, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

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

const UNPUBLISH = '/products/p1/editorial/published/unpublish'
const INITIALIZE = '/products/p1/editorial/draft/initialize'
const doc = (patch: Partial<EditorialContractDocument> = {}): EditorialContractDocument => ({ ...emptyDocument(), commercialTitle: 'Croqueta', ...patch })
const published = (cycle = 2): EditorialContractState => ({ cycle, draft: null, published: { revision: 2, document: doc() } })
const withDraft = (cycle = 2): EditorialContractState => ({ ...published(cycle), draft: { revision: 3, basePublishedRevision: 2, document: doc() } })
const kept = (cycle = 2): EditorialContractState => ({ cycle, draft: { revision: 3, basePublishedRevision: 2, document: doc() }, published: null })
const readiness = { ready: true, cycle: 2, draftRevision: 3, vocabularyRevision: R, items: [], bySection: {} }

let snapshot: EditorialContractState
function serve() {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } }
      : url.endsWith('/draft/readiness') ? { status: 200, data: { ...readiness, cycle: snapshot.cycle, draftRevision: snapshot.draft?.revision ?? null },
        headers: { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': R } }
        : success(snapshot)))
}
let wrapper: VueWrapper
const render = async () => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
  await flushPromises()
}
const button = () => wrapper.find('[data-testid="unpublish"]')
const headStatus = () => wrapper.find('[data-testid="publication-status"]')
const unpublishCalls = () => http.post.mock.calls.filter(([url]) => url === UNPUBLISH)

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update, publish] })
  snapshot = withDraft()
  serve()
})
afterEach(() => { useConfirm().cancelAll(); wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — «Despublicar»', () => {
  it('a publisher sees a ghost «Despublicar» in the header while something is published', async () => {
    await render()
    expect(button().exists()).toBe(true)
    expect(button().text()).toBe('Despublicar')
    expect(button().classes()).not.toContain('hf-primary-control')
    expect(wrapper.get('[data-testid="editorial-head"]').find('[data-testid="unpublish"]').exists()).toBe(true)
  })
  it('read + update alone: no «Despublicar»', async () => {
    auth.permissionCodes = [read, update]
    await render()
    expect(button().exists()).toBe(false)
  })
  it('nothing published: no «Despublicar»', async () => {
    snapshot = kept()
    await render()
    expect(headStatus().text()).toBe('Borrador')
    expect(button().exists()).toBe(false)
  })
  it('a publisher without the edit grant sees it while there is a draft to keep', async () => {
    auth.permissionCodes = [read, publish]
    await render()
    expect(button().exists()).toBe(true)
  })
  it('published without a draft, a writer sees it next to Historial', async () => {
    snapshot = published()
    await render()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('La ficha está publicada')
    expect(button().exists()).toBe(true)
    expect(wrapper.find('[data-testid="open-history"]').exists()).toBe(true)
  })
  it('asks with a danger confirm that says what happens online; «no» sends nothing', async () => {
    await render()
    await button().trigger('click')
    await flushPromises()
    const { pending, settle } = useConfirm()
    expect(pending.value?.options).toEqual({
      title: '¿Despublicar este producto?',
      description: 'Si la tienda muestra solo productos con ficha publicada, este producto sale del catálogo en línea. El contenido se queda como borrador para volver a publicarlo.',
      confirmLabel: 'Despublicar',
      tone: 'danger',
    })
    settle(false)
    await flushPromises()
    expect(http.post).not.toHaveBeenCalled()
    expect(headStatus().text()).toBe('Publicado')
  })
  it('after «Despublicar» the header reads «Borrador» and «Despublicar» goes away', async () => {
    await render()
    http.post.mockImplementation(() => { snapshot = kept(); return Promise.resolve(success(snapshot)) })
    await button().trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(unpublishCalls()).toHaveLength(1)
    expect(unpublishCalls()[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 2 })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Despublicado.' }))
    expect(headStatus().text()).toBe('Borrador')
    expect(button().exists()).toBe(false)
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="unpublish-message"]').exists()).toBe(false)
  })
  it('without a draft it keeps the content: initialize, then unpublish; the header reads «Borrador»', async () => {
    snapshot = published()
    await render()
    http.post.mockImplementation((url: string) => {
      snapshot = url === INITIALIZE ? withDraft(3) : kept(3)
      return Promise.resolve(success(snapshot, url === INITIALIZE ? 201 : 200))
    })
    await button().trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(http.post.mock.calls.map(([url]) => url)).toEqual([INITIALIZE, UNPUBLISH])
    expect(headStatus().text()).toBe('Borrador')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
  it('an ambiguous failure says so under the header and offers «Reintentar despublicar» with the same key, without asking again', async () => {
    await render()
    http.post.mockRejectedValueOnce(Object.assign(new Error('offline'), { isAxiosError: true }))
    await button().trigger('click')
    await flushPromises()
    useConfirm().settle(true)
    await flushPromises()
    expect(wrapper.get('[data-testid="unpublish-message"]').text()).toContain('No pudimos confirmar si se despublicó')
    expect(wrapper.find('[data-testid="reconciliation"]').exists()).toBe(false)
    expect(button().text()).toBe('Reintentar despublicar')
    http.post.mockImplementationOnce(() => { snapshot = kept(); return Promise.resolve(success(snapshot)) })
    await button().trigger('click')
    await flushPromises()
    expect(useConfirm().pending.value).toBeNull()
    expect(unpublishCalls()[1]![2].headers['Idempotency-Key']).toBe(unpublishCalls()[0]![2].headers['Idempotency-Key'])
    expect(headStatus().text()).toBe('Borrador')
  })
})
