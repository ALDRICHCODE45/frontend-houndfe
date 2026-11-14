<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import type { PublicCatalogAttributeFacetDto } from '../interfaces/public-catalog-products.types'
import { useCompactViewport } from '../composables/useCompactViewport'
import {
  buildAnimalStrip,
  clearAnimalGroup,
  selectAnimalGroup,
  toggleAnimalSpecies,
  type AnimalFamily,
  type AnimalGroup,
  type AnimalSpecies,
} from '../utils/animal-groups'
import { clearRecipientTokens, toggleFacetTokens } from '../utils/filter-model'
import '../styles/catalog-animal-filter.css'
import CatalogAnimalSpeciesRow from './CatalogAnimalSpeciesRow.vue'
import CatalogAnimalSpeciesSheet from './CatalogAnimalSpeciesSheet.vue'
import CatalogFadeRow from './CatalogFadeRow.vue'

/**
 * Animal strip (design catalog-animal-filters, direction A), built only from the `animal.target`
 * facet: animal groups with their own icon and total, and a species row for the chosen group.
 * Labels and counts are the facet's own; the group label and icon come from a front-end map keyed
 * by the option code. «Todos» is pressed only while no animal filter is active and clears only
 * the animal tokens. Every change leaves as the full list of facet tokens (`change`), so the
 * other facets travel through untouched. Fewer than two animal options: nothing is drawn.
 */
const props = defineProps<{
  facet: PublicCatalogAttributeFacetDto | null
  total: number | null
  /** Facet tokens currently in the URL (every definition, not only the animal one). */
  selected: string[]
  /** Products the current choice leaves, for the phone sheet button. */
  resultTotal?: number | null
}>()
const emit = defineEmits<{ change: [tokens: string[]] }>()

const { isCompact } = useCompactViewport()
const subId = useId()

const strip = computed(() => buildAnimalStrip(props.facet, props.selected))
const productsLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`

/** The group whose species row is open; at first, the first group that already has a selection. */
const openKey = shallowRef<AnimalFamily | null>(
  strip.value.groups.find((group) => !group.single && group.pressed)?.key ?? null,
)
const openGroup = computed(
  () => strip.value.groups.find((group) => group.key === openKey.value && !group.single) ?? null,
)
const sheetOpen = shallowRef(false)

function chipCount(group: AnimalGroup) {
  return group.partial ? `${group.selectedCount} de ${group.species.length}` : `${group.total}`
}
function chipLabel(group: AnimalGroup) {
  return group.partial
    ? `${group.label}, ${group.selectedCount} de ${group.species.length} especies elegidas`
    : `${group.label}, ${productsLabel(group.total)}`
}

function onAll() {
  openKey.value = null
  emit('change', clearRecipientTokens(props.selected))
}
/**
 * A direct chip toggles itself. A group chip selects all its species and opens their row; once
 * selected, the chip first opens the row (so a partial choice can be refined) and then clears it.
 */
function onGroup(group: AnimalGroup) {
  if (group.single) {
    emit(
      'change',
      group.pressed
        ? clearAnimalGroup(props.selected, group)
        : selectAnimalGroup(props.selected, group),
    )
    return
  }
  if (!group.pressed) {
    openKey.value = group.key
    emit('change', selectAnimalGroup(props.selected, group))
  } else if (openKey.value === group.key) {
    openKey.value = null
    emit('change', clearAnimalGroup(props.selected, group))
  } else {
    openKey.value = group.key
  }
}
function onAllOfGroup(group: AnimalGroup) {
  emit(
    'change',
    group.whole ? clearAnimalGroup(props.selected, group) : selectAnimalGroup(props.selected, group),
  )
}
function onSpecies(group: AnimalGroup, species: AnimalSpecies) {
  emit('change', toggleAnimalSpecies(props.selected, group, species))
}
/** In the sheet every row is a plain toggle: a whole group loses just the row that was tapped. */
function onSheetSpecies(species: AnimalSpecies) {
  emit('change', toggleFacetTokens(props.selected, species.tokens))
}
</script>

<template>
  <section v-if="facet && strip.visible" class="catalog-animal" aria-label="Explorar por animal">
    <CatalogFadeRow class="catalog-animal-strip">
      <button
        type="button"
        class="catalog-animal-chip"
        :aria-pressed="strip.allPressed"
        :aria-label="total === null ? 'Todos' : `Todos, ${productsLabel(total)}`"
        @click="onAll"
      >
        <span class="catalog-animal-icon" data-icon="i-lucide-package">
          <UIcon name="i-lucide-package" aria-hidden="true" />
        </span>
        <span class="catalog-animal-name">Todos</span>
        {{ ' ' }}
        <span v-if="total !== null" class="catalog-animal-count">{{ total }}</span>
        <UIcon
          v-if="strip.allPressed"
          name="i-lucide-check"
          class="catalog-animal-chip-check"
          aria-hidden="true"
        />
      </button>
      <button
        v-for="group in strip.groups"
        :key="group.key"
        type="button"
        class="catalog-animal-chip"
        :aria-pressed="group.pressed"
        :aria-expanded="group.single ? undefined : openGroup?.key === group.key"
        :aria-controls="group.single ? undefined : subId"
        :aria-label="chipLabel(group)"
        :title="group.label"
        :data-reveal="group.pressed ? '' : undefined"
        @click="onGroup(group)"
      >
        <span class="catalog-animal-icon" :data-icon="group.icon">
          <UIcon :name="group.icon" aria-hidden="true" />
        </span>
        <span class="catalog-animal-name">{{ group.label }}</span>
        {{ ' ' }}
        <span class="catalog-animal-count">{{ chipCount(group) }}</span>
        <UIcon
          v-if="!group.single"
          name="i-lucide-chevron-down"
          class="catalog-animal-chevron"
          aria-hidden="true"
        />
        <UIcon
          v-if="group.pressed"
          name="i-lucide-check"
          class="catalog-animal-chip-check"
          aria-hidden="true"
        />
      </button>
    </CatalogFadeRow>
    <CatalogAnimalSpeciesRow
      v-if="openGroup"
      :id="subId"
      :group="openGroup"
      :compact="isCompact"
      @toggle-all="onAllOfGroup(openGroup)"
      @toggle-species="onSpecies(openGroup, $event)"
      @open-sheet="sheetOpen = true"
    />
    <CatalogAnimalSpeciesSheet
      v-if="isCompact"
      v-model:open="sheetOpen"
      :group="openGroup"
      :result-total="resultTotal ?? null"
      @toggle-species="onSheetSpecies"
    />
  </section>
</template>
