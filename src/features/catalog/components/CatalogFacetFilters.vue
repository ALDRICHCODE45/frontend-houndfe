<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCatalogAttributeFacetDto } from '../interfaces/public-catalog-products.types'

/**
 * Attribute facets as toggle chips (Selección sin checkboxes). Definitions and options come from
 * the current filtered listing in server order; the selection is the URL's facet tokens.
 */
const props = defineProps<{
  facets: PublicCatalogAttributeFacetDto[]
  /** Facet tokens `<definition code>:<option code>` currently in the URL. */
  selected: string[]
}>()
const emit = defineEmits<{ toggle: [token: string]; clear: [] }>()

const selectedTokens = computed(() => new Set(props.selected))
const groups = computed(() =>
  props.facets.map((definition) => {
    const options = definition.options.map((option) => {
      const token = `${definition.code}:${option.code}`
      return {
        token,
        label: option.label,
        count: option.count,
        pressed: selectedTokens.value.has(token),
        ariaLabel: `${definition.label}: ${option.label}, ${option.count} ${option.count === 1 ? 'producto' : 'productos'}`,
      }
    })
    return {
      code: definition.code,
      label: definition.label,
      labelId: `catalog-facet-${definition.code.replace(/[^A-Za-z0-9_-]/g, '-')}`,
      options,
      active: options
        .filter((option) => option.pressed)
        .map((option) => option.label)
        .join(', '),
    }
  }),
)
</script>

<template>
  <div
    v-if="facets.length > 0 || selected.length > 0"
    data-testid="catalog-facet-filters"
    class="catalog-facets"
    role="region"
    aria-label="Filtrar por características"
  >
    <!-- Groups scroll inside their own row; «Limpiar filtros» sits outside it, so it never covers them. -->
    <div class="catalog-facet-scroller" data-testid="catalog-facet-scroller">
      <div
        v-for="group in groups"
        :key="group.code"
        class="catalog-facet-group"
        role="group"
        :data-facet="group.code"
        :aria-labelledby="group.labelId"
      >
        <p class="catalog-facet-label">
          <span :id="group.labelId">{{ group.label }}</span>
          <span v-if="group.active" data-testid="catalog-facet-active" class="catalog-facet-active">{{
            group.active
          }}</span>
        </p>
        <div class="catalog-facet-options">
          <button
            v-for="option in group.options"
            :key="option.token"
            type="button"
            class="catalog-facet-chip"
            :aria-pressed="option.pressed"
            :aria-label="option.ariaLabel"
            @click="emit('toggle', option.token)"
          >
            <UIcon
              v-if="option.pressed"
              data-testid="catalog-facet-check"
              name="i-lucide-check"
              class="size-4"
              aria-hidden="true"
            />
            {{ option.label }} <span class="catalog-facet-count">{{ option.count }}</span>
          </button>
        </div>
      </div>
    </div>
    <button
      v-if="selected.length > 0"
      type="button"
      class="catalog-filter-button catalog-facet-clear"
      @click="emit('clear')"
    >
      Limpiar filtros ({{ selected.length }})
    </button>
  </div>
</template>
