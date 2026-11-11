<script setup lang="ts">
import { computed } from 'vue'

/** «Nuestro catálogo» with the real listing total, MXN and the selected branch. */
const props = defineProps<{ total: number | null; branchName: string | null }>()
const totalLabel = computed(() =>
  props.total === null ? null : `${props.total} ${props.total === 1 ? 'producto' : 'productos'}`,
)
</script>

<template>
  <div class="catalog-listing-heading">
    <div>
      <p class="catalog-listing-eyebrow">Encuentra lo que necesitas</p>
      <h2>
        Nuestro catálogo
        <span v-if="totalLabel" data-testid="catalog-result-total" role="status" class="catalog-listing-count">{{
          totalLabel
        }}</span>
      </h2>
    </div>
    <p class="catalog-listing-context">
      <UIcon name="i-lucide-tag" class="size-4" aria-hidden="true" />
      {{ branchName ? `Precios en MXN · ${branchName}` : 'Precios en MXN' }}
    </p>
  </div>
</template>
