<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EditorialWorkspace from '../components/editorial/EditorialWorkspace.vue'
import { productApi } from '../api/product.api'
const route = useRoute()
const router = useRouter()
const activeSection = shallowRef<'content' | 'review'>('content')
const productId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const productName = shallowRef('')
function goBack() {
  void router.push(productId.value ? `/pos/products/${productId.value}` : '/pos/products')
}
function goToProducts() {
  void router.push('/pos/products')
}
// The name is context only: a failed lookup leaves the generic title.
onMounted(async () => {
  if (!productId.value) return
  try {
    productName.value = (await productApi.getById(productId.value)).name ?? ''
  } catch {
    productName.value = ''
  }
})
</script>

<template>
  <main class="hf-theme hf-ui guided-workspace" aria-labelledby="guided-editorial-title">
    <header class="guided-header">
      <button type="button" class="guided-back" aria-label="Volver al producto" @click="goBack">
        <UIcon name="i-lucide-arrow-left" class="size-5" aria-hidden="true" />
      </button>
      <h1 id="guided-editorial-title" class="hf-page-title line-clamp-2 break-words">{{ productName || 'Producto' }}</h1>
    </header>
    <nav class="editorial-guide" aria-label="Tareas editoriales, sin orden obligatorio">
      <button type="button" :aria-current="activeSection === 'content' ? 'page' : undefined" @click="activeSection = 'content'">Contenido</button>
      <button type="button" :aria-current="activeSection === 'review' ? 'page' : undefined" @click="activeSection = 'review'">Revisar</button>
    </nav>
    <EditorialWorkspace class="guided-editor" embedded :active-section="activeSection" :product-id="productId" back-label="Volver a productos" @back="goToProducts">
      <template #summary="{ title, draftRevision, publishedRevision, dirty, acknowledged }">
        <aside class="editorial-summary" aria-label="Resumen editorial privado">
          <h2>Resumen editorial</h2>
          <p class="summary-title">{{ title || 'Sin título editorial guardado' }}</p>
          <dl class="summary-states">
            <div><dt>En el editor</dt><dd>{{ dirty ? 'Cambios locales sin guardar' : 'Sin cambios locales' }}</dd></div>
            <div><dt>Borrador guardado</dt><dd>{{ draftRevision === null ? 'Sin borrador consultado' : `Revisión consultada ${draftRevision}` }}</dd></div>
            <div><dt>Publicado</dt><dd>{{ publishedRevision === null ? 'Sin versión publicada' : `Revisión consultada ${publishedRevision}` }}</dd></div>
            <div><dt>Última solicitud</dt><dd>{{ acknowledged ? 'Acuse histórico; no es el estado actual' : 'Sin acuse histórico' }}</dd></div>
          </dl>
        </aside>
      </template>
    </EditorialWorkspace>
  </main>
</template>

<style scoped>
.guided-workspace { max-width: 1240px; margin: 0 auto; display: grid; gap: 24px; color: var(--hf-ink); font-family: var(--hf-font); }
.guided-header { display: flex; align-items: center; gap: 12px; min-width: 0; }
.guided-back { display: inline-grid; flex: none; place-items: center; width: 44px; height: 44px; border-radius: var(--hf-radius-control); color: var(--hf-muted); }
.guided-back:hover { background: var(--hf-surface-muted); color: var(--hf-heading); }
.guided-back:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.editorial-guide { display: flex; gap: 4px; border-bottom: 1px solid var(--hf-border); }
.editorial-guide button { flex: 1; min-height: 44px; padding: 12px 16px; border-radius: var(--hf-radius-control) var(--hf-radius-control) 0 0; color: var(--hf-muted); background: transparent; }
.editorial-guide button[aria-current="page"] { color: var(--hf-active); background: var(--hf-active-soft); box-shadow: inset 0 -2px var(--hf-active); font-weight: 600; }
.editorial-guide button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.guided-editor { display: grid; grid-template-columns: minmax(0, 1fr) 260px; align-items: start; max-width: none; width: 100%; }
.guided-editor :deep(.editorial-content) { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.guided-editor > .editorial-summary { grid-column: 2; position: sticky; top: 24px; }
.editorial-summary { min-width: 0; padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); overflow-wrap: anywhere; }
.editorial-summary h2 { color: var(--hf-heading); font-size: 16px; font-weight: 600; }
.summary-title { margin-top: 12px; white-space: pre-wrap; }
.summary-states { display: grid; gap: 16px; margin-top: 24px; font-size: 14px; }
.summary-states dt { color: var(--hf-muted); }
.summary-states dd { margin-top: 4px; }
@media (max-width: 800px) {
  .guided-editor { grid-template-columns: minmax(0, 1fr); }
  .guided-editor > .editorial-summary { grid-column: 1; position: static; padding: 16px; }
  .summary-states { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
