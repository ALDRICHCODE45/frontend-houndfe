import { computed, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { z } from 'zod'
import { editorialApi, EditorialApiError } from '../api/product-editorial.api'
import { canReadEditorial, canWriteEditorial } from '../authorization/editorial-access'
import type {
  EditorialDocument, EditorialInitializeRequest, EditorialSaveRequest,
  EditorialState, EditorialWriteResponse,
} from '../interfaces/product-editorial.types'
import { decodeEditorialDocument } from '../utils/product-editorial-document'
import { validateEditorialSave } from '../utils/product-editorial-save-validation'

export interface EditorialDraftContext {
  authenticated: boolean
  userId: string | null
  tenantId: string | null
  productId: string
  permissionsLoaded: boolean
  permissionCodes: readonly string[]
}
export type EditorialIntent = Readonly<{ key: string; productId: string } & (
  | { kind: 'initialize'; body: EditorialInitializeRequest }
  | { kind: 'save'; body: EditorialSaveRequest }
)>
export interface EditorialSnapshotTicket { readonly id: symbol }
type Outcome = 'acknowledged' | 'ambiguous' | 'conflict' | 'rejected'
type SafeError = { status: number | null; code: EditorialApiError['code'] }
const revision = z.number().int().positive()
const stateSchema = z.object({
  cycle: revision.nullable(),
  draft: z.object({ revision, basePublishedRevision: revision.nullable(), document: z.unknown() }).nullable(),
  published: z.object({ revision, document: z.unknown() }).nullable(),
}).strict()

// JSON-shaped transport data, including unreadable history, is copied without
// normalizing it. Recursive copying also accepts the editable Vue proxy.
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => copy(item)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T
  }
  return value
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(item => freeze(item))
    Object.freeze(value)
  }
  return value
}

/** Feature-only writer. No queries, invalidations, retries, router or auth store.
 * T4 must validate authoritative vocabulary, archived conservation and complete
 * variant context BEFORE save(); its structural/cap check is not that authority.
 * Call beginSnapshotRead BEFORE issuing a fresh GET, then explicitly reconcile
 * its result with retain/discard. Never ingest a write receipt as a GET result.
 */
