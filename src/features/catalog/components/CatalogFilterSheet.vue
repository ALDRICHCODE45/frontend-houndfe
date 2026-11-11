<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import type {
  PublicCatalogAttributeFacetDto,
  PublicCatalogProductsCategoryFacetDto,
} from '../interfaces/public-catalog-products.types'
import { useCatalogFilterCount } from '../composables/useCatalogFilterCount'
import {
  useCatalogFilterDraft,
  type CatalogFilterSelection,
} from '../composables/useCatalogFilterDraft'
import { buildFacetChips, buildFilterGroups, type FilterOption } from '../utils/filter-model'
import CatalogFilterGroup from './CatalogFilterGroup.vue'

/**
 * Mobile «Filtros» bottom sheet (artboard 02). Everything changes a draft copy of the committed
 * selection; only «Ver N productos» applies it (`apply`). N is a live probe of the products api
 * with the draft filters; while it counts the label is neutral and on failure it stays
 * «Ver productos». The modal (Nuxt UI dialog) traps focus and closes on Escape and the scrim.
 */
const props = defineProps<{
  open: boolean
  branchSlug: string | null
  priceListId: string | null
  search: string
  categories: PublicCatalogProductsCategoryFacetDto[]
  attributes: PublicCatalogAttributeFacetDto[]
  selectedCategoryId: string | null
  selectedTokens: string[]
}>()
const emit = defineEmits<{
  'update:open': [open: boolean]
  apply: [selection: CatalogFilterSelection]
}>()

const draft = useCatalogFilterDraft()
const openGroup = shallowRef<string | null>(null)

const filterGroups = computed(() =>
  buildFilterGroups({
    categories: props.categories,
    attributes: props.attributes,
    categoryId: draft.categoryId.value,
    tokens: draft.tokens.value,
  }),
)
// Synchronous so the draft is already fresh when the count probe reads it for a new opening.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    draft.reset({ categoryId: props.selectedCategoryId, tokens: props.selectedTokens })
    openGroup.value = filterGroups.value.groups[0]?.key ?? null
  },
  { immediate: true, flush: 'sync' },
)
const facetChips = computed(() => buildFacetChips(props.attributes, draft.tokens.value))
const categoryChipLabel = computed(() =>
  draft.categoryId.value === null
    ? null
    : (props.categories.find((category) => category.id === draft.categoryId.value)?.name ??
      'Categoría'),
)
const activeCount = computed(() => draft.activeCount(facetChips.value.length))
const badgeLabel = computed(
  () => `${activeCount.value} ${activeCount.value === 1 ? 'filtro elegido' : 'filtros elegidos'}`,
)

const { count, status } = useCatalogFilterCount(() =>
  props.open
    ? {
        branchSlug: props.branchSlug,
        priceListId: props.priceListId,
        search: props.search,
        categoryId: draft.categoryId.value,
        tokens: draft.tokens.value,
      }
    : null,
)
const applyLabel = computed(() => {
  if (status.value === 'counting') return 'Contando…'
  if (status.value === 'ready' && count.value !== null)
    return `Ver ${count.value} ${count.value === 1 ? 'producto' : 'productos'}`
  return 'Ver productos'
})

function select(option: FilterOption) {
  if (option.target.kind === 'category') draft.toggleCategory(option.target.id)
  else draft.toggleFacet(option.target.tokens)
}
function toggleGroup(key: string) {
  openGroup.value = openGroup.value === key ? null : key
}
function apply() {
  emit('apply', { categoryId: draft.categoryId.value, tokens: [...draft.tokens.value] })
  emit('update:open', false)
}

/** The focus lands on the title, as the artboard says; closing returns it to «Filtros». */
const title = useTemplateRef<HTMLElement>('title')
function focusTitle(event: Event) {
  event.preventDefault()
  title.value?.focus()
}
</script>

<template>
  <UModal
    :open="open"
    title="Filtros"
    description="Elige filtros y confirma para ver los productos."
    :close="false"
    :content="{ onOpenAutoFocus: focusTitle }"
    :ui="{
      overlay: 'catalog-branch-overlay z-40',
      content:
        'catalog-filter-sheet z-50 top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="catalog-filter-sheet-grab" aria-hidden="true" />
      <div class="catalog-filter-sheet-head">
        <h2 ref="title" tabindex="-1">
          Filtros
          <span
            v-if="activeCount > 0"
            class="catalog-filter-sheet-badge"
            :aria-label="badgeLabel"
            >{{ activeCount }}</span
          >
        </h2>
        <button
          type="button"
          class="catalog-filter-sheet-close"
          aria-label="Cerrar filtros"
          @click="emit('update:open', false)"
        >
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </div>
      <div class="catalog-filter-sheet-body">
        <div
          v-if="categoryChipLabel !== null || facetChips.length > 0"
          class="catalog-chips catalog-filter-sheet-chips"
          role="group"
          aria-label="Filtros activos"
        >
          <button
            v-if="categoryChipLabel !== null"
            type="button"
            class="catalog-chip"
            :aria-label="`Quitar filtro: ${categoryChipLabel}`"
            @click="draft.categoryId.value = null"
          >
            {{ categoryChipLabel }}
            <UIcon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
          </button>
          <button
            v-for="chip in facetChips"
            :key="chip.key"
            type="button"
            class="catalog-chip"
            :aria-label="`Quitar filtro: ${chip.label}`"
            @click="draft.removeTokens(chip.tokens)"
          >
            {{ chip.label }}
            <UIcon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <CatalogFilterGroup
          v-for="group in filterGroups.groups"
          :key="group.key"
          :group="group"
          collapsible
          :open="openGroup === group.key"
          @toggle-open="toggleGroup(group.key)"
          @select="select"
        />
        <p v-if="filterGroups.recipientHint" class="catalog-filter-hint">
          <UIcon name="i-lucide-info" class="size-4" aria-hidden="true" />
          Elige un destinatario para ver filtros de etapa, tamaño y más.
        </p>
      </div>
      <div class="catalog-filter-sheet-foot">
        <button type="button" class="catalog-button" @click="draft.clear()">Limpiar</button>
        <button
          type="button"
          class="catalog-button catalog-button--primary"
          data-testid="catalog-filter-apply"
          :aria-busy="status === 'counting'"
          @click="apply"
        >
          {{ applyLabel }}
        </button>
      </div>
    </template>
  </UModal>
</template>
