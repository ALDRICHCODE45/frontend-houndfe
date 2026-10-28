import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useEditorialEditor } from '../useEditorialEditor'
import { EditorialApiError } from '../../api/product-editorial.api'

const { http } = vi.hoisted(() => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' },
  currentTenant: { id: 't1' }, permissionsLoaded: true,
  permissionCodes: ['read:ProductEditorialDraft', 'update:ProductEditorialDraft'] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const empty = { commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [] }
const snapshot = (document: unknown = empty) => ({ cycle: 1, draft: { revision: 2, basePublishedRevision: null, document }, published: null })
const vocabulary = { families: [{ id: 'f', code: 'general', label: 'General', bindings: [
  { definitionId: 'd', definitionCode: 'color', owner: 'product', sortOrder: 0 },
] }], definitions: [{ id: 'd', code: 'color', label: 'Color', type: 'single', options: [
  { code: 'old', label: 'Anterior', archived: true, sortOrder: 0 },
  { code: 'new', label: 'Actual', archived: false, sortOrder: 1 },
] }] }
let scope: ReturnType<typeof effectScope>
function setup() { scope = effectScope(); return scope.run(() => useEditorialEditor(() => 'p1'))! }
function reads(state = snapshot(), vocab: unknown = vocabulary) {
  http.get.mockImplementation((url: string) => Promise.resolve({ data:
    url.endsWith('/context') ? { variants: [] } : url.includes('vocabulary') ? vocab : state }))
}
beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' },
    currentTenant: { id: 't1' }, permissionsLoaded: true,
    permissionCodes: ['read:ProductEditorialDraft', 'update:ProductEditorialDraft'] })
  reads()
})
afterEach(() => scope?.stop())

