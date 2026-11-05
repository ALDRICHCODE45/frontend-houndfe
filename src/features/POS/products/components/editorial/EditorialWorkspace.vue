<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { useConfirm } from '@/core/shared/composables/useConfirm'
import { useLeaveGuard } from '@/core/shared/composables/useLeaveGuard'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import HfFieldGrid from '@/core/shared/components/form/HfFieldGrid.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import HfSectionNav, { type HfSection } from '@/core/shared/components/form/HfSectionNav.vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { useEditorialEditor, editorialErrorMessage, editorialIssueMessage } from '../../composables/useEditorialEditor'
import { useEditorialPublish } from '../../composables/useEditorialPublish'
import type { EditorialReadinessItem } from '../../interfaces/editorial-contract-readiness.types'
import EditorialPublishBar from './EditorialPublishBar.vue'
import EditorialPublishChecklist, { type EditorialChecklistEntry } from './EditorialPublishChecklist.vue'
import EditorialAttributeField from './EditorialAttributeField.vue'
import EditorialContractDocumentFields from './EditorialContractDocumentFields.vue'
import EditorialContractFamilyField from './EditorialContractFamilyField.vue'
import EditorialHistoryDrawer from './EditorialHistoryDrawer.vue'
import EditorialPresentationSection from './EditorialPresentationSection.vue'
import { toEditorialDocumentEditingState, type EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'
import { countEditorialDocumentChanges } from '../../utils/editorial-contract-document-dirty'
import { inspectEditorialDocumentReferences } from '../../utils/editorial-contract-document-references'
import { qualifyEditorialConservationBaseline } from '../../utils/editorial-contract-conservation'
import { projectEditorialDeclarationChoices } from '../../utils/editorial-contract-declaration-choices'
import { applyEditorialCellInput, editorialTargetKey, isEditorialOptionalBinding, removeEditorialCell, type EditorialTableCell } from '../../utils/editorial-attribute-table'
import { buildEditorialContentSections, editorialRowCell } from '../../utils/editorial-content-sections'
import { editorialEffectiveSource, editorialSourceKey, ensureEditorialFactsRow, setEditorialOptionalNonpertinence, type EditorialCardSource } from '../../utils/editorial-presentation-card'
import type { EditorialAssignmentInput } from '../../utils/editorial-contract-assignment-input'
import type { EditorialAssignmentTarget } from '../../utils/editorial-contract-assignment-input'
import { buildEditorialHistoryChanges } from '../../utils/editorial-history-diff'
import '@/core/shared/design-system/houndfe-ui.css'

declare const useToast: () => { add: (options: { title: string; color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral' }) => void }

/** The product's catalog content as section cards (design/content-editor-v3/02-section-cards.html):
 * a calm header (Contenido, the publication state, Faltan N, Historial), the Issue checklist of what
 * is missing to publish, a sticky index, the «Presentación» card (family, the presentation being
 * edited, its questions and source), «Título y descripción», then one card per attribute section of
 * the vocabulary, and the save bar: «Guardar» with changes, «Publicar» when everything is saved.
 */
const props = defineProps<{
  productId: string
  embedded?: boolean
  /** Label of the way back shown when the content is not found; omit for none. */
  backLabel?: string
}>()
const emit = defineEmits<{ back: [] }>()
const editor = useEditorialEditor(() => props.productId)
const { lifecycle, vocabulary, qualification, loading, errorMessage, readStatus, staleView, metadataMessage, issues, editable, canInitialize, canDiscard, hasUnsavedChanges } = editor
const { authoritative, buffer, canRead, canWrite, isPending, receipt, outcome, error, pendingIntent } = lifecycle
const publishPermission = lifecycle.canPublish
useLeaveGuard(hasUnsavedChanges, { description: 'Tienes cambios sin guardar en el contenido.' })
const toast = useToast()
const { confirm } = useConfirm()
const publication = useEditorialPublish(editor, {
  productId: () => props.productId,
  confirmCare: () => confirm({ title: '¿Publicar la información de cuidado?', description: 'Confirmo que revisé la información de cuidado.', confirmLabel: 'Publicar' }),
  notify: title => toast.add({ title, color: 'success' }),
})

const retransmitAllowed = computed(() => pendingIntent.value?.kind === 'publish'
  ? publishPermission.value : canWrite.value && (pendingIntent.value?.kind === 'discard' || Boolean(vocabulary.value && qualification.value)))
const discardPending = shallowRef(false)
const discardDraftOpen = shallowRef(false)
const historyOpen = shallowRef(false)
const savedAt = shallowRef<Date | null>(null)
watch(() => [props.productId, authoritative.value], () => { discardPending.value = false })
watch(() => props.productId, () => { savedAt.value = null; historyOpen.value = false })
watch(canRead, () => { discardPending.value = false; discardDraftOpen.value = false }, { flush: 'sync' })

const subjects = computed(() => qualification.value?.variants.length
  ? qualification.value.variants.map(variant => ({ variantId: variant.id, label: variant.name }))
  : [{ variantId: null, label: 'Presentación' }])
// A writer edits the local buffer; a read-only user sees the saved draft, or else the published version.
const shown = computed<EditorialDocumentEditingState | null>(() => {
  if (canWrite.value) return buffer.value
  const stored = authoritative.value?.draft?.document ?? authoritative.value?.published?.document
  if (!stored) return null
  let counter = 0
  return toEditorialDocumentEditingState(stored, () => `read-${++counter}`)
})
const family = computed(() => vocabulary.value?.families.find(entry => entry.code === shown.value?.familyCode) ?? null)
// The presentation being edited: its answers and its per-presentation data show in the cards.
const selected = shallowRef(editorialSourceKey(null))
watch(subjects, list => {
  if (!list.some(subject => editorialSourceKey(subject.variantId) === selected.value)) selected.value = editorialSourceKey(list[0]?.variantId ?? null)
}, { immediate: true })
const selectedSubject = computed(() => subjects.value.find(subject => editorialSourceKey(subject.variantId) === selected.value) ?? subjects.value[0]!)
const content = computed(() => buildEditorialContentSections({ family: family.value, definitions: vocabulary.value?.definitions ?? [],
  values: shown.value?.values ?? [], subjects: subjects.value, facts: shown.value?.facts ?? [] }))
const cellOf = (row: (typeof content.value.sections)[number]['rows'][number]) => editorialRowCell(content.value.table, row, selectedSubject.value.variantId)
const orphans = computed(() => {
  const count = content.value.table.orphanCount
  return count ? `${count} ${count === 1 ? 'dato guardado no aparece' : 'datos guardados no aparecen'} en las secciones. Se conservan.` : ''
})
const PRESENTATION_ID = 'editorial-section-presentation'
const DOCUMENT_ID = 'editorial-section-document'
// One count for one thing: while there are unsaved edits, «falta N» is the live local count of fields to
// answer; once everything is saved it is the backend's readiness of that saved draft, counted in distinct
// fields per section, and the header's «Faltan N» is then every readiness field, the ones above the cards included.
const savedCounts = computed(() => (hasUnsavedChanges.value ? null : publication.sectionCounts.value))
const sectionMissing = computed(() => {
  const counts = savedCounts.value
  const missing = new Map(content.value.sections.map(section => [section.id, counts ? counts[section.code ?? ''] ?? 0 : section.missing]))
  if (counts) {
    // A section the page does not show counts in «Otros datos» when there is one; its items stay in the checklist.
    const other = content.value.sections.find(section => section.code === null)
    const shown = new Set(content.value.sections.map(section => section.code))
    if (other) for (const [code, count] of Object.entries(counts)) if (!shown.has(code)) missing.set(other.id, (missing.get(other.id) ?? 0) + count)
  }
  return missing
})
const missingTotal = computed(() => (savedCounts.value ? publication.missingFields.value : content.value.missing))
const navSections = computed<HfSection[]>(() => [
  { id: PRESENTATION_ID, label: 'Presentación', missing: 0 },
  { id: DOCUMENT_ID, label: 'Título y descripción', missing: 0 },
  ...content.value.sections.map(section => ({ id: section.id, label: section.label, missing: sectionMissing.value.get(section.id) ?? 0 })),
])
// Product, presentation and care items first, then the data in page order; a datum on the page gets a link.
const rowOf = (code: string | null) => (code === null ? null : content.value.sections.flatMap(section => section.rows).find(row => row.code === code) ?? null)
const checklistEntries = computed<EditorialChecklistEntry[]>(() => {
  const entries = publication.checklist.value.map((item, index) => ({ key: `${index}`, item, label: item.scope === 'definition' ? rowOf(item.definitionCode)?.label ?? null : null }))
  return [...entries.filter(entry => entry.item.scope !== 'definition'), ...entries.filter(entry => entry.item.scope === 'definition')]
})
async function gotoItem(item: EditorialReadinessItem) {
  const row = rowOf(item.definitionCode)
  if (!row) return
  if (row.owner === 'sellable' && subjects.value.some(subject => subject.variantId === item.variantId)) selected.value = editorialSourceKey(item.variantId)
  await nextTick()
  const base = `attr-${row.code}-${row.owner}`
  const control = document.getElementById(`${base}-value`)
    ?? document.getElementById(`${base}-label`)?.closest('[data-testid="attribute-field"]')?.querySelector<HTMLElement>('input, textarea, [role="combobox"]')
  control?.scrollIntoView({ block: 'center', behavior: 'auto' })
  control?.focus({ preventScroll: true })
}
// Below lg the product summary still takes its column: the index stays a row of chips above the cards.
const wide = useBreakpoints(breakpointsTailwind).greaterOrEqual('lg')
function focusSection(id: string) { document.getElementById(`${id}-title`)?.focus({ preventScroll: true }) }

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
// Sources picked on a card before any answer, per presentation; the stored evidence covers the rest.
const cardSources = shallowRef<ReadonlyMap<string, EditorialCardSource>>(new Map())
watch(() => [props.productId, authoritative.value], () => { cardSources.value = new Map() })
// A card whose answers lack their source says so on its source row, so the general notice would only repeat it.
const sourceMissing = computed(() => (shown.value?.facts ?? []).some(row => (row.declarations.some(item => item.input.state === 'known') || row.careReview.state === 'prepared')
  && !editorialEffectiveSource(cardSources.value, row, row.variantId).sourceRef.trim()))
const generalIssues = computed(() => issues.value.filter(issue => issue.valueIndex === undefined && issue.code !== 'TITLE_LIMIT' && issue.code !== 'DESCRIPTION_LIMIT'
  && !(issue.code === 'FACTS_CAPTURE' && sourceMissing.value)))
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
// A publish attempt reports in its own bar (useEditorialPublish); this alert is for saves and discards.
const needsReconciliation = computed(() => Boolean(pendingIntent.value) && pendingIntent.value?.kind !== 'publish' && outcome.value !== 'acknowledged')
const reconciliationText = computed(() => {
  if (outcome.value === 'conflict') return editorialErrorMessage(409)
  if (outcome.value === 'ambiguous') return 'No pudimos confirmar si se guardó. Puedes reintentar con el mismo contenido o comprobar el estado.'
  return editorialErrorMessage(error.value?.status ?? null)
})
// The save bar: how many fields changed against the saved draft, and why a save was refused.
// An acknowledged save stands even when the read that follows it fails.
const justSaved = computed(() => outcome.value === 'acknowledged' && pendingIntent.value?.kind === 'save')
const dirtyCount = computed(() => {
  if (!buffer.value || !hasUnsavedChanges.value || justSaved.value) return 0
  const saved = authoritative.value?.draft?.document
  return Math.max(1, countEditorialDocumentChanges(buffer.value, saved ? toEditorialDocumentEditingState(saved, () => 'baseline') : null))
})
const saveError = computed(() => (issues.value.length ? `No se guardó · corrige ${issues.value.length === 1 ? '1 dato' : `${issues.value.length} datos`}` : null))
// «Guardar» is the primary while there is something to save; once all is saved, «Publicar» (for publishers).
const bar = computed<'save' | 'publish' | null>(() => {
  const saving = isPending.value && pendingIntent.value?.kind !== 'publish'
  if (publication.visible.value && authoritative.value?.draft && !dirtyCount.value && !saveError.value && !saving) return 'publish'
  return canWrite.value && buffer.value ? 'save' : null
})
const statusTone = computed(() => (publication.status.value?.kind === 'published' ? 'success' : publication.status.value?.kind === 'changes' ? 'info' : 'neutral'))

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
  // The discard is acknowledged without installing state: one GET brings back the empty state.
  if (await editor.discard()) await editor.refresh('discard')
}

function replace(next: EditorialDocumentEditingState) { editor.replaceDocument(next) }
function fieldChanged(cell: EditorialTableCell, input: EditorialAssignmentInput) {
  if (buffer.value && editable.value) valuesChanged(applyEditorialCellInput(buffer.value.values, cell, input, lifecycle.nextId))
}
function fieldCleared(cell: EditorialTableCell) {
  if (buffer.value && editable.value && cell.rowId !== null) valuesChanged(removeEditorialCell(buffer.value.values, cell.rowId))
}
function factsChanged(facts: EditorialDocumentEditingState['facts']) { if (buffer.value) replace({ ...buffer.value, facts }) }
// "No aplica" on an optional datum of a presentation is declared in that presentation's hidden
// `optionalNonpertinenceCodes`, with the card's source; taking the "No aplica" away takes the code out.
function optionalNotApplicable(values: EditorialDocumentEditingState['values']) {
  const codes = new Set(family.value?.bindings.filter(binding => binding.owner === 'sellable' && isEditorialOptionalBinding(binding)).map(binding => binding.definitionCode))
  const targets = new Map<string, EditorialAssignmentTarget>()
  for (const item of values) if (item.input.state === 'not_applicable' && item.target.owner === 'sellable' && codes.has(item.target.code)) targets.set(editorialTargetKey(item.target), item.target)
  return targets
}
function valuesChanged(values: EditorialDocumentEditingState['values']) {
  if (!buffer.value) return
  const before = optionalNotApplicable(buffer.value.values), after = optionalNotApplicable(values)
  let facts = buffer.value.facts
  const toggle = (target: EditorialAssignmentTarget, include: boolean) => {
    if (!include && !facts.some(row => row.variantId === target.variantId)) return
    const subject = subjects.value.find(item => item.variantId === target.variantId)
    const presentation = target.variantId === null ? buffer.value!.commercialTitle?.trim() || 'Producto' : subject?.label ?? 'Presentación'
    const ensured = ensureEditorialFactsRow(facts, { variantId: target.variantId, presentation }, lifecycle.nextId)
    const source = editorialEffectiveSource(cardSources.value, ensured.row, target.variantId)
    const row = setEditorialOptionalNonpertinence(ensured.row, target.code, include, source, lifecycle.nextId)
    facts = ensured.state.map(item => (item.id === ensured.row.id ? row : item))
  }
  for (const [key, target] of after) if (!before.has(key)) toggle(target, true)
  for (const [key, target] of before) if (!after.has(key)) toggle(target, false)
  replace({ ...buffer.value, values, facts })
}
</script>

<template>
  <component :is="embedded ? 'section' : 'main'" class="hf-theme hf-ui editorial-workspace" aria-labelledby="editorial-workspace-title">
    <div class="editorial-head" data-testid="editorial-head">
      <component :is="embedded ? 'h2' : 'h1'" id="editorial-workspace-title" class="editorial-head__title">Contenido</component>
      <StatusBadge v-if="authoritative && publication.status.value && !errorMessage" data-testid="publication-status" :label="publication.status.value.label"
        :tone="statusTone" aria-prefix="Estado:" />
      <template v-if="hasContent && authoritative && !noDraft">
        <StatusBadge v-if="family" data-testid="editorial-progress" :label="missingTotal ? `Faltan ${missingTotal}` : 'Completo'"
          :tone="missingTotal ? 'warning' : 'success'" aria-prefix="Avance:" />
        <span class="editorial-spacer" />
        <UButton v-if="canWrite && authoritative.draft" color="neutral" variant="ghost" icon="i-lucide-trash-2" class="editorial-head__action" data-testid="discard-draft"
          label="Descartar borrador" :disabled="!canDiscard" @click="discardDraftOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-history" class="editorial-head__action" data-testid="open-history" label="Historial" @click="historyOpen = true" />
      </template>
      <template v-else-if="authoritative?.published && noDraft">
        <span class="editorial-spacer" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-history" class="editorial-head__action" data-testid="open-history" label="Historial" @click="historyOpen = true" />
      </template>
    </div>

    <div v-if="showRefresh" class="editorial-refresh">
      <p v-if="!canWrite && !errorMessage" class="editorial-quiet">Solo consulta. Para editar necesitas permiso de edición del contenido editorial.</p>
      <UButton color="neutral" variant="outline" label="Actualizar" data-testid="refresh-retain" :disabled="!canRead || loading || isPending" @click="refreshView()" />
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
        <div v-if="!authoritative" class="editorial-layout" aria-hidden="true">
          <div class="editorial-skeleton-nav" data-skeleton="section">
            <div v-for="entry in 5" :key="entry" class="hf-skeleton animate-pulse editorial-skeleton-bar" />
          </div>
          <div class="editorial-cards">
            <div v-for="card in 3" :key="card" class="editorial-skeleton-card" data-skeleton="section">
              <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 9rem" />
              <div class="editorial-skeleton-grid">
                <div v-for="entry in 4" :key="entry" class="editorial-skeleton-field">
                  <div class="hf-skeleton animate-pulse editorial-skeleton-bar" style="width: 40%" />
                  <div class="hf-skeleton animate-pulse editorial-skeleton-bar editorial-skeleton-control" data-skeleton="field" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-if="metadataMessage" role="alert" class="editorial-alert" data-tone="warning">{{ metadataMessage }}</p>

      <template v-if="authoritative">
        <EmptyState
          v-if="noDraft"
          :title="authoritative.published ? 'La ficha está publicada' : 'Aún no hay ficha para el catálogo'"
          :description="authoritative.published ? 'Hay una versión publicada. Para cambiarla, empieza un borrador desde ella.' : 'Aquí vas a escribir cómo se presenta este producto en el catálogo.'"
          :action-label="authoritative.published ? 'Empezar desde lo publicado' : 'Empezar ficha'"
          action-icon="i-lucide-file-plus"
          action-variant="solid"
          action-test-id="initialize"
          :action-loading="isPending"
          @action="start"
        />
        <EmptyState v-else-if="!hasContent && !canWrite" title="Aún no hay ficha para el catálogo" />

        <template v-else-if="hasContent && shown && vocabulary && qualification">
          <div v-if="needsReconciliation && canWrite" role="alert" class="editorial-alert" data-tone="warning" data-testid="reconciliation">
            <p>{{ reconciliationText }}</p>
            <div class="editorial-actions">
              <UButton color="neutral" variant="outline" label="Cargar la versión más reciente" data-testid="refresh-discard" :disabled="loading || isPending" @click="discardPending = true" />
              <UButton color="neutral" variant="outline" label="Conservar mis cambios y actualizar" data-testid="refresh-retain" :disabled="loading || isPending" @click="refreshView()" />
              <UButton v-if="outcome === 'ambiguous'" color="neutral" variant="outline" label="Reintentar guardado" :disabled="!retransmitAllowed || isPending || loading" @click="editor.retransmit()" />
            </div>
          </div>
          <div v-if="discardPending && canRead" role="group" aria-labelledby="discard-title" class="editorial-alert" data-tone="confirm">
            <p id="discard-title">¿Reemplazar tus cambios sin guardar con la versión más reciente?</p>
            <div class="editorial-actions">
              <UButton color="neutral" variant="outline" label="Cancelar" data-testid="cancel-discard" @click="discardPending = false" />
              <UButton color="neutral" variant="outline" label="Cargar versión más reciente" data-testid="confirm-discard" :disabled="loading || isPending" @click="loadLatest" />
            </div>
          </div>
          <p v-if="staleView" role="status" class="editorial-alert" data-testid="stale-view">
            Se guardó, pero no se pudo actualizar la vista.
            <button type="button" class="editorial-link" data-testid="retry-view" @click="refreshView(true)">Reintentar</button>
          </p>
          <p v-if="invalidHistoryContext" role="status" class="editorial-alert" data-tone="warning">Hay datos guardados que ya no aplican a esta familia o a estas presentaciones. Se conservan; quítalos o corrígelos para poder guardar.</p>
          <div v-if="canWrite && generalIssues.length" role="alert" class="editorial-alert" data-tone="warning">
            <p>Revisa el contenido antes de guardar.</p>
            <ul><li v-for="(issue, index) in generalIssues" :key="index">{{ editorialIssueMessage(issue) }}</li></ul>
          </div>

          <EditorialPublishChecklist v-if="checklistEntries.length" :entries="checklistEntries" :stale="hasUnsavedChanges" @goto="gotoItem" />

          <div class="editorial-layout" :data-wide="wide || undefined">
            <HfSectionNav class="editorial-nav" :sections="navSections" label="Secciones del contenido" :chips="!wide" @navigate="focusSection" />
            <component :is="canWrite ? 'form' : 'div'" id="editorial-form" class="editorial-cards" :aria-label="canWrite ? 'Editar ficha del catálogo' : undefined" novalidate @submit.prevent="submit">
              <EditorialPresentationSection :id="PRESENTATION_ID" v-model:selected="selected" :facts="shown.facts" :subjects="subjects" :choices="declarationChoices"
                :care-allowed="family?.code === 'care'" :next-id="lifecycle.nextId" :sources="cardSources" :product-name="shown.commercialTitle ?? ''"
                :show-errors="issues.length > 0" :readonly="!canWrite" :disabled="!editable" @update:facts="factsChanged" @update:sources="cardSources = $event">
                <template #family>
                  <EditorialContractFamilyField v-if="canWrite" id="editorial-family" :model-value="shown" :families="vocabulary.families" :disabled="!editable" @update:model-value="replace" />
                  <HfFormField v-else label="Familia" label-id="editorial-family-label">
                    <p class="editorial-read">{{ family?.label ?? 'Sin familia' }}</p>
                  </HfFormField>
                  <p v-if="!family" class="editorial-quiet">{{ canWrite ? 'Elige una familia: decide qué datos aplican a este producto.' : 'Esta ficha aún no tiene familia.' }}</p>
                </template>
              </EditorialPresentationSection>

              <HfSectionCard :id="DOCUMENT_ID" title="Título y descripción">
                <EditorialContractDocumentFields id="editorial" :model-value="shown" :disabled="!editable" :readonly="!canWrite"
                  :title-issue="titleIssue" :description-issue="descriptionIssue" @update:model-value="replace" />
              </HfSectionCard>

              <HfSectionCard v-for="section in content.sections" :id="section.id" :key="section.id" :title="section.label" data-testid="attribute-section">
                <template v-if="section.perPresentation && subjects.length > 1" #meta>Para: {{ selectedSubject.label }}</template>
                <HfFieldGrid>
                  <template v-for="row in section.rows" :key="`${row.code}:${row.owner}`">
                    <EditorialAttributeField v-if="cellOf(row)" :id="`attr-${row.code}-${row.owner}`" :row="row" :cell="cellOf(row)!" :readonly="!canWrite" :disabled="!editable"
                      :issue="cellOf(row)!.rowId ? cellIssues.get(cellOf(row)!.rowId!) : undefined" :conserved-options="conserved.get(editorialTargetKey(cellOf(row)!.target))"
                      @update="fieldChanged(cellOf(row)!, $event)" @clear="fieldCleared(cellOf(row)!)" />
                  </template>
                </HfFieldGrid>
              </HfSectionCard>
              <p v-if="orphans" class="editorial-quiet" data-testid="attribute-orphans">{{ orphans }}</p>
            </component>
          </div>

          <div v-if="bar" class="editorial-save" data-testid="editorial-save-bar">
            <HfSaveBar v-if="bar === 'save'" :dirty-count="dirtyCount" :saving="isPending" :saved-at="savedAt" :error="saveError" @save="submit" @discard="discardPending = true" />
            <EditorialPublishBar v-else :ready="publication.readiness.value?.ready ?? null" :can-publish="publication.canPublish.value"
              :publishing="publication.publishing.value" :failed="publication.readinessFailed.value" :error="publication.message.value"
              :retryable="publication.retryable.value" :explained="checklistEntries.length > 0"
              @publish="publication.publish()" @retry="publication.retry()" @recheck="publication.reloadReadiness()" />
          </div>
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
/* A calm header: the title, one progress badge, then the ghost actions. */
.editorial-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0; min-height: 36px; }
.editorial-head__title { margin: 0; color: var(--hf-heading); font-size: 16px; font-weight: 600; line-height: 1.4; }
.editorial-head__action { color: var(--hf-muted); }
.editorial-spacer { flex: 1 1 0; }
.editorial-refresh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.editorial-quiet { margin: 0; color: var(--hf-muted); font-size: 13px; }
.editorial-read { margin: 0; font-size: 14px; }
.editorial-alert { display: grid; gap: 10px; margin: 0; padding: 14px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); font-size: 14px; }
.editorial-alert[data-tone='warning'] { border-color: color-mix(in srgb, var(--hf-warning) 40%, var(--hf-border)); background: var(--hf-warning-soft); }
.editorial-alert p { margin: 0; }
.editorial-alert ul { margin: 0; padding-left: 20px; list-style: disc; }
.editorial-actions { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.editorial-link { color: var(--hf-action); text-decoration: underline; cursor: pointer; font: inherit; }
.editorial-link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
/* The index beside the cards from lg (the product summary takes the right column); a chip row above them below. */
.editorial-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
.editorial-layout[data-wide] { grid-template-columns: 200px minmax(0, 1fr); align-items: start; gap: 24px; }
.editorial-layout > * { min-width: 0; }
/* The sticky chip row paints the page color out to the scroller's gutters (px-4, sm:px-6). */
.editorial-nav { min-width: 0; --hf-section-nav-bleed: 16px; }
.editorial-cards { display: grid; gap: 16px; min-width: 0; padding-bottom: 16px; }
/* The save bar is the last thing in the scroll, flush to its bottom edge, so it never covers the last field. */
.editorial-save { position: sticky; bottom: 0; z-index: 5; margin-inline: -16px; }
.editorial-save :deep(.hf-save-bar) { position: static; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
.editorial-loading { display: grid; gap: 16px; min-width: 0; }
.editorial-skeleton-nav { display: grid; gap: 8px; align-content: start; }
.editorial-skeleton-card { display: grid; gap: 16px; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.editorial-skeleton-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.editorial-skeleton-field { display: grid; gap: 6px; }
.editorial-skeleton-bar { height: 14px; border-radius: var(--hf-radius-control); }
.editorial-skeleton-control { height: 44px; }
.editorial-loading .editorial-layout { grid-template-columns: minmax(0, 1fr); }
.editorial-skeleton-nav { grid-auto-flow: column; grid-auto-columns: 6rem; overflow: hidden; }
@media (min-width: 640px) {
  .editorial-nav { --hf-section-nav-bleed: 24px; }
  .editorial-save { margin-inline: -24px; }
}
@media (min-width: 768px) {
  .editorial-skeleton-card { padding: 24px; }
  .editorial-skeleton-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px 16px; }
  .editorial-skeleton-control { height: 40px; }
}
@media (min-width: 1024px) {
  .editorial-save { margin-inline: 0; }
  .editorial-loading .editorial-layout { grid-template-columns: 200px minmax(0, 1fr); gap: 24px; }
  .editorial-skeleton-nav { grid-auto-flow: row; grid-auto-columns: auto; }
  .editorial-skeleton-nav .editorial-skeleton-bar { height: 20px; }
}
</style>
