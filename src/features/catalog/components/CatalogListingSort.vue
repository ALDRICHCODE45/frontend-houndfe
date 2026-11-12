<script setup lang="ts">
import { useId } from 'vue'
import type { CatalogProductsSort } from '../interfaces/public-catalog-products.types'

/**
 * Listing order (handoff 15 §1). Exactly the three real orders: `relevance` and
 * `rating_desc` behave like `newest` on the server, so «Relevancia» is never offered.
 */
defineProps<{ modelValue: CatalogProductsSort }>()
const emit = defineEmits<{ 'update:modelValue': [sort: CatalogProductsSort] }>()

const options: { value: CatalogProductsSort; label: string }[] = [
  { value: 'newest', label: 'Novedades' },
  { value: 'price_asc', label: 'Precio menor' },
  { value: 'price_desc', label: 'Precio mayor' },
]
const id = useId()

function onChange(value: unknown) {
  const match = options.find((option) => option.value === value)
  if (match) emit('update:modelValue', match.value)
}
</script>

<template>
  <div class="catalog-sort">
    <label :for="id">
      <span class="catalog-sort-long">Ordenar por</span>
      <span class="catalog-sort-short" aria-hidden="true">Orden</span>
    </label>
    <USelectMenu
      :id="id"
      :model-value="modelValue"
      :items="options"
      value-key="value"
      label-key="label"
      :search-input="false"
      class="catalog-sort-menu"
      :ui="{
        base: 'catalog-sort-trigger',
        content: 'catalog-sort-popup z-30',
        viewport: 'p-1.5',
        item: 'catalog-sort-option min-h-11 px-3 py-2',
      }"
      data-testid="catalog-sort-menu"
      @update:model-value="onChange"
    />
  </div>
</template>
