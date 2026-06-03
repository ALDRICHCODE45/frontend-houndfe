<script setup lang="ts">
import { useCatalogStore } from '../composables/useCatalogStore'

const catalog = useCatalogStore()
</script>

<template>
  <footer class="border-t border-default bg-default/50 py-6">
    <div class="mx-auto max-w-7xl px-4 text-center sm:px-6">
      <div class="flex items-center justify-center gap-2">
        <div class="flex size-6 items-center justify-center rounded-lg bg-orange-500 text-white">
          <UIcon name="i-lucide-paw-print" class="size-3.5" />
        </div>
        <span class="text-sm font-semibold text-highlighted">HoundFe</span>
      </div>
      <p class="mt-2 text-xs text-dimmed">
        Catálogo en línea · precios sujetos a cambio · {{ catalog.branches.length }} sucursales
      </p>
    </div>
  </footer>
</template>
