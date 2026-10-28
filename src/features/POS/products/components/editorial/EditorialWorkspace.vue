<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useEditorialEditor, editorialErrorMessage, editorialIssueMessage } from '../../composables/useEditorialEditor'
import EditorialDocumentFields from './EditorialDocumentFields.vue'
import type { EditorialValue } from '../../interfaces/product-editorial.types'
import { validateEditorialAssignments } from '../../utils/product-editorial-assignment-validation'
import '@/core/shared/design-system/houndfe-ui.css'
const props = defineProps<{ productId: string }>()
const editor = useEditorialEditor(() => props.productId)
const { lifecycle, vocabulary, qualification, loading, errorMessage, metadataMessage, sections, issues, editable, canSave, canInitialize } = editor
const { authoritative, buffer, canRead, canWrite, isPending, receipt, outcome, error, pendingIntent } = lifecycle
const discardPending = shallowRef(false)
const fieldsValid = shallowRef(true)
watch(() => [props.productId, authoritative.value], () => { discardPending.value = false; fieldsValid.value = true })
watch(canRead, () => { discardPending.value = false; fieldsValid.value = true }, { flush: 'sync' })
const invalidHistoryContext = computed(() => vocabulary.value && qualification.value && sections.value.some(section => {
  if (!section.decoded?.readable) return false
  const document = section.decoded.document
  const result = validateEditorialAssignments({ document, persistedBaseline: document,
    vocabulary: vocabulary.value, context: qualification.value })
  return result.issues.some(issue => ['family', 'binding', 'variant', 'unit', 'option', 'archived'].includes(issue.code))
}))
const warnings = computed(() => (receipt.value?.warnings ?? []).map(warning => {
  const family = vocabulary.value?.families.find(item => item.id === warning.familyId)
  const definition = vocabulary.value?.definitions.find(item => item.id === warning.definitionId)
  const option = definition && (definition.type === 'single' || definition.type === 'multi')
    ? definition.options.find(item => item.code === warning.optionCode) : null
  const variant = qualification.value?.variants.find(item => item.id === warning.variantId)
  const bounded = (text: string) => text.slice(0, 80)
  return `${family?.label ?? 'Familia no disponible'} · ${definition?.label ?? 'Atributo no disponible'} · ${option?.label ?? bounded(warning.optionCode)} · ${warning.owner === 'product' ? 'Producto' : variant ? `${variant.name} · ${variant.id.slice(0, 8)}` : warning.variantId ? `Presentación ${bounded(warning.variantId)}` : 'Sin presentación'}`
}))
function familyLabel(code: string | null): string {
  return vocabulary.value?.families.find(item => item.code === code)?.label ?? code ?? 'Sin familia'
}
function assignmentText(assignment: EditorialValue): string {
  if (assignment.type === 'multi') return assignment.value.join(', ') || 'Sin opciones'
  if (assignment.type === 'boolean') return assignment.value ? 'Sí' : 'No'
  if (assignment.type === 'number') return `${assignment.value}${assignment.unit ? ` ${assignment.unit}` : ''}`
  return assignment.value
}
const refreshLabel = computed(() => {
  if (loading.value) return 'Actualizando…'
  if (!canWrite.value) return 'Actualizar contenido'
  return buffer.value ? 'Consultar y conservar cambios' : 'Consultar y cargar borrador'
})
async function refreshFromHeader() {
  // With no local buffer there are no edits to discard. Loading still requires
  // this explicit user action and a fresh GET, never the historical receipt.
  await editor.refresh(canWrite.value && buffer.value === null ? 'discard' : 'retain')
}
async function discard() { discardPending.value = false; await editor.refresh('discard') }
async function submit() { if (fieldsValid.value) await editor.save() }
</script>

