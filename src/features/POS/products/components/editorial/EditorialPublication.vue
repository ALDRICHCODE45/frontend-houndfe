<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import type { EditorialContext, EditorialState, EditorialValue, EditorialVocabulary } from '../../interfaces/product-editorial.types'
import type { EditorialPublishIssue } from '../../utils/product-editorial-publish-validation'
import { decodeEditorialDocument } from '../../utils/product-editorial-document'
import { editorialIssueMessage } from '../../composables/useEditorialEditor'

const props = defineProps<{
  state: EditorialState
  canWrite: boolean
  publishPermission: boolean
  canPublish: boolean
  canDiscard: boolean
  hasUnsavedChanges: boolean
  publishIssues: readonly EditorialPublishIssue[]
  busy: boolean
  needsReconciliation: boolean
  vocabulary: EditorialVocabulary | null
  context: EditorialContext | null
}>()
const emit = defineEmits<{ publish: []; discard: [] }>()
const confirmation = shallowRef<'publish' | 'discard' | null>(null)
const publishTrigger = useTemplateRef<HTMLButtonElement>('publishTrigger')
const discardTrigger = useTemplateRef<HTMLButtonElement>('discardTrigger')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
// The trigger leaves the DOM while the inline confirmation is open: move focus
// to the safe choice and give it back to the trigger afterwards.
async function openConfirmation(action: 'publish' | 'discard') {
  confirmation.value = action
  await nextTick()
  cancelButton.value?.focus()
}
async function closeConfirmation(action: 'publish' | 'discard' | null) {
  confirmation.value = null
  await nextTick()
  ;(action === 'discard' ? discardTrigger.value : publishTrigger.value)?.focus()
}
watch(() => [props.state, props.publishPermission, props.canWrite, props.canPublish, props.canDiscard], () => {
  confirmation.value = null
})
const messages = computed(() => {
  const reasons: string[] = []
  if (props.canWrite && !props.publishPermission) reasons.push('No tienes permiso para publicar.')
  if (props.publishPermission && props.state.draft) {
    for (const issue of props.publishIssues) {
      if (issue.code === 'title') reasons.push('Agrega un título comercial editorial y guarda el borrador antes de publicar.')
      else if (issue.code === 'media') reasons.push('El borrador tiene referencias de medios. Por ahora no se pueden publicar medios ni quitarlos desde este editor; descarta el borrador guardado para salir de este estado.')
      else if (issue.code === 'archived') reasons.push('Un atributo usa una opción archivada que no está en la versión publicada. Cámbiala, guarda y vuelve a intentar.')
      else reasons.push(editorialIssueMessage(issue))
    }
    if (props.hasUnsavedChanges) reasons.push('Guarda o descarta tus cambios locales antes de publicar. Solo se publica el borrador guardado.')
  }
  if (props.publishPermission && !props.state.draft) reasons.push('Inicia y guarda un borrador antes de publicar.')
  if (props.busy) reasons.push('Espera a que termine la solicitud actual.')
  if (props.needsReconciliation) reasons.push('Consulta el estado actual antes de una nueva acción.')
  return [...new Set(reasons)]
})
function confirmAction() {
  const action = confirmation.value
  if (action === 'publish' && props.canPublish) emit('publish')
  if (action === 'discard' && props.canDiscard) emit('discard')
  void closeConfirmation(action)
}
const comparison = computed(() => {
  const draft = decodeEditorialDocument(props.state.draft?.document)
  const published = props.state.published ? decodeEditorialDocument(props.state.published.document) : null
  if (!draft.readable) return { error: 'El borrador guardado no se puede interpretar.', rows: [] }
  if (published && !published.readable) return { error: 'La versión publicada no se puede interpretar.', rows: [] }
  const before = published?.readable ? published.document : null
  const after = draft.document
  const display = (value: unknown) => value === null || value === undefined ? 'Sin valor' : String(value)
  const rows: Array<{ key: string; label: string; unchanged: boolean; before: string; after: string }> = (['commercialTitle', 'description', 'familyCode'] as const).map((key, index) => ({
    key, label: ['Título comercial editorial', 'Descripción editorial', 'Familia editorial'][index]!,
    unchanged: before !== null && before[key] === after[key],
    before: display(before?.[key]), after: display(after[key]),
  }))
  const tuple = (value: EditorialValue) => JSON.stringify([value.code, value.variantId])
  // Same presentation as the form: current labels when available, stored codes otherwise.
  const definition = (code: string) => props.vocabulary?.definitions.find(item => item.code === code)
  const optionLabel = (code: string, option: string) => {
    const found = definition(code)
    return found && (found.type === 'single' || found.type === 'multi')
      ? found.options.find(item => item.code === option)?.label ?? option : option
  }
  const variantLabel = (id: string) => {
    const variant = props.context?.variants.find(item => item.id === id)
    return variant ? `${variant.name} · ${id.slice(0, 8)}` : `Presentación no disponible · ${id}`
  }
  const oldValues = new Map((before?.values ?? []).map(value => [tuple(value), value]))
  const newValues = new Map(after.values.map(value => [tuple(value), value]))
  const format = (value: EditorialValue | undefined) => {
    if (!value) return 'Sin atributo'
    const content = value.type === 'boolean' ? (value.value ? 'Sí' : 'No')
      : value.type === 'multi' ? value.value.map(option => optionLabel(value.code, option)).join(', ')
        : value.type === 'single' ? optionLabel(value.code, value.value) : String(value.value)
    return `${content}${value.type === 'number' && value.unit ? ` ${value.unit}` : ''} · ${value.owner === 'product' ? 'Producto' : 'Presentación'}`
  }
  if (oldValues.size === 0 && newValues.size === 0) rows.push({ key: 'attributes', label: 'Atributos editoriales',
    unchanged: before !== null, before: 'Sin atributos', after: 'Sin atributos' })
  for (const key of new Set([...oldValues.keys(), ...newValues.keys()])) {
    const oldValue = oldValues.get(key)
    const newValue = newValues.get(key)
    const assignment = newValue ?? oldValue!
    const unchanged = Boolean(oldValue && newValue && JSON.stringify(oldValue) === JSON.stringify(newValue))
    const change = unchanged ? 'Sin cambios' : !oldValue ? 'Agregado' : !newValue ? 'Eliminado' : 'Cambiado'
    rows.push({ key, label: `${definition(assignment.code)?.label ?? assignment.code}${assignment.variantId ? ` · ${variantLabel(assignment.variantId)}` : ''} · ${change}`,
      unchanged, before: format(oldValue), after: format(newValue) })
  }
  return { error: null, rows }
})
</script>

