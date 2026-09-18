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
  <article class="min-w-0">
    <button
      :aria-label="`Ver detalles de ${product.name}`"
      :data-catalog-product-id="product.id"
      class="group flex w-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-default bg-default text-left shadow-sm transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-coco-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 dark:hover:border-coco-700"
      type="button"
      @click="openDetail"
    >
      <div
        data-testid="catalog-product-media"
        class="relative aspect-square overflow-hidden bg-coco-neutral-100 dark:bg-coco-neutral-800"
      >
        <img
          v-if="showImage && productImageUrl"
          class="size-full object-cover"
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
          class="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-sm ring-1 ring-black/5 dark:bg-coco-neutral-900/90 dark:ring-white/10"
        >
          <span class="size-1.5 rounded-full" :class="availability.dot" />
          <span class="text-[11px] font-semibold" :class="availability.text">
            {{ availability.label }}
          </span>
        </span>
      </div>

      <div data-testid="catalog-product-body" class="flex flex-1 flex-col gap-1 p-4">
        <p
          v-if="product.brand"
          data-testid="catalog-product-brand"
          class="break-words text-[11px] font-semibold tracking-[0.14em] text-primary uppercase"
        >
          {{ product.brand.name }}
        </p>
        <h2 class="break-words text-sm leading-snug font-semibold text-highlighted">
          {{ product.name }}
        </h2>
        <p
          v-if="product.category"
          data-testid="catalog-product-category"
          class="break-words text-xs text-muted"
        >
          {{ product.category.name }}
        </p>

        <div class="flex-1" />

        <div class="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p
            v-if="formattedPrice"
            data-testid="catalog-product-price"
            class="min-w-0 break-words text-lg font-bold tracking-tight text-highlighted tabular-nums"
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
            class="min-w-0 break-words text-[11px] font-medium text-muted tabular-nums"
          >
            {{ presentationQuantity }}
          </span>
        </div>
      </div>
    </button>
  </article>
</template>
