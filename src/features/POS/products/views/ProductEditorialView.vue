<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useEditorialState } from '../composables/useEditorialState'
import type { EditorialValue } from '../interfaces/product-editorial.types'
import '@/core/shared/design-system/houndfe-ui.css'

const route = useRoute()
const { state, sections, errorMessage, enabled, isFetching, refresh } = useEditorialState(
  () => typeof route.params.id === 'string' ? route.params.id : '',
)
function assignmentText(assignment: EditorialValue): string {
  if (assignment.type === 'multi') return assignment.value.join(', ') || 'Sin opciones'
  if (assignment.type === 'boolean') return assignment.value ? 'Sí' : 'No'
  if (assignment.type === 'number') return `${assignment.value}${assignment.unit ? ` ${assignment.unit}` : ''}`
  return assignment.value
}
</script>

<template>
  <main class="hf-theme hf-ui editorial-workspace" aria-labelledby="editorial-title">
    <header class="hf-page-header editorial-header">
      <div class="editorial-heading">
        <p class="editorial-eyebrow">PRODUCTO · CONTENIDO EDITORIAL</p>
        <h1 id="editorial-title" class="hf-page-title">Contenido editorial</h1>
        <p class="hf-page-subtitle">Consulta el borrador y la versión publicada, separados de los datos operativos del producto.</p>
      </div>
      <button class="editorial-refresh" type="button" :disabled="!enabled || isFetching" @click="refresh">
        {{ isFetching ? 'Actualizando…' : 'Actualizar contenido' }}
      </button>
    </header>

    <p class="editorial-notice">Solo consulta. La edición todavía no está disponible; no se realizan cambios desde esta pantalla.</p>
    <p v-if="errorMessage" role="alert" class="editorial-panel">{{ errorMessage }}</p>
    <p v-else-if="!state" role="status" class="editorial-panel">Cargando contenido editorial…</p>
    <div v-else class="editorial-state" :aria-busy="isFetching">
      <p v-if="isFetching" role="status">Actualizando contenido editorial…</p>
      <p v-if="!state.draft && !state.published" class="editorial-panel">Todavía no hay contenido editorial. No existe un borrador ni una versión publicada.</p>
      <p class="editorial-context">Ciclo editorial: {{ state.cycle ?? 'Sin iniciar' }}</p>
      <section v-for="section in sections" :key="section.key" class="editorial-panel" :aria-labelledby="`editorial-${section.key}`">
        <header class="editorial-section-header">
          <h2 :id="`editorial-${section.key}`">{{ section.label }}</h2>
          <span v-if="section.revision !== null" class="editorial-context">Revisión {{ section.revision }}</span>
        </header>
        <p v-if="!section.decoded">{{ section.key === 'draft' ? 'Sin borrador' : 'Sin versión publicada' }}</p>
        <p v-else-if="!section.decoded.readable" role="status">No se puede interpretar este documento. Se conserva sin cambios y solo se puede consultar su estado.</p>
        <template v-else>
          <dl class="editorial-facts">
            <div>
              <dt>Título comercial editorial</dt>
              <dd>{{ section.decoded.document.commercialTitle ?? 'Sin título editorial' }}</dd>
            </div>
            <div>
              <dt>Familia editorial (código)</dt>
              <dd>{{ section.decoded.document.familyCode ?? 'Sin familia' }}</dd>
            </div>
          </dl>
          <p class="editorial-context">{{ section.decoded.document.mediaRefs.length }} referencias de medios conservadas · {{ section.decoded.document.values.length }} atributos guardados</p>
          <details class="editorial-details">
            <summary>Ver descripción editorial y atributos de {{ section.label.toLowerCase() }}</summary>
            <h3>Descripción editorial</h3>
            <p class="editorial-description">{{ section.decoded.document.description ?? 'Sin descripción editorial' }}</p>
            <h3>Atributos guardados</h3>
            <p v-if="!section.decoded.document.values.length">Sin atributos.</p>
            <dl v-else class="editorial-facts">
              <div v-for="value in section.decoded.document.values" :key="JSON.stringify([value.code, value.variantId])">
                <dt>{{ value.code }} · {{ value.owner === 'product' ? 'Producto' : 'Presentación' }}{{ value.variantId ? ` · ${value.variantId}` : '' }}</dt>
                <dd>{{ assignmentText(value) }}</dd>
              </div>
            </dl>
          </details>
        </template>
      </section>
    </div>
  </main>
</template>

<style scoped>
.editorial-workspace { display: flex; flex-direction: column; gap: 24px; max-width: 1100px; margin: 0 auto; color: var(--hf-ink); }
.editorial-workspace .editorial-header, .editorial-section-header { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.editorial-heading { flex: 1 1 320px; min-width: 0; }
.editorial-eyebrow, .editorial-context, .editorial-notice, dt { color: var(--hf-muted); font-size: 14px; line-height: 1.5; }
.editorial-eyebrow { margin-bottom: 8px; }
.editorial-notice { padding: 16px; border-left: 3px solid var(--hf-border); }
.editorial-panel { padding: 24px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); overflow-wrap: anywhere; }
.editorial-state { display: grid; gap: 16px; min-width: 0; }
.editorial-section-header h2 { font-size: 18px; font-weight: 600; color: var(--hf-heading); }
.editorial-facts { display: grid; gap: 16px; margin: 16px 0; }
.editorial-facts dd { margin: 4px 0 0; white-space: pre-wrap; }
.editorial-details { margin-top: 16px; border-top: 1px solid var(--hf-border); }
.editorial-details summary { cursor: pointer; padding: 12px 0; min-height: 44px; color: var(--hf-heading); }
.editorial-details h3 { font-weight: 600; margin-top: 16px; }
.editorial-description { white-space: pre-wrap; margin-top: 8px; }
.editorial-refresh { min-height: 44px; padding: 8px 16px; border: 1px solid var(--hf-border); border-radius: 6px; background: var(--hf-surface); color: var(--hf-ink); cursor: pointer; }
.editorial-refresh:hover:not(:disabled) { background: var(--hf-surface-muted); }
.editorial-refresh:disabled { cursor: default; opacity: 0.65; }
.editorial-refresh:focus-visible, .editorial-details summary:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 3px; }
@media (max-width: 480px) { .editorial-panel { padding: 16px; } .editorial-refresh { width: 100%; } }
</style>
