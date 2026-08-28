/**
 * useDriverActiveRoutes — S6a (sdd delivery-routes, design.md §6.2, REQ-DRM-002 driver side)
 *
 * TanStack `useQuery` wrapper over `GET /delivery-routes?status=ACTIVE`.
 *
 * Locked contract:
 *   - queryKey: `deliveryRouteQueryKeys.list(tenantId, { status: 'ACTIVE' })` —
 *     the same cache slot the manager `useDeliveryRoutesTable('ACTIVE')` would
 *     write to (status is part of the key), so the prefix invalidation owned by
 *     every S4c / S5a / S5b mutation already refetches the driver list.
 *   - NO `driverUserId` param: CASL scopes the list server-side; the client
 *     never sends a driver-scoped filter (design §6.4, §13.1). The driver
 *     calls `GET /delivery-routes?status=ACTIVE` and the backend returns ONLY
 *     the driver's routes per the conditional rules.
 *   - NO client-side filter on the response (server is the source of truth;
 *     any client filter would re-implement server logic and could leak).
 *   - `refetchOnWindowFocus: false` (matches the payment-methods / sale-
 *     payment-methods precedent — no surprise refetches while the driver is
 *     mid-render).
 *   - `placeholderData` is intentionally UNSET — the driver list goes straight
 *     to "loading" without flashing stale data. The detail composable is the
 *     one that opts into `keepPreviousData`; the list does not.
 *   - Returns `{ data, isLoading, isFetching, isError, error, refetch }`.
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import type { DeliveryRouteResponseDto } from '../interfaces/delivery-route.types'

export function useDriverActiveRoutes() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const query = useQuery<DeliveryRouteResponseDto[]>({
    queryKey: computed(() =>
      deliveryRouteQueryKeys.list(tenantId.value, { status: 'ACTIVE' }),
    ),
    queryFn: () => deliveryRoutesApi.list('ACTIVE'),
    refetchOnWindowFocus: false,
    enabled: computed(() => tenantId.value !== ''),
  })

  return {
    /** Active routes for the current driver (server-scoped via CASL). */
    data: query.data,
    /** True while the FIRST fetch is in-flight (no cached data yet). */
    isLoading: query.isLoading,
    /** True while ANY fetch (including background refetch) is in-flight. */
    isFetching: query.isFetching,
    /** True after the queryFn rejected. The view owns the error routing. */
    isError: query.isError,
    /** The last error, or null. The view reads `extractDeliveryRouteErrorCode` on it. */
    error: query.error,
    /** Imperative refetch (used by pull-to-refresh in S6b; S6a exposes it for parity). */
    refetch: query.refetch,
  }
}
