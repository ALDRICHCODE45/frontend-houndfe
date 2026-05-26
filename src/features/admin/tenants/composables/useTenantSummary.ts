import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminTenantQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { tenantsApi } from '../api/tenants.api'

/**
 * Resolves the human-readable name of a tenant identified by `tenantId`.
 *
 * Same-tenant fast path: when `tenantId` matches the currently active tenant in
 * the auth store, returns the store name without hitting the API.
 *
 * Cross-tenant path: super-admin or any caller browsing a tenant other than
 * their active one triggers `GET /admin/tenants/:id` via TanStack Query.
 *
 * Failure fallback: if the fetch errors (network failure, 404, missing
 * permissions), exposes the literal `tenantId` so the UI never crashes.
 */
export function useTenantSummary(tenantId: MaybeRefOrGetter<string>) {
  const authStore = useAuthStore()

  const resolvedTenantId = computed(() => toValue(tenantId))
  const isSameTenant = computed(
    () =>
      Boolean(authStore.currentTenant?.id) &&
      authStore.currentTenant?.id === resolvedTenantId.value,
  )

  const enabled = computed(
    () => !isSameTenant.value && resolvedTenantId.value.length > 0,
  )

  const query = useQuery({
    queryKey: computed(() => adminTenantQueryKeys.detail(resolvedTenantId.value)),
    queryFn: () => tenantsApi.getById(resolvedTenantId.value),
    enabled,
    staleTime: 60_000,
  })

  const tenantName = computed(() => {
    if (isSameTenant.value) {
      return authStore.currentTenant?.name ?? resolvedTenantId.value
    }
    if (query.isError?.value) {
      return resolvedTenantId.value
    }
    return query.data?.value?.name ?? resolvedTenantId.value
  })

  const isLoadingTenantName = computed(() => {
    if (isSameTenant.value) return false
    return Boolean(query.isLoading?.value)
  })

  return {
    tenantName,
    isLoadingTenantName,
  }
}
