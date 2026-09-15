<script setup lang="ts">
/**
 * TenantCatalogSettingsView — routed composition surface at
 * /system/catalog-settings (WU3A, REQ-4 / REQ-5 / REQ-12).
 *
 * Thin composition: tenant id from useSafeTenantId, the WU2C read query,
 * and three states — loading skeleton, GET error with Reintentar (no
 * synthetic defaults), accepted read-only surface delegated to
 * CatalogSettingsReadView. WU3B layers the editable form, mutation, and
 * confirmation modal on top of this same route.
 */
import { useCatalogSettingsQuery } from '../composables/useCatalogSettingsQuery'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import CatalogSettingsReadView from '../components/CatalogSettingsReadView.vue'

const tenantId = useSafeTenantId()
const query = useCatalogSettingsQuery(tenantId)

/** Re-run the read query after a GET failure (any non-2xx, incl. 404). */
function onRetry() {
  void query.refetch()
}
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <!-- Loading state: skeletons only; no enabled controls, no synthetic values. -->
    <template v-if="query.isLoading.value">
      <USkeleton class="h-8 w-1/3" />
      <USkeleton class="h-40 w-full rounded-lg" />
      <USkeleton class="h-40 w-full rounded-lg" />
    </template>

    <!-- GET error state: explicit retry, never a 404-as-default fallback. -->
    <div
      v-else-if="query.isError.value"
      class="flex flex-col gap-3 rounded-lg border border-default p-6"
      data-testid="settings-error"
    >
      <p class="text-sm text-error">
        No se pudo cargar la configuración del catálogo.
      </p>
      <UButton
        color="primary"
        data-testid="retry-button"
        @click="onRetry"
      >
        Reintentar
      </UButton>
    </div>

    <!-- Accepted read-only surface. -->
    <CatalogSettingsReadView
      v-else-if="query.settings.value"
      :settings="query.settings.value"
    />
  </div>
</template>
