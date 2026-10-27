import { effectScope, ref, toRaw } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorialDraft, type EditorialDraftContext } from '@/features/POS/products/composables/useEditorialDraft'
import type { EditorialDocument, EditorialState, EditorialWriteResponse } from '../../interfaces/product-editorial.types'

const http = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const doc = (): EditorialDocument => ({
  commercialTitle: ' exact ', description: null, mediaRefs: [' private '], familyCode: null, values: [],
})
const state = (revision = 3): EditorialState => ({
  cycle: 2, draft: { revision, basePublishedRevision: null, document: doc() }, published: null,
})
const contextValue = (): EditorialDraftContext => ({
  authenticated: true, userId: 'user', tenantId: 'tenant', productId: 'product /1',
  permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft', 'update:ProductEditorialDraft'],
})
function setup(initial: EditorialState = state()) {
  const context = ref(contextValue())
  const scope = effectScope()
  const editor = scope.run(() => useEditorialDraft(context))!
  const ticket = editor.beginSnapshotRead()!
  expect(editor.reconcileSnapshot(ticket, initial, 'discard')).toBe(true)
  return { editor, context, scope }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function reconcile(editor: ReturnType<typeof useEditorialDraft>, fresh = state(), choice: 'retain' | 'discard' = 'retain') {
  return editor.reconcileSnapshot(editor.beginSnapshotRead()!, fresh, choice)
}
function axiosFailure(status: number, error?: string) {
  return { isAxiosError: true, response: { status, data: { statusCode: status, error, message: 'PRIVATE RAW' } } }
}
beforeEach(() => vi.resetAllMocks())

describe('editorial explicit intent lifecycle', () => {
  it('stops all ingestion and actions on disposal, including a late successful write', async () => {
    const { editor, scope } = setup()
    expect(editor.canRead.value).toBe(true)
    expect(editor.canWrite.value).toBe(true)
    const response = deferred<{ data: EditorialWriteResponse }>()
    http.put.mockReturnValue(response.promise)
    const saving = editor.save()
    scope.stop()
    expect(editor.canRead.value).toBe(false)
    expect(editor.canWrite.value).toBe(false)
    expect(editor.beginSnapshotRead()).toBeNull()
    expect(await editor.save()).toBe(false)
    response.resolve({ data: state(4) })
    expect(await saving).toBe(false)
    expect(editor.receipt.value).toBeNull()
  })

  it('initializes truly empty state without fabricating a document and retries the exact initialize intent explicitly', async () => {
    const { editor } = setup({ cycle: null, draft: null, published: null })
    http.post.mockRejectedValueOnce(new Error('network'))
    expect(await editor.initialize()).toBe(false)
    const intent = editor.pendingIntent.value
    expect(editor.buffer.value).toBeNull()
    expect(await editor.initialize()).toBe(false)
    http.post.mockResolvedValue({ data: { cycle: 1, draft: { revision: 1, basePublishedRevision: null,
      document: { commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [] } }, published: null } })
    expect(await editor.retransmit()).toBe(true)
    expect(editor.pendingIntent.value).toBe(intent)
    expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0])
    expect(http.post.mock.calls[1]![1]).toBe(http.post.mock.calls[0]![1])
    expect(editor.authoritative.value).toEqual({ cycle: null, draft: null, published: null })
    expect(editor.buffer.value).toBeNull()
    expect(http.put).not.toHaveBeenCalled()
  })

  it.each(['title', 'description', 'media', 'values'] as const)('invalid %s save creates no key and leaves the live GET ticket, buffer and baseline untouched', async (field) => {
    const { editor } = setup()
    if (field === 'title') editor.buffer.value!.commercialTitle = '😀'.repeat(201)
    if (field === 'description') editor.buffer.value!.description = '😀'.repeat(20001)
    if (field === 'media') editor.buffer.value!.mediaRefs = Array.from({ length: 21 }, (_, i) => `m${i}`)
    if (field === 'values') {
      editor.buffer.value!.familyCode = 'f'
      editor.buffer.value!.values = Array.from({ length: 201 }, (_, i) => ({
        code: `c${i}`, owner: 'product', variantId: null, type: 'text', value: 'v',
      }))
    }
    const edited = structuredClone(toRaw(editor.buffer.value!))
    const ticket = editor.beginSnapshotRead()!
    const key = vi.spyOn(crypto, 'randomUUID')
    expect(await editor.save()).toBe(false)
    expect(await editor.initialize()).toBe(false)
    expect(await editor.retransmit()).toBe(false)
    expect(key).not.toHaveBeenCalled()
    key.mockRestore()
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.buffer.value).toEqual(edited)
    expect(editor.pendingIntent.value).toBeNull()
    expect(editor.outcome.value).toBeNull()
    expect(editor.reconcileSnapshot(ticket, state(4), 'retain')).toBe(true)
    expect(editor.buffer.value).toEqual(edited)
    expect(http.put).not.toHaveBeenCalled()
  })

  it.each([null, 7])('initializes missing draft using only GET cycle %s and keeps published copy receipt historical', async (cycle) => {
    const published = { revision: 8, document: { ...doc(), description: '😀'.repeat(20001) } }
    const { editor } = setup({ cycle, draft: null, published })
    const receipt = { cycle: 9, draft: { revision: 1, basePublishedRevision: 8, document: published.document }, published }
    http.post.mockResolvedValue({ data: receipt })
    expect(editor.buffer.value).toBeNull()
    expect(await editor.initialize()).toBe(true)
    const key = editor.pendingIntent.value!.key
    expect(key.length).toBeGreaterThan(0)
    expect(key.length).toBeLessThanOrEqual(200)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/products/product%20%2F1/editorial/draft/initialize',
      { expectedCycle: cycle }, { headers: { 'Idempotency-Key': key } })
    expect(editor.authoritative.value).toEqual({ cycle, draft: null, published })
    expect(editor.buffer.value).toBeNull()
    expect(editor.receipt.value).toEqual(receipt)
    expect(await editor.initialize()).toBe(false)
    expect(reconcile(editor, receipt, 'discard')).toBe(true)
    expect(editor.buffer.value).toEqual(published.document)
    expect(editor.receipt.value).toEqual(receipt)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('freezes full save body while edits continue; receipt never overwrites GET or buffer; new intent needs fresh reconciliation', async () => {
    const { editor } = setup()
    const staleTicket = editor.beginSnapshotRead()!
    const response = deferred<{ data: EditorialWriteResponse }>()
    http.put.mockReturnValue(response.promise)
    const original = structuredClone(toRaw(editor.buffer.value!))
    const saving = editor.save()
    const intent = editor.pendingIntent.value!
    expect(Object.isFrozen(intent)).toBe(true)
    expect(Object.isFrozen(intent.body)).toBe(true)
    expect(intent.kind).toBe('save')
    if (intent.kind !== 'save') throw new Error('Expected save intent')
    expect(Object.isFrozen(intent.body.document.mediaRefs)).toBe(true)
    expect(Reflect.set(intent.body.document, 'commercialTitle', 'tampered')).toBe(false)
    editor.buffer.value!.commercialTitle = 'edited in flight'
    editor.buffer.value!.mediaRefs.push('next')
    expect(await editor.save()).toBe(false)
    expect(await editor.retransmit()).toBe(false)
    expect(editor.beginSnapshotRead()).toBeNull()
    expect(editor.reconcileSnapshot(staleTicket, state(99), 'discard')).toBe(false)
    expect(editor.pendingIntent.value).toBe(intent)
    expect(http.put).toHaveBeenCalledExactlyOnceWith('/products/product%20%2F1/editorial/draft',
      { expectedCycle: 2, expectedRevision: 3, document: original }, { headers: { 'Idempotency-Key': intent.key } })
    const warnings = [{ code: 'ARCHIVED_OPTION' as const, familyId: 'f', definitionId: 'd', owner: 'product' as const, variantId: null, optionCode: 'old' }]
    response.resolve({ data: { ...state(4), warnings } })
    expect(await saving).toBe(true)
    expect(editor.receipt.value).toEqual({ ...state(4), warnings })
    expect(editor.authoritative.value!.draft!.revision).toBe(3)
    expect(editor.buffer.value!.commercialTitle).toBe('edited in flight')
    expect(await editor.save()).toBe(false)
    expect(await editor.retransmit()).toBe(false)
    expect(editor.reconcileSnapshot(staleTicket, state(4), 'retain')).toBe(false)
    expect(reconcile(editor, state(5))).toBe(true)
    expect(editor.buffer.value!.commercialTitle).toBe('edited in flight')
    http.put.mockResolvedValue({ data: state(6) })
    expect(await editor.save()).toBe(true)
    expect(editor.pendingIntent.value!.key).not.toBe(intent.key)
    expect(http.put.mock.calls[1]).toEqual(['/products/product%20%2F1/editorial/draft',
      { expectedCycle: 2, expectedRevision: 5, document: editor.buffer.value },
      { headers: { 'Idempotency-Key': editor.pendingIntent.value!.key } }])
    expect(http.get).not.toHaveBeenCalled()
  })

  it('ambiguous explicit retransmission uses original body/key despite invalid changed buffer, and blocks parallel retry', async () => {
    const { editor } = setup()
    http.put.mockRejectedValueOnce(new Error('PRIVATE RAW'))
    expect(await editor.save()).toBe(false)
    const intent = editor.pendingIntent.value
    const originalCall = http.put.mock.calls[0]
    editor.buffer.value!.commercialTitle = '😀'.repeat(201)
    expect(await editor.save()).toBe(false)
    const response = deferred<{ data: EditorialWriteResponse }>()
    http.put.mockReturnValue(response.promise)
    const retry = editor.retransmit()
    expect(await editor.retransmit()).toBe(false)
    expect(editor.pendingIntent.value).toBe(intent)
    expect(http.put.mock.calls).toEqual([originalCall, originalCall])
    expect(http.put.mock.calls[1]![1]).toBe(originalCall![1])
    response.resolve({ data: state(4) })
    expect(await retry).toBe(true)
    expect(editor.buffer.value!.commercialTitle).toBe('😀'.repeat(201))
    expect(editor.authoritative.value).toEqual(state())
  })

  it('409 preserves intent and buffer; equal-revision GET does not resend, diagnose cause or create a key', async () => {
    const { editor } = setup()
    http.put.mockRejectedValue(axiosFailure(409, 'CONFLICT'))
    const oldTicket = editor.beginSnapshotRead()!
    expect(await editor.save()).toBe(false)
    const intent = editor.pendingIntent.value
    editor.buffer.value!.description = 'keep'
    expect(editor.outcome.value).toBe('conflict')
    expect(await editor.retransmit()).toBe(false)
    expect(await editor.save()).toBe(false)
    expect(editor.reconcileSnapshot(oldTicket, state(), 'discard')).toBe(false)
    expect(editor.pendingIntent.value).toBe(intent)
    expect(reconcile(editor)).toBe(true)
    expect(editor.buffer.value!.description).toBe('keep')
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.get).not.toHaveBeenCalled()
    http.put.mockResolvedValue({ data: state(4) })
    expect(await editor.save()).toBe(true)
    expect(editor.pendingIntent.value!.key).not.toBe(intent!.key)
  })

  it.each([
    [400, 'MALFORMED', 'rejected'], [401, 'UNAUTHORIZED', 'rejected'],
    [403, 'FORBIDDEN', 'rejected'], [404, 'NOT_FOUND', 'rejected'],
    [500, 'INTERNAL_ERROR', 'ambiguous'], [413, undefined, 'ambiguous'],
    [502, undefined, 'ambiguous'], [null, undefined, 'ambiguous'],
  ] as const)('safely preserves state for %s without automatic retries', async (status, code, outcome) => {
    const { editor } = setup()
    http.put.mockRejectedValue(status === null ? new Error('PRIVATE RAW') : axiosFailure(status, code))
    const buffer = structuredClone(toRaw(editor.buffer.value!))
    expect(await editor.save()).toBe(false)
    expect(editor.outcome.value).toBe(outcome)
    expect(editor.error.value).toEqual({ status, code: code ?? 'UNKNOWN' })
    expect(JSON.stringify(editor.error.value)).not.toContain('PRIVATE RAW')
    expect(editor.buffer.value).toEqual(buffer)
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.receipt.value).toBeNull()
    expect(editor.pendingIntent.value).not.toBeNull()
    expect(await editor.initialize()).toBe(false)
    expect(await editor.save()).toBe(false)
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.get).not.toHaveBeenCalled()
  })

  it.each(['user', 'tenant', 'product', 'grant', 'grantAddition', 'session', 'hydration'] as const)(
    'clears identity-scoped state synchronously on %s change and ignores old async results even after switching back', async (change) => {
      const { editor, context } = setup()
      const original = contextValue()
      const ticket = editor.beginSnapshotRead()!
      const response = deferred<{ data: EditorialWriteResponse }>()
      http.put.mockReturnValue(response.promise)
      const saving = editor.save()
      if (change === 'user') context.value.userId = 'other'
      if (change === 'tenant') context.value.tenantId = 'other'
      if (change === 'product') context.value.productId = 'other'
      if (change === 'grant') context.value.permissionCodes = ['read:ProductEditorialDraft']
      if (change === 'grantAddition') context.value.permissionCodes = [...context.value.permissionCodes, 'read:Product']
      if (change === 'session') context.value.authenticated = false
      if (change === 'hydration') context.value.permissionsLoaded = false
      expect(editor.authoritative.value).toBeNull()
      expect(editor.buffer.value).toBeNull()
      expect(editor.pendingIntent.value).toBeNull()
      expect(editor.receipt.value).toBeNull()
      expect(await editor.retransmit()).toBe(false)
      context.value = original
      expect(editor.reconcileSnapshot(ticket, state(), 'discard')).toBe(false)
      expect(reconcile(editor, state(10), 'discard')).toBe(true)
      http.put.mockResolvedValue({ data: state(11) })
      expect(await editor.save()).toBe(true)
      const currentReceipt = editor.receipt.value
      response.resolve({ data: state(4) })
      expect(await saving).toBe(false)
      expect(editor.receipt.value).toBe(currentReceipt)
      expect(editor.authoritative.value).toEqual(state(10))
      expect(editor.isPending.value).toBe(false)
      expect(http.put).toHaveBeenCalledTimes(2)
    },
  )

  it.each([[], ['manage:all'], ['update:ProductEditorialDraft'], ['read:Product']].map(codes => ({ codes })))('uses exact grants $codes', async ({ codes }) => {
    const { editor, context } = setup()
    context.value.permissionCodes = codes
    expect(await editor.initialize()).toBe(false)
    expect(await editor.save()).toBe(false)
    expect(await editor.retransmit()).toBe(false)
    expect(editor.pendingIntent.value).toBeNull()
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('ingests readable history only, never normalizes unreadable data and supports deliberate retain/discard', async () => {
    const unreadable = { ...state(), draft: { revision: 3, basePublishedRevision: null, document: { bad: true } } }
    const { editor } = setup(unreadable)
    expect(editor.authoritative.value).toEqual(unreadable)
    expect(editor.buffer.value).toBeNull()
    expect(await editor.save()).toBe(false)
    expect(await editor.initialize()).toBe(false)
    expect(reconcile(editor, state(), 'discard')).toBe(true)
    editor.buffer.value!.description = 'local'
    expect(reconcile(editor, state(4), 'retain')).toBe(true)
    expect(editor.buffer.value!.description).toBe('local')
    expect(reconcile(editor, state(5), 'discard')).toBe(true)
    expect(editor.buffer.value).toEqual(doc())
    const oversized = state(6)
    oversized.draft!.document = { ...doc(), description: '😀'.repeat(20001) }
    expect(reconcile(editor, oversized, 'discard')).toBe(true)
    const before = editor.beginSnapshotRead()!
    expect(await editor.save()).toBe(false)
    expect(editor.pendingIntent.value).toBeNull()
    expect(editor.reconcileSnapshot(before, state(7), 'retain')).toBe(true)
    expect(editor.buffer.value!.description).toBe('😀'.repeat(20001))
    expect(http.put).not.toHaveBeenCalled()
  })

  it.each(['missing', 'unreadable'] as const)('retains unsaved buffer identity when fresh GET draft is %s without enabling save', async (draftState) => {
    const { editor } = setup()
    editor.buffer.value!.commercialTitle = 'UNSAVED'
    const unsavedBuffer = editor.buffer.value
    const unsavedContents = structuredClone(toRaw(unsavedBuffer!))
    const fresh: EditorialState = {
      cycle: 4,
      draft: draftState === 'missing' ? null : {
        revision: 9, basePublishedRevision: null, document: { unreadable: true },
      },
      published: { revision: 8, document: doc() },
    }
    const ticket = editor.beginSnapshotRead()!
    expect(editor.reconcileSnapshot(ticket, fresh, 'retain')).toBe(true)
    expect(editor.buffer.value).toBe(unsavedBuffer)
    expect(editor.buffer.value).toEqual(unsavedContents)
    expect(editor.buffer.value!.commercialTitle).toBe('UNSAVED')
    expect(editor.authoritative.value).toEqual(fresh)
    expect(await editor.save()).toBe(false)
    expect(editor.pendingIntent.value).toBeNull()
    expect(http.put).toHaveBeenCalledTimes(0)
    expect(http.post).toHaveBeenCalledTimes(0)
    expect(http.get).toHaveBeenCalledTimes(0)

    expect(reconcile(editor, fresh, 'discard')).toBe(true)
    expect(editor.buffer.value).toBeNull()
    expect(editor.authoritative.value).toEqual(fresh)
    expect(await editor.save()).toBe(false)
    expect(reconcile(editor, state(10), 'discard')).toBe(true)
    expect(editor.buffer.value).not.toBe(unsavedBuffer)
    expect(editor.buffer.value).toEqual(doc())
    expect(editor.authoritative.value).toEqual(state(10))
    expect(http.put).toHaveBeenCalledTimes(0)
    expect(http.post).toHaveBeenCalledTimes(0)
    expect(http.get).toHaveBeenCalledTimes(0)
  })

  it('rejects malformed snapshots/counters and old or foreign GET tickets without changing state', async () => {
    const { editor } = setup()
    const other = setup().editor
    const first = editor.beginSnapshotRead()!
    const latest = editor.beginSnapshotRead()!
    expect(editor.reconcileSnapshot(first, state(99), 'discard')).toBe(false)
    expect(editor.reconcileSnapshot(other.beginSnapshotRead()!, state(99), 'discard')).toBe(false)
    expect(editor.reconcileSnapshot(latest, { ...state(), cycle: 0 }, 'discard')).toBe(false)
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.reconcileSnapshot(latest, state(4), 'retain')).toBe(true)
    expect(editor.reconcileSnapshot(latest, state(99), 'discard')).toBe(false)
    expect(editor.authoritative.value).toEqual(state(4))
    expect(await editor.initialize()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('ignores stale asynchronous failures after context transition', async () => {
    const { editor, context } = setup()
    const response = deferred<never>()
    http.put.mockReturnValue(response.promise)
    const saving = editor.save()
    context.value.tenantId = 'new'
    response.reject(axiosFailure(409, 'CONFLICT'))
    expect(await saving).toBe(false)
    expect(editor.outcome.value).toBeNull()
    expect(editor.error.value).toBeNull()
    expect(editor.isPending.value).toBe(false)
  })
})
