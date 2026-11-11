<script lang="ts">
/** One removable active filter; `key` identifies it for the view (facet chips carry their tokens). */
export interface CatalogActiveFilterChip {
  kind: 'search' | 'category' | 'facet'
  key: string
  label: string
  tokens?: string[]
}
</script>

<script setup lang="ts">
defineProps<{ chips: CatalogActiveFilterChip[] }>()
const emit = defineEmits<{ remove: [chip: CatalogActiveFilterChip]; clear: [] }>()

function ariaLabel(chip: CatalogActiveFilterChip) {
  return chip.kind === 'search' ? `Quitar búsqueda: ${chip.label}` : `Quitar filtro: ${chip.label}`
}
</script>

<template>
  <div v-if="chips.length > 0" class="catalog-chips" role="group" aria-label="Filtros activos">
    <button
      v-for="chip in chips"
      :key="`${chip.kind}:${chip.key}`"
      type="button"
      class="catalog-chip"
      :aria-label="ariaLabel(chip)"
      @click="emit('remove', chip)"
    >
      {{ chip.kind === 'search' ? `“${chip.label}”` : chip.label }}
      <UIcon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
    </button>
    <button type="button" class="catalog-chips-clear" @click="emit('clear')">Limpiar todo</button>
  </div>
</template>
