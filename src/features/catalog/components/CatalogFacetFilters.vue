<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCatalogAttributeFacetDto } from '../interfaces/public-catalog-products.types'
import { mergeFacetOptions } from '../utils/facet-options'

/**
 * Attribute facets as toggle chips (Selección sin checkboxes). Definitions and options come from
 * the current filtered listing in server order; the selection is the URL's facet tokens. Options
 * sharing a label within a definition are one chip (see `mergeFacetOptions`): it reads pressed
 * when any of its tokens is selected, and toggling it adds or removes all of them.
 */
const props = defineProps<{
  facets: PublicCatalogAttributeFacetDto[]
  /** Facet tokens `<definition code>:<option code>` currently in the URL. */
  selected: string[]
}>()
const emit = defineEmits<{ toggle: [tokens: string[]]; clear: [] }>()

const selectedTokens = computed(() => new Set(props.selected))
const groups = computed(() =>
  props.facets.map((definition) => {
    const options = mergeFacetOptions(definition).map((option) => ({
      key: option.tokens[0]!,
      tokens: option.tokens,
      label: option.label,
      count: option.count,
      pressed: option.tokens.some((token) => selectedTokens.value.has(token)),
      ariaLabel: `${definition.label}: ${option.label}, ${option.count} ${option.count === 1 ? 'producto' : 'productos'}`,
    }))
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
/** Selected choices: a merged chip counts once; tokens no chip shows still count. */
const selectedCount = computed(() => {
  const shown = groups.value.flatMap((group) => group.options)
  const shownTokens = new Set(shown.flatMap((option) => option.tokens))
  return (
    shown.filter((option) => option.pressed).length +
    props.selected.filter((token) => !shownTokens.has(token)).length
  )
})
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
            :key="option.key"
            type="button"
            class="catalog-facet-chip"
            :aria-pressed="option.pressed"
            :aria-label="option.ariaLabel"
            @click="emit('toggle', option.tokens)"
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
      Limpiar filtros ({{ selectedCount }})
    </button>
  </div>
</template>
