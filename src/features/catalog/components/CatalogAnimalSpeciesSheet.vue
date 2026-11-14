<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { AnimalGroup, AnimalSpecies } from '../utils/animal-groups'

/**
 * Phone sheet with every species of a long group (design 05 E2): search, 44px rows with a round
 * mark on the right (selection without checkboxes). A row applies at once through the URL, so the
 * button only closes the sheet and reports how many products the choice leaves. The modal (Nuxt
 * UI dialog) traps focus and closes on Escape and the scrim.
 */
const props = defineProps<{
  open: boolean
  group: AnimalGroup | null
  /** Products the current choice leaves; null while unknown. */
  resultTotal: number | null
}>()
const emit = defineEmits<{
  'update:open': [open: boolean]
  'toggle-species': [species: AnimalSpecies]
}>()

const query = shallowRef('')
watch(
  () => props.open,
  (open) => {
    if (open) query.value = ''
  },
)

const productsLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
const rows = computed(() => {
  const needle = normalize(query.value.trim())
  const species = props.group?.species ?? []
  return needle === '' ? species : species.filter((item) => normalize(item.label).includes(needle))
})
const title = computed(() =>
  props.group ? `${props.group.label} · ${props.group.species.length} especies` : 'Especies',
)
const doneLabel = computed(() =>
  props.resultTotal === null ? 'Listo' : `Ver ${productsLabel(props.resultTotal)}`,
)
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    description="Elige una o más especies; los productos se actualizan al elegir."
    :close="false"
    :ui="{
      overlay: 'catalog-branch-overlay z-40',
      content:
        'catalog-filter-sheet catalog-animal-sheet z-50 top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="catalog-filter-sheet-grab" aria-hidden="true" />
      <div class="catalog-filter-sheet-head">
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="catalog-filter-sheet-close"
          aria-label="Cerrar especies"
          @click="emit('update:open', false)"
        >
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </div>
      <label class="catalog-animal-sheet-search">
        <UIcon name="i-lucide-search" class="catalog-animal-search-icon" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          placeholder="Buscar especie"
          autocomplete="off"
          :aria-label="`Buscar especie en ${group?.label ?? 'el grupo'}`"
        />
      </label>
      <div class="catalog-animal-sheet-list">
        <button
          v-for="species in rows"
          :key="species.key"
          type="button"
          class="catalog-animal-sheet-row"
          :aria-pressed="species.selected"
          :aria-label="`${species.label}, ${productsLabel(species.count)}`"
          :title="species.label"
          @click="emit('toggle-species', species)"
        >
          <span class="catalog-animal-name">{{ species.label }}</span>
          <span class="catalog-animal-count">{{ species.count }}</span>
          <span class="catalog-animal-sheet-mark" aria-hidden="true">
            <UIcon name="i-lucide-check" class="size-3.5" />
          </span>
        </button>
        <p v-if="rows.length === 0" class="catalog-animal-empty" role="status">
          Ninguna especie coincide.
        </p>
      </div>
      <div class="catalog-filter-sheet-foot catalog-animal-sheet-foot">
        <button
          type="button"
          class="catalog-button catalog-button--primary"
          @click="emit('update:open', false)"
        >
          {{ doneLabel }}
        </button>
      </div>
    </template>
  </UModal>
</template>
