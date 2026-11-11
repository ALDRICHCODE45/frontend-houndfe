<script setup lang="ts">
import { computed } from 'vue'

/** The hero shrunk to one slim bar while the visitor filters, searches or pages. */
const props = defineProps<{ branchName: string | null }>()
const pageTitle = computed(() =>
  props.branchName ? `Catálogo en línea de HoundFe, ${props.branchName}` : 'Catálogo en línea de HoundFe',
)
</script>

<template>
  <h1 class="sr-only">{{ pageTitle }}</h1>
  <section class="catalog-hero-bar" aria-label="HoundFe, tienda en línea">
    <div class="catalog-hero-bar-copy">
      <b>Todo para quienes te acompañan.</b>
      <span v-if="branchName">Precios y disponibilidad de {{ branchName }}.</span>
    </div>
    <div class="catalog-hero-bar-photo" role="img" aria-label="Un perro y un gato juntos" />
  </section>
</template>
