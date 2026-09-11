<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

function toggleDarkMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6">
      <div class="flex items-center gap-3 sm:gap-4">
        <div class="flex shrink-0 items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
            <UIcon name="i-lucide-store" class="size-5" />
          </div>
          <span class="hidden text-lg font-bold tracking-tight text-highlighted sm:block">Catálogo</span>
        </div>

        <UButton color="neutral" variant="outline" size="sm" class="shrink-0" disabled aria-label="Seleccionar sucursal">
          <template #leading><UIcon name="i-lucide-map-pin" class="size-3.5 text-orange-500" /></template>
          <span class="hidden text-xs font-medium uppercase tracking-wide sm:inline">Sucursal</span>
          <span class="text-xs font-medium uppercase tracking-wide sm:hidden">...</span>
        </UButton>

        <div class="relative min-w-0 flex-1">
          <UInput placeholder="Buscar en el catálogo" icon="i-lucide-search" size="sm" class="w-full" :ui="{ root: 'w-full' }" disabled aria-label="Buscar en el catálogo" />
        </div>

        <UButton color="neutral" variant="ghost" size="sm" class="shrink-0" aria-label="Cambiar tema" @click="toggleDarkMode">
          <UIcon :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" class="size-4" />
        </UButton>

        <UButton color="neutral" variant="outline" size="sm" class="shrink-0" disabled aria-label="Ver carrito">
          <template #leading><UIcon name="i-lucide-shopping-bag" class="size-5" /></template>
        </UButton>
      </div>
    </div>
  </header>
</template>