export function useEditorialDraft(context: MaybeRefOrGetter<EditorialDraftContext>) {
  const authoritative = shallowRef<EditorialState | null>(null)
  const buffer = ref<EditorialDocument | null>(null)
  const pendingIntent = shallowRef<EditorialIntent | null>(null)
  const receipt = shallowRef<EditorialWriteResponse | null>(null)
  const outcome = shallowRef<Outcome | null>(null)
  const error = shallowRef<SafeError | null>(null)
  const isPending = shallowRef(false)
  let activeTicket: EditorialSnapshotTicket | null = null
  let generation = 0
  const disposed = shallowRef(false)
  const identity = computed(() => {
    const c = toValue(context)
    // Scope identifiers and grants only; never secrets/tokens.
    return JSON.stringify([c.authenticated, c.userId, c.tenantId, c.productId,
      c.permissionsLoaded, c.permissionCodes])
  })
  const canRead = computed(() => {
    const c = toValue(context)
    return !disposed.value && Boolean(c.authenticated && c.userId && c.tenantId && c.productId &&
      c.permissionsLoaded && canReadEditorial(c.permissionCodes))
  })
  const canWrite = computed(() => canRead.value && canWriteEditorial(toValue(context).permissionCodes))
  function resetContext() {
    generation++
    activeTicket = null
    authoritative.value = null
    buffer.value = null
    pendingIntent.value = null
    receipt.value = null
    outcome.value = null
    error.value = null
    isPending.value = false
  }
  watch(identity, resetContext, { flush: 'sync' })
  onScopeDispose(() => { disposed.value = true; resetContext() }, true)

  function beginSnapshotRead(): EditorialSnapshotTicket | null {
    if (!canRead.value || isPending.value) return null
    activeTicket = Object.freeze({ id: Symbol('editorial GET') })
    return activeTicket
  }
  function reconcileSnapshot(ticket: EditorialSnapshotTicket, raw: unknown, choice: 'retain' | 'discard'): boolean {
    if (!canRead.value || isPending.value || !ticket || ticket !== activeTicket ||
      (choice !== 'retain' && choice !== 'discard')) return false
    if (!stateSchema.safeParse(raw).success) return false
    const snapshot = copy(raw as EditorialState)
    const decoded = snapshot.draft ? decodeEditorialDocument(snapshot.draft.document) : null
    // Only explicit discard replaces edits. Retain keeps the buffer even when
    // fresh history is missing/unreadable; save still requires a readable draft.
    if (choice === 'discard') {
      buffer.value = decoded?.readable ? copy(decoded.document) : null
    }
    authoritative.value = freeze(snapshot)
    activeTicket = null
    // This explicit reconciliation resolves the previous intent, irrespective
    // of equal revisions. It never resends or diagnoses the conflict's cause.
    pendingIntent.value = null
    outcome.value = null
    error.value = null
    return true
  }
  function freshActionAllowed(): boolean {
    return canWrite.value && !isPending.value && pendingIntent.value === null && authoritative.value !== null
  }
  async function transmit(intent: EditorialIntent): Promise<boolean> {
    const requestedGeneration = generation
    const current = () => !disposed.value && requestedGeneration === generation &&
      canWrite.value && pendingIntent.value === intent
    activeTicket = null
    isPending.value = true
    outcome.value = null
    error.value = null
    try {
      const response = intent.kind === 'initialize'
        ? await editorialApi.initialize(intent.productId, intent.body, intent.key)
        : await editorialApi.save(intent.productId, intent.body, intent.key)
      if (!current()) return false
      // This can be an old replay. Do not decode it as a new baseline, apply
      // fresh caps, or replace either GET state or edits. Preserve all warnings.
      receipt.value = freeze(copy(response))
      outcome.value = 'acknowledged'
      return true
    } catch (failure) {
      if (!current()) return false
      const safe = failure instanceof EditorialApiError ? failure : new EditorialApiError(null, null)
      error.value = Object.freeze({ status: safe.status, code: safe.code })
      outcome.value = safe.status === 409 ? 'conflict'
        : safe.status !== null && [400, 401, 403, 404].includes(safe.status) ? 'rejected' : 'ambiguous'
      return false
    } finally {
      if (current()) isPending.value = false
    }
  }
  async function initialize(): Promise<boolean> {
    if (!freshActionAllowed() || authoritative.value!.draft !== null) return false
    const intent: EditorialIntent = freeze({ kind: 'initialize', key: crypto.randomUUID(),
      productId: toValue(context).productId, body: { expectedCycle: authoritative.value!.cycle } })
    pendingIntent.value = intent
    return transmit(intent)
  }
  async function save(): Promise<boolean> {
    const snapshot = authoritative.value
    if (!freshActionAllowed() || !snapshot?.draft || snapshot.cycle === null ||
      !decodeEditorialDocument(snapshot.draft.document).readable) return false
    const validation = validateEditorialSave(buffer.value)
    if (!validation.valid) return false
    const intent: EditorialIntent = freeze({ kind: 'save', key: crypto.randomUUID(),
      productId: toValue(context).productId, body: { expectedCycle: snapshot.cycle,
        expectedRevision: snapshot.draft.revision, document: copy(validation.document) } })
    pendingIntent.value = intent
    return transmit(intent)
  }
  async function retransmit(): Promise<boolean> {
    if (!canWrite.value || isPending.value || outcome.value !== 'ambiguous' || !pendingIntent.value) return false
    // Explicit ambiguous retry only: no changed-buffer validation or new key.
    return transmit(pendingIntent.value)
  }
  return {
    authoritative: computed(() => authoritative.value), buffer,
    pendingIntent: computed(() => pendingIntent.value), receipt: computed(() => receipt.value),
    outcome: computed(() => outcome.value), error: computed(() => error.value),
    isPending: computed(() => isPending.value), canRead, canWrite,
    beginSnapshotRead, reconcileSnapshot, initialize, save, retransmit,
  }
}
