<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useEditorialEditor, editorialErrorMessage, editorialIssueMessage } from '../../composables/useEditorialEditor'
import EditorialAttributeTable from './EditorialAttributeTable.vue'
import EditorialContractDocumentFields from './EditorialContractDocumentFields.vue'
import EditorialContractFactsList from './EditorialContractFactsList.vue'
import EditorialContractFamilyField from './EditorialContractFamilyField.vue'
import EditorialHistoryDrawer from './EditorialHistoryDrawer.vue'
import { toEditorialDocumentEditingState, type EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'
import { inspectEditorialDocumentReferences } from '../../utils/editorial-contract-document-references'
import { qualifyEditorialConservationBaseline } from '../../utils/editorial-contract-conservation'
import { projectEditorialDeclarationChoices } from '../../utils/editorial-contract-declaration-choices'
import { buildEditorialAttributeTable, editorialTargetKey } from '../../utils/editorial-attribute-table'
import { buildEditorialHistoryChanges } from '../../utils/editorial-history-diff'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import '@/core/shared/design-system/houndfe-ui.css'

/** The product's catalog content: a compact header, the document text, the table of the family's
 * data (rows) by product and presentation (columns), and the declarations folded under "Completar
 * para publicar". Same draft lifecycle, payload, conflicts and permissions as before; publication
 * stays unavailable.
 */
const props = defineProps<{
  productId: string
  embedded?: boolean
  /** Label of the way back shown when the content is not found; omit for none. */
  backLabel?: string
}>()
const emit = defineEmits<{ back: [] }>()
const editor = useEditorialEditor(() => props.productId)
const { lifecycle, vocabulary, qualification, loading, errorMessage, readStatus, staleView, metadataMessage, issues, editable, canSave, canInitialize, canDiscard, hasUnsavedChanges } = editor
const { authoritative, buffer, canRead, canWrite, isPending, receipt, outcome, error, pendingIntent } = lifecycle
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
const discardDraftOpen = shallowRef(false)
const historyOpen = shallowRef(false)
const onlyMissing = shallowRef(false)
const missingCodes = shallowRef<ReadonlySet<string>>(new Set())
const savedAt = shallowRef<Date | null>(null)
watch(() => [props.productId, authoritative.value], () => { discardPending.value = false })
watch(() => props.productId, () => { savedAt.value = null; onlyMissing.value = false; historyOpen.value = false })
watch(canRead, () => { discardPending.value = false; discardDraftOpen.value = false }, { flush: 'sync' })

const subjects = computed(() => qualification.value?.variants.length
  ? qualification.value.variants.map(variant => ({ variantId: variant.id, label: variant.name }))
  : [{ variantId: null, label: 'Sin presentación' }])
// A writer edits the local buffer; a read-only user sees the saved draft, or else the published version.
const shown = computed<EditorialDocumentEditingState | null>(() => {
  if (canWrite.value) return buffer.value
  const stored = authoritative.value?.draft?.document ?? authoritative.value?.published?.document
  if (!stored) return null
  let counter = 0
  return toEditorialDocumentEditingState(stored, () => `read-${++counter}`)
})
const family = computed(() => vocabulary.value?.families.find(entry => entry.code === shown.value?.familyCode) ?? null)
const table = computed(() => buildEditorialAttributeTable({ family: family.value, definitions: vocabulary.value?.definitions ?? [], values: shown.value?.values ?? [], subjects: subjects.value }))
const rowsMissing = computed(() => table.value.rows.filter(row => row.cells.some(cell => cell && !cell.filled)).length)
const completeness = computed(() => (table.value.total ? Math.round((table.value.answered / table.value.total) * 100) : 0))
const visibleCodes = computed(() => (onlyMissing.value ? missingCodes.value : null))
// The filter keeps the rows that were missing when it was switched on, so a row does not vanish under the cursor as it is filled.
function toggleMissing() {
  onlyMissing.value = !onlyMissing.value
  if (onlyMissing.value) missingCodes.value = new Set(table.value.rows.filter(row => row.cells.some(cell => cell && !cell.filled)).map(row => row.code))
}
watch(() => shown.value?.familyCode, () => { onlyMissing.value = false })

const invalidHistoryContext = computed(() => vocabulary.value && qualification.value && [authoritative.value?.draft, authoritative.value?.published].some(entry => entry &&
  inspectEditorialDocumentReferences({ document: entry.document, vocabulary: vocabulary.value!, context: qualification.value! }).length > 0))
// Display admission uses only the entire reference-qualified saved Draft, never
// a previous local selection, encoded candidate or acknowledgement document.
const conserved = computed(() => {
  const feedback = new Map<string, readonly string[]>()
  if (!vocabulary.value || !qualification.value || !buffer.value) return feedback
  const baseline = qualifyEditorialConservationBaseline(authoritative.value?.draft?.document, vocabulary.value, qualification.value)
  if (!baseline || baseline.familyCode !== buffer.value.familyCode) return feedback
  for (const previous of baseline.values) {
    if (previous.state !== 'known') continue
    const payload = previous.payload
    if (payload.type === 'single' || payload.type === 'multi') feedback.set(editorialTargetKey(previous), payload.type === 'single' ? [payload.value] : payload.value)
  }
  return feedback
})
// A save problem belongs next to the datum it is about. Value indexes count the rows that are sent, which skip omitted ones.
const cellIssues = computed(() => {
  const found = new Map<string, string>()
  const sent = (buffer.value?.values ?? []).filter(row => row.input.state !== 'omitted')
  for (const issue of issues.value) {
    const row = issue.valueIndex === undefined ? undefined : sent[issue.valueIndex]
    if (row && !found.has(row.id)) found.set(row.id, editorialIssueMessage(issue))
  }
  return found
})
const issueFor = (code: string) => issues.value.find(issue => issue.code === code && issue.valueIndex === undefined)
const titleIssue = computed(() => (issueFor('TITLE_LIMIT') ? editorialIssueMessage({ code: 'TITLE_LIMIT' }) : undefined))
const descriptionIssue = computed(() => (issueFor('DESCRIPTION_LIMIT') ? editorialIssueMessage({ code: 'DESCRIPTION_LIMIT' }) : undefined))
const generalIssues = computed(() => issues.value.filter(issue => issue.valueIndex === undefined && issue.code !== 'TITLE_LIMIT' && issue.code !== 'DESCRIPTION_LIMIT'))
const declarationChoices = computed(() => projectEditorialDeclarationChoices({ family: family.value, definitions: vocabulary.value?.definitions ?? [] }))

const warnings = computed(() => (receipt.value?.state.warnings ?? []).map(warning => {
  const owner = vocabulary.value?.families.find(item => item.id === warning.familyId)
  const definition = vocabulary.value?.definitions.find(item => item.id === warning.definitionId)
  const option = definition && (definition.type === 'single' || definition.type === 'multi')
    ? definition.options.find(item => item.code === warning.optionCode) : null
  const variant = qualification.value?.variants.find(item => item.id === warning.variantId)
  return `${owner?.label ?? 'Familia no disponible'} · ${definition?.label ?? 'Dato no disponible'} · ${option?.label ?? warning.optionCode.slice(0, 80)} · ${warning.owner === 'product' ? 'Producto' : variant?.name ?? 'Presentación'}`
}))
const historyChanges = computed(() => buildEditorialHistoryChanges({ published: authoritative.value?.published?.document ?? null,
  draft: authoritative.value?.draft?.document ?? null, vocabulary: vocabulary.value, context: qualification.value }))

// Not found, refused and failed reads are three different states (S10).
const notFound = computed(() => Boolean(errorMessage.value) && readStatus.value === 404)
const forbidden = computed(() => !canRead.value || readStatus.value === 401 || readStatus.value === 403)
// Not found and a failed read carry their own action (way back, Reintentar). A refusal and a read-only
// view keep an "Actualizar", the only way to look again once access or someone else's work changes.
const showRefresh = computed(() => !notFound.value && (errorMessage.value ? forbidden.value : !canWrite.value))
const noDraft = computed(() => Boolean(authoritative.value) && !authoritative.value!.draft && canWrite.value)
const hasContent = computed(() => Boolean(shown.value && vocabulary.value && qualification.value))
const needsReconciliation = computed(() => Boolean(pendingIntent.value) && outcome.value !== 'acknowledged')
const reconciliationText = computed(() => {
  if (outcome.value === 'conflict') return editorialErrorMessage(409)
  if (outcome.value === 'ambiguous') return 'No pudimos confirmar si se guardó. Puedes reintentar con el mismo contenido o comprobar el estado.'
  return editorialErrorMessage(error.value?.status ?? null)
})
// An acknowledged save stands even when the read that follows it fails.
const justSaved = computed(() => outcome.value === 'acknowledged' && pendingIntent.value?.kind === 'save')
const saveStatus = computed(() => {
  if (isPending.value) return 'pending'
  if (issues.value.length) return 'error'
  return justSaved.value || !hasUnsavedChanges.value ? 'saved' : 'dirty'
})
const savedWhen = computed(() => (savedAt.value ? ` · ${formatShortDateTime(savedAt.value)}` : ''))

const footerActions = computed<RowAction[]>(() => [
  ...(hasUnsavedChanges.value ? [{ key: 'undo', label: 'Deshacer cambios sin guardar…', icon: 'i-lucide-undo-2', disabled: loading.value || isPending.value }] : []),
  { key: 'discard', label: 'Descartar borrador…', icon: 'i-lucide-trash-2', destructive: true, disabled: !canDiscard.value },
])
function footerAction(key: string) {
  if (key === 'undo') discardPending.value = true
  else if (key === 'discard') discardDraftOpen.value = true
}

async function refreshView(quiet = false) {
  // With no local buffer there are no edits to discard. Loading still requires a fresh GET, never the historical receipt.
  await editor.refresh(canWrite.value && buffer.value === null ? 'discard' : 'retain', { quiet })
}
async function loadLatest() { discardPending.value = false; await editor.refresh('discard') }
// An acknowledged save does not install state: one explicit GET brings the saved draft back,
// and a failure of that GET never reads as a failed save.
async function submit() {
  if (!(await editor.save())) return
  savedAt.value = new Date()
  await editor.refresh('retain', { quiet: true })
}
async function start() {
  if (canInitialize.value && (await editor.initialize())) { savedAt.value = new Date(); await editor.refresh('discard') }
}
async function confirmDiscardDraft() {
  discardDraftOpen.value = false
  await editor.discard()
}

function replace(next: EditorialDocumentEditingState) { editor.replaceDocument(next) }
function valuesChanged(values: EditorialDocumentEditingState['values']) { if (buffer.value) replace({ ...buffer.value, values }) }
function factsChanged(facts: EditorialDocumentEditingState['facts']) { if (buffer.value) replace({ ...buffer.value, facts }) }
</script>

<template>
  <component :is="embedded ? 'section' : 'main'" class="hf-theme hf-ui editorial-workspace" aria-labelledby="editorial-workspace-title">
    <!-- Embedded under the product title the heading is for assistive tech only: two stacked titles repeat the Contenido tab. -->
    <h2 v-if="embedded" id="editorial-workspace-title" class="sr-only">Contenido editorial</h2>
    <header v-else class="hf-page-header editorial-header">
      <h1 id="editorial-workspace-title" class="hf-page-title">Contenido editorial</h1>
    </header>

    <div v-if="showRefresh" class="editorial-refresh">
      <p v-if="!canWrite && !errorMessage" class="editorial-quiet">Solo consulta. Para editar necesitas permiso de edición del contenido editorial.</p>
      <button class="editorial-button" type="button" data-testid="refresh-retain" :disabled="!canRead || loading || isPending" @click="refreshView()">Actualizar</button>
    </div>

    <EmptyState
      v-if="notFound"
      title="No encontramos el contenido editorial"
      description="El producto no existe o ya no tienes acceso a él."
      :action-label="backLabel"
      action-icon="i-lucide-arrow-left"
      @action="emit('back')"
    />
    <EmptyState v-else-if="errorMessage && forbidden" kind="forbidden" :title="errorMessage" />
    <EmptyState
      v-else-if="errorMessage"
      kind="error"
      title="No se pudo cargar el contenido editorial"
      description="Inténtalo de nuevo en un momento."
      action-label="Reintentar"
      @action="refreshView()"
    />
    <template v-else>
      <div v-if="loading" role="status" class="editorial-loading" data-testid="editorial-skeleton" aria-busy="true">
        <span class="sr-only">{{ authoritative ? 'Actualizando contenido editorial…' : 'Cargando contenido editorial…' }}</span>
        <template v-if="!authoritative">
          <div class="editorial-skeleton-toolbar" data-skeleton="section" aria-hidden="true">
            <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 12rem" />
            <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 9rem" />
            <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 7rem" />
          </div>
          <div class="editorial-skeleton-table" data-skeleton="section" aria-hidden="true">
            <div class="editorial-skeleton-row editorial-skeleton-head">
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 6rem" />
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 5rem" />
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 7rem" />
            </div>
            <div v-for="row in 5" :key="row" class="editorial-skeleton-row">
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 60%" />
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar editorial-skeleton-cell" data-skeleton="field" />
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar editorial-skeleton-cell" data-skeleton="field" />
            </div>
          </div>
        </template>
      </div>
      <p v-if="metadataMessage" role="alert" class="editorial-alert" data-tone="warning">{{ metadataMessage }}</p>

      <template v-if="authoritative">
        <EmptyState
          v-if="noDraft"
          title="Aún no hay ficha para el catálogo"
          :description="authoritative.published ? 'Hay una versión publicada. Empieza desde ella para editarla.' : 'Aquí vas a escribir cómo se presenta este producto en el catálogo.'"
          :action-label="authoritative.published ? 'Empezar desde lo publicado' : 'Empezar ficha'"
          action-icon="i-lucide-file-plus"
          action-variant="solid"
          action-test-id="initialize"
          :action-loading="isPending"
          @action="start"
        />
        <EmptyState v-else-if="!hasContent && !canWrite" title="Aún no hay ficha para el catálogo" />

        <template v-else-if="hasContent && shown && vocabulary && qualification">
          <div class="editorial-toolbar" role="toolbar" aria-label="Resumen y filtros de la ficha">
            <div v-if="table.total" class="editorial-completeness">
              <span class="hf-figure"><strong>{{ table.answered }}</strong> de {{ table.total }} datos</span>
              <div class="editorial-bar" aria-hidden="true"><i :style="{ width: `${completeness}%` }" /></div>
            </div>
            <button v-if="table.total" type="button" class="editorial-button" data-testid="only-missing" :aria-pressed="onlyMissing" @click="toggleMissing">
              <UIcon name="i-lucide-list-filter" class="size-4" aria-hidden="true" />Solo faltantes
              <span v-if="rowsMissing" class="hf-figure editorial-count">{{ rowsMissing }}</span>
            </button>
            <EditorialContractFamilyField v-if="canWrite" id="editorial-family" :model-value="shown" :families="vocabulary.families" :disabled="!editable" @update:model-value="replace" />
            <p v-else-if="family" class="editorial-family-name">Familia · {{ family.label }}</p>
            <span class="editorial-spacer" />
            <StatusBadge v-if="authoritative.draft" label="Borrador" tone="neutral" aria-prefix="Estado de la ficha:" />
            <StatusBadge v-else label="Publicado" tone="info" aria-prefix="Estado de la ficha:" />
            <button type="button" class="editorial-button" data-testid="open-history" @click="historyOpen = true">
              <UIcon name="i-lucide-history" class="size-4" aria-hidden="true" />Historial
            </button>
          </div>

          <div v-if="needsReconciliation && canWrite" role="alert" class="editorial-alert" data-tone="warning" data-testid="reconciliation">
            <p>{{ reconciliationText }}</p>
            <div class="editorial-actions">
              <button type="button" class="editorial-button" data-testid="refresh-discard" :disabled="loading || isPending" @click="discardPending = true">Cargar la versión más reciente</button>
              <button type="button" class="editorial-button" data-testid="refresh-retain" :disabled="loading || isPending" @click="refreshView()">Conservar mis cambios y actualizar</button>
              <button v-if="outcome === 'ambiguous'" type="button" class="editorial-button" :disabled="!retransmitAllowed || isPending || loading" @click="editor.retransmit()">Reintentar guardado</button>
            </div>
          </div>
          <div v-if="discardPending && canRead" role="group" aria-labelledby="discard-title" class="editorial-alert" data-tone="confirm">
            <p id="discard-title">¿Reemplazar tus cambios sin guardar con la versión más reciente?</p>
            <div class="editorial-actions">
              <button type="button" class="editorial-button" data-testid="cancel-discard" @click="discardPending = false">Cancelar</button>
              <button type="button" class="editorial-button" data-testid="confirm-discard" :disabled="loading || isPending" @click="loadLatest">Cargar versión más reciente</button>
            </div>
          </div>
          <p v-if="invalidHistoryContext" role="status" class="editorial-alert" data-tone="warning">Hay datos guardados que ya no aplican a esta familia o a estas presentaciones. Se conservan; quítalos o corrígelos para poder guardar.</p>
          <div v-if="canWrite && generalIssues.length" role="alert" class="editorial-alert" data-tone="warning">
            <p>Revisa el contenido antes de guardar.</p>
            <ul><li v-for="(issue, index) in generalIssues" :key="index">{{ editorialIssueMessage(issue) }}</li></ul>
          </div>

          <component :is="canWrite ? 'form' : 'div'" id="editorial-form" class="editorial-form" :aria-label="canWrite ? 'Editar ficha del catálogo' : undefined" novalidate @submit.prevent="submit">
            <div class="editorial-surface">
              <EditorialContractDocumentFields id="editorial" :model-value="shown" :disabled="!editable" :readonly="!canWrite"
                :title-issue="titleIssue" :description-issue="descriptionIssue" @update:model-value="replace" />
            </div>

            <EmptyState v-if="!family && canWrite" title="Elige una familia" description="La familia decide qué datos aplican a este producto." />
            <EmptyState v-else-if="!family" title="Esta ficha aún no tiene familia" />
            <EmptyState v-else-if="onlyMissing && !missingCodes.size" kind="no-match" title="No falta ningún dato" action-label="Ver todos los datos" action-test-id="clear-missing" @action="onlyMissing = false" />
            <EditorialAttributeTable v-else :values="shown.values" :family="family" :definitions="vocabulary.definitions" :subjects="subjects"
              :next-id="lifecycle.nextId" :visible-codes="visibleCodes" :readonly="!canWrite" :disabled="!editable" :issues="cellIssues" :conserved="conserved"
              @update:values="valuesChanged" />

            <details v-if="family && (canWrite || shown.facts.length)" class="editorial-fold" data-testid="complete-to-publish">
              <summary>Completar para publicar <StatusBadge label="Opcional por ahora" tone="neutral" aria-prefix="" /></summary>
              <div class="editorial-fold__body">
                <EditorialContractFactsList id="editorial-facts" :model-value="shown.facts" :subjects="subjects" :allowed="declarationChoices"
                  :care-allowed="family.code === 'care'" :next-id="lifecycle.nextId" :disabled="!editable" @update:model-value="factsChanged" />
              </div>
            </details>
          </component>

          <footer v-if="canWrite && buffer" class="editorial-footer" data-testid="editorial-footer">
            <div class="editorial-save-state" aria-live="polite" :data-status="saveStatus">
              <template v-if="saveStatus === 'pending'">Guardando…</template>
              <template v-else-if="saveStatus === 'error'">No se guardó · corrige {{ issues.length === 1 ? '1 dato' : `${issues.length} datos` }}</template>
              <template v-else-if="saveStatus === 'dirty'"><i class="editorial-dot" aria-hidden="true" /><b>Cambios sin guardar</b></template>
              <template v-else><b class="editorial-ok">Guardado</b>{{ savedWhen }}</template>
              <template v-if="staleView"> · No se pudo actualizar la vista · <button type="button" class="editorial-link" data-testid="retry-view" @click="refreshView(true)">Reintentar</button></template>
            </div>
            <div class="editorial-footer__actions">
              <RowActionsMenu :actions="footerActions" row-label="la ficha" aria-label="Más acciones de la ficha" portal-class="editorial-portal" @select="footerAction" />
              <button type="button" class="editorial-button" disabled aria-disabled="true">Publicación próximamente</button>
              <button class="hf-primary-control" type="submit" form="editorial-form" :disabled="!canSave">{{ isPending ? 'Guardando…' : 'Guardar' }}</button>
            </div>
          </footer>
        </template>

        <EditorialHistoryDrawer v-model:open="historyOpen" :has-draft="Boolean(authoritative.draft)" :has-published="Boolean(authoritative.published)"
          :saved-at="savedAt" :changes="historyChanges" :warnings="warnings" />
        <ConfirmModal v-model:open="discardDraftOpen" title="¿Descartar el borrador?" confirm-label="Descartar borrador" confirm-color="error"
          description="Se pierden los cambios guardados y los que no has guardado. Lo publicado no cambia." :ui="{ content: 'hf-theme hf-ui' }" @confirm="confirmDiscardDraft" />
      </template>
    </template>
  </component>
</template>

<style scoped>
.editorial-workspace { display: flex; flex-direction: column; gap: 16px; min-width: 0; color: var(--hf-ink); }
.editorial-header { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.editorial-refresh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.editorial-quiet { margin: 0; color: var(--hf-muted); font-size: 14px; }
.editorial-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; min-width: 0; }
.editorial-completeness { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.editorial-bar { width: 6rem; height: 6px; border-radius: 3px; background: var(--hf-surface-muted); overflow: hidden; }
.editorial-bar > i { display: block; height: 100%; background: var(--hf-success); }
.editorial-count { margin-left: 4px; padding: 0 6px; border-radius: 10px; background: var(--hf-active-soft); color: var(--hf-active); font-size: 12px; font-weight: 600; }
.editorial-family-name { margin: 0; color: var(--hf-muted); font-size: 14px; }
.editorial-spacer { flex: 1 1 0; }
.editorial-button { display: inline-flex; align-items: center; gap: 6px; min-height: var(--hf-control-height); padding: 8px 14px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); color: var(--hf-ink); font-family: var(--hf-font); font-size: 14px; cursor: pointer; }
.editorial-button:hover:not(:disabled) { background: var(--hf-surface-muted); }
.editorial-button[aria-pressed='true'] { border-color: var(--hf-active); background: var(--hf-active-soft); color: var(--hf-active); }
.editorial-button:disabled, .hf-primary-control:disabled { cursor: default; opacity: .65; }
.editorial-button:focus-visible, .editorial-link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.editorial-alert { display: grid; gap: 10px; margin: 0; padding: 14px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); font-size: 14px; }
.editorial-alert[data-tone='warning'] { border-color: color-mix(in srgb, var(--hf-warning) 40%, var(--hf-border)); background: var(--hf-warning-soft); }
.editorial-alert p { margin: 0; }
.editorial-alert ul { margin: 0; padding-left: 20px; list-style: disc; }
.editorial-actions { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.editorial-form { display: grid; gap: 16px; min-width: 0; }
.editorial-surface { padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); min-width: 0; }
.editorial-fold { border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); min-width: 0; }
.editorial-fold > summary { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 16px; color: var(--hf-heading); font-weight: 600; cursor: pointer; }
.editorial-fold > summary:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: -2px; border-radius: var(--hf-radius-card); }
.editorial-fold__body { padding: 0 16px 16px; min-width: 0; }
.editorial-footer { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 12px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.editorial-save-state { min-width: 0; color: var(--hf-muted); font-size: 14px; }
.editorial-save-state b { color: var(--hf-ink); font-weight: 600; }
.editorial-save-state .editorial-ok { color: var(--hf-success); }
.editorial-save-state[data-status='error'] { color: var(--hf-danger); font-weight: 600; }
.editorial-dot { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--hf-warning); }
.editorial-link { color: var(--hf-action); text-decoration: underline; cursor: pointer; font: inherit; }
.editorial-footer__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.editorial-loading { display: grid; gap: 16px; min-width: 0; }
.editorial-skeleton-toolbar { display: flex; flex-wrap: wrap; gap: 12px; }
.editorial-skeleton-table { border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); overflow: hidden; }
.editorial-skeleton-row { display: grid; grid-template-columns: 14rem 1fr 1fr; align-items: center; gap: 16px; min-height: 64px; padding: 10px 12px; border-bottom: 1px solid var(--hf-border); }
.editorial-skeleton-row:last-child { border-bottom: 0; }
.editorial-skeleton-head { min-height: 40px; background: color-mix(in srgb, var(--hf-ink) 4%, var(--hf-surface)); }
.editorial-skeleton-bar { height: 14px; border-radius: var(--hf-radius-control); }
.editorial-skeleton-cell { height: 44px; }
@media (max-width: 767px) {
  .editorial-footer { margin-inline: -4px; }
  .editorial-footer__actions { display: grid; grid-template-columns: auto minmax(0, 1fr); width: 100%; }
  .editorial-footer__actions > .hf-primary-control { grid-column: 1 / -1; }
  .editorial-footer__actions > .editorial-button { justify-content: center; }
  .editorial-skeleton-row { grid-template-columns: 8rem 1fr; }
  .editorial-skeleton-row > :nth-child(3) { display: none; }
}
</style>
