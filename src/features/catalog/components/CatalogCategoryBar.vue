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
  <!--
    The band stays transparent so the page has no full-bleed divider. The informational controls
    live on one contained, ringed surface instead of a page-wide rule.
  -->
  <div data-testid="catalog-category-bar" class="bg-transparent px-4 py-3 sm:px-6">
    <div
      data-testid="catalog-category-toolbar"
      class="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl bg-elevated px-3 py-3 shadow-sm ring-1 ring-default sm:flex-row sm:items-center sm:justify-between sm:px-4"
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
