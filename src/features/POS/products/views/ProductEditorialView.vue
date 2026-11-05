<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EditorialWorkspace from '../components/editorial/EditorialWorkspace.vue'
import { productApi } from '../api/product.api'
const route = useRoute()
const router = useRouter()
const productId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const productName = shallowRef('')
// loading → named | unnamed (any other failure) | missing (404)
const nameState = shallowRef<'loading' | 'named' | 'unnamed' | 'missing'>('loading')
function goBack() {
  void router.push(productId.value ? `/pos/products/${productId.value}` : '/pos/products')
}
function goToProducts() {
  void router.push('/pos/products')
}
// The name is context only: a failed lookup leaves the generic title, except a
// missing product, which has no content to show.
onMounted(async () => {
  if (!productId.value) {
    nameState.value = 'unnamed'
    return
  }
  try {
    productName.value = (await productApi.getById(productId.value)).name ?? ''
    nameState.value = productName.value ? 'named' : 'unnamed'
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status
    nameState.value = status === 404 ? 'missing' : 'unnamed'
  }
})
</script>

<template>
  <main v-if="nameState === 'missing'" class="hf-theme hf-ui guided-workspace" aria-label="Producto no encontrado">
    <EmptyState
      title="No encontramos el producto"
      description="Pudo haberse eliminado o el enlace no es correcto."
      action-label="Volver a productos"
      action-icon="i-lucide-arrow-left"
      @action="goToProducts"
    />
  </main>
  <main v-else class="hf-theme hf-ui guided-workspace" aria-labelledby="guided-editorial-title">
    <header class="guided-header">
      <button type="button" class="guided-back" aria-label="Volver al producto" @click="goBack">
        <UIcon name="i-lucide-arrow-left" class="size-5" aria-hidden="true" />
      </button>
      <h1
        id="guided-editorial-title"
        class="hf-page-title line-clamp-2 min-w-0 flex-1 break-words"
        :aria-busy="nameState === 'loading' ? 'true' : undefined"
      >
        <span v-if="nameState === 'loading'" class="hf-skeleton animate-pulse guided-title-skeleton" data-testid="editorial-title-skeleton" />
        <template v-else>{{ productName || 'Producto' }}</template>
      </h1>
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
/* One line of the title's own height, so the header does not jump when the name arrives. */
.guided-title-skeleton { display: block; width: min(24rem, 70%); height: 1em; border-radius: var(--hf-radius-control); }
.guided-editor { width: 100%; min-width: 0; }
</style>
