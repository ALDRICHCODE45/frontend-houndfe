import { effectScope, ref, toRaw } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorialDraft, type EditorialDraftContext } from '../useEditorialDraft'
import type { EditorialDocument, EditorialState } from '../../interfaces/product-editorial.types'

const http = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const read = 'read:ProductEditorialDraft'
const update = 'update:ProductEditorialDraft'
const publish = 'publish:ProductEditorialDraft'
const document = (): EditorialDocument => ({ commercialTitle: ' a ', description: null,
  mediaRefs: [], familyCode: null, values: [] })
const state = (saved: unknown = document(), cycle = 4, revision = 7): EditorialState => ({
  cycle, draft: { revision, basePublishedRevision: null, document: saved }, published: null,
})
const scopes: ReturnType<typeof effectScope>[] = []
function setup(saved = state(), codes = [read, update, publish]) {
  const context = ref<EditorialDraftContext>({ authenticated: true, userId: 'u', tenantId: 't',
    productId: 'p/1', permissionsLoaded: true, permissionCodes: codes })
  const metadata = ref({ vocabulary: { families: [], definitions: [] }, context: { variants: [] } })
  const scope = effectScope(); scopes.push(scope)
  const editor = scope.run(() => useEditorialDraft(context, metadata))!
  if (editor.canRead.value) expect(editor.reconcileSnapshot(editor.beginSnapshotRead()!, saved, 'discard')).toBe(true)
  return { editor, context, metadata, scope }
}
function reconcile(editor: ReturnType<typeof useEditorialDraft>, saved = state()) {
  return editor.reconcileSnapshot(editor.beginSnapshotRead()!, saved, 'retain')
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('explicit saved draft transitions', () => {
  it('publishes with read+publish alone, exact GET counters and an untouched spaced title', async () => {
    const saved = state()
    const { editor } = setup(saved, [read, publish])
    const receipt = { cycle: 4, draft: null, published: { revision: 1, document: document() } }
    http.post.mockResolvedValue({ data: receipt })
    expect(editor.canWrite.value).toBe(false)
    expect(await editor.publish()).toBe(true)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/products/p%2F1/editorial/draft/publish',
      { expectedCycle: 4, expectedRevision: 7 }, { headers: { 'Idempotency-Key': editor.pendingIntent.value!.key } })
    expect(editor.receipt.value).toEqual(receipt)
    expect(editor.authoritative.value).toEqual(saved)
    expect(editor.buffer.value!.commercialTitle).toBe(' a ')
    expect(await editor.publish()).toBe(false)
    expect(http.get).not.toHaveBeenCalled()
  })
  it('refuses publish with local unsaved changes without allocating a key', async () => {
    const { editor } = setup()
    editor.buffer.value!.description = 'unsaved'
    const key = vi.spyOn(crypto, 'randomUUID')
    expect(await editor.publish()).toBe(false)
    expect(editor.hasUnsavedChanges.value).toBe(true)
    expect(key).not.toHaveBeenCalled(); key.mockRestore()
    expect(editor.pendingIntent.value).toBeNull()
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each([null, '', '   ', ' \n'])('refuses saved title %j before transport', async commercialTitle => {
    const { editor } = setup(state({ ...document(), commercialTitle }))
    expect(await editor.publish()).toBe(false)
    expect(editor.publishIssues.value).toContainEqual({ code: 'title' })
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each([
    { mediaRefs: ['private'] }, { description: 'x'.repeat(20001) }, { commercialTitle: 'x'.repeat(201) },
    { familyCode: 'f', values: Array.from({ length: 201 }, (_, index) => (
      { code: `text-${index}`, owner: 'product', variantId: null, type: 'text', value: 'x' })) },
  ])('refuses other unpublishable saved documents %#', async change => {
    const { editor } = setup(state({ ...document(), ...change }))
    expect(await editor.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each([[read, update], ['manage:all'], [publish], [update], [read]])('refuses publish without exact grants %j', async (...codes) => {
    const { editor } = setup(state(), codes)
    expect(await editor.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each([state({ unreadable: true }), state({ ...document(), commercialTitle: null, mediaRefs: ['private'] })])(
    'discards invalid saved history without document validation %#', async saved => {
      const { editor } = setup(saved, [read, update])
      http.post.mockResolvedValue({ data: { cycle: 4, draft: null, published: null } })
      const before = editor.buffer.value
      expect(await editor.discard()).toBe(true)
      expect(http.post).toHaveBeenCalledExactlyOnceWith('/products/p%2F1/editorial/draft/discard',
        { expectedCycle: 4, expectedRevision: 7 }, { headers: { 'Idempotency-Key': editor.pendingIntent.value!.key } })
      expect(editor.buffer.value).toBe(before)
      expect(editor.authoritative.value).toEqual(saved)
    })
  it.each([[read, publish], ['manage:all'], [update], [read]])('refuses discard without read+update %j', async (...codes) => {
    const { editor } = setup(state(), codes)
    expect(await editor.discard()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each(['publish', 'discard'] as const)('refuses %s without saved draft', async action => {
    const { editor } = setup({ cycle: 4, draft: null, published: null })
    expect(await editor[action]()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each(['publish', 'discard'] as const)('%s conflict preserves buffer and requires explicit reconciliation, then uses fresh cycle and key', async action => {
    const { editor } = setup()
    http.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { statusCode: 409, error: 'CONFLICT' } } })
    expect(await editor[action]()).toBe(false)
    const intent = editor.pendingIntent.value!
    editor.buffer.value!.description = 'keep'
    expect(editor.outcome.value).toBe('conflict')
    expect(await editor.retransmit()).toBe(false)
    expect(await editor[action]()).toBe(false)
    expect(editor.buffer.value!.description).toBe('keep')
    expect(http.post).toHaveBeenCalledTimes(1)
    const fresh = state({ ...document(), description: 'keep' }, 5, 1)
    expect(reconcile(editor, fresh)).toBe(true)
    http.post.mockResolvedValue({ data: { cycle: 5, draft: null, published: null } })
    expect(await editor[action]()).toBe(true)
    expect(editor.pendingIntent.value!.key).not.toBe(intent.key)
    expect(editor.pendingIntent.value!.body).toEqual({ expectedCycle: 5, expectedRevision: 1 })
  })
  it.each(['publish', 'discard'] as const)('%s ambiguous retry retains identical frozen body/key despite later edits', async action => {
    const { editor } = setup(state(), action === 'publish' ? [read, publish] : [read, update])
    http.post.mockRejectedValueOnce(new Error('network'))
    expect(await editor[action]()).toBe(false)
    const intent = editor.pendingIntent.value!
    expect(Object.isFrozen(intent)).toBe(true)
    expect(Object.isFrozen(intent.body)).toBe(true)
    const original = http.post.mock.calls[0]!
    editor.buffer.value!.commercialTitle = null
    const buffer = structuredClone(toRaw(editor.buffer.value!))
    expect(await editor[action]()).toBe(false)
    const receipt = { cycle: 4, draft: null, published: null }
    http.post.mockResolvedValue({ data: receipt })
    expect(await editor.retransmit()).toBe(true)
    expect(http.post.mock.calls[1]).toEqual(original)
    expect(http.post.mock.calls[1]![1]).toBe(original[1])
    expect(editor.pendingIntent.value).toBe(intent)
    expect(editor.buffer.value).toEqual(buffer)
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.receipt.value).toEqual(receipt)
  })
  const identityChanges = [
    ['permission loss', (c: EditorialDraftContext) => { c.permissionCodes = [read] }],
    ['user change', (c: EditorialDraftContext) => { c.userId = 'other' }],
    ['product change', (c: EditorialDraftContext) => { c.productId = 'p/2' }],
  ] as const
  it.each((['publish', 'discard'] as const).flatMap(action => identityChanges.map(([name, change]) => [action, name, change] as const)))(
    'ignores a late %s response after %s and blocks retransmission', async (action, _name, change) => {
      const { editor, context } = setup()
      let resolve!: (value: unknown) => void
      http.post.mockReturnValue(new Promise(yes => { resolve = yes }))
      const writing = editor[action]()
      change(context.value)
      resolve({ data: { cycle: 4, draft: null, published: null } })
      expect(await writing).toBe(false)
      expect(editor.receipt.value).toBeNull()
      expect(await editor.retransmit()).toBe(false)
      expect(http.post).toHaveBeenCalledTimes(1)
    })
  it.each((['publish', 'discard'] as const).flatMap(action => identityChanges.map(([name, change]) => [action, name, change] as const)))(
    'blocks %s ambiguous retransmission after %s', async (action, _name, change) => {
      const { editor, context } = setup()
      http.post.mockRejectedValueOnce(new Error('network'))
      expect(await editor[action]()).toBe(false)
      expect(editor.outcome.value).toBe('ambiguous')
      change(context.value)
      expect(await editor.retransmit()).toBe(false)
      expect(http.post).toHaveBeenCalledTimes(1)
    })
  it.each(['publish', 'discard'] as const)('keeps a newer GET authoritative when a stale %s response arrives late', async action => {
    const { editor, context } = setup()
    let resolve!: (value: unknown) => void
    http.post.mockReturnValue(new Promise(yes => { resolve = yes }))
    const writing = editor[action]()
    expect(editor.beginSnapshotRead()).toBeNull()
    context.value.tenantId = 'other'
    await Promise.resolve()
    const newer = state({ ...document(), description: 'newer' }, 9, 2)
    expect(editor.reconcileSnapshot(editor.beginSnapshotRead()!, newer, 'discard')).toBe(true)
    resolve({ data: { cycle: 4, draft: null, published: null } })
    expect(await writing).toBe(false)
    expect(editor.authoritative.value).toEqual(newer)
    expect(editor.receipt.value).toBeNull()
    expect(editor.buffer.value!.description).toBe('newer')
  })
  it.each(['publish', 'discard'] as const)('ignores a late %s response after identity changes', async action => {
    const { editor, context } = setup()
    let resolve!: (value: unknown) => void
    http.post.mockReturnValue(new Promise(yes => { resolve = yes }))
    const writing = editor[action]()
    expect(await editor[action]()).toBe(false)
    context.value.tenantId = 'other'
    resolve({ data: { cycle: 4, draft: null, published: null } })
    expect(await writing).toBe(false)
    expect(editor.receipt.value).toBeNull()
    expect(editor.isPending.value).toBe(false)
  })
})
