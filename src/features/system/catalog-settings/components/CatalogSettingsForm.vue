<script setup lang="ts">
/**
 * CatalogSettingsForm — WU3B editable settings composition (REQ-7 / REQ-8 /
 * REQ-10 / REQ-12). Composes the publication switch, the contexts field, the
 * stock field, the validation summary, and the Save footer. The draft is owned
 * by the parent view's form composable; this component emits granular intents
 * (no prop mutation) and the parent applies them. The parent view owns save
 * routing (rising-edge confirmation) and toasts.
 */
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
  canSave: boolean
  saving?: boolean
  canEditContexts: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-publish'): void
  (event: 'add-context', priceListId: string): void
  (event: 'remove-context', priceListId: string): void
  (event: 'set-default', priceListId: string | null): void
  (event: 'stock-change', value: CatalogStockPresentationDefaultDto): void
  (event: 'save'): void
}>()
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="catalog-settings-form">
    <!-- Editable publication intent (REQ-10: the accepted badge stays read-only
         in the read view; the switch only carries local intent until PATCH). -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        :aria-checked="props.draft.catalogPublished"
        data-testid="publish-switch"
        class="rounded-full border border-default px-3 py-1 text-sm"
        :class="props.draft.catalogPublished ? 'bg-primary text-white' : 'bg-neutral'"
        @click="emit('toggle-publish')"
      >
        {{ props.draft.catalogPublished ? 'Publicado' : 'No publicado' }}
      </button>
      <span class="text-sm text-default">Publicar catálogo</span>
    </div>

    <!-- Contexts + default editing, gated by global-list read (REQ-6A). -->
    <CatalogPriceContextsField
      :draft="props.draft"
      :accepted-contexts="props.acceptedContexts"
      :candidates="props.candidates"
      :disabled="!props.canEditContexts"
      @add="emit('add-context', $event)"
      @remove="emit('remove-context', $event)"
      @set-default="emit('set-default', $event)"
    />

    <!-- Tenant stock-presentation default (REQ-8). -->
    <CatalogStockPresentationField
      :stock-default="props.draft.stockPresentationDefault"
      @change="emit('stock-change', $event)"
    />

    <!-- Validation summary (REQ-12: invalid drafts never reach the API). -->
    <ul
      v-if="props.validationErrors.length > 0"
      class="flex flex-col gap-1"
      data-testid="validation-summary"
    >
      <li v-for="error in props.validationErrors" :key="error" class="text-sm text-error">
        {{ error }}
      </li>
    </ul>

    <div class="flex items-center gap-3">
      <UButton
        color="primary"
        data-testid="save-button"
        :disabled="!props.canSave || props.saving"
        :loading="props.saving"
        @click="emit('save')"
      >
        Guardar
      </UButton>
      <span v-if="!props.canSave && !props.saving" class="text-xs text-muted">
        Sin cambios para guardar
      </span>
    </div>
  </section>
</template>