<template>
  <main class="hf-theme hf-ui editorial-workspace" aria-labelledby="editorial-title">
    <header class="hf-page-header editorial-header">
      <div class="editorial-heading">
        <p class="editorial-eyebrow">PRODUCTO · CONTENIDO EDITORIAL</p>
        <h1 id="editorial-title" class="hf-page-title">Contenido editorial</h1>
        <p class="hf-page-subtitle">Edita el borrador por separado de los datos operativos. Guardar no publica el contenido.</p>
      </div>
      <div class="editorial-actions">
        <button class="editorial-button" type="button" data-testid="refresh-retain" :disabled="!canRead || loading || isPending" @click="refreshFromHeader">{{ refreshLabel }}</button>
        <button v-if="canWrite && buffer" class="editorial-button" type="button" data-testid="refresh-discard" :disabled="loading || isPending" @click="discardPending = true">Consultar y descartar cambios…</button>
        <button v-if="canWrite && buffer" class="hf-primary-control" type="submit" form="editorial-form" :disabled="!canSave || !fieldsValid">{{ isPending ? 'Enviando…' : 'Guardar borrador' }}</button>
      </div>
    </header>
    <p v-if="!canWrite" class="editorial-notice">Solo consulta. Necesitas permisos editoriales explícitos de lectura y actualización para editar.</p>
    <div v-if="discardPending && canRead" role="group" aria-labelledby="discard-title" class="editorial-panel confirmation">
      <h2 id="discard-title">Descartar cambios locales y consultar</h2><p>El borrador local se reemplazará con el resultado de una nueva consulta. Esta acción no envía cambios al servidor.</p>
      <div class="editorial-actions"><button type="button" class="editorial-button" data-testid="cancel-discard" @click="discardPending = false">Cancelar</button><button type="button" class="editorial-button" data-testid="confirm-discard" :disabled="loading || isPending" @click="discard">Descartar cambios y consultar</button></div>
    </div>
    <p v-if="errorMessage" role="alert" class="editorial-panel">{{ errorMessage }}</p>
    <template v-else>
      <p v-if="loading" role="status">{{ authoritative ? 'Actualizando contenido editorial…' : 'Cargando contenido editorial…' }}</p>
      <p v-if="metadataMessage" role="alert" class="editorial-panel warning">{{ metadataMessage }}</p>
      <div v-if="outcome || receipt" class="editorial-panel" aria-live="polite">
        <template v-if="outcome === 'acknowledged' || receipt">
          <h2>Acuse histórico{{ outcome === 'acknowledged' ? ' · solicitud confirmada' : ' · solicitud anterior' }}</h2>
          <p>Este acuse no representa el estado actual.</p>
          <p v-if="pendingIntent">Haz una consulta explícita y elige conservar o descartar los cambios antes de una nueva acción.</p>
          <p v-else>El estado de la consulta explícita se muestra por separado.</p>
          <p v-for="(warning, index) in warnings" :key="index" class="warning">Opción archivada conservada: {{ warning }}</p>
        </template>
        <p v-if="error" role="alert">{{ editorialErrorMessage(error.status) }}</p>
        <button v-if="outcome === 'ambiguous' && pendingIntent" type="button" class="editorial-button" :disabled="!canWrite || isPending || loading || !vocabulary || !qualification" @click="editor.retransmit()">Retransmitir la misma solicitud (mismo contenido y clave)</button>
        <p v-if="outcome === 'conflict'">No se reenvía automáticamente. Usa las opciones de consulta para reconciliar el borrador.</p>
      </div>
      <template v-if="authoritative">
        <p class="editorial-context">Ciclo editorial: {{ authoritative.cycle ?? 'Sin iniciar' }} · {{ authoritative.draft ? `Revisión consultada: ${authoritative.draft.revision}` : 'Sin borrador' }}</p>
        <div v-if="!authoritative.draft" class="editorial-panel">
          <p v-if="!authoritative.published">Todavía no hay contenido editorial. No existe un borrador ni una versión publicada.</p>
          <p v-else>La versión publicada permanece intacta. Puedes iniciar un borrador a partir de ella.</p>
          <button v-if="canWrite" type="button" class="editorial-button" data-testid="initialize" :disabled="!canInitialize" @click="editor.initialize()">{{ authoritative.published ? 'Iniciar borrador desde Publicado' : 'Iniciar borrador vacío' }}</button>
        </div>
        <p v-if="invalidHistoryContext" role="status" class="editorial-panel warning">Historial con atributos o contexto no disponibles. Se conserva intacto. Quita o corrige esos atributos en el borrador para poder guardarlo.</p>
        <form v-if="canWrite && buffer && vocabulary && qualification" id="editorial-form" class="editorial-form" aria-label="Editar borrador editorial" novalidate @submit.prevent="submit">
          <div v-if="issues.length" role="alert" class="editorial-panel warning"><p>Revisa el contenido antes de guardar.</p><ul><li v-for="(issue, index) in issues" :key="index">{{ issue.valueIndex === undefined ? '' : `Atributo ${issue.valueIndex + 1}: ` }}{{ editorialIssueMessage(issue) }}</li></ul></div>
          <EditorialDocumentFields :document="buffer" :baseline="authoritative.draft?.document" :vocabulary="vocabulary" :context="qualification" :issues="issues" :disabled="!editable" @update:document="editor.replaceDocument" @validity="fieldsValid = $event" />
          <p class="editorial-context">Sin guardado automático. El servidor valida el contenido y el contexto final.</p>
        </form>
        <div class="editorial-state" :aria-busy="loading">
          <section v-for="section in sections" :key="section.key" class="editorial-panel" :aria-labelledby="`editorial-${section.key}`">
            <header class="editorial-section-header"><h2 :id="`editorial-${section.key}`">{{ section.label }}{{ canWrite ? ' · historial consultado' : '' }}</h2><span v-if="section.revision !== null" class="editorial-context">Revisión {{ section.revision }}</span></header>
            <p v-if="!section.decoded">{{ section.key === 'draft' ? 'Sin borrador' : 'Sin versión publicada' }}</p>
            <p v-else-if="!section.decoded.readable" role="status">No se puede interpretar este documento. Se conserva sin cambios y solo se puede consultar su estado.</p>
            <template v-else>
              <dl class="editorial-facts"><div><dt>Título comercial editorial</dt><dd>{{ section.decoded.document.commercialTitle ?? 'Sin título editorial' }}</dd></div><div><dt>Familia editorial</dt><dd>{{ familyLabel(section.decoded.document.familyCode) }}</dd></div></dl>
              <p class="editorial-context">{{ section.decoded.document.mediaRefs.length }} referencias de medios conservadas · {{ section.decoded.document.values.length }} atributos guardados</p>
              <details class="editorial-details"><summary>Ver descripción editorial y atributos de {{ section.label.toLowerCase() }}</summary>
                <h3>Descripción editorial</h3><p class="editorial-description">{{ section.decoded.document.description ?? 'Sin descripción editorial' }}</p>
                <h3>Atributos guardados</h3><p v-if="!section.decoded.document.values.length">Sin atributos.</p>
                <dl v-else class="editorial-facts"><div v-for="value in section.decoded.document.values" :key="JSON.stringify([value.code, value.variantId])"><dt>{{ value.code }} · {{ value.owner === 'product' ? 'Producto' : 'Presentación' }}{{ value.variantId ? ` · ${value.variantId}` : '' }}</dt><dd>{{ assignmentText(value) }}</dd></div></dl>
              </details>
            </template>
          </section>
        </div>
      </template>
    </template>
  </main>
