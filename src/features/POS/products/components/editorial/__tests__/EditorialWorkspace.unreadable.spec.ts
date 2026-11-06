/**
 * EditorialWorkspace — 409 EDITORIAL_STATE_UNREADABLE (handoff 05, T13): the stored editorial state is not V2.
 * Retrying cannot help, so the read and the writes (initialize, save, discard) say so once, in plain words,
 * where the other editorial errors show, and offer no Reintentar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import type { EditorialContractDocument } from '../../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../../interfaces/editorial-contract-vocabulary.types'
import { document as emptyDocument, read, update, state, success, failure, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const MESSAGE = 'No pudimos leer el contenido guardado de este producto. Avísale a soporte para repararlo.'
const binding = { definitionId: 'material', definitionCode: 'material', owner: 'product' as const, sortOrder: 0, exposure: 'DETAIL' as const, searchable: false, publicationCheck: 'when_asserted' as const, policy: { route: 'pending' as const } }
const vocabulary: EditorialContractVocabulary = {
  semanticsVersion: 'editorial-production-1',
  families: [{ id: 'food', code: 'food', label: 'Alimento', bindings: [binding] }],
  definitions: [{ id: 'material', code: 'material', label: 'Material', type: 'text' }],
}
const doc = (): EditorialContractDocument => ({ ...emptyDocument(), commercialTitle: 'Croqueta', familyCode: 'food' })
let wrapper: VueWrapper

function reads(snapshot = state(doc())) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope(vocabulary) }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(snapshot)))
}
function unreadableState() {
  http.get.mockImplementation((url: string) => url.includes('vocabulary') ? Promise.resolve({ ...success(), data: vocabularyEnvelope(vocabulary) })
    : url.endsWith('/context') ? Promise.resolve({ status: 200, data: { variants: [] } })
      : url.endsWith('/readiness') ? Promise.resolve({ status: 200, data: {} }) : Promise.reject(failure(409, 'EDITORIAL_STATE_UNREADABLE')))
}
const stateReads = () => http.get.mock.calls.filter(([url]) => String(url).endsWith('/editorial')).length
const render = async () => {
  wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
  await flushPromises()
}
const material = () => wrapper.findAll('[data-testid="attribute-field"]').find(item => item.get('.hf-form-field__label').text() === 'Material')!.get('input[type="text"]')
const noRetry = () => {
  expect(wrapper.text()).not.toMatch(/Reintentar|Cargar la versión más reciente|Conservar mis cambios/)
  expect(wrapper.text()).not.toContain('Alguien más guardó cambios')
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { permissionCodes: [read, update], isAuthenticated: true, authPhase: 'authenticated', permissionsLoaded: true })
  reads()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

describe('EditorialWorkspace — EDITORIAL_STATE_UNREADABLE', () => {
  it('the read: the shared error state says what happened and who fixes it, with no Reintentar and one read', async () => {
    unreadableState()
    await render()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('error')
    expect(empty.text()).toContain('No pudimos leer el contenido guardado de este producto.')
    expect(empty.text()).toContain('Avísale a soporte para repararlo.')
    noRetry()
    await new Promise(resolve => setTimeout(resolve, 60)); await flushPromises()
    expect(stateReads()).toBe(1)
  })

  it('the read after an acknowledged save is not a stale view to retry', async () => {
    http.put.mockResolvedValue(success())
    await render()
    await material().setValue('Nylon')
    unreadableState()
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.find('[data-testid="stale-view"]').exists()).toBe(false)
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.get('.hf-empty-state__title').text()).toBe('No pudimos leer el contenido guardado de este producto.')
    expect(empty.get('.hf-empty-state__description').text()).toBe('Avísale a soporte para repararlo.')
    // The header keeps only its title: no progress or actions of a state that cannot be read.
    expect(wrapper.get('[data-testid="editorial-head"]').text()).toBe('Contenido')
    noRetry()
  })

  it('save: the alert above the cards says it once, keeps the edits and offers no reload or retry', async () => {
    http.put.mockRejectedValue(failure(409, 'EDITORIAL_STATE_UNREADABLE'))
    await render()
    await material().setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const alert = wrapper.get('[data-testid="reconciliation"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toBe(MESSAGE)
    expect(material().element).toHaveProperty('value', 'LOCAL')
    noRetry()
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it('discard: the same message, no reload', async () => {
    http.post.mockRejectedValue(failure(409, 'EDITORIAL_STATE_UNREADABLE'))
    await render()
    await wrapper.get('[data-testid="discard-draft"]').trigger('click'); await new Promise(resolve => setTimeout(resolve, 60))
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === 'Descartar borrador')!.click()
    await flushPromises()
    expect(wrapper.get('[data-testid="reconciliation"]').text()).toBe(MESSAGE)
    noRetry()
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('initialize: the empty state keeps its place and the message shows above it', async () => {
    reads({ cycle: 2, draft: null, published: { revision: 1, document: doc() } })
    http.post.mockRejectedValue(failure(409, 'EDITORIAL_STATE_UNREADABLE'))
    await render()
    await wrapper.get('[data-testid="initialize"]').trigger('click'); await flushPromises()
    const alert = wrapper.get('[data-testid="reconciliation"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toBe(MESSAGE)
    noRetry()
    expect(http.post).toHaveBeenCalledTimes(1)
  })
})
