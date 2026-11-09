import { computed, onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { editorialContractApi, EditorialContractApiError } from '../api/editorial-contract.api'
import { loadEditorialContractSnapshot } from '../utils/editorial-contract-snapshot'
import type { EditorialDocumentEditingState } from '../utils/editorial-contract-document-editing'
import type { EditorialRuntimeIssue } from '../utils/editorial-contract-publication-checks'
import { useEditorialDraft } from './useEditorialDraft'

export function editorialIssueMessage(issue: EditorialRuntimeIssue): string {
  if (issue.code === 'title') return 'Agrega un título comercial editorial y guarda el borrador antes de publicar.'
  if (issue.code === 'media') return 'El borrador tiene referencias de medios. Por ahora no se pueden publicar medios ni quitarlos desde este editor; descarta el borrador guardado para salir de este estado.'
  if (issue.code === 'INCOMPLETE_INPUT') return 'Completa o corrige los campos y las evidencias antes de guardar.'
  if (issue.code === 'FACTS_CAPTURE') return 'Revisa la captura de hechos, declaraciones y cuidado.'
  if (issue.code === 'NUMERIC_POLICY_PENDING') return 'La política numérica está pendiente; no se puede publicar este valor.'
  if (issue.code === 'TITLE_LIMIT') return 'El título es demasiado largo. El máximo es 200 caracteres.'
  if (issue.code === 'DESCRIPTION_LIMIT') return 'La descripción es demasiado larga. El máximo es 20,000 caracteres.'
  if (issue.code === 'EVIDENCE') return 'La evidencia necesita una fuente y una fecha válida.'
  if (issue.code === 'RANGE_ORDER') return 'El mínimo no puede ser mayor que el máximo.'
  if (issue.code === 'NUMERIC_INTEGER') return 'Este dato debe ser un número entero.'
  if (issue.code === 'NUMERIC_BOUNDS') return 'El valor está fuera del rango permitido.'
  if (issue.code === 'NA_NOT_ALLOWED') return 'Este dato no admite «No aplica».'
  if (issue.code === 'DUPLICATE_VALUE') return 'Este dato está repetido.'
  if (issue.code.includes('ARCHIVED')) return 'Un atributo usa una opción archivada fuera de su asignación guardada. Corrígela antes de continuar.'
  return `Revisa el contenido editorial (${issue.code}).`
}
export function editorialErrorMessage(status: number | null): string {
  switch (status) {
    case 400: return 'El servidor no aceptó el contenido. Tus cambios siguen aquí; revisa los datos marcados.'
    case 401: return 'Tu sesión ya no permite esta operación. Vuelve a iniciar sesión.'
    case 403: return 'No tienes acceso al contenido editorial de este producto.'
    case 404: return 'No se encontró contenido editorial para este producto.'
    case 409: return 'Alguien más guardó cambios. Carga la versión más reciente para continuar.'
    case 413: return 'La ficha es demasiado grande para guardarla. Tus cambios siguen aquí.'
    default: return 'No pudimos confirmar si se guardó. Tus cambios siguen aquí.'
  }
}

/** 409 EDITORIAL_STATE_UNREADABLE: the stored state is not V2. Retrying cannot help; only a backend repair does. */
export const EDITORIAL_STATE_UNREADABLE_TITLE = 'No pudimos leer el contenido guardado de este producto.'
export const EDITORIAL_STATE_UNREADABLE_ACTION = 'Avísale a soporte para repararlo.'
export const EDITORIAL_STATE_UNREADABLE_MESSAGE = `${EDITORIAL_STATE_UNREADABLE_TITLE} ${EDITORIAL_STATE_UNREADABLE_ACTION}`
export const isEditorialStateUnreadable = (failure: unknown) =>
  failure instanceof EditorialContractApiError && failure.code === 'EDITORIAL_STATE_UNREADABLE'

/** Scoped read orchestration; the raw owner installs exactly one coherent pair. */
export function useEditorialEditor(productId: MaybeRefOrGetter<string>, api: MaybeRefOrGetter<typeof editorialContractApi> = editorialContractApi) {
  const auth = useAuthStore()
  const context = computed(() => ({ authenticated: auth.isAuthenticated && auth.authPhase === 'authenticated',
    userId: auth.user?.id ?? null, tenantId: auth.currentTenant?.id ?? null, productId: toValue(productId),
    permissionsLoaded: auth.permissionsLoaded, permissionCodes: auth.permissionCodes, isSuperAdmin: auth.isSuperAdmin }))
  const lifecycle = useEditorialDraft(context, api)
  const vocabulary = computed(() => lifecycle.snapshot.value?.vocabulary.vocabulary ?? null)
  const qualification = computed(() => lifecycle.snapshot.value?.context ?? null)
  const loading = shallowRef(false)
  const readError = shallowRef<string | null>(null)
  /** HTTP status of the failed read (404 → not found, 401/403 → forbidden), else null. */
  const readStatus = shallowRef<number | null>(null)
  /** The failed read was EDITORIAL_STATE_UNREADABLE: show it without Reintentar. */
  const readUnreadable = shallowRef(false)
  /** A read that follows an acknowledged write failed: the write stands, only the view is out of date. */
  const staleView = shallowRef(false)
  const metadataMessage = computed(() => readError.value ? 'No se pudieron cargar metadatos editoriales coherentes. Vuelve a consultar.' : null)
  let generation = 0
  let controller: AbortController | null = null
  let disposed = false
  /** `quiet` is for the read that follows an acknowledged write: a failure leaves the editor in place
   * and marks the view stale, instead of replacing the page with a read error. Refusals stay refusals. */
  async function refresh(choice: 'retain' | 'discard', options: { quiet?: boolean } = {}) {
    if (loading.value || lifecycle.isPending.value || !lifecycle.canRead.value || disposed) return false
    const ticket = lifecycle.beginSnapshotRead()
    if (!ticket) return false
    const requestedGeneration = generation
    const requestedApi = toValue(api)
    const requestedProduct = context.value.productId
    const abort = new AbortController(); controller = abort
    const current = () => !disposed && generation === requestedGeneration && requestedApi === toValue(api) && !abort.signal.aborted && lifecycle.canRead.value
    loading.value = true; readError.value = null; readStatus.value = null; readUnreadable.value = false
    try {
      const snapshot = await loadEditorialContractSnapshot(requestedApi, requestedProduct, abort.signal)
      if (!current()) return false
      if (!lifecycle.reconcileSnapshot(ticket, snapshot, choice)) throw new Error('Invalid editorial snapshot')
      staleView.value = false
      return true
    } catch (failure) {
      if (!current()) return false
      lifecycle.cancelSnapshotRead(ticket)
      const unreadable = isEditorialStateUnreadable(failure)
      const refused = failure instanceof EditorialContractApiError && [401, 403, 404].includes(failure.status ?? 0)
      if (options.quiet && !refused && !unreadable) { staleView.value = true; return false }
      readStatus.value = failure instanceof EditorialContractApiError ? failure.status : null
      readUnreadable.value = unreadable
      readError.value = unreadable ? EDITORIAL_STATE_UNREADABLE_MESSAGE : refused
        ? editorialErrorMessage(readStatus.value) : 'No se pudo consultar el contenido editorial coherente. Puedes actualizar para intentar de nuevo.'
      return false
    } finally { if (current()) { loading.value = false; controller = null } }
  }
  watch([() => JSON.stringify(context.value), () => toValue(api)], () => {
    generation++; controller?.abort(); controller = null; readError.value = null; readStatus.value = null; readUnreadable.value = false; staleView.value = false; loading.value = false
    if (lifecycle.canRead.value) void refresh('discard')
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; generation++; controller?.abort(); loading.value = false; readError.value = null }, true)
  const sections = computed(() => !lifecycle.canRead.value || readError.value ? [] : (['draft', 'published'] as const).map(key => {
    const entry = lifecycle.authoritative.value?.[key]
    return { key, label: key === 'draft' ? 'Borrador' : 'Publicado', revision: entry?.revision ?? null, document: entry?.document ?? null }
  }))
  const editable = computed(() => lifecycle.canWrite.value && Boolean(vocabulary.value && qualification.value && lifecycle.authoritative.value?.draft) && !loading.value && !readError.value && !lifecycle.isPending.value)
  const canSave = computed(() => editable.value && !lifecycle.pendingIntent.value && Boolean(lifecycle.buffer.value))
  const canInitialize = computed(() => lifecycle.canWrite.value && Boolean(vocabulary.value && qualification.value) && !loading.value && !readError.value && lifecycle.authoritative.value?.draft === null && !lifecycle.pendingIntent.value && !lifecycle.isPending.value)
  function replaceDocument(document: EditorialDocumentEditingState) { if (editable.value) { lifecycle.buffer.value = document; lifecycle.issues.value = [] } }
  const canPublish = computed(() => !loading.value && !readError.value && lifecycle.canPublishDraft.value)
  const canDiscard = computed(() => !loading.value && !readError.value && lifecycle.canDiscard.value)
  const canUnpublish = computed(() => !loading.value && !readError.value && lifecycle.canUnpublish.value)
  // Retransmission uses only captured intent and current grants, not fresh candidate
  // admission or current metadata. A failed read cannot rewrite the original R/token.
  async function retransmit() { return !loading.value ? lifecycle.retransmit() : false }
  const errorMessage = computed(() => !lifecycle.canRead.value ? 'No tienes acceso al contenido editorial en el contexto actual.' : readError.value)
  return { lifecycle, vocabulary, qualification, loading, errorMessage, readStatus, readUnreadable, staleView, metadataMessage, issues: lifecycle.issues,
    sections, editable, canSave, canInitialize, canPublish, canDiscard, canUnpublish, publishIssues: lifecycle.publishIssues, hasUnsavedChanges: lifecycle.hasUnsavedChanges,
    replaceDocument, refresh, retransmit, save: () => canSave.value ? lifecycle.save() : Promise.resolve(false),
    initialize: () => canInitialize.value ? lifecycle.initialize() : Promise.resolve(false),
    publish: (confirmation: 'review-v1' | null = null) => canPublish.value ? lifecycle.publish(confirmation) : Promise.resolve(false),
    discard: () => canDiscard.value ? lifecycle.discard() : Promise.resolve(false),
    unpublish: () => canUnpublish.value ? lifecycle.unpublish() : Promise.resolve(false) }
}
