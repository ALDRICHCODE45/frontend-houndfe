<script setup lang="ts">
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { getProductColor } from '../data/mock-catalog'
import type { PublicCatalogProductCard } from '../interfaces/catalog.types'

const props = defineProps<{
  product: PublicCatalogProductCard
  index: number
}>()

const emit = defineEmits<{
  select: [productId: string]
}>()

const colorClass = getProductColor(props.index)

const availabilityConfig = {
  available: { label: 'Disponible', dot: 'bg-emerald-400', text: 'text-emerald-600' },
  low_stock: { label: 'Pocas piezas', dot: 'bg-amber-400', text: 'text-amber-600' },
  out_of_stock: { label: 'Agotado', dot: 'bg-red-400', text: 'text-red-600' },
} as const

const badgeColors: Record<string, string> = {
  'Mas vendido': 'bg-gray-900 text-white',
  'Premium': 'bg-gray-900 text-white',
  'Favorito': 'bg-gray-900 text-white',
  'Nuevo': 'bg-gray-900 text-white',
}
</script>

<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:shadow-md hover:ring-gray-200 dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:ring-zinc-600"
    :class="{ 'opacity-60': product.availability === 'out_of_stock' }"
  >
    <!-- Image placeholder with pastel color -->
    <div
      class="relative flex aspect-square items-center justify-center overflow-hidden"
      :class="colorClass"
    >
      <!-- Featured badge -->
      <div
        v-if="product.featuredLabel"
        class="absolute left-3 top-3 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
        :class="badgeColors[product.featuredLabel] ?? 'bg-gray-900 text-white'"
      >
        {{ product.featuredLabel }}
      </div>

      <!-- Product icon placeholder -->
      <UIcon
        name="i-lucide-package"
        class="size-12 text-gray-400/30 transition-transform duration-300 group-hover:scale-110"
      />
    </div>

    <!-- Content -->
    <div class="flex flex-1 flex-col gap-1.5 p-4">
      <!-- Brand -->
      <p
        v-if="product.brand"
        class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
      >
        {{ product.brand.name }}
      </p>

      <!-- Name -->
      <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
        {{ product.name }}
      </h3>

      <!-- Rating + Variants -->
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <template v-if="product.rating !== null">
          <span class="flex items-center gap-0.5">
            <UIcon name="i-lucide-star" class="size-3 fill-amber-400 text-amber-400" />
            <span class="font-medium">{{ product.rating.toFixed(1) }}</span>
          </span>
        </template>
        <span v-if="product.hasVariants && product.rating !== null" class="text-gray-300">·</span>
        <span v-if="product.hasVariants" class="text-gray-400">
          Variantes disponibles
        </span>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Price + Availability -->
      <div class="mt-1 flex items-end justify-between">
        <div>
          <p
            v-if="!product.price.hidden"
            class="text-base font-bold text-gray-900 dark:text-gray-100"
          >
            <span v-if="product.hasVariants" class="text-xs font-normal text-gray-500">desde </span>
            {{ formatCentsMXN(product.price.fromPriceCents ?? product.price.priceCents ?? 0) }}
          </p>
          <p v-else class="text-sm font-medium text-gray-500 italic">
            Consultar precio
          </p>
        </div>

        <div class="flex items-center gap-1">
          <span
            class="size-1.5 rounded-full"
            :class="availabilityConfig[product.availability].dot"
          />
          <span
            class="text-[10px] font-medium"
            :class="availabilityConfig[product.availability].text"
          >
            {{ availabilityConfig[product.availability].label }}
          </span>
        </div>
      </div>

      <!-- View link -->
      <button
        class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-500 transition-colors hover:text-orange-600"
        @click="emit('select', product.id)"
      >
        Ver
        <UIcon name="i-lucide-chevron-right" class="size-3" />
      </button>
    </div>
  </article>
</template>
