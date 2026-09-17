<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCatalogProductsCategoryFacetDto } from '../interfaces/public-catalog-products.types'

const props = defineProps<{
  /** Real category facets from the current product-list response. Informational only. */
  categories: PublicCatalogProductsCategoryFacetDto[]
  /**
   * Real result total from the current product-list response. `null` while no response exists:
   * an unknown total must never be rendered as an authoritative zero.
   */
  total: number | null
}>()

const resultTotalLabel = computed(() =>
  props.total === null ? null : `${props.total} ${props.total === 1 ? 'producto' : 'productos'}`,
)
</script>

<template>
  <div data-testid="catalog-category-bar" class="border-b border-default bg-default/60">
    <div
      class="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          class="shrink-0 rounded-full"
          disabled
          aria-label="Todas las categorías"
        >
          Todas las categorías
        </UButton>
        <UButton
          v-for="category in categories"
          :key="category.id"
          color="neutral"
          variant="outline"
          size="sm"
          class="min-w-0 max-w-full rounded-full"
          disabled
          :aria-label="category.name"
        >
          <span class="truncate">{{ category.name }}</span>
          <span class="ml-1.5 shrink-0 text-[11px] font-medium text-muted tabular-nums">{{
            category.count
          }}</span>
        </UButton>
      </div>

      <div class="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <p
          v-if="resultTotalLabel !== null"
          data-testid="catalog-result-total"
          class="text-xs font-medium text-muted tabular-nums"
        >
          {{ resultTotalLabel }}
        </p>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="shrink-0 rounded-full"
          disabled
          aria-label="Ordenar catálogo"
        >
          <template #leading><UIcon name="i-lucide-arrow-up-down" class="size-3.5" /></template>
          <span class="hidden sm:inline">Ordenar</span>
        </UButton>
      </div>
    </div>
  </div>
</template>
