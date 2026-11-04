<script setup lang="ts">
/**
 * ProductDetailSkeleton — The loading shape of the product workspace: the
 * form cards on the left and the summary panel on the right, never a blank
 * screen.
 */
</script>

<template>
  <div class="product-skeleton-grid" data-testid="product-detail-skeleton" aria-busy="true">
    <div class="min-w-0 space-y-6">
      <USkeleton class="h-11 w-full max-w-md rounded-lg" />
      <div v-for="card in 2" :key="card" class="rounded-xl border border-default p-6">
        <USkeleton class="h-5 w-40" />
        <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <USkeleton class="h-10 md:col-span-2" />
          <USkeleton class="h-10" />
          <USkeleton class="h-10" />
        </div>
      </div>
    </div>
    <div class="rounded-xl border border-default p-6">
      <div class="flex items-center gap-4">
        <USkeleton class="h-22 w-18 rounded-lg" />
        <USkeleton class="h-5 flex-1" />
      </div>
      <USkeleton class="mt-6 h-9 w-32" />
      <USkeleton class="mt-4 h-4 w-full" />
    </div>
  </div>
</template>

<style scoped>
.product-skeleton-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 24px;
  min-width: 0;
}
@media (max-width: 720px) {
  .product-skeleton-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
