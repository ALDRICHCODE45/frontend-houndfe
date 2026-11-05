import { computed, onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { editorialContractApi, EditorialContractApiError } from '../api/editorial-contract.api'
import type { EditorialReadiness, EditorialReadinessItem } from '../interfaces/editorial-contract-readiness.types'
import {
  countEditorialReadinessFields, editorialPublicationStatus, editorialReadinessSectionCounts, isEditorialNoDraftReadiness, isEditorialReadinessCurrent,
} from '../utils/editorial-contract-readiness'
import type { EditorialContractSnapshot } from '../utils/editorial-contract-snapshot'
import { editorialErrorMessage, type useEditorialEditor } from './useEditorialEditor'

type Confirmation = 'review-v1' | null
export interface EditorialPublishOptions {
  productId: MaybeRefOrGetter<string>
  /** Asks «Confirmo que revisé la información de cuidado.»; only called for the Cuidado family. */
  confirmCare: () => Promise<boolean>
  notify: (title: string) => void
  api?: MaybeRefOrGetter<typeof editorialContractApi>
}

const MESSAGES = {
  ambiguous: 'No pudimos confirmar si se publicó. Reintenta: si ya se publicó, no se publica dos veces.',
  notReady: 'Todavía no se puede publicar. Revisa lo pendiente.',
  careMissing: 'Falta confirmar que revisaste la información de cuidado. Vuelve a publicar y confírmalo.',
  request: 'No pudimos publicar. Recarga la página e inténtalo de nuevo.',
  forbidden: 'No tienes permiso para publicar este contenido.',
  conflict: 'Alguien más cambió el contenido. Cargamos la versión más reciente; revísala y vuelve a publicar.',
  vocabulary: 'El catálogo de datos cambió mientras publicabas. Recarga la página e inténtalo de nuevo.',
} as const

/**
 * The «Publicar» flow of Contenido (handoff 05). The backend owns publishability (D2): readiness is read
 * after every coherent read of the editor (load, save, publish, discard), and it speaks only for the saved
 * draft it evaluated. Publish V2 sends one Idempotency-Key per attempt (reused only to retransmit an
 * ambiguous one) and `Editorial-Care-Confirmation: review-v1` only for Cuidado, after `confirmCare`.
 */
export function useEditorialPublish(editor: ReturnType<typeof useEditorialEditor>, options: EditorialPublishOptions) {
  const api = () => toValue(options.api ?? editorialContractApi)
  const { lifecycle } = editor
  const fetched = shallowRef<EditorialReadiness | null>(null)
  const readinessFailed = shallowRef(false)
  const forbidden = shallowRef(false)
  const publishing = shallowRef(false)
  const message = shallowRef<string | null>(null)
  const publishedAt = shallowRef<Date | null>(null)
  let inflight: { snapshot: EditorialContractSnapshot; promise: Promise<void> } | null = null
  let controller: AbortController | null = null
  let vocabularyRetried = false
  let disposed = false

  const readiness = computed(() => {
    const snapshot = lifecycle.snapshot.value
    const value = fetched.value
    return value && snapshot && isEditorialReadinessCurrent(value, snapshot.state.state, snapshot.state.vocabularyRevision) ? value : null
  })
  /** «No saved draft» is what a publish leaves behind: the published state, not a pending item. */
  const noDraft = computed(() => Boolean(readiness.value && isEditorialNoDraftReadiness(readiness.value)))
  const checklist = computed<readonly EditorialReadinessItem[]>(() => (readiness.value && !noDraft.value ? readiness.value.items : []))
  // Distinct fields, not items: `bySection` counts items, and one field may have several.
  const sectionCounts = computed(() => (readiness.value && !noDraft.value ? editorialReadinessSectionCounts(checklist.value) : null))
  const missingFields = computed(() => countEditorialReadinessFields(checklist.value))
  const status = computed(() => {
    const state = lifecycle.authoritative.value
    return state ? editorialPublicationStatus(state, publishedAt.value) : null
  })
  const visible = computed(() => lifecycle.canPublish.value && !forbidden.value)
  const canPublish = computed(() => visible.value && !publishing.value && readiness.value?.ready === true && editor.canPublish.value)
  const retryable = computed(() => lifecycle.pendingIntent.value?.kind === 'publish' && lifecycle.outcome.value === 'ambiguous' && !publishing.value)
  const refreshChoice = () => (editor.hasUnsavedChanges.value ? 'retain' : 'discard') as 'retain' | 'discard'

  function loadReadiness(force = false): Promise<void> {
    const snapshot = lifecycle.snapshot.value
    if (!snapshot || !lifecycle.canRead.value || disposed) { inflight = null; return Promise.resolve() }
    if (!force && inflight?.snapshot === snapshot) return inflight.promise
    controller?.abort()
    const abort = new AbortController(); controller = abort
    const stale = () => disposed || abort.signal.aborted || lifecycle.snapshot.value !== snapshot
    readinessFailed.value = false
    const promise = (async () => {
      try {
        const value = await api().getReadiness(toValue(options.productId), snapshot.state.vocabularyRevision, abort.signal)
        if (stale()) return
        fetched.value = value; vocabularyRetried = false
      } catch (failure) {
        if (stale()) return
        fetched.value = null
        // The vocabulary moved: install the new pair once, which reads readiness again with the new R.
        if (failure instanceof EditorialContractApiError && failure.code === 'VOCABULARY_CHANGED' && !vocabularyRetried) {
          vocabularyRetried = true
          await editor.refresh(refreshChoice(), { quiet: true })
          return
        }
        readinessFailed.value = true
      }
    })()
    inflight = { snapshot, promise }
    return promise
  }
  watch(() => lifecycle.snapshot.value, () => { void loadReadiness() }, { immediate: true, flush: 'sync' })
  watch(() => toValue(options.productId), () => {
    forbidden.value = false; message.value = null; publishedAt.value = null; fetched.value = null; vocabularyRetried = false
  })
  watch(editor.hasUnsavedChanges, dirty => { if (dirty) message.value = null })
  onScopeDispose(() => { disposed = true; controller?.abort() })

  async function published() {
    publishedAt.value = new Date()
    options.notify('Publicado.')
    // An acknowledged publish installs nothing: read the state (and with it readiness) once.
    await editor.refresh('discard', { quiet: true })
    return true
  }
  async function refused(confirmation: Confirmation, mayRetryVocabulary: boolean): Promise<boolean> {
    const error = lifecycle.error.value
    if (lifecycle.outcome.value === 'ambiguous' || !error) { message.value = MESSAGES.ambiguous; return false }
    lifecycle.dismissRejection()
    const snapshot = lifecycle.snapshot.value
    if (error.status === 400 && error.readiness && snapshot) {
      const state = snapshot.state.state
      fetched.value = { ready: false, cycle: state.cycle, draftRevision: state.draft?.revision ?? null,
        vocabularyRevision: snapshot.state.vocabularyRevision, ...error.readiness }
      message.value = MESSAGES.notReady
    } else if (error.status === 400) {
      message.value = confirmation === 'review-v1' || lifecycle.authoritative.value?.draft?.document.familyCode === 'care' ? MESSAGES.careMissing : MESSAGES.request
    } else if (error.status === 403) {
      forbidden.value = true; message.value = MESSAGES.forbidden
    } else if (error.code === 'VOCABULARY_CHANGED') {
      await editor.refresh(refreshChoice(), { quiet: true })
      if (mayRetryVocabulary) {
        // A new user attempt: a new key and the current cycle/revision, once.
        await loadReadiness()
        if (canPublishAgain()) return attempt(confirmation, false)
      }
      message.value = MESSAGES.vocabulary
    } else if (error.status === 409) {
      await editor.refresh(refreshChoice(), { quiet: true })
      message.value = MESSAGES.conflict
    } else {
      message.value = editorialErrorMessage(error.status)
    }
    return false
  }
  const canPublishAgain = () => visible.value && readiness.value?.ready === true && editor.canPublish.value
  async function attempt(confirmation: Confirmation, mayRetryVocabulary: boolean): Promise<boolean> {
    publishing.value = true; message.value = null
    try {
      return (await editor.publish(confirmation)) ? await published() : await refused(confirmation, mayRetryVocabulary)
    } finally { publishing.value = false }
  }
  async function publish(): Promise<boolean> {
    if (!canPublish.value) return false
    const care = lifecycle.authoritative.value?.draft?.document.familyCode === 'care'
    if (care && !(await options.confirmCare())) return false
    // The answer may come after the state changed.
    if (!canPublish.value) return false
    return attempt(care ? 'review-v1' : null, true)
  }
  /** Retransmits the ambiguous attempt: the same key, body and headers. */
  async function retry(): Promise<boolean> {
    if (!retryable.value) return false
    const confirmation = lifecycle.pendingIntent.value!.confirmation
    publishing.value = true; message.value = null
    try {
      return (await editor.retransmit()) ? await published() : await refused(confirmation, false)
    } finally { publishing.value = false }
  }
  async function reload() {
    await editor.refresh(refreshChoice())
    await loadReadiness()
  }

  return { readiness, readinessFailed, noDraft, checklist, sectionCounts, missingFields, status, visible, canPublish, publishing, retryable,
    message, publishedAt, publish, retry, reload, reloadReadiness: () => loadReadiness(true) }
}
