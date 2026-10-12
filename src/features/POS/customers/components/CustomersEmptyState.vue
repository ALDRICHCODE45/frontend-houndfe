<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), {
  message: 'No se encontraron clientes',
})
</script>

<template>
  <div
    class="clients-empty-state flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="customers-empty-state"
  >
    <div class="clients-empty-icon flex items-center justify-center">
      <UIcon name="i-lucide-users" class="size-6" />
    </div>
    <p class="clients-empty-title">{{ message }}</p>
  </div>
</template>
