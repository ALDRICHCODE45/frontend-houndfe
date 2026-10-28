import { computed, onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { editorialApi, EditorialApiError } from '../api/product-editorial.api'
import type { EditorialContext, EditorialDocument, EditorialVocabulary } from '../interfaces/product-editorial.types'
import { decodeEditorialDocument } from '../utils/product-editorial-document'
import { validateEditorialAssignments, type EditorialAssignmentIssue } from '../utils/product-editorial-assignment-validation'
import { useEditorialDraft } from './useEditorialDraft'

const metadataProbe: EditorialDocument = {
  commercialTitle: null, description: null, familyCode: null, mediaRefs: [], values: [],
}
export function editorialIssueMessage(issue: EditorialAssignmentIssue): string {
  const messages: Record<EditorialAssignmentIssue['code'], string> = {
    structure: 'Revisa el formato del contenido.', limits: 'El contenido supera los límites de guardado (200 caracteres de título, 20,000 de descripción, 20 medios, 200 atributos o 100 kB por solicitud).',
    metadata: 'No se pudieron validar los metadatos editoriales.', baseline: 'El borrador guardado no se puede interpretar.',
    family: 'La familia ya no está disponible.', binding: 'El atributo ya no corresponde a esta familia o cambió de tipo.',
    variant: 'La presentación guardada ya no está disponible en el contexto actual.', unit: 'Selecciona una unidad disponible.',
    option: 'Una opción guardada ya no está disponible.', archived: 'No se pueden introducir opciones archivadas fuera de su asignación guardada.',
    media: 'Las referencias de medios deben conservarse sin cambios.',
  }
  return messages[issue.code]
}
export function editorialErrorMessage(status: number | null): string {
  switch (status) {
    case 400: return 'El servidor no aceptó el contenido. Conservamos tus cambios locales; revisa los campos y el estado del historial.'
    case 401: return 'Tu sesión ya no permite esta operación. Vuelve a iniciar sesión.'
    case 403: return 'No tienes acceso al contenido editorial de este producto.'
    case 404: return 'No se encontró contenido editorial para este producto.'
    case 409: return 'No se confirmó el cambio por un conflicto. Consulta el estado actual y decide si conservas o descartas tus cambios.'
    case 413: return 'La solicitud supera el tamaño permitido. Tus cambios locales se conservan; consulta el estado antes de otra acción.'
    default: return 'No se pudo confirmar la operación. Tus cambios locales se conservan. Consulta el estado o retransmite la misma solicitud si está disponible.'
  }
}

/** Owns scoped reads only. T3 owns all write intent/replay state; T4a owns qualification. */
export function useEditorialEditor(productId: MaybeRefOrGetter<string>) {
  const auth = useAuthStore()
  const context = computed(() => ({
    authenticated: auth.isAuthenticated && auth.authPhase === 'authenticated',
    userId: auth.user?.id ?? null, tenantId: auth.currentTenant?.id ?? null,
    productId: toValue(productId), permissionsLoaded: auth.permissionsLoaded,
    permissionCodes: auth.permissionCodes,
  }))
  const lifecycle = useEditorialDraft(context)
  const identity = computed(() => JSON.stringify(context.value))
  const vocabulary = shallowRef<EditorialVocabulary | null>(null)
  const qualification = shallowRef<EditorialContext | null>(null)
  const loading = shallowRef(false)
  const readError = shallowRef<string | null>(null)
  const metadataMessage = shallowRef<string | null>(null)
  const issues = shallowRef<EditorialAssignmentIssue[]>([])
  let generation = 0
  let disposed = false

  async function refresh(choice: 'retain' | 'discard') {
    if (loading.value || lifecycle.isPending.value || !lifecycle.canRead.value) return false
    const ticket = lifecycle.beginSnapshotRead()
    if (!ticket) return false
    const currentGeneration = generation
    const current = () => !disposed && generation === currentGeneration && lifecycle.canRead.value
    const requestedProduct = context.value.productId
    loading.value = true
    readError.value = null
    // No cached authority is reused while a refresh is outstanding or fails.
    vocabulary.value = null
    qualification.value = null
    metadataMessage.value = null
    const [stateResult, vocabularyResult, contextResult] = await Promise.allSettled([
      editorialApi.getState(requestedProduct), editorialApi.getVocabulary(), editorialApi.getContext(requestedProduct),
    ])
    if (!current()) return false
    if (stateResult.status === 'fulfilled') {
      if (!lifecycle.reconcileSnapshot(ticket, stateResult.value, choice)) {
        readError.value = 'No se pudo consultar un estado editorial válido. El historial y los cambios locales no se normalizan.'
      }
    } else {
      readError.value = stateResult.reason instanceof EditorialApiError && [401, 403, 404].includes(stateResult.reason.status ?? 0)
        ? editorialErrorMessage(stateResult.reason.status)
        : 'No se pudo consultar el contenido editorial. Puedes actualizar para intentar de nuevo.'
    }
    // Reuse the closed T4a metadata schemas, without testing historical documents
    // against fresh-save limits or replacing failed authority with an empty catalog.
    if (vocabularyResult.status === 'fulfilled' && contextResult.status === 'fulfilled' &&
      validateEditorialAssignments({ document: metadataProbe, persistedBaseline: metadataProbe,
        vocabulary: vocabularyResult.value, context: contextResult.value }).valid) {
      vocabulary.value = vocabularyResult.value
      qualification.value = contextResult.value
    } else metadataMessage.value = 'No se pudieron cargar metadatos editoriales válidos. La edición y el guardado están deshabilitados; puedes volver a consultar.'
    issues.value = []
    loading.value = false
    return !readError.value
  }
  watch(identity, () => {
    generation++
    vocabulary.value = null
    qualification.value = null
    readError.value = null
    metadataMessage.value = null
    issues.value = []
    loading.value = false
    if (lifecycle.canRead.value) void refresh('discard')
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; generation++ }, true)

  const sections = computed(() => {
    if (!lifecycle.canRead.value || readError.value) return []
    return (['draft', 'published'] as const).map(key => {
      const entry = lifecycle.authoritative.value?.[key]
      return { key, label: key === 'draft' ? 'Borrador' : 'Publicado', revision: entry?.revision ?? null,
        decoded: entry ? decodeEditorialDocument(entry.document) : null }
    })
  })
  const readableDraft = computed(() => sections.value.some(section => section.key === 'draft' && section.decoded?.readable))
  const metadataReady = computed(() => Boolean(vocabulary.value && qualification.value))
  const editable = computed(() => lifecycle.canWrite.value && metadataReady.value && readableDraft.value &&
    !loading.value && !readError.value && !lifecycle.isPending.value)
  const canSave = computed(() => editable.value && lifecycle.pendingIntent.value === null && lifecycle.buffer.value !== null)
  const canInitialize = computed(() => lifecycle.canWrite.value && metadataReady.value && !loading.value &&
    !readError.value && lifecycle.authoritative.value?.draft === null && !lifecycle.pendingIntent.value && !lifecycle.isPending.value)
  function replaceDocument(document: EditorialDocument) {
    if (!editable.value) return
    lifecycle.buffer.value = document
    issues.value = []
  }
  async function save() {
    if (!canSave.value) return false
    const validation = validateEditorialAssignments({ document: lifecycle.buffer.value,
      persistedBaseline: lifecycle.authoritative.value?.draft?.document,
      vocabulary: vocabulary.value, context: qualification.value })
    issues.value = validation.issues
    return validation.valid ? lifecycle.save() : false
  }
  async function initialize() { return canInitialize.value ? lifecycle.initialize() : false }
  async function retransmit() {
    return lifecycle.canWrite.value && metadataReady.value && !loading.value && !readError.value
      ? lifecycle.retransmit() : false
  }
  const errorMessage = computed(() => !lifecycle.canRead.value
    ? 'No tienes acceso al contenido editorial en el contexto actual.' : readError.value)
  return { lifecycle, vocabulary, qualification, loading, errorMessage, metadataMessage,
    issues, sections, editable, canSave, canInitialize, replaceDocument, refresh, initialize, save, retransmit }
}
