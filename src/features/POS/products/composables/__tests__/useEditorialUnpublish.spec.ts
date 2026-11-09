/** S4: «Despublicar» (handoff 07 §6): keys, the Published target, keeping the content, and every refusal. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useEditorialEditor } from '../useEditorialEditor'
import { useEditorialUnpublish } from '../useEditorialUnpublish'
import type { EditorialContractState } from '../../interfaces/editorial-contract-response.types'
import { careDocument, careVocabulary, document, failure, R, read, publish, success, update, vocabularyEnvelope } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' },
  permissionsLoaded: true, permissionCodes: [read, update, publish] as string[] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const R2 = `ev2-sha256-${'b'.repeat(64)}`
const UNPUBLISH = '/products/p1/editorial/published/unpublish'
const INITIALIZE = '/products/p1/editorial/draft/initialize'
// A published product with a kept draft (cycle 2, draft rev 3, Published rev 2), and the same without a draft.
const withDraft = (cycle = 2): EditorialContractState => ({ cycle, draft: { revision: 3, basePublishedRevision: 2, document: document() },
  published: { revision: 2, document: document() } })
const publishedOnly = (cycle = 2): EditorialContractState => ({ cycle, draft: null, published: { revision: 2, document: document() } })
const unpublished = (cycle = 2): EditorialContractState => ({ cycle, draft: { revision: 3, basePublishedRevision: 2, document: document() }, published: null })

let current: { snapshot: EditorialContractState; revision: string; care: boolean }
function serve() {
  http.get.mockImplementation((url: string) => {
    if (url.includes('vocabulary')) return Promise.resolve({ ...success(undefined, 200, current.revision), data: vocabularyEnvelope(current.care ? careVocabulary() : undefined, current.revision) })
    if (url.endsWith('/context')) return Promise.resolve({ status: 200, data: { variants: [] } })
    return Promise.resolve(success(current.snapshot, 200, current.revision))
  })
}
const stateCalls = () => http.get.mock.calls.filter(([url]) => String(url).endsWith('/editorial'))
const unpublishCalls = () => http.post.mock.calls.filter(([url]) => url === UNPUBLISH)
const sent = (call: number) => unpublishCalls()[call]!
const sentKey = (call: number) => sent(call)[2].headers['Idempotency-Key'] as string
const networkFailure = () => Object.assign(new Error('offline'), { isAxiosError: true })
const scopes: ReturnType<typeof effectScope>[] = []
const confirm = vi.fn<() => Promise<boolean>>()
const notify = vi.fn<(title: string) => void>()
async function setup() {
  const scope = effectScope(); scopes.push(scope)
  const result = scope.run(() => {
    const editor = useEditorialEditor('p1')
    return { editor, flow: useEditorialUnpublish(editor, { productId: () => 'p1', confirm, notify }) }
  })!
  await flushPromises()
  return result
}
// The backend answer of an unpublish: what it leaves behind is installed by the next read.
function unpublishes(after: EditorialContractState = unpublished()) {
  return () => { current.snapshot = after; return Promise.resolve(success(after, 200, current.revision)) }
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { isSuperAdmin: false, permissionCodes: [read, update, publish] })
  current = { snapshot: withDraft(), revision: R, care: false }
  confirm.mockResolvedValue(true)
  serve()
})
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('visibility', () => {
  it('shows «Despublicar» to a publisher when something is published', async () => {
    const { flow } = await setup()
    expect(flow.visible.value).toBe(true)
    expect(flow.canUnpublish.value).toBe(true)
  })
  it('read + publish is enough when there is a draft to keep', async () => {
    auth.permissionCodes = [read, publish]
    const { flow } = await setup()
    expect(flow.visible.value).toBe(true)
  })
  it('read + update alone never offers it', async () => {
    auth.permissionCodes = [read, update]
    const { flow } = await setup()
    expect(flow.visible.value).toBe(false)
    expect(await flow.unpublish()).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })
  it('nothing published, nothing to unpublish', async () => {
    current.snapshot = unpublished()
    const { flow } = await setup()
    expect(flow.visible.value).toBe(false)
  })
  it('without a draft and without the edit grant it is hidden: the content could not be kept (L2)', async () => {
    auth.permissionCodes = [read, publish]
    current.snapshot = publishedOnly()
    const { flow } = await setup()
    expect(flow.visible.value).toBe(false)
  })
})

describe('unpublish', () => {
  it('asks first; a «no» sends nothing', async () => {
    confirm.mockResolvedValueOnce(false)
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(http.post).not.toHaveBeenCalled()
    expect(flow.message.value).toBeNull()
  })
  it('sends the key, one vocabulary revision and the Published target, then reads again and says «Despublicado.»', async () => {
    http.post.mockImplementation(unpublishes())
    const { editor, flow } = await setup()
    expect(await flow.unpublish()).toBe(true)
    expect(unpublishCalls()).toHaveLength(1)
    expect(sent(0)[1]).toEqual({ expectedCycle: 2, expectedRevision: 2 })
    expect(sent(0)[2].headers).toEqual({ 'Idempotency-Key': expect.any(String), 'Editorial-Vocabulary-Revision': R })
    expect(http.post.mock.calls.some(([url]) => url === INITIALIZE)).toBe(false)
    expect(notify).toHaveBeenCalledWith('Despublicado.')
    expect(stateCalls()).toHaveLength(2)
    expect(editor.lifecycle.authoritative.value?.published).toBeNull()
    expect(editor.lifecycle.authoritative.value?.draft?.revision).toBe(3)
    expect(editor.lifecycle.pendingIntent.value).toBeNull()
    expect(flow.visible.value).toBe(false)
    expect(flow.message.value).toBeNull()
  })
  it('Cuidado: never a care header', async () => {
    current = { snapshot: { ...withDraft(), draft: { revision: 3, basePublishedRevision: 2, document: careDocument() } }, revision: R, care: true }
    http.post.mockImplementation(unpublishes())
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(true)
    expect(sent(0)[2].headers).toEqual({ 'Idempotency-Key': expect.any(String), 'Editorial-Vocabulary-Revision': R })
  })
  it('keeps unsaved edits through the read that follows', async () => {
    http.post.mockImplementation(unpublishes())
    const { editor, flow } = await setup()
    editor.lifecycle.buffer.value = { ...editor.lifecycle.buffer.value!, commercialTitle: 'Sin guardar' }
    expect(await flow.unpublish()).toBe(true)
    expect(editor.lifecycle.buffer.value?.commercialTitle).toBe('Sin guardar')
  })
  it('without a draft: initializes first (Published becomes the draft), reads, then unpublishes the new cycle', async () => {
    current.snapshot = publishedOnly(2)
    http.post.mockImplementation((url: string) => {
      if (url === INITIALIZE) { current.snapshot = withDraft(3); return Promise.resolve(success(current.snapshot, 201)) }
      return unpublishes(unpublished(3))()
    })
    const { editor, flow } = await setup()
    expect(await flow.unpublish()).toBe(true)
    expect(http.post.mock.calls.map(([url]) => url)).toEqual([INITIALIZE, UNPUBLISH])
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: 2 })
    expect(sent(0)[1]).toEqual({ expectedCycle: 3, expectedRevision: 2 })
    expect(editor.lifecycle.authoritative.value).toMatchObject({ published: null, draft: { revision: 3 } })
    expect(notify).toHaveBeenCalledWith('Despublicado.')
  })
  it('without a draft: a refused initialize unpublishes nothing and says so', async () => {
    current.snapshot = publishedOnly()
    http.post.mockRejectedValue(failure(400, 'MALFORMED'))
    const { editor, flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(unpublishCalls()).toHaveLength(0)
    expect(flow.message.value).toBe('No pudimos guardar el contenido como borrador, así que no se despublicó. Inténtalo de nuevo.')
    expect(editor.lifecycle.pendingIntent.value).toBeNull()
    expect(editor.lifecycle.authoritative.value?.published?.revision).toBe(2)
  })
})

describe('refusals', () => {
  it('an ambiguous failure retries with the same key, body and headers; a new attempt gets a new key', async () => {
    http.post.mockRejectedValueOnce(networkFailure()).mockRejectedValueOnce(networkFailure())
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(flow.retryable.value).toBe(true)
    expect(flow.message.value).toBe('No pudimos confirmar si se despublicó. Reintenta: si ya se despublicó, no pasa nada.')
    expect(await flow.retry()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(sent(1)[1]).toBe(sent(0)[1])
    expect(sent(1)[2].headers).toEqual(sent(0)[2].headers)
    http.post.mockImplementationOnce(unpublishes())
    expect(await flow.retry()).toBe(true)
    expect(sentKey(2)).toBe(sentKey(0))
    expect(flow.retryable.value).toBe(false)
    // Republished elsewhere: a separate attempt is a new key.
    current.snapshot = withDraft(4)
    await flow.reload()
    http.post.mockImplementationOnce(unpublishes(unpublished(4)))
    expect(await flow.unpublish()).toBe(true)
    expect(sentKey(3)).not.toBe(sentKey(0))
    expect(sent(3)[1]).toEqual({ expectedCycle: 4, expectedRevision: 2 })
  })
  it('409 CONFLICT reloads and, still published, retries once with a new key and the current target', async () => {
    http.post.mockImplementationOnce(() => { current.snapshot = withDraft(5); return Promise.reject(failure(409, 'CONFLICT')) })
      .mockImplementationOnce(unpublishes(unpublished(5)))
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(true)
    expect(unpublishCalls()).toHaveLength(2)
    expect(sent(1)[1]).toEqual({ expectedCycle: 5, expectedRevision: 2 })
    expect(sentKey(1)).not.toBe(sentKey(0))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Despublicado.')
  })
  it('409 CONFLICT when someone else already unpublished: reloads and stops, nothing left to do', async () => {
    http.post.mockImplementationOnce(() => { current.snapshot = unpublished(); return Promise.reject(failure(409, 'CONFLICT')) })
    const { editor, flow } = await setup()
    expect(await flow.unpublish()).toBe(true)
    expect(unpublishCalls()).toHaveLength(1)
    expect(editor.lifecycle.authoritative.value?.published).toBeNull()
    expect(notify).toHaveBeenCalledWith('Ya estaba despublicado.')
    expect(flow.visible.value).toBe(false)
  })
  it('a second 409 CONFLICT stops and says so', async () => {
    http.post.mockImplementation(() => { current.snapshot = withDraft((current.snapshot.cycle ?? 0) + 1); return Promise.reject(failure(409, 'CONFLICT')) })
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(unpublishCalls()).toHaveLength(2)
    expect(flow.message.value).toBe('Alguien más cambió el contenido. Cargamos la versión más reciente; revísala y vuelve a despublicar.')
  })
  it('409 VOCABULARY_CHANGED reloads the vocabulary and retries once with a new key and the new revision', async () => {
    http.post.mockImplementationOnce(() => { current.revision = R2; return Promise.reject(failure(409, 'VOCABULARY_CHANGED')) })
      .mockImplementationOnce(unpublishes())
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(true)
    expect(unpublishCalls()).toHaveLength(2)
    expect(sent(1)[2].headers['Editorial-Vocabulary-Revision']).toBe(R2)
    expect(sentKey(1)).not.toBe(sentKey(0))
  })
  it('a second VOCABULARY_CHANGED stops and shows the error', async () => {
    http.post.mockImplementation(() => { current.revision = current.revision === R ? R2 : R; return Promise.reject(failure(409, 'VOCABULARY_CHANGED')) })
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(unpublishCalls()).toHaveLength(2)
    expect(flow.message.value).toBe('El catálogo de datos cambió mientras despublicabas. Recarga la página e inténtalo de nuevo.')
  })
  it('a 403 hides «Despublicar» and says why', async () => {
    http.post.mockRejectedValue(failure(403, 'FORBIDDEN'))
    const { editor, flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(flow.visible.value).toBe(false)
    expect(flow.message.value).toBe('No tienes permiso para despublicar este contenido.')
    expect(editor.lifecycle.pendingIntent.value).toBeNull()
  })
  it('a 400 is a request error, not retried', async () => {
    http.post.mockRejectedValue(failure(400, 'MALFORMED'))
    const { flow } = await setup()
    expect(await flow.unpublish()).toBe(false)
    expect(unpublishCalls()).toHaveLength(1)
    expect(flow.retryable.value).toBe(false)
    expect(flow.message.value).toBe('No pudimos despublicar. Recarga la página e inténtalo de nuevo.')
  })
})
