<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { PublicCatalogProductDto } from '../interfaces/public-catalog-products.types'

const props = defineProps<{ product: PublicCatalogProductDto }>()
const emit = defineEmits<{
  'open-detail': [productId: string, invoker: HTMLButtonElement]
}>()
/**
 * The failure is keyed to the exact URL that failed, so a new URL on the same mounted card is always
 * attempted instead of staying suppressed by a stale failure.
 */
const failedImageUrl = ref<string | null>(null)
const productImageUrl = computed(() => props.product.image?.url ?? null)
const showImage = computed(
  () => productImageUrl.value !== null && failedImageUrl.value !== productImageUrl.value,
)

watch(
  () => props.product.id,
  () => {
    // A different product is a different media set: a stale failure must never suppress its image.
    failedImageUrl.value = null
  },
)

function markImageFailed() {
  failedImageUrl.value = productImageUrl.value
}

const priceCents = computed(() => {
  const value = props.product.price.fromPriceCents ?? props.product.price.priceCents
  return typeof value === 'number' && Number.isInteger(value) ? value : null
})
const formattedPrice = computed(() => {
  const cents = priceCents.value
  return !props.product.price.hidden && cents !== null ? formatCentsMXN(cents) : null
})
const availabilityConfig = {
  available: {
    label: 'Disponible',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  low_stock: {
    label: 'Pocas piezas',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  out_of_stock: {
    label: 'Agotado',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
} as const
const availability = computed(() => {
  const presentation = props.product.stockPresentation
  if (presentation.mode === 'HIDDEN' || presentation.status === null) return null
  return availabilityConfig[presentation.status]
})
const presentationQuantity = computed(() => {
  const presentation = props.product.stockPresentation
  return presentation.mode === 'CUSTOM_QUANTITY' && presentation.customQuantity !== null
    ? `${presentation.customQuantity} unidades`
    : null
})

function openDetail(event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLButtonElement)) return
  emit('open-detail', props.product.id, event.currentTarget)
}
</script>

<template>
  <article class="h-full min-w-0">
    <button
      :aria-label="`Ver detalles de ${product.name}`"
      :data-catalog-product-id="product.id"
      class="catalog-product-card group flex h-full w-full min-w-0 flex-col overflow-hidden border border-default bg-default text-left"
      type="button"
      @click="openDetail"
    >
      <div
        data-testid="catalog-product-media"
        class="catalog-product-media relative w-full shrink-0 overflow-hidden"
      >
        <img
          v-if="showImage && productImageUrl"
          class="catalog-product-image object-contain"
          :src="productImageUrl"
          :alt="`Imagen de ${product.name}`"
          @error="markImageFailed"
        />
        <div
          v-else
          data-testid="catalog-product-image-fallback"
          class="flex size-full flex-col items-center justify-center gap-2.5 bg-coco-50 px-4 text-center dark:bg-coco-950/40"
          :aria-label="`Imagen no disponible para ${product.name}`"
          role="img"
        >
          <!--
            Honest media absence: a calm cobalt surface, one contained glyph and the written state.
            It never substitutes an invented URL, and the visible copy is never icon-only.
          -->
          <span
            class="flex size-14 items-center justify-center rounded-2xl bg-white/80 text-coco-500 ring-1 ring-coco-200/80 dark:bg-coco-900/50 dark:text-coco-300 dark:ring-coco-800/60"
          >
            <UIcon name="i-lucide-image-off" class="size-6" />
          </span>
          <span class="text-xs font-medium text-coco-700 dark:text-coco-200">
            Imagen no disponible
          </span>
        </div>

        <span
          v-if="availability"
          data-testid="catalog-product-availability"
          class="catalog-product-availability inline-flex max-w-full items-center gap-1.5"
        >
          <span class="size-1.5 rounded-full" :class="availability.dot" />
          <span class="text-xs font-semibold" :class="availability.text">
            {{ availability.label }}
          </span>
        </span>
      </div>

      <div
        data-testid="catalog-product-body"
        class="catalog-product-body flex w-full min-w-0 flex-1 flex-col"
      >
        <p
          v-if="product.brand"
          data-testid="catalog-product-brand"
          class="catalog-product-brand break-words font-medium text-muted"
        >
          {{ product.brand.name }}
        </p>
        <h2 class="catalog-product-name break-words font-semibold text-highlighted">
          {{ product.name }}
        </h2>
        <p
          v-if="product.category"
          data-testid="catalog-product-category"
          class="catalog-product-category break-words text-sm text-muted"
        >
          {{ product.category.name }}
        </p>

        <p
          v-if="product.hasVariants && formattedPrice"
          class="catalog-product-price-note text-muted"
        >
          Precio de referencia
        </p>
        <div
          class="catalog-product-price-row flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1"
        >
          <p
            v-if="formattedPrice"
            data-testid="catalog-product-price"
            class="catalog-product-price min-w-0 break-words font-bold tracking-tight text-highlighted tabular-nums"
          >
            {{ formattedPrice }}
          </p>
          <p
            v-else
            data-testid="catalog-product-price"
            class="min-w-0 break-words text-sm font-medium text-muted"
          >
            Consultar precio
          </p>
          <span
            v-if="presentationQuantity"
            data-testid="catalog-product-quantity"
            class="min-w-0 break-words text-sm font-medium text-muted tabular-nums"
          >
            {{ presentationQuantity }}
          </span>
        </div>
        <p
          v-if="product.hasVariants && formattedPrice"
          class="catalog-product-price-note text-muted"
        >
          Consulta los precios por presentación en el detalle.
        </p>
        <span class="catalog-product-action">
          Ver detalles
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0" aria-hidden="true" />
        </span>
      </div>
    </button>
  </article>
</template>
