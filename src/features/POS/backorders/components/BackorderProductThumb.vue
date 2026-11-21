<script setup lang="ts">
/**
 * Product thumbnail of a backorder (design system «Image thumbnails open whole»): with an image it
 * is a `<button>` named «Ver imagen completa» that opens the lightbox; without one it is a quiet
 * placeholder and there is no button.
 */
import { ref } from 'vue'
import ProductImageLightbox from '@/features/POS/products/components/ProductImageLightbox.vue'

defineProps<{ src: string | null; alt: string; size?: 'sm' | 'lg' }>()

const open = ref(false)
</script>

<template>
  <span class="bo-thumb" :class="size === 'lg' ? 'bo-thumb--lg' : ''" data-row-ignore>
    <button
      v-if="src"
      type="button"
      class="bo-thumb__btn"
      aria-label="Ver imagen completa"
      data-testid="backorder-thumb"
      @click.stop="open = true"
    >
      <img :src="src" :alt="alt" loading="lazy" />
    </button>
    <span v-else class="bo-thumb__empty" aria-hidden="true"><UIcon name="i-lucide-package" /></span>
    <ProductImageLightbox v-if="src" :open="open" :src="src" :alt="alt" @close="open = false" />
  </span>
</template>
