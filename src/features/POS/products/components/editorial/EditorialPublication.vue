<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import type { EditorialContractContext } from '../../interfaces/editorial-contract-request.types'
import type { EditorialContractState } from '../../interfaces/editorial-contract-response.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialRuntimeIssue } from '../../utils/editorial-contract-publication-checks'
import { editorialIssueMessage } from '../../composables/useEditorialEditor'
import EditorialContractHistory from './EditorialContractHistory.vue'
const props = withDefaults(defineProps<{ state: EditorialContractState; canWrite: boolean; publishPermission: boolean; canPublish: boolean;
  publicationAvailable?: boolean;
  canDiscard: boolean; hasUnsavedChanges: boolean; publishIssues: readonly EditorialRuntimeIssue[]; busy: boolean;
  needsReconciliation: boolean; vocabulary: EditorialContractVocabulary | null; context: EditorialContractContext | null }>(), { publicationAvailable: true })
const emit = defineEmits<{ publish: [confirmation: 'review-v1' | null]; discard: [] }>()
const confirmation = shallowRef<'publish' | 'discard' | null>(null)
const careConfirmed = shallowRef(false)
const care = computed(() => props.state.draft?.document.familyCode === 'care')
const publishTrigger = useTemplateRef<HTMLButtonElement>('publishTrigger')
const discardTrigger = useTemplateRef<HTMLButtonElement>('discardTrigger')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
async function openConfirmation(action: 'publish' | 'discard') {
  if (props.busy || props.needsReconciliation || (action === 'publish' ? !props.publicationAvailable || !props.canPublish : !props.canDiscard)) return
  careConfirmed.value = false; confirmation.value = action
  await nextTick(); cancelButton.value?.focus()
}
async function closeConfirmation(action: 'publish' | 'discard' | null) {
  confirmation.value = null; careConfirmed.value = false
  await nextTick(); (action === 'discard' ? discardTrigger.value : publishTrigger.value)?.focus()
}
// Scope changes remove/recreate the component. Any new GET/revision/cycle or
// authority change resets both private confirmation and its actual DOM control.
watch(() => [props.state, props.publicationAvailable, props.publishPermission, props.canWrite, props.canPublish, props.canDiscard, props.busy, props.needsReconciliation], () => {
  confirmation.value = null; careConfirmed.value = false
}, { flush: 'sync' })
const messages = computed(() => {
  const reasons: string[] = []
  if (props.canWrite && !props.publishPermission) reasons.push('No tienes permiso para publicar.')
  if (props.publishPermission && props.state.draft) {
    reasons.push(...props.publishIssues.map(editorialIssueMessage))
    if (props.hasUnsavedChanges) reasons.push('Guarda o descarta tus cambios locales antes de publicar. Solo se publica el borrador guardado.')
  }
  if (props.publishPermission && !props.state.draft) reasons.push('Inicia y guarda un borrador antes de publicar.')
  if (props.busy) reasons.push('Espera a que termine la solicitud actual.')
  if (props.needsReconciliation) reasons.push('Consulta el estado actual antes de una nueva acción.')
  return [...new Set(reasons)]
})
// Compare stored content only, not the local raw buffer or publication eligibility.
// Object insertion order is immaterial; every array order and duplicate is retained.
function comparable(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : item)
}
function comparisonText(value: unknown, missing: string): string {
  if (value === undefined) return missing
  if (value === null) return 'Sin valor'
  if (value === '') return 'Texto vacío'
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
const comparison = computed(() => {
  const before = props.state.published?.document
  const after = props.state.draft?.document
  const rows: Array<{ label: string; before: string; after: string }> = []
  if (!after) return rows
  function add(label: string, oldValue: unknown, newValue: unknown, missing = 'Sin valor') {
    const change = oldValue === undefined ? 'Agregado' : newValue === undefined ? 'Eliminado'
      : comparable(oldValue) === comparable(newValue) ? 'Sin cambios' : 'Cambiado'
    rows.push({ label: `${label} · ${change}`, before: comparisonText(oldValue, missing), after: comparisonText(newValue, missing) })
  }
  const fields = [
    ['commercialTitle', 'Título comercial editorial'], ['description', 'Descripción editorial'],
    ['familyCode', 'Familia editorial'], ['mediaRefs', 'Referencias de medios'],
  ] as const
  for (const [key, label] of fields) add(label, before?.[key], after[key])
  const subject = (id: string | null) => id === null ? 'Sin presentación'
    : `${props.context?.variants.find(item => item.id === id)?.name ?? 'Presentación no disponible'} · ${id}`
  // Match the nth occurrence of each exact identity with its nth counterpart.
  // Never put history rows into a one-value-per-identity Map (stored duplicates are valid history).
  function assignments<T>(oldItems: readonly T[], newItems: readonly T[], identity: (item: T) => string,
    label: (item: T) => string, missing: string) {
    const used = new Set<number>()
    for (const oldItem of oldItems) {
      const index = newItems.findIndex((item, index) => !used.has(index) && identity(item) === identity(oldItem))
      if (index !== -1) used.add(index)
      add(label(oldItem), oldItem, index === -1 ? undefined : newItems[index], missing)
    }
    newItems.forEach((item, index) => { if (!used.has(index)) add(label(item), undefined, item, missing) })
  }
  if (!before?.values.length && !after.values.length) add('Atributos editoriales', before ? [] : undefined, [], 'Sin atributos')
  assignments(before?.values ?? [], after.values,
    value => JSON.stringify([value.code, value.owner, value.variantId]),
    value => `${props.vocabulary?.definitions.find(item => item.code === value.code)?.label ?? value.code}${value.owner === 'product' ? '' : ` · ${subject(value.variantId)}`}`,
    'Sin atributo')
  if (!before?.facts.length && !after.facts.length) add('Hechos y revisiones de cuidado', before ? [] : undefined, [], 'Sin hechos')
  assignments(before?.facts ?? [], after.facts, row => JSON.stringify(row.variantId),
    row => `Hechos y revisiones de cuidado · ${subject(row.variantId)}`, 'Sin hechos')
  return rows
})
function confirmAction() {
  if (props.busy || props.needsReconciliation) return
  const action = confirmation.value
  if (action === 'publish' && props.publicationAvailable && props.publishPermission && props.canPublish && (!care.value || careConfirmed.value)) emit('publish', care.value ? 'review-v1' : null)
  if (action === 'discard' && props.canWrite && props.canDiscard) emit('discard')
  void closeConfirmation(action)
}
</script>

<template>
  <section class="editorial-panel publication" aria-labelledby="publication-title">
    <h2 id="publication-title">Publicación</h2>
    <p v-if="!publicationAvailable" role="status" class="publication-pending">La publicación aún no está disponible</p>
    <div class="publication-status">
      <p>{{ state.published ? `Publicado: revisión ${state.published.revision}` : 'Sin versión publicada' }}</p>
      <p>{{ state.draft ? `Borrador guardado: revisión ${state.draft.revision}` : 'Sin borrador guardado' }}</p>
      <p v-if="state.draft">Ciclo {{ state.cycle }} · revisión {{ state.draft.revision }}</p>
      <p v-if="hasUnsavedChanges" class="warning">Tienes cambios locales sin guardar.</p>
      <p>La elegibilidad se valida en el servidor</p>
    </div>
    <ul v-if="messages.length" id="publication-reasons" class="publication-reasons"><li v-for="message in messages" :key="message">{{ message }}</li></ul>
    <section v-if="care && state.draft" aria-labelledby="candidate-care-title">
      <h3 id="candidate-care-title">Todas las revisiones de cuidado candidatas · borrador guardado</h3>
      <EditorialContractHistory :document="state.draft.document" :vocabulary="vocabulary" :context="context" />
    </section>
    <div v-if="!confirmation" class="editorial-actions">
      <button v-if="publicationAvailable && publishPermission" ref="publishTrigger" type="button" class="hf-primary-control" :disabled="!canPublish || busy || needsReconciliation" :aria-describedby="messages.length ? 'publication-reasons' : undefined" @click="openConfirmation('publish')">Publicar borrador…</button>
      <button v-if="canDiscard" ref="discardTrigger" type="button" class="editorial-button" :disabled="busy || needsReconciliation" @click="openConfirmation('discard')">Descartar borrador guardado…</button>
    </div>
    <div v-else role="group" aria-labelledby="publication-confirm-title" class="confirmation">
      <h3 id="publication-confirm-title">{{ confirmation === 'publish' ? 'Publicar borrador guardado' : 'Descartar borrador guardado' }}</h3>
      <p v-if="confirmation === 'publish'">Se publicará la revisión {{ state.draft?.revision }} del borrador guardado {{ state.published ? 'y reemplazará la versión publicada.' : 'y será la primera versión publicada.' }} El borrador se cerrará.</p>
      <p v-else>El borrador guardado se eliminará en el servidor. La versión publicada no cambia. Tus cambios locales sin guardar también se perderán.</p>
      <label v-if="confirmation === 'publish' && care" class="care-consent"><input v-model="careConfirmed" type="checkbox" :disabled="busy || !canPublish"> Revisé todas las revisiones de cuidado de este ciclo y revisión y confirmo su envío (review-v1). La elegibilidad se valida en el servidor.</label>
      <div class="editorial-actions">
        <button ref="cancelButton" type="button" class="editorial-button" @click="closeConfirmation(confirmation)">Cancelar</button>
        <button type="button" :class="confirmation === 'publish' ? 'hf-primary-control' : 'editorial-button'" :disabled="busy || needsReconciliation || (confirmation === 'publish' ? !canPublish || (care && !careConfirmed) : !canDiscard)" @click="confirmAction">{{ confirmation === 'publish' ? 'Publicar ahora' : 'Descartar borrador' }}</button>
      </div>
    </div>
    <details v-if="state.draft" class="editorial-details">
      <summary>Comparar borrador guardado con la versión publicada</summary>
      <dl class="comparison-list">
        <div v-for="(row, index) in comparison" :key="index" class="comparison-row">
          <dt>{{ row.label }}</dt>
          <dd><p>Publicado: {{ row.before }}</p><p>Borrador guardado: {{ row.after }}</p></dd>
        </div>
      </dl>
      <div class="comparison-list">
        <section><h3>Publicado</h3><EditorialContractHistory v-if="state.published" :document="state.published.document" :vocabulary="vocabulary" :context="context" /><p v-else>Sin versión publicada</p></section>
        <section><h3>Borrador guardado</h3><EditorialContractHistory :document="state.draft.document" :vocabulary="vocabulary" :context="context" /></section>
      </div>
    </details>
  </section>
</template>

<style scoped>
.editorial-panel { display: grid; gap: 12px; padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); min-width: 0; overflow-wrap: anywhere; }
.publication h2 { font-size: 18px; font-weight: 600; color: var(--hf-heading); }
.publication h3, .comparison-row dt { font-weight: 600; color: var(--hf-heading); }
.comparison-row { min-width: 0; padding: 12px 0; border-top: 1px solid var(--hf-border); }
.comparison-row dd { margin: 4px 0 0; white-space: pre-wrap; }
.publication-status, .comparison-list, .confirmation { display: grid; gap: 12px; }
.publication-reasons { padding-left: 20px; color: var(--hf-muted); list-style: disc; }
.editorial-actions { display: flex; flex-wrap: wrap; gap: 12px; min-width: 0; }
.editorial-actions > button { flex: 1 1 auto; white-space: normal; overflow-wrap: anywhere; min-width: 0; min-height: max(44px, var(--hf-control-height)); border-radius: var(--hf-radius-control); }
.editorial-button { padding: 8px 16px; border: 1px solid var(--hf-border); background: var(--hf-surface); color: var(--hf-ink); font-family: var(--hf-font); font-size: .875rem; cursor: pointer; }
.editorial-button:hover:not(:disabled) { background: var(--hf-surface-muted); }
.editorial-button:disabled, .hf-primary-control:disabled { cursor: default; opacity: .65; }
.editorial-button:focus-visible, .hf-primary-control:focus-visible, .editorial-details summary:focus-visible, .care-consent input:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 3px; }
.confirmation { padding: 16px; background: var(--hf-warning-soft); border-radius: var(--hf-radius-control); }
.care-consent { display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; }
.publication-pending { padding: 16px; border-radius: var(--hf-radius-control); background: var(--hf-warning-soft); color: var(--hf-warning); }
.warning { color: var(--hf-warning); }
.editorial-details { min-width: 0; border-top: 1px solid var(--hf-border); }
.editorial-details summary { cursor: pointer; padding: 12px 0; min-height: 44px; color: var(--hf-heading); }
@media (max-width: 480px) { .editorial-panel { padding: 16px; } .editorial-actions { width: 100%; } }
</style>
