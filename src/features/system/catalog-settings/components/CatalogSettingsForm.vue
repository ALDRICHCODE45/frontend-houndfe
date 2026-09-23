<script setup lang="ts">
/**
 * CatalogSettingsForm — WU3B editable settings composition (REQ-7 / REQ-8 /
 * REQ-10 / REQ-12). Composes the publication switch, the contexts field, the
 * stock field, and the validation summary. The page owns the Save footer. The draft is owned
 * by the parent view's form composable; this component emits granular intents
 * (no prop mutation) and the parent applies them. The parent view owns save
 * routing (rising-edge confirmation) and toasts.
 *
 * UI redesign: USwitch with label/description replaces the raw button-role
 * switch. Semantic internal sections sit inside the routed view's single outer
 * card: the publication intent owns a compact subtle surface, and the contexts
 * and stock sections share one responsive internal grid (one column on mobile,
 * two columns from `lg` up) split by a divider. The page footer owns save
 * state. All data-testid, props, emits, and validation-error contracts are
 * preserved; no nested UCard is introduced.
 */
import { computed } from 'vue'
import CatalogPriceContextsField from './CatalogPriceContextsField.vue'
import CatalogStockPresentationField from './CatalogStockPresentationField.vue'
import type {
  CatalogPriceContextDto,
  CatalogSettingsDraft,
  CatalogStockPresentationDefaultDto,
} from '../interfaces/catalog-settings.types'

const props = defineProps<{
  draft: CatalogSettingsDraft
  acceptedContexts: Array<CatalogPriceContextDto>
  candidates: Array<{ id: string; name: string }>
  validationErrors: string[]
  canEditContexts: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-publish'): void
  (event: 'add-context', priceListId: string): void
  (event: 'remove-context', priceListId: string): void
  (event: 'set-default', priceListId: string | null): void
  (event: 'stock-change', value: CatalogStockPresentationDefaultDto): void
}>()

const publishLabel = computed(() => (props.draft.catalogPublished ? 'Publicado' : 'No publicado'))
</script>

<template>
  <section class="flex flex-col gap-6 sm:gap-8" data-testid="catalog-settings-form">
    <!-- Publication intent (REQ-10: accepted badge stays read-only in the
         read view; the switch only carries local intent until PATCH). Compact
         subtle surface so the section does not read as a sparse full-width
         strip on wide screens. -->
    <section
      class="min-w-0 rounded-lg border border-default bg-elevated/50 px-4 py-3"
      data-testid="publication-card"
    >
      <USwitch
        :model-value="props.draft.catalogPublished"
        :label="publishLabel"
        description="Habilitar la visibilidad del catálogo para clientes públicos"
        data-testid="publish-switch"
        @update:model-value="emit('toggle-publish')"
      />
    </section>

    <!-- Contexts + default editing, gated by global-list read (REQ-6A), and the
         tenant stock-presentation default (REQ-8) share one responsive grid:
         stacked on mobile, two columns from `lg` up, split by a divider. -->
    <div
      class="grid grid-cols-1 gap-6 border-t border-default pt-6 sm:gap-8 sm:pt-8 lg:grid-cols-2 lg:gap-0"
      data-testid="settings-grid"
    >
      <section class="min-w-0 lg:pr-8" data-testid="contexts-card">
        <CatalogPriceContextsField
          :draft="props.draft"
          :accepted-contexts="props.acceptedContexts"
          :candidates="props.candidates"
          :disabled="!props.canEditContexts"
          @add="emit('add-context', $event)"
          @remove="emit('remove-context', $event)"
          @set-default="emit('set-default', $event)"
        />
      </section>

      <section
        class="min-w-0 border-t border-default pt-6 sm:pt-8 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0"
        data-testid="stock-card"
      >
        <CatalogStockPresentationField
          :stock-default="props.draft.stockPresentationDefault"
          @change="emit('stock-change', $event)"
        />
      </section>
    </div>

    <!-- Validation summary (REQ-12: invalid drafts never reach the API). -->
    <ul
      v-if="props.validationErrors.length > 0"
      class="flex flex-col gap-1 rounded-lg border border-error/30 bg-error/5 p-4"
      data-testid="validation-summary"
    >
      <li v-for="error in props.validationErrors" :key="error" class="text-sm text-error">
        {{ error }}
      </li>
    </ul>
  </section>
</template>
