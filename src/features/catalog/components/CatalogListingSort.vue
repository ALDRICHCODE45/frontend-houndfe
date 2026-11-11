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

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
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
    <select :id="id" :value="modelValue" @change="onChange">
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <UIcon name="i-lucide-chevron-down" class="catalog-sort-chevron" aria-hidden="true" />
  </div>
</template>
