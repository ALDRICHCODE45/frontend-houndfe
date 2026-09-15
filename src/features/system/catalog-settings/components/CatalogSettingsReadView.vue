<script setup lang="ts">
/**
 * CatalogSettingsReadView — read-only rendering of the ACCEPTED tenant
 * catalog-settings response (WU3A, REQ-5 / REQ-11 / REQ-12).
 *
 * Pure presentational: receives the response DTO and renders publication /
 * effective badges, contexts + default, stock default, warnings, timestamp,
 * and the empty-contexts state. WU3B adds the `canUpdate` notice: when the
 * user lacks update:TenantCatalogSettings the locked Spanish save-permission
 * notice renders here and the routed view keeps the surface read-only.
 *
 * Warnings are mapped through the WU2B closed-set mapper: known codes render
 * the locked Spanish copy; unknown codes are dropped silently. The stock
 * default is serialized via the WU2B mapper and labeled per REQ-8
 * ("Mostrar 0" for CUSTOM_QUANTITY 0).
 */
import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import type { CatalogSettingsResponseDto } from '../interfaces/catalog-settings.types'
import {
  mapCatalogSettingsWarning,
  serializeStockPresentationDefault,
} from '../utils/catalogSettingsMappers'

const props = withDefaults(
  defineProps<{
    settings: CatalogSettingsResponseDto
    canUpdate?: boolean
  }>(),
  { canUpdate: true },
)

const STOCK_MODE_LABELS: Record<string, string> = {
  SYSTEM_STATUS: 'Según estado del sistema',
  ABSTRACT_STATUS: 'Según estado abstracto',
  CUSTOM_QUANTITY: 'Cantidad personalizada',
  HIDDEN: 'Oculto',
}

const publicationLabel = computed(() =>
  props.settings.catalogPublished ? 'Publicado' : 'No publicado',
)
const publicationTone = computed(() =>
  props.settings.catalogPublished ? 'success' : 'neutral',
)
const effectiveLabel = computed(() =>
  props.settings.effectivePublication ? 'Activa' : 'Inactiva',
)
const effectiveTone = computed(() =>
  props.settings.effectivePublication ? 'success' : 'warning',
)

/** Closed-set warnings: known codes → Spanish copy; unknown dropped silently. */
const visibleWarnings = computed(() =>
  props.settings.warnings
    .map((code) => mapCatalogSettingsWarning(code))
    .filter((copy): copy is string => copy !== null),
)

const stockDefault = computed(() =>
  serializeStockPresentationDefault(props.settings.stockPresentationDefault),
)
const stockModeLabel = computed(
  () => STOCK_MODE_LABELS[stockDefault.value.mode] ?? stockDefault.value.mode,
)
const stockQuantityLabel = computed(() =>
  stockDefault.value.mode === 'CUSTOM_QUANTITY'
    ? `Mostrar ${stockDefault.value.customQuantity}`
    : null,
)
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="catalog-settings-read">
    <!-- Publication + effective status (REQ-11: read-as-is, never recomputed). -->
    <div class="flex flex-wrap items-center gap-3">
      <AppBadge
        data-testid="publication-badge"
        :label="`Catálogo: ${publicationLabel}`"
        :tone="publicationTone"
      />
      <AppBadge
        data-testid="effective-badge"
        :label="`Publicación efectiva: ${effectiveLabel}`"
        :tone="effectiveTone"
      />
    </div>
    <p v-if="!settings.effectivePublication" class="text-sm text-muted">
      La publicación efectiva también depende del estado del tenant.
    </p>

    <!-- WU3B / REQ-12: read-only notice when update:TenantCatalogSettings is missing. -->
    <p
      v-if="!props.canUpdate"
      class="text-sm text-warning"
      data-testid="readonly-notice"
    >
      No tienes permisos para guardar cambios
    </p>

    <!-- Public contexts + default (REQ-5/REQ-6: server order, isCatalogDefault). -->
    <div>
      <h3 class="mb-2 text-sm font-semibold text-default">Listas públicas</h3>
      <p
        v-if="settings.priceContexts.length === 0"
        class="text-sm text-muted"
        data-testid="contexts-empty"
      >
        Sin listas públicas: la configuración no se mostrará públicamente
      </p>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="context in settings.priceContexts"
          :key="context.priceListId"
          class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
          data-testid="context-row"
        >
          <span class="text-sm text-default">{{ context.name }}</span>
          <AppBadge
            v-if="context.isCatalogDefault"
            label="Predeterminada"
            tone="info"
          />
        </li>
      </ul>
    </div>

    <!-- Stock presentation default (REQ-8). -->
    <div
      class="rounded-lg border border-default px-3 py-2"
      data-testid="stock-default"
    >
      <span class="text-sm font-semibold text-default">Stock en catálogo:</span>
      <span class="text-sm text-muted">{{ stockModeLabel }}</span>
      <span v-if="stockQuantityLabel" class="text-sm text-muted">
        ({{ stockQuantityLabel }})
      </span>
    </div>

    <!-- Closed-set warnings, read-only and warn-only (REQ-11). -->
    <p
      v-for="warning in visibleWarnings"
      :key="warning"
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
