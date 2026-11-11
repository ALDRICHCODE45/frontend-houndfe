<script setup lang="ts">
/** Reserves the gallery, title, price and presentations so nothing jumps when the data arrives. */
const thumbs = [0, 1, 2, 3]
const presentations = [0, 1, 2]
</script>

<template>
  <div data-testid="catalog-detail-loading" class="catalog-pdp-skeleton" aria-busy="true">
    <p class="sr-only" role="status">Cargando producto…</p>
    <div class="catalog-pdp-skeleton-gallery">
      <USkeleton class="catalog-pdp-skeleton-main" />
      <div class="catalog-pdp-skeleton-thumbs">
        <USkeleton v-for="thumb in thumbs" :key="thumb" class="catalog-pdp-skeleton-thumb" />
      </div>
    </div>
    <div class="catalog-pdp-skeleton-buy">
      <USkeleton class="h-3 w-1/3 rounded" />
      <USkeleton class="h-8 w-5/6 rounded-lg" />
      <USkeleton class="h-8 w-2/5 rounded-lg" />
      <USkeleton class="h-4 w-1/2 rounded" />
      <div class="catalog-pdp-skeleton-presentations">
        <USkeleton
          v-for="presentation in presentations"
          :key="presentation"
          class="h-[84px] rounded-xl"
        />
      </div>
      <USkeleton class="h-12 w-full rounded-lg" />
    </div>
  </div>
</template>
