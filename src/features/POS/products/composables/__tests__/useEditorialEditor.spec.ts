import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useEditorialEditor } from '../useEditorialEditor'
import { editorialContractApi } from '../../api/editorial-contract.api'
import { document, state, success, vocabularyEnvelope, R, read, update, publish, failure, deferred } from '../../__tests__/editorial-contract-fixtures'
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const scopes: ReturnType<typeof effectScope>[] = []
function setup() {
  const scope = effectScope(); scopes.push(scope)
  const api = shallowRef(editorialContractApi)
  const editor = scope.run(() => useEditorialEditor(() => 'p1', api))!
  return { editor, api, scope }
}
function reads(snapshot = state()) {
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(snapshot)))
}
beforeEach(() => { vi.resetAllMocks(); Object.assign(auth, { isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' }, permissionsLoaded: true, permissionCodes: [read, update] }); reads() })
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('coherent scoped editor orchestration', () => {
  it.each(['global', 'tenant'] as const)('%s admin loads selected tenant and edits valid incomplete raw content', async kind => {
    auth.isSuperAdmin = kind === 'global'
    auth.permissionCodes = kind === 'global' ? [] : ['manage:all']
    const { editor } = setup(); await flushPromises()
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(editor.editable.value).toBe(true)
    editor.replaceDocument({ ...editor.lifecycle.buffer.value!, commercialTitle: 'x'.repeat(201) })
    expect(editor.lifecycle.buffer.value!.commercialTitle).toHaveLength(201)
    expect(await editor.save()).toBe(false)
    expect(http.put).not.toHaveBeenCalled()
  })
  it.each(['global', 'tenant'] as const)('%s privilege loss aborts reads, clears private data, and ignores late ignored-abort failure after regain', async kind => {
    auth.isSuperAdmin = kind === 'global'
    auth.permissionCodes = kind === 'global' ? [] : ['manage:all']
    const { editor } = setup(); await flushPromises()
    editor.lifecycle.buffer.value!.description = 'private'
    const late = deferred<unknown>()
    http.get.mockReturnValueOnce(late.promise)
    const refreshing = editor.refresh('retain')
    const signal = http.get.mock.calls[3]![1].signal as AbortSignal
    if (kind === 'global') auth.isSuperAdmin = false
    else auth.permissionCodes = []
    expect(signal.aborted).toBe(true)
    expect(editor.lifecycle.snapshot.value).toBeNull()
    expect(editor.lifecycle.buffer.value).toBeNull()
    expect(editor.sections.value).toEqual([])
    auth.isSuperAdmin = kind === 'global'
    auth.permissionCodes = kind === 'global' ? [] : ['manage:all']
    await flushPromises()
    late.reject(new Error('private old failure'))
    expect(await refreshing).toBe(false)
    expect(editor.errorMessage.value).toBeNull()
    expect(editor.lifecycle.buffer.value!.description).toBe(document().description)
  })
  it.each((['global', 'tenant'] as const).flatMap(kind => ['selecting-tenant', 'authenticating'].map(phase => [kind, phase] as const)))('%s admin cannot read/write during %s', async (kind, phase) => {
    auth.isSuperAdmin = kind === 'global'
    auth.permissionCodes = kind === 'global' ? [] : ['manage:all']
    auth.authPhase = phase
    const { editor } = setup(); await flushPromises()
    expect(await editor.refresh('discard')).toBe(false)
    expect(await editor.initialize()).toBe(false)
    expect(await editor.save()).toBe(false)
    expect(await editor.publish()).toBe(false)
    expect(await editor.discard()).toBe(false)
    expect(http.get).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
    auth.authPhase = 'authenticated'; await flushPromises()
    expect(editor.editable.value).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('loads vocabulary first, then pinned state/context in parallel, never installs a partial pair', async () => {
    const vocab = deferred<unknown>(); const saved = deferred<unknown>(); const context = deferred<unknown>()
    http.get.mockImplementation((url: string) => url.includes('vocabulary') ? vocab.promise : url.endsWith('/context') ? context.promise : saved.promise)
    const { editor } = setup()
    expect(http.get.mock.calls.map(c => c[0])).toEqual(['/catalog-editorial/vocabulary'])
    vocab.resolve({ ...success(), data: vocabularyEnvelope() }); await flushPromises()
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.get.mock.calls[1]![1].headers).toEqual({ 'Editorial-Vocabulary-Revision': R })
    expect(http.get.mock.calls[2]![1].headers).toBeUndefined()
    saved.resolve(success()); await flushPromises()
    expect(editor.lifecycle.authoritative.value).toBeNull()
    context.resolve({ status: 200, data: { variants: [] } }); await flushPromises()
    expect(editor.lifecycle.authoritative.value).toEqual(state())
    expect(editor.vocabulary.value).toEqual(vocabularyEnvelope().vocabulary)
    expect(editor.editable.value).toBe(true)
  })
  it('saves unnormalized raw title with GET counters and R; no automatic reconciliation', async () => {
    const { editor } = setup(); await flushPromises()
    editor.replaceDocument({ ...editor.lifecycle.buffer.value!, commercialTitle: '  😀 exact  ' })
    http.put.mockResolvedValue(success(state(document(), 99)))
    expect(await editor.save()).toBe(true)
    expect(http.put.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3, document: { ...document(), commercialTitle: '  😀 exact  ' } })
    expect(http.put.mock.calls[0]![2].headers['Editorial-Vocabulary-Revision']).toBe(R)
    expect(editor.lifecycle.authoritative.value!.draft!.revision).toBe(3)
    expect(await editor.save()).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('retain keeps raw IDs/incomplete edits, discard explicitly replaces', async () => {
    const { editor } = setup(); await flushPromises()
    editor.lifecycle.buffer.value!.values.push({ id: 'keep', target: { code: 'n', owner: 'product', variantId: null }, input: { state: 'known', payload: { type: 'number', value: '-' }, evidence: null } })
    const buffer = editor.lifecycle.buffer.value
    reads({ cycle: 2, draft: null, published: null }); await editor.refresh('retain')
    expect(editor.lifecycle.buffer.value).toBe(buffer)
    expect(editor.hasUnsavedChanges.value).toBe(true)
    expect(await editor.save()).toBe(false)
    reads(); await editor.refresh('discard')
    expect(editor.lifecycle.buffer.value!.values).toEqual([])
  })
  it.each(['tenant', 'account', 'grants', 'api', 'dispose'])('aborts stale reads across %s and away/back, including ports ignoring abort', async change => {
    const old = deferred<unknown>()
    http.get.mockReturnValueOnce(old.promise)
    const { editor, api, scope } = setup()
    const oldSignal = http.get.mock.calls[0]![1].signal as AbortSignal
    if (change === 'tenant') { auth.currentTenant.id = 'other'; auth.currentTenant.id = 't1' }
    if (change === 'account') { auth.user.id = 'other'; auth.user.id = 'u1' }
    if (change === 'grants') { auth.permissionCodes = []; auth.permissionCodes = [read, update] }
    if (change === 'api') { const original = api.value; api.value = { ...original }; api.value = original }
    if (change === 'dispose') scope.stop()
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    old.resolve({ ...success(), data: vocabularyEnvelope(undefined, `ev2-sha256-${'b'.repeat(64)}`) }); await flushPromises()
    if (change === 'dispose') { expect(editor.vocabulary.value).toBeNull(); expect(editor.lifecycle.buffer.value).toBeNull() }
    else expect(editor.lifecycle.snapshot.value!.state.vocabularyRevision).toBe(R)
  })
  it('fails closed on R mismatch/invalid success and preserves raw edits without partial installation or retry', async () => {
    const { editor } = setup(); await flushPromises()
    editor.lifecycle.buffer.value!.description = 'LOCAL'
    const previous = editor.lifecycle.snapshot.value
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
      : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state(), 200, `ev2-sha256-${'b'.repeat(64)}`)))
    expect(await editor.refresh('retain')).toBe(false)
    expect(editor.lifecycle.snapshot.value).toBe(previous)
    expect(editor.lifecycle.buffer.value!.description).toBe('LOCAL')
    expect(editor.editable.value).toBe(false)
    expect(editor.errorMessage.value).toContain('No se pudo consultar')
    expect(http.get).toHaveBeenCalledTimes(6)
  })
  it.each(['read-only', 'hydrating', 'selecting-tenant', 'authenticating'])('enforces exact grants and auth hydration: %s', async mode => {
    if (mode === 'read-only') auth.permissionCodes = [read]
    if (mode === 'selecting-tenant' || mode === 'authenticating') auth.authPhase = mode
    if (mode === 'hydrating') auth.permissionsLoaded = false
    const { editor } = setup(); await flushPromises()
    expect(await editor.save()).toBe(false); expect(await editor.initialize()).toBe(false)
    expect(editor.editable.value).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(mode === 'read-only' ? 3 : 0)
  })
  it('publishes with read+publish, retries the original intent even if fresh metadata is unavailable', async () => {
    auth.permissionCodes = [read, publish]
    const { editor } = setup(); await flushPromises()
    expect(editor.canPublish.value).toBe(true)
    expect(editor.canSave.value).toBe(false)
    http.post.mockRejectedValueOnce(new Error('network'))
    expect(await editor.publish(null)).toBe(false)
    http.get.mockRejectedValue(failure(500, 'INTERNAL_ERROR'))
    expect(await editor.refresh('retain')).toBe(false)
    http.post.mockResolvedValue(success())
    expect(await editor.retransmit()).toBe(true)
    expect(http.post.mock.calls[1]!.slice(0, 2)).toEqual(http.post.mock.calls[0]!.slice(0, 2))
    expect(http.post.mock.calls[1]![2].headers).toEqual(http.post.mock.calls[0]![2].headers)
  })
})
