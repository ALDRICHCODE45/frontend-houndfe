<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCatalogAttributeFacetDto } from '../interfaces/public-catalog-products.types'
import { mergeFacetOptions } from '../utils/facet-options'

/**
 * Recipient tiles, built only from the `animal.target` facet (S3, S8): labels and counts are the
 * facet's own, «Todos» carries the listing total and clears the recipient. No facet, no tiles.
 */
const props = defineProps<{
  facet: PublicCatalogAttributeFacetDto | null
  total: number | null
  /** Facet tokens currently in the URL. */
  selected: string[]
}>()
const emit = defineEmits<{ toggle: [tokens: string[]]; clear: [] }>()

/** Decoration only: the label and the count always come from the facet. */
function iconFor(token: string) {
  if (/(^|[.:])dog$/.test(token)) return 'i-lucide-dog'
  if (/(^|[.:])cat$/.test(token)) return 'i-lucide-cat'
  return 'i-lucide-paw-print'
}
const productsLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`

const tiles = computed(() => {
  if (!props.facet) return []
  const selected = new Set(props.selected)
  return mergeFacetOptions(props.facet).map((option) => ({
    key: option.tokens[0]!,
    tokens: option.tokens,
    label: option.label,
    count: option.count,
    icon: iconFor(option.tokens[0]!),
    pressed: option.tokens.some((token) => selected.has(token)),
    ariaLabel: `${option.label}, ${productsLabel(option.count)}`,
  }))
})
const allPressed = computed(() => !tiles.value.some((tile) => tile.pressed))
</script>

<template>
  <section
    v-if="facet && tiles.length > 0"
    class="catalog-recipients"
    aria-label="Explorar por destinatario"
  >
    <button
      type="button"
      class="catalog-recipient"
      :aria-pressed="allPressed"
      :aria-label="total === null ? 'Todos' : `Todos, ${productsLabel(total)}`"
      @click="emit('clear')"
    >
      <UIcon name="i-lucide-package" class="catalog-recipient-icon" aria-hidden="true" />
      <span class="catalog-recipient-text">
        <span>Todos</span>
        {{ ' ' }}
        <span v-if="total !== null" class="catalog-recipient-count">{{ total }}</span>
      </span>
      <UIcon
        v-if="allPressed"
        name="i-lucide-check"
        class="catalog-recipient-check"
        aria-hidden="true"
      />
    </button>
    <button
      v-for="tile in tiles"
      :key="tile.key"
      type="button"
      class="catalog-recipient"
      :aria-pressed="tile.pressed"
      :aria-label="tile.ariaLabel"
      @click="emit('toggle', tile.tokens)"
    >
      <UIcon :name="tile.icon" class="catalog-recipient-icon" aria-hidden="true" />
      <span class="catalog-recipient-text">
        <span>{{ tile.label }}</span>
        {{ ' ' }}
        <span class="catalog-recipient-count">{{ tile.count }}</span>
      </span>
      <UIcon
        v-if="tile.pressed"
        name="i-lucide-check"
        class="catalog-recipient-check"
        aria-hidden="true"
      />
    </button>
  </section>
</template>
