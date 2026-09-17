<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { PublicCatalogProductDto } from '../interfaces/public-catalog-products.types'

const props = defineProps<{ product: PublicCatalogProductDto }>()
const emit = defineEmits<{
  'open-detail': [productId: string, invoker: HTMLButtonElement]
}>()
const imageFailed = ref(false)

const priceCents = computed(() => {
  const value = props.product.price.fromPriceCents ?? props.product.price.priceCents
  return typeof value === 'number' && Number.isInteger(value) ? value : null
})
const formattedPrice = computed(() => {
  const cents = priceCents.value
  return !props.product.price.hidden && cents !== null ? formatCentsMXN(cents) : null
})
const availabilityConfig = {
  available: { label: 'Disponible', dot: 'bg-emerald-400', text: 'text-emerald-600' },
  low_stock: { label: 'Pocas piezas', dot: 'bg-amber-400', text: 'text-amber-600' },
  out_of_stock: { label: 'Agotado', dot: 'bg-red-400', text: 'text-red-600' },
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
      class="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-100 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.96] dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:ring-zinc-600"
      type="button"
      @click="openDetail"
    >
      <div
        class="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-100 dark:bg-zinc-700"
      >
        <img
          v-if="product.image && !imageFailed"
          class="size-full object-cover"
          :src="product.image.url"
          :alt="`Imagen de ${product.name}`"
          @error="imageFailed = true"
        />
        <div
          v-else
          data-testid="catalog-product-image-fallback"
          class="flex size-full items-center justify-center"
          :aria-label="`Imagen no disponible para ${product.name}`"
          role="img"
        >
          <UIcon name="i-lucide-package" class="size-12 text-gray-400/50" />
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-1.5 p-4">
        <p
          v-if="product.brand"
          class="break-words text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
        >
          {{ product.brand.name }}
        </p>
        <h2 class="break-words text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {{ product.name }}
        </h2>
        <p v-if="product.category" class="break-words text-xs text-gray-500 dark:text-gray-400">
          {{ product.category.name }}
        </p>

        <div class="flex-1" />

        <div class="mt-1 flex min-w-0 items-end justify-between gap-3">
          <p v-if="formattedPrice" class="text-base font-bold text-gray-900 dark:text-gray-100">
            {{ formattedPrice }}
          </p>
          <p v-else class="text-sm font-medium italic text-gray-500">Consultar precio</p>

          <div class="flex shrink-0 flex-col items-end gap-1">
            <span v-if="presentationQuantity" class="text-[10px] font-medium text-gray-500">
              {{ presentationQuantity }}
            </span>
            <div v-if="availability" class="flex items-center gap-1">
              <span class="size-1.5 rounded-full" :class="availability.dot" />
              <span class="text-[10px] font-medium" :class="availability.text">
                {{ availability.label }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  </article>
</template>
