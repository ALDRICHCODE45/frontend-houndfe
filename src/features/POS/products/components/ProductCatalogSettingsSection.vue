<script setup lang="ts">
/**
 * ProductCatalogSettingsSection — WU5 advanced "Catálogo online" composition
 * surface for the full product editor (REQ-14/REQ-15). The view renders it only
 * with update:Product. Hide-price and the stock override stay editable
 * regardless of settings-read, while the per-product public-context support
 * selector additionally requires read:TenantCatalogSettings and otherwise
 * disables with the locked Spanish note (the frontend never auto-grants it).
 * supportsAllCatalogPriceLists is response-only and never sent.
 */
import { computed } from 'vue'
import OnlineStockOverrideFields from './OnlineStockOverrideFields.vue'
import type {
  CatalogPriceContextDto,
  OnlineStockPresentationMode,
} from '@/features/system/catalog-settings/interfaces/catalog-settings.types'

const props = defineProps<{
  hidePriceInOnlineCatalog: boolean
  supportedCatalogPriceListIds: string[]
  supportsAllCatalogPriceLists: boolean
  onlineStockPresentation: OnlineStockPresentationMode | null
  onlineStockPresentationCustomQty: number | null
  contexts: Array<CatalogPriceContextDto>
  canReadSettings: boolean
  settingsLoading?: boolean
  settingsError?: boolean
  disabled?: boolean
}>()

// Same shape OnlineStockOverrideFields emits: the shared nullable override pair.
interface StockOverrideValue {
  mode: OnlineStockPresentationMode | null
  customQuantity: number | null
}

const emit = defineEmits<{
  (event: 'toggle-hide-price', value: boolean): void
  (event: 'stock-change', value: StockOverrideValue): void
  (event: 'toggle-context', priceListId: string): void
}>()

const stockValue = computed<StockOverrideValue>(() => ({
  mode: props.onlineStockPresentation,
  customQuantity: props.onlineStockPresentationCustomQty,
}))

    const contextRows = computed(() =>
      props.settingsLoading || props.settingsError
        ? []
        : props.contexts.map((context) => ({
            ...context,
            supported: props.supportedCatalogPriceListIds.includes(context.priceListId),
          })),
    )
</script>

<template>
  <UCard :ui="{ root: 'overflow-visible' }" data-testid="catalog-settings-section">
    <template #header>
      <h2 class="text-lg font-semibold">Catálogo online</h2>
    </template>

    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          :aria-checked="props.hidePriceInOnlineCatalog"
          data-testid="hide-price-switch"
          class="rounded-full border border-default px-3 py-1 text-sm"
          :class="props.hidePriceInOnlineCatalog ? 'bg-primary text-white' : 'bg-neutral'"
          :disabled="props.disabled"
          @click="emit('toggle-hide-price', !props.hidePriceInOnlineCatalog)"
        >
          {{ props.hidePriceInOnlineCatalog ? 'Precios ocultos' : 'Precios visibles' }}
        </button>
        <span class="text-sm text-default">Ocultar precios en catálogo</span>
      </div>

      <OnlineStockOverrideFields
        :value="stockValue"
        :disabled="props.disabled"
        @change="emit('stock-change', $event)"
      />

      <div class="space-y-2" data-testid="supported-contexts">
        <h4 class="text-sm font-semibold text-default">Contextos públicos soportados</h4>
        <p
          v-if="props.supportsAllCatalogPriceLists"
          data-testid="supports-all-note"
          class="text-xs text-muted"
        >
          Soporta todos los contextos públicos del tenant
        </p>
            <label v-for="row in contextRows" :key="row.priceListId" class="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="context-toggle"
                class="size-4"
                :checked="row.supported"
                :disabled="props.disabled || !props.canReadSettings"
                @change="emit('toggle-context', row.priceListId)"
              />
              <span class="text-sm text-default">{{ row.name }}</span>
            </label>
            <!-- The settings query state affects only this selector: when no row
                 controls exist (unavailable, pending, failed, or accepted-empty)
                 the selector stays visibly present but disabled, without
                 synthesizing context options or backend defaults. -->
            <select
              v-if="contextRows.length === 0"
              data-testid="contexts-select"
              class="rounded-lg border border-default px-2 py-1 text-sm"
              disabled
            >
              <option value="">—</option>
            </select>
            <!-- Frontend data-access gate — never auto-granted; pending and
                 failed query states surface their own note so they are never
                 conflated with an accepted-empty configuration. -->
            <p v-if="!props.canReadSettings" data-testid="contexts-gated-note" class="text-sm text-muted">
              Configura los contextos públicos del tenant en Sistema &gt; Catálogo online para habilitar esta selección
            </p>
            <p v-else-if="props.settingsLoading" data-testid="settings-loading-note" class="text-sm text-muted">
              Cargando contextos públicos del tenant…
            </p>
            <p v-else-if="props.settingsError" data-testid="settings-error-note" class="text-sm text-muted">
              No se pudieron cargar los contextos públicos del tenant
            </p>
            <p v-else-if="contextRows.length === 0" data-testid="contexts-empty-note" class="text-xs text-muted">
              El tenant no tiene contextos públicos configurados
            </p>
          </div>
    </div>
  </UCard>
</template>
