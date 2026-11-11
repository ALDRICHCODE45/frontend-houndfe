<script setup lang="ts">
/**
 * Header search (artboards 01, 02). The draft is the view's; only a submit commits it,
 * so typing never requests products. Clearing lives in the active-filter chips.
 */
const draft = defineModel<string>({ required: true })
const emit = defineEmits<{ submit: [value: string] }>()
</script>

<template>
  <form class="catalog-search" role="search" @submit.prevent="emit('submit', draft)">
    <label for="catalog-search" class="sr-only">Buscar productos o marcas</label>
    <UIcon name="i-lucide-search" class="catalog-search-icon" aria-hidden="true" />
    <input
      id="catalog-search"
      v-model="draft"
      type="search"
      placeholder="Buscar productos o marcas"
      autocomplete="off"
    />
    <button type="submit" class="catalog-search-submit">Buscar</button>
  </form>
</template>
