/** T23: readiness after every coherent read, and publish V2 with its headers, keys and refusals (handoff 05). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useEditorialEditor } from '../useEditorialEditor'
import { useEditorialPublish } from '../useEditorialPublish'
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import type { EditorialContractState } from '../../interfaces/editorial-contract-response.types'
import { careDocument, careVocabulary, document, failure, R, read, publish, state, success, update, vocabularyEnvelope } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' },
  permissionsLoaded: true, permissionCodes: [read, update, publish] as string[] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const R2 = `ev2-sha256-${'b'.repeat(64)}`
const item = (patch: Record<string, unknown> = {}) => ({ scope: 'definition', definitionCode: 'measure.net_mass', variantId: null,
  sectionCode: 'pack', problem: 'REQUIRED_MISSING', message: 'Falta el peso neto.', ...patch })
const noDraftItem = item({ scope: 'product', definitionCode: null, sectionCode: null, problem: 'NO_DRAFT', message: 'Todavía no hay un borrador guardado.' })
type Readiness = { ready: boolean; cycle: number | null; draftRevision: number | null; vocabularyRevision: string; items: unknown[]; bySection: Record<string, number> }
const ready = (patch: Partial<Readiness> = {}): Readiness => ({ ready: true, cycle: 2, draftRevision: 3, vocabularyRevision: R, items: [], bySection: {}, ...patch })
const notReady = (patch: Partial<Readiness> = {}) => ready({ ready: false, items: [item()], bySection: { pack: 1 }, ...patch })
const ok = (data: unknown, revision = R) => ({ status: 200, data, headers: { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': revision } })
const published = (doc: EditorialContractDocument = document()): EditorialContractState => ({ cycle: 2, draft: null, published: { revision: 2, document: doc } })

let current: { snapshot: EditorialContractState; readiness: Readiness | (() => unknown); revision: string; care: boolean }
function serve() {
  http.get.mockImplementation((url: string) => {
    if (url.includes('vocabulary')) return Promise.resolve({ ...success(undefined, 200, current.revision), data: vocabularyEnvelope(current.care ? careVocabulary() : undefined, current.revision) })
    if (url.endsWith('/context')) return Promise.resolve({ status: 200, data: { variants: [] } })
    if (url.endsWith('/draft/readiness')) {
      const value = current.readiness
      return typeof value === 'function' ? Promise.resolve().then(value) : Promise.resolve(ok(value, current.revision))
    }
    return Promise.resolve(success(current.snapshot, 200, current.revision))
  })
}
const readinessCalls = () => http.get.mock.calls.filter(([url]) => String(url).endsWith('/draft/readiness'))
const stateCalls = () => http.get.mock.calls.filter(([url]) => String(url).endsWith('/editorial'))
const scopes: ReturnType<typeof effectScope>[] = []
const confirmCare = vi.fn<() => Promise<boolean>>()
const notify = vi.fn<(title: string) => void>()
async function setup() {
  const scope = effectScope(); scopes.push(scope)
  const result = scope.run(() => {
    const editor = useEditorialEditor('p1')
    return { editor, flow: useEditorialPublish(editor, { productId: () => 'p1', confirmCare, notify }) }
  })!
  await flushPromises()
  return result
}
const publishedResponse = (doc = document()) => success(published(doc))
const networkFailure = () => Object.assign(new Error('offline'), { isAxiosError: true })
const sentKey = (call: number) => http.post.mock.calls[call]![2].headers['Idempotency-Key'] as string
const sentHeaders = (call: number) => http.post.mock.calls[call]![2].headers as Record<string, string>

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { isSuperAdmin: false, permissionCodes: [read, update, publish] })
  current = { snapshot: state(), readiness: ready(), revision: R, care: false }
  serve()
})
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('readiness', () => {
  it('is read after the editor loads, pinned to the installed vocabulary', async () => {
    const { flow } = await setup()
    expect(readinessCalls()).toHaveLength(1)
    expect(readinessCalls()[0]![1].headers).toEqual({ 'Editorial-Vocabulary-Revision': R })
    expect(flow.readiness.value?.ready).toBe(true)
    expect(flow.canPublish.value).toBe(true)
    expect(flow.checklist.value).toEqual([])
  })
  it('not ready: lists every item with its message and counts per section; Publicar stays off', async () => {
    current.readiness = notReady({ items: [item(), item({ scope: 'care', definitionCode: null, sectionCode: null, problem: 'CARE_REVIEW_INCOMPLETE', message: 'Completa la revisión de cuidado de esta presentación.' })] })
    const { flow } = await setup()
    expect(flow.canPublish.value).toBe(false)
    expect(flow.checklist.value.map(entry => entry.message)).toEqual(['Falta el peso neto.', 'Completa la revisión de cuidado de esta presentación.'])
    expect(flow.sectionCounts.value).toEqual({ pack: 1 })
  })
  it('is read again after every successful save (it evaluates what is saved)', async () => {
    const { editor } = await setup()
    editor.lifecycle.buffer.value = { ...editor.lifecycle.buffer.value!, commercialTitle: 'Otro' }
    current.snapshot = state({ ...document(), commercialTitle: 'Otro' }, 4)
    current.readiness = notReady({ draftRevision: 4 })
    http.put.mockResolvedValue(success(current.snapshot))
    expect(await editor.save()).toBe(true)
    await editor.refresh('retain', { quiet: true })
    await flushPromises()
    expect(readinessCalls()).toHaveLength(2)
  })
  it('ignores a readiness for another saved revision', async () => {
    current.readiness = notReady({ draftRevision: 9 })
    const { flow } = await setup()
    expect(flow.readiness.value).toBeNull()
    expect(flow.sectionCounts.value).toBeNull()
    expect(flow.canPublish.value).toBe(false)
  })
  it('NO_DRAFT after a publication reads as «Publicado»: no checklist, no error', async () => {
    current.snapshot = published()
    current.readiness = ready({ ready: false, draftRevision: null, items: [noDraftItem] })
    const { flow } = await setup()
    expect(flow.status.value).toEqual({ kind: 'published', label: 'Publicado' })
    expect(flow.checklist.value).toEqual([])
    expect(flow.sectionCounts.value).toBeNull()
    expect(flow.message.value).toBeNull()
  })
  it('VOCABULARY_CHANGED reloads the vocabulary once and reads again with the new revision', async () => {
    let calls = 0
    current.readiness = () => {
      calls++
      if (calls === 1) { current.revision = R2; throw failure(409, 'VOCABULARY_CHANGED') }
      return ok(ready({ vocabularyRevision: R2 }), R2)
    }
    const { flow } = await setup()
    await flushPromises()
    expect(readinessCalls().map(call => call[1].headers['Editorial-Vocabulary-Revision'])).toEqual([R, R2])
    expect(flow.readiness.value?.vocabularyRevision).toBe(R2)
  })
})

describe('permission gating', () => {
  it('hides Publicar without the publish grant', async () => {
    auth.permissionCodes = [read, update]
    const { flow } = await setup()
    expect(flow.visible.value).toBe(false)
    expect(flow.canPublish.value).toBe(false)
  })
  it('read + publish is enough: update is not needed', async () => {
    auth.permissionCodes = [read, publish]
    const { flow } = await setup()
    expect(flow.visible.value).toBe(true)
    expect(flow.canPublish.value).toBe(true)
  })
  it('a 403 on publish hides Publicar', async () => {
    http.post.mockRejectedValue(failure(403, 'FORBIDDEN'))
    const { flow } = await setup()
    expect(await flow.publish()).toBe(false)
    expect(flow.visible.value).toBe(false)
  })
})

describe('publish', () => {
  it('sends the key, the vocabulary and the saved target, never a care header for another family; then reloads', async () => {
    http.post.mockResolvedValue(publishedResponse())
    const { flow } = await setup()
    current.snapshot = published(); current.readiness = ready({ ready: false, draftRevision: null, items: [noDraftItem] })
    expect(await flow.publish()).toBe(true)
    expect(confirmCare).not.toHaveBeenCalled()
    expect(http.post.mock.calls[0]![0]).toBe('/products/p1/editorial/draft/publish')
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3 })
    expect(sentHeaders(0)).toEqual({ 'Idempotency-Key': expect.any(String), 'Editorial-Vocabulary-Revision': R })
    await flushPromises()
    expect(notify).toHaveBeenCalledWith('Publicado.')
    expect(stateCalls()).toHaveLength(2)
    expect(readinessCalls()).toHaveLength(2)
    expect(flow.status.value?.kind).toBe('published')
    expect(flow.status.value?.label).toMatch(/^Publicado · /)
  })
  it('Cuidado: asks first, and sends review-v1 only after the confirmation', async () => {
    current = { ...current, snapshot: state(careDocument()), care: true }
    http.post.mockResolvedValue(publishedResponse(careDocument()))
    const { flow } = await setup()
    confirmCare.mockResolvedValueOnce(false)
    expect(await flow.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
    confirmCare.mockResolvedValueOnce(true)
    expect(await flow.publish()).toBe(true)
    expect(sentHeaders(0)['Editorial-Care-Confirmation']).toBe('review-v1')
  })
  it('an ambiguous failure retries with the same key; a new attempt gets a new key', async () => {
    http.post.mockRejectedValueOnce(networkFailure()).mockRejectedValueOnce(networkFailure())
    const { flow } = await setup()
    expect(await flow.publish()).toBe(false)
    expect(flow.retryable.value).toBe(true)
    expect(flow.message.value).toMatch(/No pudimos confirmar si se publicó/)
    expect(await flow.retry()).toBe(false)
    expect(sentKey(1)).toBe(sentKey(0))
    http.post.mockResolvedValueOnce(publishedResponse())
    expect(await flow.retry()).toBe(true)
    expect(sentKey(2)).toBe(sentKey(0))
    // A later, separate attempt is a new key.
    current.snapshot = state(document(), 5); current.readiness = ready({ draftRevision: 5 })
    await flow.reload()
    http.post.mockResolvedValueOnce(publishedResponse())
    expect(await flow.publish()).toBe(true)
    expect(sentKey(3)).not.toBe(sentKey(0))
  })
  it('400 with items shows the same checklist and drops the intent', async () => {
    http.post.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { statusCode: 400, error: 'MALFORMED', items: [item()], bySection: { pack: 1 } } } })
    const { editor, flow } = await setup()
    expect(await flow.publish()).toBe(false)
    expect(flow.checklist.value.map(entry => entry.message)).toEqual(['Falta el peso neto.'])
    expect(flow.sectionCounts.value).toEqual({ pack: 1 })
    expect(flow.canPublish.value).toBe(false)
    expect(editor.lifecycle.pendingIntent.value).toBeNull()
  })
  it('400 without items on Cuidado says the confirmation is missing', async () => {
    current = { ...current, snapshot: state(careDocument()), care: true }
    http.post.mockRejectedValue(failure(400, 'MALFORMED'))
    confirmCare.mockResolvedValue(true)
    const { flow } = await setup()
    expect(await flow.publish()).toBe(false)
    expect(flow.message.value).toBe('Falta confirmar que revisaste la información de cuidado. Vuelve a publicar y confírmalo.')
  })
  it('400 without items on another family is a request error', async () => {
    http.post.mockRejectedValue(failure(400, 'MALFORMED'))
    const { flow } = await setup()
    expect(await flow.publish()).toBe(false)
    expect(flow.message.value).toBe('No pudimos publicar. Recarga la página e inténtalo de nuevo.')
  })
  it('409 CONFLICT reloads the draft and says so', async () => {
    http.post.mockRejectedValue(failure(409, 'CONFLICT'))
    const { flow } = await setup()
    expect(await flow.publish()).toBe(false)
    await flushPromises()
    expect(stateCalls()).toHaveLength(2)
    expect(flow.message.value).toBe('Alguien más cambió el contenido. Cargamos la versión más reciente; revísala y vuelve a publicar.')
  })
  it('409 VOCABULARY_CHANGED reloads the vocabulary and retries once with a new key and the new revision', async () => {
    http.post.mockImplementationOnce(() => { current.revision = R2; current.readiness = ready({ vocabularyRevision: R2 }); return Promise.reject(failure(409, 'VOCABULARY_CHANGED')) })
      .mockResolvedValueOnce(success(published(), 200, R2))
    const { flow } = await setup()
    expect(await flow.publish()).toBe(true)
    expect(http.post).toHaveBeenCalledTimes(2)
    expect(sentHeaders(1)['Editorial-Vocabulary-Revision']).toBe(R2)
    expect(sentKey(1)).not.toBe(sentKey(0))
  })
  it('a second VOCABULARY_CHANGED stops and shows the error', async () => {
    http.post.mockImplementation(() => { current.revision = current.revision === R ? R2 : R; current.readiness = ready({ vocabularyRevision: current.revision }); return Promise.reject(failure(409, 'VOCABULARY_CHANGED')) })
    const { flow } = await setup()
    expect(await flow.publish()).toBe(false)
    expect(http.post).toHaveBeenCalledTimes(2)
    expect(flow.message.value).toBe('El catálogo de datos cambió mientras publicabas. Recarga la página e inténtalo de nuevo.')
  })
})
