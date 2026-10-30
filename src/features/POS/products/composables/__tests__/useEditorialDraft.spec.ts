import { effectScope, ref, shallowRef, toRaw } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorialDraft, type EditorialDraftContext } from '../useEditorialDraft'
import { editorialContractApi } from '../../api/editorial-contract.api'
import { document, state, envelope, vocabularyEnvelope, R, read, update, publish, success, failure, deferred } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const scopes: ReturnType<typeof effectScope>[] = []
function setup(snapshot = state()) {
  const context = ref<EditorialDraftContext>({ authenticated: true, userId: 'u', tenantId: 't', productId: 'p/1', permissionsLoaded: true, permissionCodes: [read, update, publish] })
  const api = shallowRef(editorialContractApi)
  const scope = effectScope(); scopes.push(scope)
  const editor = scope.run(() => useEditorialDraft(context, api))!
  const install = (next = snapshot, choice: 'retain' | 'discard' = 'retain', revision = R) => editor.reconcileSnapshot(editor.beginSnapshotRead()!, {
    vocabulary: vocabularyEnvelope(undefined, revision), state: envelope(next, revision), context: { variants: [] },
  }, choice)
  expect(install(snapshot, 'discard')).toBe(true)
  return { editor, context, api, scope, install }
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('target raw owner and frozen intents', () => {
  it('freezes the exact body/key/R while edits continue; receipt is not GET authority', async () => {
    const { editor, install } = setup()
    const response = deferred<ReturnType<typeof success>>()
    http.put.mockReturnValue(response.promise)
    const saving = editor.save()
    const intent = editor.pendingIntent.value!
    expect(Object.isFrozen(intent.body)).toBe(true)
    editor.buffer.value!.commercialTitle = 'in flight'
    expect(await editor.save()).toBe(false)
    expect(editor.beginSnapshotRead()).toBeNull()
    response.resolve(success(state(document(), 99)))
    expect(await saving).toBe(true)
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.buffer.value!.commercialTitle).toBe('in flight')
    expect(editor.receipt.value).toEqual(envelope(state(document(), 99)))
    expect(await editor.save()).toBe(false)
    expect(install()).toBe(true)
    http.put.mockResolvedValue(success())
    expect(await editor.save()).toBe(true)
    expect(editor.pendingIntent.value!.key).not.toBe(intent.key)
    expect(http.put.mock.calls[0]![2].headers).toEqual({ 'Idempotency-Key': intent.key, 'Editorial-Vocabulary-Revision': R })
    expect(http.put.mock.calls[0]![1].document).toEqual(document())
  })
  it('retransmits ambiguous writes without validating changed raw input or metadata', async () => {
    const { editor, install } = setup()
    http.put.mockRejectedValueOnce(new Error('PRIVATE'))
    expect(await editor.save()).toBe(false)
    const intent = editor.pendingIntent.value
    editor.buffer.value!.commercialTitle = 'x'.repeat(201)
    http.put.mockResolvedValue(success())
    expect(await editor.retransmit()).toBe(true)
    expect(http.put.mock.calls[1]!.slice(0, 2)).toEqual(http.put.mock.calls[0]!.slice(0, 2))
    expect(http.put.mock.calls[1]![2].headers).toEqual(http.put.mock.calls[0]![2].headers)
    expect(http.put.mock.calls[1]![2].signal.aborted).toBe(false)
    expect(http.put.mock.calls[1]![1]).toBe(http.put.mock.calls[0]![1])
    expect(editor.pendingIntent.value).toBe(intent)
    expect(install()).toBe(true)
    expect(await editor.save()).toBe(false)
  })
  it.each(['CONFLICT', 'VOCABULARY_CHANGED'])('%s retains edits and forbids retry/new key until explicit reconciliation', async code => {
    const { editor, install } = setup()
    http.put.mockRejectedValue(failure(409, code))
    expect(await editor.save()).toBe(false)
    editor.buffer.value!.description = 'keep'
    const intent = editor.pendingIntent.value
    expect(editor.outcome.value).toBe('conflict')
    expect(await editor.retransmit()).toBe(false)
    expect(await editor.save()).toBe(false)
    expect(editor.pendingIntent.value).toBe(intent)
    expect(install()).toBe(true)
    expect(editor.buffer.value!.description).toBe('keep')
    expect(http.put).toHaveBeenCalledTimes(1)
  })
  it('retain preserves incomplete raw content and wrapper IDs even without latest Draft; discard replaces explicitly', async () => {
    const { editor, install } = setup()
    editor.buffer.value!.values.push({ id: 'raw', target: { code: 'n', owner: 'product', variantId: null }, input: { state: 'known', payload: { type: 'number', value: '-' }, evidence: null } })
    const buffer = editor.buffer.value
    expect(editor.hasUnsavedChanges.value).toBe(true)
    expect(install({ cycle: 2, draft: null, published: null })).toBe(true)
    expect(editor.buffer.value).toBe(buffer)
    expect(editor.buffer.value!.values[0]!.id).toBe('raw')
    expect(await editor.save()).toBe(false)
    expect(install(state(), 'discard')).toBe(true)
    expect(editor.buffer.value!.values).toEqual([])
    expect(editor.hasUnsavedChanges.value).toBe(false)
  })
  it('compares raw omitted wrappers, not equal encoded output, and does not allocate on derived reads', () => {
    const { editor } = setup()
    const id = vi.spyOn(crypto, 'randomUUID')
    editor.buffer.value!.values.push({ id: 'omitted', target: { code: 'x', owner: 'product', variantId: null }, input: { state: 'omitted' } })
    expect(editor.hasUnsavedChanges.value).toBe(true)
    void editor.canPublishDraft.value; void editor.publishIssues.value; void editor.hasUnsavedChanges.value
    expect(id).not.toHaveBeenCalled(); id.mockRestore()
  })
  it('initializes without fabricating a buffer and keeps even oversized copy receipts historical', async () => {
    const { editor } = setup({ cycle: null, draft: null, published: null })
    http.post.mockResolvedValue(success(state({ ...document(), description: 'x'.repeat(20001) }), 201))
    expect(await editor.initialize()).toBe(true)
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: null })
    expect(editor.buffer.value).toBeNull()
    expect(editor.authoritative.value!.draft).toBeNull()
    expect(await editor.initialize()).toBe(false)
  })
  it.each(['user', 'tenant', 'product', 'grants', 'session', 'hydration', 'api', 'dispose'])('clears all private state and rejects stale completion across %s away and back', async change => {
    const { editor, context, api, scope, install } = setup()
    const original = structuredClone(toRaw(context.value))
    const originalApi = api.value
    const response = deferred<ReturnType<typeof success>>()
    http.put.mockReturnValue(response.promise)
    const saving = editor.save()
    const signal = http.put.mock.calls[0]![2].signal as AbortSignal
    if (change === 'user') context.value.userId = 'other'
    if (change === 'tenant') context.value.tenantId = 'other'
    if (change === 'product') context.value.productId = 'other'
    if (change === 'grants') context.value.permissionCodes = [read]
    if (change === 'session') context.value.authenticated = false
    if (change === 'hydration') context.value.permissionsLoaded = false
    if (change === 'api') api.value = { ...editorialContractApi }
    if (change === 'dispose') scope.stop()
    expect(signal.aborted).toBe(true)
    expect(editor.buffer.value).toBeNull()
    expect(editor.authoritative.value).toBeNull()
    expect(editor.snapshot.value).toBeNull()
    expect(editor.receipt.value).toBeNull()
    expect(editor.pendingIntent.value).toBeNull()
    context.value = original; api.value = originalApi
    if (change !== 'dispose') expect(install(state(document(), 10), 'discard')).toBe(true)
    response.resolve(success(state(document(), 99)))
    expect(await saving).toBe(false)
    expect(editor.receipt.value).toBeNull()
    expect(editor.isPending.value).toBe(false)
  })
  it.each([[400, 'MALFORMED', 'rejected'], [401, 'UNAUTHORIZED', 'rejected'], [403, 'FORBIDDEN', 'rejected'], [404, 'NOT_FOUND', 'rejected'], [500, 'INTERNAL_ERROR', 'ambiguous'], [413, 'X', 'ambiguous']])('preserves raw state after %s and never leaks error content', async (status, code, outcome) => {
    const { editor } = setup()
    http.put.mockRejectedValue(failure(status as number, code as string))
    expect(await editor.save()).toBe(false)
    expect(editor.outcome.value).toBe(outcome)
    expect(editor.buffer.value!.commercialTitle).toBe(' exact ')
    expect(editor.receipt.value).toBeNull()
    expect(http.put).toHaveBeenCalledTimes(1)
  })
  it('invalidates old/foreign tickets and rejects incoherent or malformed snapshots atomically', () => {
    const { editor } = setup()
    const old = editor.beginSnapshotRead()!
    const ticket = editor.beginSnapshotRead()!
    const fresh = { vocabulary: vocabularyEnvelope(), state: envelope(), context: { variants: [] } }
    expect(editor.reconcileSnapshot(old, fresh, 'discard')).toBe(false)
    expect(editor.reconcileSnapshot(ticket, { ...fresh, state: envelope(state(), `ev2-sha256-${'b'.repeat(64)}`) }, 'discard')).toBe(false)
    expect(editor.reconcileSnapshot(ticket, { ...fresh, state: { ...envelope(), state: { ...state(), cycle: 0 } } }, 'discard')).toBe(false)
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.reconcileSnapshot(ticket, fresh, 'retain')).toBe(true)
    expect(editor.reconcileSnapshot(ticket, fresh, 'discard')).toBe(false)
  })
})
