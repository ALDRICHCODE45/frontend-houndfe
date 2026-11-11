<script setup lang="ts">
import type { FilterGroup, FilterOption } from '../utils/filter-model'
import CatalogFilterGroup from './CatalogFilterGroup.vue'

/** Desktop filters (artboard 01): groups apply as soon as a row is pressed. */
defineProps<{ groups: FilterGroup[]; hint: boolean }>()
const emit = defineEmits<{ select: [option: FilterOption] }>()
</script>

<template>
  <aside class="catalog-filter-sidebar" aria-label="Filtros del catálogo">
    <div class="catalog-filter-sidebar-head">
      <span>Filtrar por</span>
      <UIcon name="i-lucide-sliders-horizontal" class="size-4" aria-hidden="true" />
    </div>
    <CatalogFilterGroup
      v-for="group in groups"
      :key="group.key"
      :group="group"
      @select="emit('select', $event)"
    />
    <p v-if="hint" class="catalog-filter-hint">
      <UIcon name="i-lucide-info" class="size-4" aria-hidden="true" />
      Elige un destinatario para ver filtros de etapa, tamaño y más.
    </p>
  </aside>
</template>
