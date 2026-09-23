<script setup lang="ts">
/**
 * ProductCatalogSettingsSection — WU6 redesigned "Catálogo online" composition
 * surface for the full product editor (REQ-14/REQ-15). The view renders it only
 * with update:Product. Hide-price and the stock override stay editable
 * regardless of settings-read, while the per-product public-context support
 * selector additionally requires read:TenantCatalogSettings and otherwise
 * disables with the locked Spanish note (the frontend never auto-grants it).
 * supportsAllCatalogPriceLists is response-only and never sent.
 *
 * UI redesign (U6): USwitch with label+description replaces the manual button-role
 * switch; UCheckbox replaces native checkboxes in a responsive list; OnlineStockOverrideFields
 * uses UFormField + USelectMenu + UInput; internal sections use spacing and dividers.
 * One UCard sibling of Inventario/Variantes with no nested cards.
 *
 * U8: the stock override is configured here with the product inheritance scope, so a
 * null override reads "Usar configuración global" (the tenant default).
 *
 * U9: each catalog context is a labeled USwitch (instead of UCheckbox) and only the
 * catalog-default context carries the "Lista predeterminada del catálogo" explanation.
 * The responsive list semantics, `context-toggle` testid, permission/loading/error/empty
 * states, disabled behavior and `toggle-context` emit are unchanged.
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
  !props.canReadSettings || props.settingsLoading || props.settingsError
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
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">Catálogo online</h2>
        <p class="text-sm text-muted">
          Controla la visibilidad de precios y stock de este producto en el catálogo público
        </p>
      </div>
    </template>

    <div class="flex flex-col gap-6">
      <!-- ① Publication / price visibility -->
      <div class="flex items-start gap-4">
        <USwitch
          :model-value="props.hidePriceInOnlineCatalog"
          label="Ocultar precios"
          description="Los precios no serán visibles en el catálogo en línea"
          data-testid="hide-price-switch"
          :disabled="props.disabled"
          @update:model-value="emit('toggle-hide-price', $event)"
        />
      </div>

      <!-- Subtle divider -->
      <div class="border-t border-default" />

      <!-- ② Stock override -->
      <div class="flex flex-col gap-1">
        <OnlineStockOverrideFields
          :value="stockValue"
          inheritance-scope="product"
          :disabled="props.disabled"
          @change="emit('stock-change', $event)"
        />
      </div>

      <!-- Subtle divider -->
      <div class="border-t border-default" />

      <!-- ③ Public contexts -->
      <div class="flex flex-col gap-3" data-testid="supported-contexts">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-semibold text-default">Contextos públicos soportados</h3>
          <p class="text-xs text-muted">
            Listas de precios visibles para clientes públicos de este producto
          </p>
        </div>

        <!-- supportsAll indicator (response-only, never sent) -->
        <p
          v-if="props.supportsAllCatalogPriceLists"
          data-testid="supports-all-note"
          class="text-xs text-muted"
        >
          Soporta todos los contextos públicos del tenant
        </p>

        <!-- Context toggle list: one column on mobile, two columns when space permits. -->
        <ul
          v-if="contextRows.length > 0"
          class="grid grid-cols-1 gap-2 sm:grid-cols-2"
          data-testid="context-list"
        >
          <li v-for="row in contextRows" :key="row.priceListId" class="min-w-0">
            <USwitch
              :model-value="row.supported"
              :label="row.name"
              :description="row.isCatalogDefault ? 'Lista predeterminada del catálogo' : undefined"
              data-testid="context-toggle"
              :disabled="props.disabled || !props.canReadSettings"
              @update:model-value="emit('toggle-context', row.priceListId)"
            />
          </li>
        </ul>

        <!-- Unavailable contexts state: all unavailable cases keep a labeled disabled control. -->
        <USelectMenu
          v-if="contextRows.length === 0"
          data-testid="contexts-select"
          aria-label="Contextos públicos no disponibles"
          :model-value="null"
          :items="[]"
          placeholder="—"
          disabled
          class="w-full sm:max-w-xs"
        />

        <!-- Settings query state: affects only this selector context -->
        <p
          v-if="!props.canReadSettings"
          data-testid="contexts-gated-note"
          class="text-sm text-muted"
        >
          Configura los contextos públicos del tenant en Sistema &gt; Catálogo online para habilitar
          esta selección
        </p>
        <p
          v-else-if="props.settingsLoading"
          data-testid="settings-loading-note"
          class="text-sm text-muted"
        >
          Cargando contextos públicos del tenant…
        </p>
        <p
          v-else-if="props.settingsError"
          data-testid="settings-error-note"
          class="text-sm text-muted"
        >
          No se pudieron cargar los contextos públicos del tenant
        </p>
        <p
          v-else-if="contextRows.length === 0"
          data-testid="contexts-empty-note"
          class="text-xs text-muted"
        >
          El tenant no tiene contextos públicos configurados
        </p>
      </div>
    </div>
  </UCard>
</template>
