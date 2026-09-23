<script setup lang="ts">
/**
 * CatalogSettingsReadView — read-only rendering of the ACCEPTED tenant
 * catalog-settings response (WU3A, REQ-5 / REQ-11 / REQ-12).
 *
 * Pure presentational: receives the response DTO and renders publication /
 * effective badges, contexts + default, stock default, warnings, timestamp,
 * and the empty-contexts state.
 *
 * Warnings are mapped through the WU2B closed-set mapper: known codes render
 * the locked Spanish copy; unknown codes are dropped silently. The stock
 * default is serialized via the WU2B mapper; its label and explanation come
 * from the shared `stockPresentationUi` module ("Estado detallado", "Solo
 * disponibilidad", "Mostrar cantidad fija", "No mostrar stock"), and
 * CUSTOM_QUANTITY 0 is labeled "Mostrar 0".
 *
 * UI redesign: semantic internal sections (publication status, lists, stock
 * default) are separated by responsive spacing and dividers inside the routed
 * view's single outer card. UBadge replaces AppBadge for tone-consistent Nuxt
 * UI styling. All data-testid, props, and rendering contracts are preserved.
 */
import { computed } from 'vue'
import type { CatalogSettingsResponseDto } from '../interfaces/catalog-settings.types'
import {
  mapCatalogSettingsWarning,
  serializeStockPresentationDefault,
} from '../utils/catalogSettingsMappers'
import { formatCustomQuantityLabel, getStockPresentationCopy } from '../utils/stockPresentationUi'

const { settings } = defineProps<{
  settings: CatalogSettingsResponseDto
}>()

const publicationLabel = computed(() => (settings.catalogPublished ? 'Publicado' : 'No publicado'))
const publicationColor = computed(() => (settings.catalogPublished ? 'success' : 'neutral'))
const effectiveLabel = computed(() => (settings.effectivePublication ? 'Activa' : 'Inactiva'))
const effectiveColor = computed(() => (settings.effectivePublication ? 'success' : 'warning'))

/** Closed-set warnings: known codes → Spanish copy; unknown dropped silently. */
const visibleWarnings = computed(() =>
  settings.warnings
    .map((code) => mapCatalogSettingsWarning(code))
    .filter((copy): copy is string => copy !== null),
)

const stockDefault = computed(() =>
  serializeStockPresentationDefault(settings.stockPresentationDefault),
)
const stockModeCopy = computed(() => getStockPresentationCopy(stockDefault.value.mode))
const stockQuantityLabel = computed(() =>
  stockDefault.value.mode === 'CUSTOM_QUANTITY'
    ? formatCustomQuantityLabel(stockDefault.value.customQuantity)
    : null,
)
</script>

<template>
  <section class="flex flex-col gap-6 sm:gap-8" data-testid="catalog-settings-read">
    <!-- Publication + effective status (REQ-11: read-as-is, never recomputed). -->
    <section data-testid="publication-card">
      <div class="flex flex-wrap items-center gap-3">
        <UBadge
          data-testid="publication-badge"
          :label="`Catálogo: ${publicationLabel}`"
          :color="publicationColor"
          variant="subtle"
          size="md"
        />
        <UBadge
          data-testid="effective-badge"
          :label="`Publicación efectiva: ${effectiveLabel}`"
          :color="effectiveColor"
          variant="subtle"
          size="md"
        />
      </div>
      <p v-if="!settings.effectivePublication" class="mt-2 text-sm text-muted">
        La publicación efectiva también depende del estado del tenant.
      </p>
    </section>

    <!-- Public contexts + default (REQ-5/REQ-6: server order, isCatalogDefault). -->
    <section class="border-t border-default pt-6 sm:pt-8" data-testid="contexts-card">
      <h2 class="text-sm font-semibold text-default">Listas públicas</h2>
      <p class="mt-0.5 text-xs text-muted">Listas de precios visibles para clientes públicos</p>
      <p
        v-if="settings.priceContexts.length === 0"
        class="mt-4 text-sm text-muted"
        data-testid="contexts-empty"
      >
        Sin listas públicas: la configuración no se mostrará públicamente
      </p>
      <ul v-else class="mt-4 flex flex-col gap-2" data-testid="contexts-list">
        <li
          v-for="context in settings.priceContexts"
          :key="context.priceListId"
          class="flex flex-col gap-2 rounded-lg border border-default bg-default px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0"
          data-testid="context-row"
        >
          <span class="min-w-0 break-words text-sm text-default">{{ context.name }}</span>
          <UBadge
            v-if="context.isCatalogDefault"
            label="Predeterminada"
            color="primary"
            variant="subtle"
            size="sm"
          />
        </li>
      </ul>
    </section>

    <!-- Stock presentation default (REQ-8): shared label + honest explanation. -->
    <section class="border-t border-default pt-6 sm:pt-8" data-testid="stock-card">
      <h2 class="text-sm font-semibold text-default">Stock en catálogo</h2>
      <div class="mt-3 flex flex-col gap-1" data-testid="stock-default">
        <p class="text-sm text-default">
          {{ stockModeCopy.label }}
          <span v-if="stockQuantityLabel" class="text-muted">({{ stockQuantityLabel }})</span>
        </p>
        <p class="text-xs text-muted" data-testid="stock-default-description">
          {{ stockModeCopy.description }}
        </p>
      </div>
    </section>

    <!-- Closed-set warnings, read-only and warn-only (REQ-11). -->
    <p
      v-for="(warning, idx) in visibleWarnings"
      :key="idx"
      class="text-sm text-warning"
      data-testid="settings-warning"
    >
      {{ warning }}
    </p>

    <!-- Accepted timestamp. -->
    <p class="text-xs text-muted" data-testid="updated-at">
      Última actualización: {{ new Date(settings.updatedAt).toLocaleString() }}
    </p>
  </section>
</template>
