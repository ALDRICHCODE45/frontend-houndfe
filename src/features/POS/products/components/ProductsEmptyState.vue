<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string
  }>(),
  {
    message: 'No se encontraron productos',
  },
)
</script>

<template>
  <div
    class="products-empty-state flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="products-empty-state"
  >
    <div
      class="products-empty-icon flex size-12 items-center justify-center rounded-lg bg-elevated"
    >
      <UIcon name="i-lucide-package" class="size-6 text-muted" />
    </div>
    <p class="products-empty-title text-sm font-semibold text-highlighted">{{ message }}</p>
    <p class="products-empty-description text-sm text-muted">
      Los productos aparecerán aquí cuando estén disponibles.
    </p>
  </div>
</template>
