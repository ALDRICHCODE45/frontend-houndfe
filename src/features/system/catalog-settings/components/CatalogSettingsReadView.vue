<script setup lang="ts">
/**
 * CatalogSettingsReadView — the ACCEPTED tenant catalog settings in the same
 * rows as the editable screen, read-only (REQ-5 / REQ-11 / REQ-12), for users
 * without update:TenantCatalogSettings.
 *
 * Publication shows as a badge plus the effective-status line (read as-is,
 * never recomputed); the public lists keep server order with the default
 * badge; the stock card shows the accepted mode only (CUSTOM_QUANTITY 0 reads
 * «Mostrar 0»). Warnings go through the closed-set mapper; unknown codes are
 * dropped silently.
 */
import { computed } from 'vue'
import CatalogPublicationSection from './CatalogPublicationSection.vue'
import CatalogPriceContextsField from './CatalogPriceContextsField.vue'
import CatalogStockPresentationField from './CatalogStockPresentationField.vue'
import type { CatalogSettingsResponseDto } from '../interfaces/catalog-settings.types'
import {
  fromCatalogSettingsResponse,
  mapCatalogSettingsWarning,
  serializeStockPresentationDefault,
} from '../utils/catalogSettingsMappers'

const { settings } = defineProps<{
  settings: CatalogSettingsResponseDto
}>()

const snapshot = computed(() => fromCatalogSettingsResponse(settings))
const defaultName = computed(
  () => settings.priceContexts.find((context) => context.isCatalogDefault)?.name ?? null,
)
const visibleWarnings = computed(() =>
  settings.warnings
    .map((code) => mapCatalogSettingsWarning(code))
    .filter((copy): copy is string => copy !== null),
)
const stockDefault = computed(() =>
  serializeStockPresentationDefault(settings.stockPresentationDefault),
)
</script>

<template>
  <div class="flex flex-col gap-6 sm:gap-8" data-testid="catalog-settings-read">
    <CatalogPublicationSection
      readonly
      :published="settings.catalogPublished"
      :published-only="settings.catalogRequiresPublishedEditorial"
      :public-count="settings.priceContexts.length"
      :default-name="defaultName"
      :effective-publication="settings.effectivePublication"
      :warnings="visibleWarnings"
    />

    <CatalogPriceContextsField
      readonly
      :draft="snapshot"
      :accepted-contexts="settings.priceContexts"
      :candidates="[]"
    />

    <CatalogStockPresentationField readonly :stock-default="stockDefault" />
  </div>
</template>