describe('editorial editor public orchestration', () => {
  it('exposes publish to read+publish without update and retransmits the same intent', async () => {
    auth.permissionCodes = ['read:ProductEditorialDraft', 'publish:ProductEditorialDraft']
    reads(snapshot({ ...empty, commercialTitle: ' a ' }))
    const editor = setup(); await flushPromises()
    expect(editor.canPublish.value).toBe(true)
    expect(editor.canSave.value).toBe(false)
    http.post.mockRejectedValueOnce(new Error('network'))
    expect(await editor.publish()).toBe(false)
    http.post.mockResolvedValue({ data: { cycle: 1, draft: null, published: null } })
    expect(await editor.retransmit()).toBe(true)
    expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0])
  })
  it('exposes discard even with unreadable history and failed metadata', async () => {
    reads(snapshot({ unreadable: true }), null)
    const editor = setup(); await flushPromises()
    expect(editor.canDiscard.value).toBe(true)
    expect(editor.canPublish.value).toBe(false)
    http.post.mockResolvedValue({ data: { cycle: 1, draft: null, published: null } })
    expect(await editor.discard()).toBe(true)
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: 1, expectedRevision: 2 })
  })
  it('prevalidates against Published rather than the draft and blocks unsaved changes', async () => {
    auth.permissionCodes.push('publish:ProductEditorialDraft')
    const assignment = { code: 'color', owner: 'product' as const, variantId: null, type: 'single' as const, value: 'old' }
    const saved = { ...empty, commercialTitle: 'Ready', familyCode: 'general', values: [assignment] }
    reads(snapshot(saved))
    const editor = setup(); await flushPromises()
    expect(await editor.publish()).toBe(false)
    expect(editor.publishIssues.value).toContainEqual({ code: 'archived', valueIndex: 0 })
    const published = { revision: 1, document: saved }
    http.get.mockImplementation((url: string) => Promise.resolve({ data:
      url.endsWith('/context') ? { variants: [] } : url.includes('vocabulary') ? vocabulary : { ...snapshot(saved), published } }))
    await editor.refresh('discard')
    expect(editor.canPublish.value).toBe(true)
    editor.replaceDocument({ ...saved, description: 'local' })
    expect(await editor.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('loads exactly the three editorial GETs and saves the unnormalized buffer with the persisted revision', async () => {
    const editor = setup(); await flushPromises()
    expect(http.get.mock.calls.map(call => call[0]).sort()).toEqual([
      '/catalog-editorial/vocabulary', '/products/p1/editorial', '/products/p1/editorial/context',
    ])
    editor.replaceDocument({ ...empty, commercialTitle: '  título 😀  ' })
    http.put.mockResolvedValue({ data: snapshot() })
    expect(await editor.save()).toBe(true)
    expect(http.put).toHaveBeenCalledWith('/products/p1/editorial/draft', {
      expectedCycle: 1, expectedRevision: 2, document: { ...empty, commercialTitle: '  título 😀  ' },
    }, { headers: { 'Idempotency-Key': expect.any(String) } })
    expect(editor.lifecycle.authoritative.value?.draft?.revision).toBe(2)
    expect(await editor.save()).toBe(false)
    expect(http.put).toHaveBeenCalledTimes(1)
  })
  it.each(['read-only', 'hydrating', 'manage'])('never writes without the exact authenticated writer context: %s', async mode => {
    if (mode === 'read-only') auth.permissionCodes = ['read:ProductEditorialDraft']
    if (mode === 'manage') auth.permissionCodes = ['manage:all']
    if (mode === 'hydrating') auth.authPhase = 'hydrating'
    const editor = setup(); await flushPromises()
    expect(editor.editable.value).toBe(false)
    await editor.initialize(); await editor.save(); await editor.retransmit()
    expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled()
    expect(http.get).toHaveBeenCalledTimes(mode === 'read-only' ? 3 : 0)
  })
  it('disables metadata failure rather than treating malformed authority as empty', async () => {
    reads(snapshot(), { families: [] })
    const editor = setup(); await flushPromises()
    expect(editor.editable.value).toBe(false)
    expect(editor.metadataMessage.value).toContain('metadatos')
    expect(await editor.save()).toBe(false)
    expect(http.put).not.toHaveBeenCalled()
  })
  it('preflights assignments using persisted GET, including archived conservation after local remove/re-add', async () => {
    const assignment = { code: 'color', owner: 'product' as const, variantId: null, type: 'single' as const, value: 'old' }
    reads(snapshot({ ...empty, familyCode: 'general', values: [assignment] }))
    const editor = setup(); await flushPromises()
    editor.replaceDocument({ ...empty, familyCode: 'general' })
    editor.replaceDocument({ ...empty, familyCode: 'general', values: [assignment] })
    http.put.mockResolvedValue({ data: snapshot() })
    expect(await editor.save()).toBe(true)
    await editor.refresh('discard')
    editor.replaceDocument({ ...empty, familyCode: 'general', values: [{ ...assignment, value: 'missing' }] })
    expect(await editor.save()).toBe(false)
    expect(editor.issues.value[0]?.code).toBe('option')
    expect(http.put).toHaveBeenCalledTimes(1)
  })
  it('prohibits archived introduction after persisted removal and preserves edits on a safe 400', async () => {
    reads(snapshot({ ...empty, familyCode: 'general' }))
    const editor = setup(); await flushPromises()
    const assignment = { code: 'color', owner: 'product' as const, variantId: null, type: 'single' as const, value: 'old' }
    editor.replaceDocument({ ...empty, familyCode: 'general', values: [assignment] })
    expect(await editor.save()).toBe(false)
    expect(editor.issues.value).toEqual([{ code: 'archived', valueIndex: 0 }])
    expect(http.put).not.toHaveBeenCalled()
    editor.replaceDocument({ ...empty, familyCode: 'general', values: [{ ...assignment, value: 'new' }] })
    http.put.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { statusCode: 400, error: 'MALFORMED', message: 'PRIVATE' } } })
    expect(await editor.save()).toBe(false)
    expect(editor.lifecycle.buffer.value?.values[0]?.value).toBe('new')
    expect(editor.lifecycle.error.value).toEqual({ status: 400, code: 'MALFORMED' })
    expect(await editor.save()).toBe(false)
    expect(http.put).toHaveBeenCalledTimes(1)
  })
  it('retains or explicitly discards edits during fresh GET reconciliation', async () => {
    const editor = setup(); await flushPromises()
    editor.replaceDocument({ ...empty, commercialTitle: 'LOCAL' })
    reads(snapshot({ ...empty, commercialTitle: 'REMOTE' }))
    await editor.refresh('retain')
    expect(editor.lifecycle.buffer.value?.commercialTitle).toBe('LOCAL')
    await editor.refresh('discard')
    expect(editor.lifecycle.buffer.value?.commercialTitle).toBe('REMOTE')
    expect(http.put).not.toHaveBeenCalled()
  })
  it('initializes explicitly with null cycle and requires GET after historical acknowledgement', async () => {
    reads({ cycle: null, draft: null, published: null } as unknown as ReturnType<typeof snapshot>)
    const editor = setup(); await flushPromises()
    expect(http.post).not.toHaveBeenCalled()
    http.post.mockResolvedValue({ data: snapshot() })
    expect(await editor.initialize()).toBe(true)
    expect(http.post).toHaveBeenCalledWith('/products/p1/editorial/draft/initialize', { expectedCycle: null },
      { headers: { 'Idempotency-Key': expect.any(String) } })
    expect(editor.lifecycle.authoritative.value?.draft).toBeNull()
    expect(editor.lifecycle.buffer.value).toBeNull()
    expect(await editor.initialize()).toBe(false)
  })
  it('ignores late reads and late write failure after identity revocation', async () => {
    let resolve!: (value: unknown) => void
    http.get.mockReturnValue(new Promise(done => { resolve = done }))
    const editor = setup()
    auth.permissionCodes = []; await nextTick()
    resolve({ data: snapshot({ ...empty, commercialTitle: 'SECRET' }) }); await flushPromises()
    expect(editor.lifecycle.buffer.value).toBeNull()
    expect(editor.vocabulary.value).toBeNull()
    reads(); auth.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']; await flushPromises()
    let reject!: (value: unknown) => void
    http.put.mockReturnValue(new Promise((_done, fail) => { reject = fail }))
    const saving = editor.save()
    auth.currentTenant = { id: 't2' }; await nextTick()
    reject(new EditorialApiError(400, null)); await saving; await flushPromises()
    expect(editor.lifecycle.error.value).toBeNull()
    expect(editor.lifecycle.pendingIntent.value).toBeNull()
  })
  it('makes ambiguous retransmission identical even after editing; conflict only offers GET', async () => {
    const editor = setup(); await flushPromises()
    http.put.mockRejectedValueOnce(new Error('private failure'))
    await editor.save()
    editor.replaceDocument({ ...empty, commercialTitle: 'AFTER' })
    http.put.mockResolvedValueOnce({ data: snapshot() })
    await editor.retransmit()
    expect(http.put.mock.calls[1]).toEqual(http.put.mock.calls[0])
    await editor.refresh('retain')
    http.put.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { statusCode: 409, error: 'CONFLICT' } } })
    await editor.save()
    expect(editor.lifecycle.outcome.value).toBe('conflict')
    expect(await editor.retransmit()).toBe(false)
    expect(editor.lifecycle.buffer.value?.commercialTitle).toBe('AFTER')
    await editor.refresh('retain')
    expect(http.put).toHaveBeenCalledTimes(3)
  })
})
