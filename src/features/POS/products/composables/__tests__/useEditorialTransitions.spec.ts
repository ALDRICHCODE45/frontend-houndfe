import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorialDraft, type EditorialDraftContext } from '../useEditorialDraft'
import { document, state, envelope, vocabularyEnvelope, careDocument, careVocabulary, R, read, update, publish, success, failure, deferred } from '../../__tests__/editorial-contract-fixtures'
const http = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const scopes: ReturnType<typeof effectScope>[] = []
function setup(doc = document(), codes = [read, update, publish]) {
  const scope = effectScope(); scopes.push(scope)
  const context = ref<EditorialDraftContext>({ authenticated: true, userId: 'u', tenantId: 't', productId: 'p/1', permissionsLoaded: true, permissionCodes: codes })
  const editor = scope.run(() => useEditorialDraft(context))!
  const install = (revision = 3) => editor.reconcileSnapshot(editor.beginSnapshotRead()!, { state: envelope(state(doc, revision)),
    vocabulary: vocabularyEnvelope(doc.familyCode === 'care' ? careVocabulary() : undefined), context: { variants: [] } }, 'discard')
  if (editor.canRead.value) expect(install()).toBe(true)
  return { editor, context, install }
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('saved target transitions, not local eligibility certification', () => {
  it('read+publish alone sends exact counters/R with explicit null token on noncare', async () => {
    const { editor } = setup(document(), [read, publish])
    http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: { revision: 1, document: document() } }))
    expect(editor.canWrite.value).toBe(false)
    expect(await editor.publish()).toBe(true)
    expect(http.post.mock.calls[0]![1]).toEqual({ expectedCycle: 2, expectedRevision: 3 })
    expect(http.post.mock.calls[0]![2].headers).toEqual({ 'Idempotency-Key': editor.pendingIntent.value!.key, 'Editorial-Vocabulary-Revision': R })
    expect(editor.pendingIntent.value!.confirmation).toBeNull()
    expect(editor.authoritative.value).toEqual(state())
    expect(editor.buffer.value).toBeNull()
    expect(editor.hasUnsavedChanges.value).toBe(false)
    expect(await editor.publish()).toBe(false)
  })
  it('care requires explicit review-v1 and freezes that exact token through retry after raw/metadata changes', async () => {
    const { editor } = setup(careDocument(), [read, publish])
    expect(await editor.publish()).toBe(false)
    expect(editor.pendingIntent.value).toBeNull()
    http.post.mockRejectedValueOnce(new Error('network'))
    expect(await editor.publish('review-v1')).toBe(false)
    const intent = editor.pendingIntent.value!
    expect(intent.confirmation).toBe('review-v1')
    expect(http.post.mock.calls[0]![2].headers['Editorial-Care-Confirmation']).toBe('review-v1')
    editor.buffer.value!.facts[0]!.presentation = 'later raw edit'
    http.post.mockResolvedValue(success())
    expect(await editor.retransmit()).toBe(true)
    expect(http.post.mock.calls[1]![1]).toBe(http.post.mock.calls[0]![1])
    expect(http.post.mock.calls[1]![2].headers).toEqual(http.post.mock.calls[0]![2].headers)
    expect(editor.pendingIntent.value).toBe(intent)
    expect(editor.buffer.value!.facts[0]!.presentation).toBe('later raw edit')
  })
  it('rejects a care token on noncare without transport or allocating a key', async () => {
    const { editor } = setup()
    expect(await editor.publish('review-v1')).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each([null, '', '  ', '\n'])('nonblank stored title is mandatory: %j', async commercialTitle => {
    const { editor } = setup({ ...document(), commercialTitle })
    expect(await editor.publish()).toBe(false)
    expect(editor.publishIssues.value).toContainEqual({ code: 'title' })
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each([{ mediaRefs: ['private'] }, { description: 'x'.repeat(20001) }, { commercialTitle: 'x'.repeat(201) }])('blocks supplied-content failures %#', async change => {
    const { editor } = setup({ ...document(), ...change })
    expect(await editor.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('invalidates a previously computed publication gate while a coherent GET ticket is outstanding', async () => {
    const { editor } = setup()
    expect(editor.canPublishDraft.value).toBe(true)
    editor.beginSnapshotRead()
    expect(editor.canPublishDraft.value).toBe(false)
    expect(await editor.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('blocks publishing raw dirty edits without creating a key', async () => {
    const { editor } = setup()
    editor.buffer.value!.description = 'unsaved'
    const key = vi.spyOn(crypto, 'randomUUID')
    expect(await editor.publish()).toBe(false)
    expect(key).not.toHaveBeenCalled(); key.mockRestore()
  })
  it.each([[read, update], ['manage:all'], [publish], [update], [read]])('requires exact read+publish grants %j', async (...codes) => {
    const { editor } = setup(document(), codes)
    expect(await editor.publish()).toBe(false)
    expect(http.post).not.toHaveBeenCalled()
  })
  it.each(['publish', 'discard'] as const)('%s both conflicts retain raw edits and forbid auto retry', async kind => {
    for (const code of ['CONFLICT', 'VOCABULARY_CHANGED']) {
      const { editor } = setup()
      http.post.mockRejectedValueOnce(failure(409, code))
      expect(await editor[kind]()).toBe(false)
      editor.buffer.value!.description = 'keep'
      expect(await editor.retransmit()).toBe(false)
      expect(await editor[kind]()).toBe(false)
      expect(editor.buffer.value!.description).toBe('keep')
    }
  })
  it.each(['publish', 'discard'] as const)('%s ambiguous retry never revalidates or overwrites GET', async kind => {
    const { editor } = setup()
    http.post.mockRejectedValueOnce(new Error('network'))
    expect(await editor[kind]()).toBe(false)
    editor.buffer.value!.commercialTitle = null
    http.post.mockResolvedValue(success({ cycle: 9, draft: null, published: null }))
    expect(await editor.retransmit()).toBe(true)
    expect(http.post.mock.calls[1]![1]).toBe(http.post.mock.calls[0]![1])
    expect(http.post.mock.calls[1]![2].headers).toEqual(http.post.mock.calls[0]![2].headers)
    expect(editor.authoritative.value).toEqual(state())
    if (kind === 'publish') expect(editor.buffer.value!.commercialTitle).toBeNull()
    else expect(editor.buffer.value).toBeNull()
  })
  it('discard requires read+update but not fresh-content validity, and drops announced local edits only on acknowledgement', async () => {
    const { editor } = setup({ ...document(), commercialTitle: null, mediaRefs: ['private'] }, [read, update])
    http.post.mockResolvedValue(success({ cycle: 2, draft: null, published: null }))
    expect(await editor.discard()).toBe(true)
    expect(editor.buffer.value).toBeNull()
    const denied = setup(document(), [read, publish]).editor
    expect(await denied.discard()).toBe(false)
  })
  it.each(['publish', 'discard'] as const)('%s ignores stale success/failure after scope-away-and-back', async kind => {
    const { editor, context, install } = setup()
    const late = deferred<ReturnType<typeof success>>()
    http.post.mockReturnValue(late.promise)
    const writing = editor[kind]()
    context.value.tenantId = 'other'; context.value.tenantId = 't'
    expect(install(10)).toBe(true)
    late.resolve(success({ cycle: 9, draft: null, published: null }))
    expect(await writing).toBe(false)
    expect(editor.authoritative.value!.draft!.revision).toBe(10)
    expect(editor.receipt.value).toBeNull()
  })
})
