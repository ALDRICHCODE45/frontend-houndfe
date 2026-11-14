<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import {
  ANIMAL_SEARCH_FROM,
  collapseSpecies,
  type AnimalGroup,
  type AnimalSpecies,
} from '../utils/animal-groups'
import CatalogFadeRow from './CatalogFadeRow.vue'

/**
 * Species sub-row of an animal group (design 01 A2, 04, 05 E1): auto-width pills on one line each,
 * count inline, ✓ inside the selected one, the full name on hover. Long groups stop at ten
 * species with «Ver más (n)»; on a phone the button opens the species sheet instead (`compact`).
 */
const props = defineProps<{
  id: string
  group: AnimalGroup
  compact: boolean
}>()
const emit = defineEmits<{
  'toggle-all': []
  'toggle-species': [species: AnimalSpecies]
  'open-sheet': []
}>()

const expanded = shallowRef(false)
const query = shallowRef('')
// Another group, another list: start collapsed and unfiltered.
watch(
  () => props.group.key,
  () => {
    expanded.value = false
    query.value = ''
  },
)

const productsLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const collapsed = computed(() => collapseSpecies(props.group, expanded.value))
const showSearch = computed(
  () => !props.compact && expanded.value && props.group.species.length > ANIMAL_SEARCH_FROM,
)
const visibleSpecies = computed(() => {
  const needle = normalize(query.value.trim())
  if (!showSearch.value || needle === '') return collapsed.value.shown
  return collapsed.value.shown.filter((species) => normalize(species.label).includes(needle))
})
const noMatches = computed(
  () => showSearch.value && query.value.trim() !== '' && visibleSpecies.value.length === 0,
)
/** Phone: one button for the whole list; wide: the hidden count, then «Ver menos». */
const hasMore = computed(() => props.group.species.length > collapsed.value.shown.length || expanded.value)

function pillLabel(species: AnimalSpecies) {
  return `${species.label}, ${productsLabel(species.count)}`
}
function onMore() {
  if (props.compact) emit('open-sheet')
  else expanded.value = !expanded.value
}
</script>

<template>
  <div :id="id" class="catalog-animal-sub" role="group" :aria-label="`Especies de ${group.label}`">
    <div class="catalog-animal-sub-head">
      <UIcon :name="group.icon" class="catalog-animal-sub-icon" aria-hidden="true" />
      <span>Especies de {{ group.label }}</span>
      <label v-if="showSearch" class="catalog-animal-search">
        <UIcon name="i-lucide-search" class="catalog-animal-search-icon" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          placeholder="Buscar especie"
          autocomplete="off"
          :aria-label="`Buscar especie en ${group.label}`"
        />
      </label>
    </div>
    <CatalogFadeRow :reveal-key="group.key" class="catalog-animal-pills">
      <button
        type="button"
        class="catalog-animal-pill"
        :aria-pressed="group.whole"
        :aria-label="`${group.allLabel}, ${productsLabel(group.total)}`"
        :title="group.allLabel"
        :data-reveal="group.whole ? '' : undefined"
        @click="emit('toggle-all')"
      >
        <UIcon
          v-if="group.whole"
          name="i-lucide-check"
          class="catalog-animal-pill-check"
          aria-hidden="true"
        />
        <span class="catalog-animal-name">{{ group.allLabel }}</span>
        {{ ' ' }}
        <span class="catalog-animal-count">{{ group.total }}</span>
      </button>
      <button
        v-for="species in visibleSpecies"
        :key="species.key"
        type="button"
        class="catalog-animal-pill"
        :aria-pressed="group.partial && species.selected"
        :aria-label="pillLabel(species)"
        :title="species.label"
        :data-reveal="group.partial && species.selected ? '' : undefined"
        @click="emit('toggle-species', species)"
      >
        <UIcon
          v-if="group.partial && species.selected"
          name="i-lucide-check"
          class="catalog-animal-pill-check"
          aria-hidden="true"
        />
        <span class="catalog-animal-name">{{ species.label }}</span>
        {{ ' ' }}
        <span class="catalog-animal-count">{{ species.count }}</span>
      </button>
      <button
        v-if="hasMore"
        type="button"
        class="catalog-animal-pill catalog-animal-more"
        :aria-expanded="compact ? undefined : expanded"
        :aria-haspopup="compact ? 'dialog' : undefined"
        :aria-label="
          compact
            ? `Ver todas las especies de ${group.label}, ${group.species.length}`
            : expanded
              ? 'Ver menos especies'
              : `Ver más, ${collapsed.hidden} especies más`
        "
        @click="onMore"
      >
        <template v-if="compact">Ver todas ({{ group.species.length }})</template>
        <template v-else-if="expanded">Ver menos</template>
        <template v-else>Ver más ({{ collapsed.hidden }})</template>
      </button>
    </CatalogFadeRow>
    <p v-if="noMatches" class="catalog-animal-empty" role="status">
      Ninguna especie coincide con «{{ query.trim() }}».
    </p>
  </div>
</template>
