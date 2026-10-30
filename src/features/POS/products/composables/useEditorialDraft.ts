import { computed, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { editorialContractApi, EditorialContractApiError } from '../api/editorial-contract.api'
import { canPublishEditorial, canReadEditorial, canWriteEditorial } from '../authorization/editorial-access'
import type { EditorialContractInitializeRequest, EditorialContractSaveRequest, EditorialContractTransitionRequest } from '../interfaces/editorial-contract-request.types'
import type { EditorialStateResponse } from '../interfaces/editorial-contract-response.types'
import { decodeEditorialStateResponse, decodeEditorialVocabularyResponse } from '../utils/editorial-contract-response'
import type { EditorialContractSnapshot } from '../utils/editorial-contract-snapshot'
import { toEditorialDocumentEditingState, resolveEditorialDocumentEditingState, type EditorialDocumentEditingState } from '../utils/editorial-contract-document-editing'
import { isEditorialDocumentEditingEqual } from '../utils/editorial-contract-document-dirty'
import { inspectEditorialPublicationContent, inspectEditorialRuntimeCandidate, type EditorialRuntimeIssue } from '../utils/editorial-contract-publication-checks'

export interface EditorialDraftContext {
  authenticated: boolean; userId: string | null; tenantId: string | null; productId: string
  permissionsLoaded: boolean; permissionCodes: readonly string[]; isSuperAdmin?: boolean
}
export type EditorialIntent = Readonly<{ key: string; productId: string; revision: string; confirmation: 'review-v1' | null } & (
  | { kind: 'initialize'; body: EditorialContractInitializeRequest }
  | { kind: 'save'; body: EditorialContractSaveRequest }
  | { kind: 'publish' | 'discard'; body: EditorialContractTransitionRequest }
)>
export interface EditorialSnapshotTicket { readonly id: symbol }
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copy) as T
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T
  return value
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

/** Sole raw editable owner. A single immutable coherent snapshot is authority;
 * candidate/dirty/baseline views are derived, never synchronized editable copies.
 * Historical acknowledgements never install state or advance CAS authority.
 */
