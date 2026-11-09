<script setup lang="ts">
/**
 * CatalogSettingsForm — editable settings in rows (artboard 01, REQ-7 / REQ-8 /
 * REQ-10 / REQ-12): «Publicación», «Precios que ve el público» and «Stock en el
 * catálogo». The draft is owned by the parent view's form composable; this
 * component emits granular intents (no prop mutation) and the parent applies
 * them, including the default-list rules. The page owns the save bar, save
 * routing (rising-edge confirmation) and toasts.
 *
 * Validation messages already said in context (no public list → the lists
 * warning row; fixed quantity → under its field) are left out of the summary.
 */
import { computed } from 'vue'
import CatalogPublicationSection from './CatalogPublicationSection.vue'
import CatalogPriceContextsField from './CatalogPriceContextsField.vue'
import CatalogStockPresentationField from './CatalogStockPresentationField.vue'
import type {
  CatalogDefaultMove,
  CatalogPriceContextDto,
  CatalogSettingsDraft,
  CatalogStockPresentationDefaultDto,
} from '../interfaces/catalog-settings.types'
import { NO_PUBLIC_LIST_ERROR, STOCK_QUANTITY_ERROR } from '../utils/catalogSettingsMappers'

const props = withDefaults(
  defineProps<{
    draft: CatalogSettingsDraft
    acceptedContexts: Array<CatalogPriceContextDto>
    candidates: Array<{ id: string; name: string }>
    validationErrors: string[]
    canEditContexts: boolean
    candidatesLoading?: boolean
    candidatesError?: boolean
    effectivePublication?: boolean
    /** Closed-set server warnings of the accepted state, mapped to Spanish copy. */
    warnings?: string[]
    dirty?: boolean
    defaultMove?: CatalogDefaultMove | null
  }>(),
  {
    candidatesLoading: false,
    candidatesError: false,
    effectivePublication: true,
    warnings: () => [],
    dirty: false,
    defaultMove: null,
  },
)

const emit = defineEmits<{
  (event: 'toggle-publish'): void
  (event: 'toggle-published-only'): void
  (event: 'add-context', priceListId: string): void
  (event: 'remove-context', priceListId: string): void
  (event: 'set-default', priceListId: string | null): void
  (event: 'stock-change', value: CatalogStockPresentationDefaultDto): void
  (event: 'undo-default-move'): void
  (event: 'retry-candidates'): void
}>()

const defaultName = computed(() => {
  const id = props.draft.catalogDefaultPriceListId
  if (!id) return null
  return (
    props.candidates.find((candidate) => candidate.id === id)?.name ??
    props.acceptedContexts.find((context) => context.priceListId === id)?.name ??
    null
  )
})

const summaryErrors = computed(() =>
  props.validationErrors.filter(
    (error) => error !== NO_PUBLIC_LIST_ERROR && error !== STOCK_QUANTITY_ERROR,
  ),
)
</script>

<template>
  <div class="flex flex-col gap-6 sm:gap-8" data-testid="catalog-settings-form">
    <CatalogPublicationSection
      :published="props.draft.catalogPublished"
      :published-only="props.draft.catalogRequiresPublishedEditorial"
      :public-count="props.draft.publicPriceListIds.length"
      :default-name="defaultName"
      :effective-publication="props.effectivePublication"
      :warnings="props.warnings"
      :dirty="props.dirty"
      @toggle="emit('toggle-publish')"
      @toggle-published-only="emit('toggle-published-only')"
    />

    <CatalogPriceContextsField
      :draft="props.draft"
      :accepted-contexts="props.acceptedContexts"
      :candidates="props.candidates"
      :loading="props.candidatesLoading"
      :error="props.candidatesError"
      :disabled="!props.canEditContexts"
      :default-move="props.defaultMove"
      @add="emit('add-context', $event)"
      @remove="emit('remove-context', $event)"
      @set-default="emit('set-default', $event)"
      @undo-default-move="emit('undo-default-move')"
      @retry="emit('retry-candidates')"
    />

    <CatalogStockPresentationField
      :stock-default="props.draft.stockPresentationDefault"
      @change="emit('stock-change', $event)"
    />

    <!-- Remaining validation (REQ-12: invalid drafts never reach the API). -->
    <ul
      v-if="summaryErrors.length > 0"
      class="m-0 flex list-none flex-col gap-1 rounded-(--hf-radius-card) border border-(--hf-danger-border) bg-(--hf-danger-soft) px-5 py-3"
      data-testid="validation-summary"
    >
      <li v-for="error in summaryErrors" :key="error" class="text-sm font-semibold text-(--hf-danger)">
        {{ error }}
      </li>
    </ul>
  </div>
</template>
