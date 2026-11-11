<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { CatalogProductsState } from '../composables/useCatalogProducts'
import type { PublicCatalogProductsCategoryFacetDto } from '../interfaces/public-catalog-products.types'

/**
 * «Categorías» header menu with the real `facets.categories` counts. It is a disclosure
 * (button + panel of pressed-state buttons): Escape and an outside press close it.
 */
const props = defineProps<{
  categories: PublicCatalogProductsCategoryFacetDto[]
  allTotal: number | null
  selectedId: string | null
  state: CatalogProductsState
  /** The baseline was resolved under another price list: never offer its categories. */
  contextMismatch: boolean
  /** The listing already shows its failure: say it once, there. */
  combinedError: boolean
}>()
const emit = defineEmits<{ select: [id: string | null]; retry: [] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panelId = useId()

const failed = computed(() =>
  ['unavailable', 'rate-limit', 'server', 'network'].includes(props.state),
)
const loading = computed(() => props.state === 'loading' || props.state === 'retry-pending')
const errorCopy = computed(() => {
  if (props.combinedError) return null
  if (failed.value) return 'No pudimos cargar las categorías'
  if (props.contextMismatch) return 'Las categorías no coinciden con la lista de precios actual.'
  return null
})
const showList = computed(() => !failed.value && !props.contextMismatch && !loading.value)

function close(restoreFocus: boolean) {
  open.value = false
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}
function choose(id: string | null) {
  close(false)
  emit('select', id)
}
function onOutside(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close(false)
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onOutside)
  else document.removeEventListener('pointerdown', onOutside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="catalog-category-menu-root" @keydown.esc="close(true)">
    <button
      ref="trigger"
      type="button"
      class="catalog-select-trigger"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <UIcon name="i-lucide-layout-grid" class="size-4" aria-hidden="true" />
      <strong>Categorías</strong>
      <UIcon
        name="i-lucide-chevron-down"
        class="catalog-select-chevron"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>
    <div
      v-if="open"
      :id="panelId"
      data-testid="catalog-category-menu"
      class="catalog-menu"
      role="group"
      aria-label="Categorías"
    >
      <template v-if="showList">
        <button
          v-if="allTotal !== null"
          type="button"
          class="catalog-menu-item catalog-menu-item--all"
          :aria-pressed="selectedId === null"
          @click="choose(null)"
        >
          Todas las categorías <span>{{ allTotal }}</span>
        </button>
        <button
          v-for="category in categories"
          :key="category.id"
          type="button"
          class="catalog-menu-item"
          :aria-pressed="selectedId === category.id"
          @click="choose(category.id)"
        >
          {{ category.name }} <span>{{ category.count }}</span>
        </button>
      </template>
      <p v-else-if="loading" role="status" class="catalog-menu-note">Cargando categorías…</p>
      <div v-else-if="errorCopy" class="catalog-menu-note" role="alert">
        <p>{{ errorCopy }}</p>
        <button
          type="button"
          class="catalog-menu-retry"
          data-testid="catalog-retry-categories"
          @click="emit('retry')"
        >
          Reintentar
        </button>
      </div>
    </div>
  </div>
</template>
