<template>
  <div class="border-b border-default bg-default/50">
    <div class="mx-auto max-w-7xl px-4 sm:px-6">
      <div class="flex items-center justify-between gap-4 py-3">
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-hide">
          <UButton color="neutral" variant="outline" size="sm" class="shrink-0" disabled aria-label="Todas las categorías">
            Todas las categorías
          </UButton>
        </div>

        <UButton color="neutral" variant="outline" size="xs" class="shrink-0" disabled aria-label="Ordenar catálogo">
          <template #leading><UIcon name="i-lucide-arrow-up-down" class="size-3.5" /></template>
          <span class="hidden sm:inline">Ordenar</span>
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
