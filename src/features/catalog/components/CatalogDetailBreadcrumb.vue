<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

/**
 * The trail back to the listing. The crumbs (Catálogo › categoría › producto) belong to wide screens;
 * the back link, which keeps the listing the shopper came from, is on every screen. The `actions`
 * slot carries the mobile share control, which the design places in this row.
 */
defineProps<{
  productName: string
  catalogTo: RouteLocationRaw
  category: { name: string; to: RouteLocationRaw } | null
  backTo: RouteLocationRaw
  backLabel: string
}>()
</script>

<template>
  <div class="catalog-pdp-crumbs">
    <nav data-testid="catalog-detail-crumbs" aria-label="Ruta de navegación">
      <ol>
        <li>
          <RouterLink :to="catalogTo">Catálogo</RouterLink>
          <UIcon name="i-lucide-chevron-right" class="size-3.5" aria-hidden="true" />
        </li>
        <li v-if="category">
          <RouterLink :to="category.to">{{ category.name }}</RouterLink>
          <UIcon name="i-lucide-chevron-right" class="size-3.5" aria-hidden="true" />
        </li>
        <li>
          <span aria-current="page">{{ productName }}</span>
        </li>
      </ol>
    </nav>
    <RouterLink data-testid="catalog-detail-back" class="catalog-pdp-back" :to="backTo">
      <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
      {{ backLabel }}
    </RouterLink>
    <slot name="actions" />
  </div>
</template>
