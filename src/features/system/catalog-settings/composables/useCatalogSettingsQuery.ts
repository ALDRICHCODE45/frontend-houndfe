// useCatalogSettingsQuery.ts — tenant-scoped read query for
// GET /tenants/:tenantId/catalog-settings (WU2C, REQ-6). Reactive tenant key
// ⇒ a tenant switch resolves a DIFFERENT cache entry; NO placeholderData /
// initialData: a 404 (any non-2xx) is an error state, never a synthetic
// default. `enabled` is a computed CONJUNCTION: BOTH a non-empty tenant id
// (an empty id must never reach /tenants//catalog-settings) AND the optional
// caller gate (e.g. read:TenantCatalogSettings permission) must hold.

import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { catalogSettingsQueryKeys } from '@/core/shared/constants/query-keys'
import { catalogSettingsApi } from '../api/catalogSettings.api'
import type { CatalogSettingsResponseDto } from '../interfaces/catalog-settings.types'

export interface UseCatalogSettingsQueryOptions {
  /** Forwarded to TanStack `enabled` (e.g. permission-gated by the caller). */
  enabled?: MaybeRefOrGetter<boolean | undefined>
}

export function useCatalogSettingsQuery(
  tenantId: MaybeRefOrGetter<string>,
  options?: UseCatalogSettingsQueryOptions,
) {
  const enabled = computed(
    () => toValue(tenantId).length > 0 && toValue(options?.enabled ?? true),
  )
  const query = useQuery({
    queryKey: computed(() => catalogSettingsQueryKeys.detail(toValue(tenantId))),
    queryFn: () => catalogSettingsApi.get(toValue(tenantId)),
    enabled,
  })

  return {
    settings: query.data as Ref<CatalogSettingsResponseDto | undefined>,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