<template>
  <section class="editorial-panel publication" aria-labelledby="publication-title">
    <h2 id="publication-title">Publicación</h2>
    <div class="publication-status">
      <p>{{ state.published ? `Publicado: revisión ${state.published.revision}` : 'Sin versión publicada' }}</p>
      <p>{{ state.draft ? `Borrador guardado: revisión ${state.draft.revision}` : 'Sin borrador guardado' }}</p>
      <p v-if="hasUnsavedChanges" class="warning">Tienes cambios locales sin guardar.</p>
    </div>
    <ul v-if="messages.length" id="publication-reasons" class="publication-reasons"><li v-for="message in messages" :key="message">{{ message }}</li></ul>
    <div v-if="!confirmation" class="editorial-actions">
      <button v-if="publishPermission" ref="publishTrigger" type="button" class="hf-primary-control" :disabled="!canPublish" :aria-describedby="messages.length ? 'publication-reasons' : undefined" @click="openConfirmation('publish')">Publicar borrador…</button>
      <button v-if="canDiscard" ref="discardTrigger" type="button" class="editorial-button" @click="openConfirmation('discard')">Descartar borrador guardado…</button>
    </div>
    <div v-else role="group" aria-labelledby="publication-confirm-title" class="confirmation">
      <h3 id="publication-confirm-title">{{ confirmation === 'publish' ? 'Publicar borrador guardado' : 'Descartar borrador guardado' }}</h3>
      <p v-if="confirmation === 'publish'">Se publicará la revisión {{ state.draft?.revision }} del borrador guardado {{ state.published ? 'y reemplazará la versión publicada.' : 'y será la primera versión publicada.' }} El borrador se cerrará.</p>
      <p v-else>El borrador guardado se eliminará en el servidor. La versión publicada no cambia. Tus cambios locales sin guardar también se perderán.</p>
      <div class="editorial-actions">
        <button ref="cancelButton" type="button" class="editorial-button" @click="closeConfirmation(confirmation)">Cancelar</button>
        <button type="button" :class="confirmation === 'publish' ? 'hf-primary-control' : 'editorial-button'" :disabled="confirmation === 'publish' ? !canPublish : !canDiscard" @click="confirmAction">{{ confirmation === 'publish' ? 'Publicar ahora' : 'Descartar borrador' }}</button>
      </div>
    </div>
    <details v-if="state.draft" class="editorial-details">
      <summary>Comparar borrador guardado con la versión publicada</summary>
      <p v-if="comparison.error" role="status">{{ comparison.error }}</p>
      <dl v-else class="comparison-list">
        <div v-for="row in comparison.rows" :key="row.key" class="comparison-row">
          <dt>{{ row.label }}</dt>
          <dd v-if="row.unchanged">Sin cambios</dd>
          <dd v-else><p>Publicado: {{ row.before }}</p><p>Borrador guardado: {{ row.after }}</p></dd>
        </div>
      </dl>
    </details>
  </section>
</template>

<style scoped>
.editorial-panel { display: grid; gap: 12px; padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); min-width: 0; overflow-wrap: anywhere; }
.publication h2 { font-size: 18px; font-weight: 600; color: var(--hf-heading); }
.publication h3, .comparison-row dt { font-weight: 600; color: var(--hf-heading); }
.publication-status, .comparison-list, .confirmation { display: grid; gap: 12px; }
.publication-reasons { padding-left: 20px; color: var(--hf-muted); list-style: disc; }
.editorial-actions { display: flex; flex-wrap: wrap; gap: 12px; min-width: 0; }
.editorial-actions > button { flex: 1 1 auto; white-space: normal; overflow-wrap: anywhere; min-width: 0; min-height: var(--hf-control-height); border-radius: var(--hf-radius-control); }
.editorial-button { padding: 8px 16px; border: 1px solid var(--hf-border); background: var(--hf-surface); color: var(--hf-ink); font-family: var(--hf-font); font-size: 0.875rem; cursor: pointer; }
.editorial-button:hover:not(:disabled) { background: var(--hf-surface-muted); }
.editorial-button:disabled, .hf-primary-control:disabled { cursor: default; opacity: .65; }
.editorial-button:focus-visible, .hf-primary-control:focus-visible, .editorial-details summary:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 3px; }
.confirmation { padding: 16px; background: var(--hf-warning-soft); border-radius: var(--hf-radius-control); }
.warning { color: var(--hf-warning); }
.editorial-details { min-width: 0; border-top: 1px solid var(--hf-border); }
.editorial-details summary { cursor: pointer; padding: 12px 0; min-height: 44px; color: var(--hf-heading); }
.comparison-row { min-width: 0; padding: 12px 0; border-top: 1px solid var(--hf-border); }
.comparison-row dd { margin: 4px 0 0; white-space: pre-wrap; }
@media (max-width: 480px) { .editorial-panel { padding: 16px; } .editorial-actions { width: 100%; } }
</style>
