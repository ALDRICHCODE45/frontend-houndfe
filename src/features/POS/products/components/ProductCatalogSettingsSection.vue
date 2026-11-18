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
 * switch; a responsive list replaced the native checkboxes (U9 made each a switch); OnlineStockOverrideFields
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
 *
 * T6e: an HfSectionCard sibling of the Presentaciones section cards; every on/off
 * row (Ocultar precios, each context) is a whole-row HfSwitchRow in one calm list
 * with hairlines (`product-switch-list`), colors only from --hf-*.
 */
import { computed } from 'vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import { HfSwitchRow } from '@/core/shared/components/selection'
import OnlineStockOverrideFields from './OnlineStockOverrideFields.vue'
import '../styles/product-detail.css'
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
  <HfSectionCard
    id="product-catalog-settings"
    title="Catálogo online"
    :heading-level="2"
    data-testid="catalog-settings-section"
  >
    <div class="product-section-body">
      <!-- ① Publication / price visibility -->
      <div class="product-switch-list">
        <HfSwitchRow
          :model-value="props.hidePriceInOnlineCatalog"
          label="Ocultar precios"
          description="Los precios no serán visibles en el catálogo en línea"
          test-id="hide-price-switch"
          :disabled="props.disabled"
          @update:model-value="emit('toggle-hide-price', $event)"
        />
      </div>

      <hr class="product-section-divider" />

      <!-- ② Stock override -->
      <OnlineStockOverrideFields
        :value="stockValue"
        inheritance-scope="product"
        :disabled="props.disabled"
        @change="emit('stock-change', $event)"
      />

      <hr class="product-section-divider" />

      <!-- ③ Public contexts -->
      <div class="grid min-w-0 gap-3" data-testid="supported-contexts">
        <h3 class="m-0 text-sm font-semibold text-(--hf-heading)">Contextos públicos soportados</h3>

        <!-- supportsAll indicator (response-only, never sent). The backend derives it from an
             empty supported list, so every row reads off: the note explains that state (T8 D10). -->
        <p
          v-if="props.supportsAllCatalogPriceLists"
          data-testid="supports-all-note"
          class="m-0 text-xs text-(--hf-muted)"
        >
          Ningún contexto elegido: el producto se muestra en todos los contextos públicos de la
          sucursal. Enciende uno o más para limitarlo.
        </p>

        <!-- Context switch rows: one calm list, the whole row is the target. -->
        <ul
          v-if="contextRows.length > 0"
          class="product-switch-list"
          data-testid="context-list"
        >
          <li v-for="row in contextRows" :key="row.priceListId" class="min-w-0">
            <HfSwitchRow
              :model-value="row.supported"
              :label="row.name"
              :description="row.isCatalogDefault ? 'Lista predeterminada del catálogo' : undefined"
              test-id="context-toggle"
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
          class="m-0 text-sm text-(--hf-muted)"
        >
          Configura los contextos públicos de la sucursal en Sistema &gt; Catálogo online para habilitar
          esta selección
        </p>
        <p
          v-else-if="props.settingsLoading"
          data-testid="settings-loading-note"
          class="m-0 text-sm text-(--hf-muted)"
        >
          Cargando contextos públicos de la sucursal…
        </p>
        <p
          v-else-if="props.settingsError"
          data-testid="settings-error-note"
          class="m-0 text-sm text-(--hf-muted)"
        >
          No se pudieron cargar los contextos públicos de la sucursal
        </p>
        <p
          v-else-if="contextRows.length === 0"
          data-testid="contexts-empty-note"
          class="m-0 text-xs text-(--hf-muted)"
        >
          La sucursal no tiene contextos públicos configurados
        </p>
      </div>
    </div>
  </HfSectionCard>
</template>