</template>

<style scoped>
.editorial-workspace { display: flex; flex-direction: column; gap: 24px; max-width: 1100px; margin: 0 auto; color: var(--hf-ink); }
.editorial-workspace .editorial-header, .editorial-section-header { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.editorial-heading { flex: 1 1 320px; min-width: 0; }
.editorial-actions { display: flex; flex-wrap: wrap; gap: 12px; min-width: 0; }
.editorial-actions > button { flex: 1 1 auto; white-space: normal; }
.editorial-eyebrow, .editorial-context, .editorial-notice, dt { color: var(--hf-muted); font-size: 14px; line-height: 1.5; }
.editorial-eyebrow { margin-bottom: 8px; }
.editorial-notice { padding: 16px; border-left: 3px solid var(--hf-border); }
.editorial-panel { display: grid; gap: 12px; padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); overflow-wrap: anywhere; min-width: 0; }
.editorial-state, .editorial-form { display: grid; gap: 24px; min-width: 0; }
.editorial-panel h2 { font-size: 18px; font-weight: 600; color: var(--hf-heading); }
.editorial-facts { display: grid; gap: 16px; margin: 16px 0; }
.editorial-facts dd { margin: 4px 0 0; white-space: pre-wrap; }
.editorial-details { margin-top: 16px; border-top: 1px solid var(--hf-border); }
.editorial-details summary { cursor: pointer; padding: 12px 0; min-height: 44px; color: var(--hf-heading); }
.editorial-details h3 { font-weight: 600; margin-top: 16px; }
.editorial-description { white-space: pre-wrap; margin-top: 8px; }
.editorial-button { min-height: var(--hf-control-height); padding: 8px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); color: var(--hf-ink); cursor: pointer; }
.editorial-button:hover:not(:disabled) { background: var(--hf-surface-muted); }
.editorial-button:disabled, .hf-primary-control:disabled { cursor: default; opacity: .65; }
.editorial-button:focus-visible, .editorial-details summary:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 3px; }
.warning { color: var(--hf-warning); }
.confirmation { background: var(--hf-warning-soft); }
@media (max-width: 480px) { .editorial-panel { padding: 16px; } .editorial-actions { width: 100%; } }
</style>