export function useEditorialDraft(context: MaybeRefOrGetter<EditorialDraftContext>,
  api: MaybeRefOrGetter<typeof editorialContractApi> = editorialContractApi) {
  const snapshot = shallowRef<EditorialContractSnapshot | null>(null)
  const authoritative = computed(() => snapshot.value?.state.state ?? null)
  const buffer = ref<EditorialDocumentEditingState | null>(null)
  const pendingIntent = shallowRef<EditorialIntent | null>(null)
  const receipt = shallowRef<EditorialStateResponse | null>(null)
  const outcome = shallowRef<'acknowledged' | 'ambiguous' | 'conflict' | 'rejected' | null>(null)
  const error = shallowRef<{ status: number | null; code: EditorialContractApiError['code'] } | null>(null)
  const issues = shallowRef<EditorialRuntimeIssue[]>([])
  const isPending = shallowRef(false)
  const activeTicket = shallowRef<EditorialSnapshotTicket | null>(null)
  let generation = 0
  let idCounter = 0
  let writeController: AbortController | null = null
  const disposed = shallowRef(false)
  const identity = computed(() => {
    const c = toValue(context)
    return JSON.stringify([c.authenticated, c.userId, c.tenantId, c.productId, c.permissionsLoaded, c.permissionCodes, c.isSuperAdmin === true])
  })
  const canRead = computed(() => {
    const c = toValue(context)
    return !disposed.value && Boolean(c.authenticated && c.userId && c.tenantId && c.productId && c.permissionsLoaded && canReadEditorial(c.permissionCodes, c.isSuperAdmin))
  })
  const canWrite = computed(() => canRead.value && canWriteEditorial(toValue(context).permissionCodes, toValue(context).isSuperAdmin))
  const canPublish = computed(() => canRead.value && canPublishEditorial(toValue(context).permissionCodes, toValue(context).isSuperAdmin))
  const nextId = () => `editorial-${generation}-${++idCounter}`
  const hasUnsavedChanges = computed(() => {
    if (!buffer.value) return false
    const saved = authoritative.value?.draft?.document
    // Baseline IDs are irrelevant; this pure projection allocates no owner IDs.
    return !saved || !isEditorialDocumentEditingEqual(buffer.value, toEditorialDocumentEditingState(saved, () => 'baseline'))
  })
  const publishIssues = computed<EditorialRuntimeIssue[]>(() => {
    const current = snapshot.value
    const draft = authoritative.value?.draft
    return current && draft ? inspectEditorialPublicationContent(draft.document, authoritative.value?.published?.document ?? null,
      current.vocabulary.vocabulary, current.context) : [{ code: 'metadata' }]
  })
  function intentAllowed(kind: EditorialIntent['kind']) { return kind === 'publish' ? canPublish.value : canWrite.value }
  function freshActionAllowed(kind: EditorialIntent['kind'] = 'save') {
    return intentAllowed(kind) && !isPending.value && pendingIntent.value === null && snapshot.value !== null && activeTicket.value === null
  }
  const canDiscard = computed(() => freshActionAllowed('discard') && Boolean(authoritative.value?.draft))
  const canPublishDraft = computed(() => freshActionAllowed('publish') && Boolean(authoritative.value?.draft) && !hasUnsavedChanges.value && publishIssues.value.length === 0)
  function resetContext() {
    generation++; idCounter = 0; writeController?.abort(); writeController = null; activeTicket.value = null
    snapshot.value = null; buffer.value = null; pendingIntent.value = null; receipt.value = null
    outcome.value = null; error.value = null; issues.value = []; isPending.value = false
  }
  watch([identity, () => toValue(api)], resetContext, { flush: 'sync' })
  onScopeDispose(() => { disposed.value = true; resetContext() }, true)
  function beginSnapshotRead(): EditorialSnapshotTicket | null {
    if (!canRead.value || isPending.value) return null
    activeTicket.value = Object.freeze({ id: Symbol('editorial coherent GET') })
    return activeTicket.value
  }
  function cancelSnapshotRead(ticket: EditorialSnapshotTicket) { if (activeTicket.value === ticket) activeTicket.value = null }
  function reconcileSnapshot(ticket: EditorialSnapshotTicket, incoming: EditorialContractSnapshot, choice: 'retain' | 'discard'): boolean {
    if (!canRead.value || isPending.value || !ticket || ticket !== activeTicket.value || !['retain', 'discard'].includes(choice)) return false
    // Public callers cannot install a partial/old-contract or mismatched pair.
    const state = decodeEditorialStateResponse(incoming.state)
    const vocabulary = decodeEditorialVocabularyResponse(incoming.vocabulary)
    if (!state || !vocabulary || state.vocabularyRevision !== vocabulary.vocabularyRevision) return false
    const installed = freeze(copy({ vocabulary, state, context: incoming.context }))
    if (choice === 'discard') buffer.value = state.state.draft ? toEditorialDocumentEditingState(state.state.draft.document, nextId) : null
    snapshot.value = installed; activeTicket.value = null; pendingIntent.value = null; outcome.value = null; error.value = null; issues.value = []
    return true
  }
  async function transmit(intent: EditorialIntent): Promise<boolean> {
    const requestedGeneration = generation
    const requestedApi = toValue(api)
    const current = () => !disposed.value && generation === requestedGeneration && requestedApi === toValue(api) && intentAllowed(intent.kind) && pendingIntent.value === intent
    activeTicket.value = null; writeController = new AbortController()
    const signal = writeController.signal
    isPending.value = true; outcome.value = null; error.value = null
    try {
      const response = intent.kind === 'initialize' ? await requestedApi.initialize(intent.productId, intent.body, intent.key, intent.revision, signal)
        : intent.kind === 'save' ? await requestedApi.save(intent.productId, intent.body, intent.key, intent.revision, signal)
          : intent.kind === 'publish' ? await requestedApi.publish(intent.productId, intent.body, intent.key, intent.revision, intent.confirmation, signal)
            : await requestedApi.discard(intent.productId, intent.body, intent.key, intent.revision, signal)
      if (!current()) return false
      receipt.value = freeze(copy(response)); outcome.value = 'acknowledged'
      if (intent.kind === 'discard' || (intent.kind === 'publish' && !hasUnsavedChanges.value)) buffer.value = null
      return true
    } catch (failure) {
      if (!current()) return false
      const safe = failure instanceof EditorialContractApiError ? failure : new EditorialContractApiError(null, null)
      error.value = Object.freeze({ status: safe.status, code: safe.code })
      outcome.value = safe.status === 409 ? 'conflict' : safe.status !== null && [400, 401, 403, 404].includes(safe.status) ? 'rejected' : 'ambiguous'
      return false
    } finally { if (current()) { isPending.value = false; writeController = null } }
  }
  function captureIntent(value: Omit<EditorialIntent, 'key' | 'productId' | 'revision'>): EditorialIntent {
    return freeze({ ...value, key: crypto.randomUUID(), productId: toValue(context).productId, revision: snapshot.value!.state.vocabularyRevision }) as EditorialIntent
  }
  async function initialize() {
    if (!freshActionAllowed() || authoritative.value!.draft !== null) return false
    const intent = captureIntent({ kind: 'initialize', body: { expectedCycle: authoritative.value!.cycle }, confirmation: null })
    pendingIntent.value = intent; return transmit(intent)
  }
  async function save() {
    const current = snapshot.value
    const saved = authoritative.value
    if (!freshActionAllowed() || !saved?.draft || saved.cycle === null || !buffer.value || !current) return false
    const encoded = resolveEditorialDocumentEditingState(buffer.value)
    issues.value = encoded.status === 'incomplete' ? [{ code: 'INCOMPLETE_INPUT' }] : inspectEditorialRuntimeCandidate(encoded.document, saved.draft.document, current.vocabulary.vocabulary, current.context)
    if (encoded.status === 'incomplete' || issues.value.length) return false
    const intent = captureIntent({ kind: 'save', body: { expectedCycle: saved.cycle, expectedRevision: saved.draft.revision, document: encoded.document }, confirmation: null })
    pendingIntent.value = intent; return transmit(intent)
  }
  async function transition(kind: 'publish' | 'discard', confirmation: 'review-v1' | null = null) {
    if (kind === 'publish' ? !canPublishDraft.value : !canDiscard.value) return false
    const saved = authoritative.value!
    const care = saved.draft!.document.familyCode === 'care'
    if (kind === 'publish' && (care ? confirmation !== 'review-v1' : confirmation !== null)) return false
    const intent = captureIntent({ kind, body: { expectedCycle: saved.cycle!, expectedRevision: saved.draft!.revision }, confirmation: kind === 'publish' ? confirmation : null })
    pendingIntent.value = intent; return transmit(intent)
  }
  async function retransmit() {
    const intent = pendingIntent.value
    if (!intent || !intentAllowed(intent.kind) || isPending.value || activeTicket.value !== null || outcome.value !== 'ambiguous') return false
    return transmit(intent)
  }
  return { snapshot: computed(() => snapshot.value), authoritative, buffer, nextId, issues,
    pendingIntent: computed(() => pendingIntent.value), receipt: computed(() => receipt.value), outcome: computed(() => outcome.value), error: computed(() => error.value),
    isPending: computed(() => isPending.value), canRead, canWrite, canPublish, canPublishDraft, canDiscard, hasUnsavedChanges, publishIssues,
    beginSnapshotRead, cancelSnapshotRead, reconcileSnapshot, initialize, save, retransmit,
    publish: (confirmation: 'review-v1' | null = null) => transition('publish', confirmation), discard: () => transition('discard') }
}
