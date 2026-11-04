<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EditorialWorkspace from '../components/editorial/EditorialWorkspace.vue'
import { productApi } from '../api/product.api'
const route = useRoute()
const router = useRouter()
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
    <EditorialWorkspace class="guided-editor" embedded :product-id="productId" back-label="Volver a productos" @back="goToProducts" />
  </main>
</template>

<style scoped>
.guided-workspace { display: grid; gap: 24px; color: var(--hf-ink); font-family: var(--hf-font); }
.guided-header { display: flex; align-items: center; gap: 12px; min-width: 0; }
.guided-back { display: inline-grid; flex: none; place-items: center; width: 44px; height: 44px; border-radius: var(--hf-radius-control); color: var(--hf-muted); }
.guided-back:hover { background: var(--hf-surface-muted); color: var(--hf-heading); }
.guided-back:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.guided-editor { width: 100%; min-width: 0; }
</style>
