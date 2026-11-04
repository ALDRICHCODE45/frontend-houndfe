<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EditorialPublication from './EditorialPublication.vue'
import { useEditorialEditor, editorialErrorMessage, editorialIssueMessage } from '../../composables/useEditorialEditor'
import EditorialContractDocumentFields from './EditorialContractDocumentFields.vue'
import EditorialContractHistory from './EditorialContractHistory.vue'
import { inspectEditorialDocumentReferences } from '../../utils/editorial-contract-document-references'
import { qualifyEditorialConservationBaseline } from '../../utils/editorial-contract-conservation'
import '@/core/shared/design-system/houndfe-ui.css'
const props = defineProps<{
  productId: string
  embedded?: boolean
  activeSection?: 'content' | 'review'
  /** Label of the way back shown when the content is not found; omit for none. */
  backLabel?: string
}>()
const emit = defineEmits<{ back: [] }>()
defineSlots<{
  summary?(props: {
    title: string | null | undefined; draftRevision: number | null; publishedRevision: number | null
    dirty: boolean; acknowledged: boolean
  }): unknown
}>()
const editor = useEditorialEditor(() => props.productId)
const { lifecycle, vocabulary, qualification, loading, errorMessage, readStatus, metadataMessage, sections, issues, editable, canSave, canInitialize } = editor
const { authoritative, buffer, canRead, canWrite, isPending, receipt, outcome, error, pendingIntent } = lifecycle
const { canPublish, canDiscard, publishIssues, hasUnsavedChanges } = editor
const publishPermission = lifecycle.canPublish
// Standalone workspace mounts have no router; routed views register the leave guard.
if (getCurrentInstance()?.appContext.config.globalProperties.$router) {
  onBeforeRouteLeave(() => !hasUnsavedChanges.value || window.confirm('Tienes cambios sin guardar en el borrador editorial. ¿Salir sin guardarlos?'))
}
function preventUnload(event: BeforeUnloadEvent) { event.preventDefault() }
watch(hasUnsavedChanges, dirty => {
  if (dirty) window.addEventListener('beforeunload', preventUnload)
  else window.removeEventListener('beforeunload', preventUnload)
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => window.removeEventListener('beforeunload', preventUnload))
const retransmitAllowed = computed(() => pendingIntent.value?.kind === 'publish'
  ? publishPermission.value : canWrite.value && (pendingIntent.value?.kind === 'discard' || Boolean(vocabulary.value && qualification.value)))
const discardPending = shallowRef(false)
watch(() => [props.productId, authoritative.value], () => { discardPending.value = false })
watch(canRead, () => { discardPending.value = false }, { flush: 'sync' })
const subjects = computed(() => qualification.value?.variants.length
  ? qualification.value.variants.map(variant => ({ variantId: variant.id, label: variant.name }))
  : [{ variantId: null, label: 'Sin presentación' }])
const invalidHistoryContext = computed(() => vocabulary.value && qualification.value && sections.value.some(section => section.document &&
  inspectEditorialDocumentReferences({ document: section.document, vocabulary: vocabulary.value!, context: qualification.value! }).length > 0))
// Display admission uses only the entire reference-qualified saved Draft, never
// a previous local selection, encoded candidate or acknowledgement document.
const assignmentFeedback = computed(() => {
  const feedback = new Map<string, { conservedOptions: readonly string[] }>()
  if (!vocabulary.value || !qualification.value || !buffer.value) return feedback
  const baseline = qualifyEditorialConservationBaseline(authoritative.value?.draft?.document, vocabulary.value, qualification.value)
  if (!baseline || baseline.familyCode !== buffer.value.familyCode) return feedback
  for (const row of buffer.value.values) {
    const previous = baseline.values.find(value => value.code === row.target.code && value.owner === row.target.owner && value.variantId === row.target.variantId)
    if (previous?.state !== 'known') continue
    const payload = previous.payload
    if (payload.type === 'single' || payload.type === 'multi') feedback.set(row.id, { conservedOptions: payload.type === 'single' ? [payload.value] : payload.value })
  }
  return feedback
})
const warnings = computed(() => (receipt.value?.state.warnings ?? []).map(warning => {
  const family = vocabulary.value?.families.find(item => item.id === warning.familyId)
  const definition = vocabulary.value?.definitions.find(item => item.id === warning.definitionId)
  const option = definition && (definition.type === 'single' || definition.type === 'multi')
    ? definition.options.find(item => item.code === warning.optionCode) : null
  const variant = qualification.value?.variants.find(item => item.id === warning.variantId)
  const bounded = (text: string) => text.slice(0, 80)
  return `${family?.label ?? 'Familia no disponible'} · ${definition?.label ?? 'Atributo no disponible'} · ${option?.label ?? bounded(warning.optionCode)} · ${warning.owner === 'product' ? 'Producto' : variant ? `${variant.name} · ${variant.id.slice(0, 8)}` : warning.variantId ? `Presentación ${bounded(warning.variantId)}` : 'Sin presentación'}`
}))
// Not found, refused and failed reads are three different states (S10).
const notFound = computed(() => Boolean(errorMessage.value) && readStatus.value === 404)
const forbidden = computed(() => !canRead.value || readStatus.value === 401 || readStatus.value === 403)
// Not found and a failed read carry their own action (way back, Reintentar); a refused read
// keeps the header refresh, the only way to look again after access changes.
const showHeaderActions = computed(() => !errorMessage.value || forbidden.value)
const refreshLabel = computed(() => {
  if (!canWrite.value) return 'Actualizar contenido'
  return buffer.value ? 'Consultar y conservar cambios' : 'Consultar y cargar borrador'
})
async function refreshFromHeader() {
  // With no local buffer there are no edits to discard. Loading still requires
  // this explicit user action and a fresh GET, never the historical receipt.
  await editor.refresh(canWrite.value && buffer.value === null ? 'discard' : 'retain')
}
async function discard() { discardPending.value = false; await editor.refresh('discard') }
async function submit() { await editor.save() }
</script>

<template>
  <component :is="embedded ? 'section' : 'main'" class="hf-theme hf-ui editorial-workspace" aria-labelledby="editorial-workspace-title">
    <div class="editorial-content">
    <!-- Embedded under the product title the heading is for assistive tech only: two stacked titles repeat the Contenido tab. -->
    <h2 v-if="embedded" id="editorial-workspace-title" class="sr-only">Contenido editorial</h2>
    <header v-if="!embedded || showHeaderActions" class="hf-page-header editorial-header">
      <div v-if="!embedded" class="editorial-heading">
        <h1 id="editorial-workspace-title" class="hf-page-title">Contenido editorial</h1>
      </div>
      <div v-if="showHeaderActions" class="editorial-actions">
        <button class="editorial-button" type="button" data-testid="refresh-retain" :disabled="!canRead || loading || isPending" @click="refreshFromHeader">{{ refreshLabel }}</button>
        <button v-if="canWrite && buffer" class="editorial-button" type="button" data-testid="refresh-discard" :disabled="loading || isPending" @click="discardPending = true">Consultar y descartar cambios…</button>
        <button v-if="canWrite && buffer" class="hf-primary-control" type="submit" form="editorial-form" :disabled="!canSave">{{ isPending ? 'Enviando…' : 'Guardar borrador' }}</button>
      </div>
    </header>
    <p v-if="!canWrite" class="editorial-notice">Solo consulta. Para editar necesitas acceso de administrador en el tenant seleccionado o permisos editoriales de lectura y actualización.</p>
    <div v-if="discardPending && canRead" role="group" aria-labelledby="discard-title" class="editorial-panel confirmation">
      <h2 id="discard-title">Descartar cambios locales y consultar</h2><p>El borrador local se reemplazará con el resultado de una nueva consulta. Esta acción no envía cambios al servidor.</p>
      <div class="editorial-actions"><button type="button" class="editorial-button" data-testid="cancel-discard" @click="discardPending = false">Cancelar</button><button type="button" class="editorial-button" data-testid="confirm-discard" :disabled="loading || isPending" @click="discard">Descartar cambios y consultar</button></div>
    </div>
    <EmptyState
      v-if="notFound"
      title="No encontramos el contenido editorial"
      description="El producto no existe o ya no tienes acceso a él."
      :action-label="backLabel"
      action-icon="i-lucide-arrow-left"
      @action="emit('back')"
    />
    <EmptyState
      v-else-if="errorMessage && forbidden"
      kind="forbidden"
      :title="errorMessage"
    />
    <EmptyState
      v-else-if="errorMessage"
      kind="error"
      title="No se pudo cargar el contenido editorial"
      description="Inténtalo de nuevo en un momento."
      action-label="Reintentar"
      @action="refreshFromHeader"
    />
    <template v-else>
      <div v-if="loading" role="status" class="editorial-loading" data-testid="editorial-skeleton" aria-busy="true">
        <span class="sr-only">{{ authoritative ? 'Actualizando contenido editorial…' : 'Cargando contenido editorial…' }}</span>
        <template v-if="!authoritative">
          <div class="editorial-skeleton-panel" data-skeleton="section">
            <div class="editorial-skeleton-bar animate-pulse h-4 w-40" />
            <div class="editorial-skeleton-bar animate-pulse h-11 w-full" data-skeleton="field" />
            <div class="editorial-skeleton-bar animate-pulse h-28 w-full" data-skeleton="field" />
          </div>
          <div class="editorial-skeleton-panel" data-skeleton="section">
            <div class="editorial-skeleton-bar animate-pulse h-4 w-32" />
            <div class="editorial-skeleton-bar animate-pulse h-11 w-full" />
            <div class="editorial-skeleton-bar animate-pulse h-11 w-full" />
          </div>
        </template>
      </div>
      <p v-if="metadataMessage" role="alert" class="editorial-panel warning">{{ metadataMessage }}</p>
      <div v-if="outcome || receipt" class="editorial-panel" aria-live="polite">
        <template v-if="outcome === 'acknowledged' || receipt">
          <h2>Acuse histórico{{ outcome === 'acknowledged' ? ' · solicitud confirmada' : ' · solicitud anterior' }}</h2>
          <p>Este acuse no representa el estado actual.</p>
          <p v-if="outcome === 'acknowledged' && pendingIntent?.kind === 'publish'">Solicitud de publicación confirmada.</p>
          <p v-if="outcome === 'acknowledged' && pendingIntent?.kind === 'discard'">Solicitud para descartar el borrador confirmada.</p>
          <p v-if="pendingIntent">Haz una consulta explícita y elige conservar o descartar los cambios antes de una nueva acción.</p>
          <p v-else>El estado de la consulta explícita se muestra por separado.</p>
          <p v-for="(warning, index) in warnings" :key="index" class="warning">Opción archivada conservada: {{ warning }}</p>
        </template>
        <p v-if="error" role="alert">{{ editorialErrorMessage(error.status) }}</p>
        <button v-if="outcome === 'ambiguous' && pendingIntent" type="button" class="editorial-button" :disabled="!retransmitAllowed || isPending || loading" @click="editor.retransmit()">Retransmitir la misma solicitud (mismo contenido y clave)</button>
        <p v-if="outcome === 'conflict'">No se reenvía automáticamente. Usa las opciones de consulta para reconciliar el borrador.</p>
      </div>
      <template v-if="authoritative">
        <EditorialPublication v-if="canRead && (canWrite || publishPermission)" v-show="activeSection !== 'content'" :state="authoritative"
          :publication-available="false" :can-write="canWrite" :publish-permission="publishPermission" :can-publish="canPublish" :can-discard="canDiscard"
          :has-unsaved-changes="hasUnsavedChanges" :publish-issues="publishIssues" :busy="loading || isPending"
          :needs-reconciliation="Boolean(pendingIntent)" :vocabulary="vocabulary" :context="qualification" @discard="editor.discard()" />
        <EmptyState
          v-if="!authoritative.draft"
          :title="authoritative.published ? 'La versión publicada sigue intacta' : 'Aún no hay contenido editorial'"
          :description="authoritative.published ? 'Inicia un borrador a partir de ella para editarla.' : 'Crea un borrador para empezar a escribirlo.'"
          :action-label="canWrite ? (authoritative.published ? 'Iniciar borrador desde lo publicado' : 'Iniciar borrador') : undefined"
          action-icon="i-lucide-file-plus"
          action-variant="solid"
          action-test-id="initialize"
          :action-loading="isPending"
          @action="canInitialize && editor.initialize()"
        />
        <p v-if="invalidHistoryContext" role="status" class="editorial-panel warning">Historial con atributos o contexto no disponibles. Se conserva intacto. Quita o corrige esos atributos en el borrador para poder guardarlo.</p>
        <div v-if="canWrite && buffer && issues.length" role="alert" class="editorial-panel warning"><p>Revisa el contenido antes de guardar. Puedes corregirlo en Contenido.</p><ul><li v-for="(issue, index) in issues" :key="index">{{ issue.valueIndex === undefined ? '' : `Atributo ${issue.valueIndex + 1}: ` }}{{ editorialIssueMessage(issue) }}</li></ul></div>
        <form v-if="canWrite && buffer && vocabulary && qualification" v-show="activeSection !== 'review'" id="editorial-form" class="editorial-form" aria-label="Editar borrador editorial" novalidate @submit.prevent="submit">
          <EditorialContractDocumentFields id="editorial" :model-value="buffer" :vocabulary="vocabulary" :subjects="subjects" :next-id="lifecycle.nextId" :assignment-feedback="assignmentFeedback" :disabled="!editable" @update:model-value="editor.replaceDocument" />
          <p class="editorial-context">Sin guardado automático. Guardar no publica el contenido. El servidor valida el contenido y el contexto final.</p>
        </form>
        <div v-show="activeSection !== 'content' || !canWrite" class="editorial-state" :aria-busy="loading">
          <section v-for="section in sections" :key="section.key" class="editorial-panel" :aria-labelledby="`editorial-${section.key}`">
            <header class="editorial-section-header"><h2 :id="`editorial-${section.key}`">{{ section.label }}{{ canWrite ? ' · historial consultado' : '' }}</h2><span v-if="section.revision !== null" class="editorial-context">Revisión {{ section.revision }}</span></header>
            <p v-if="!section.document">{{ section.key === 'draft' ? 'Sin borrador' : 'Sin versión publicada' }}</p>
            <EditorialContractHistory v-else :document="section.document" :vocabulary="vocabulary" :context="qualification" />
          </section>
        </div>
      </template>
    </template>
    </div>
    <slot v-if="canRead && authoritative && !errorMessage" name="summary"
      :title="authoritative.draft?.document.commercialTitle ?? authoritative.published?.document.commercialTitle"
      :draft-revision="authoritative.draft?.revision ?? null" :published-revision="authoritative.published?.revision ?? null"
      :dirty="hasUnsavedChanges" :acknowledged="outcome === 'acknowledged' || Boolean(receipt)" />
  </component>
</template>

<style scoped>
.editorial-content { display: contents; }
.editorial-workspace { display: flex; flex-direction: column; gap: 24px; color: var(--hf-ink); }
.editorial-workspace .editorial-header, .editorial-section-header { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.editorial-heading { flex: 1 1 320px; min-width: 0; }
.editorial-actions { display: flex; flex-wrap: wrap; gap: 12px; min-width: 0; margin-left: auto; }
.editorial-actions > button { flex: 1 1 auto; white-space: normal; }
.editorial-context, .editorial-notice, dt { color: var(--hf-muted); font-size: 14px; line-height: 1.5; }
.editorial-loading { display: grid; gap: 16px; min-width: 0; }
.editorial-skeleton-panel { display: grid; gap: 16px; padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); min-width: 0; }
.editorial-skeleton-bar { border-radius: var(--hf-radius-control); background: var(--hf-surface-muted); }
.editorial-notice { padding: 16px; border-left: 3px solid var(--hf-border); }
.editorial-panel { display: grid; gap: 12px; padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); overflow-wrap: anywhere; min-width: 0; }
.editorial-state, .editorial-form { display: grid; gap: 24px; min-width: 0; }
.editorial-panel h2 { font-size: 16px; font-weight: 600; color: var(--hf-heading); }
.editorial-details { margin-top: 16px; border-top: 1px solid var(--hf-border); }
.editorial-details summary { cursor: pointer; padding: 12px 0; min-height: 44px; color: var(--hf-heading); }
.editorial-details h3 { font-weight: 600; margin-top: 16px; }
.editorial-button { min-height: var(--hf-control-height); padding: 8px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); color: var(--hf-ink); font-family: var(--hf-font); font-size: 0.875rem; cursor: pointer; }
.editorial-button:hover:not(:disabled) { background: var(--hf-surface-muted); }
.editorial-button:disabled, .hf-primary-control:disabled { cursor: default; opacity: .65; }
.editorial-button:focus-visible, .editorial-details summary:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 3px; }
.warning { color: var(--hf-warning); }
.confirmation { background: var(--hf-warning-soft); }
@media (max-width: 480px) { .editorial-panel { padding: 16px; } .editorial-actions { width: 100%; } }
</style>
