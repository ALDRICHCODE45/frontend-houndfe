/**
 * useDeliveryRouteDetail — S6a (sdd delivery-routes, design.md §6.2, §11)
 *
 * TanStack `useQuery` wrapper over `GET /delivery-routes/:id`.
 *
 * Locked contract:
 *   - queryKey: `deliveryRouteQueryKeys.detail(tenantId, id)` — invalidated on
 *     success by every mutation in the module:
 *       * S4c: useUpdateDeliveryRoute (PATCH)
 *       * S5a: useReorderStops (PUT)
 *       * S5b: useDeleteDeliveryRoute (removeQueries), useStartDeliveryRoute,
 *         useCancelDeliveryRoute, useAppendDeliveryRouteStop
 *   - `placeholderData: keepPreviousData` — the previous route stays visible
 *     while the new one loads (the manager navigates between routes often;
 *     flashing an empty skeleton would be jarring — design §11 detail view).
 *   - The composable does NOT swallow errors: the queryFn propagates the
 *     rejection so the view can read `extractDeliveryRouteErrorCode(error)`
 *     and route the 404 / driver 403 to the same full-page "Ruta no
 *     encontrada" state (no presence leak).
 *   - `refetchOnWindowFocus: false` — no surprise refetches while the manager
 *     is mid-edit; the window-focus path stays inert (no focus listener).
 *   - Freshness sources (REQ-DRC-110): mutation invalidation on success and the
 *     cockpit manual refresh — the view calls observer `refetch()` once per
 *     header refresh and toasts failures itself; no polling/push/new key.
 *   - `id` is typed as `MaybeRefOrGetter<string>` so the view can pass
 *     `route.params.id` directly OR a computed. The composable normalises
 *     reactive and non-reactive inputs the same way (`toValue`).
 *   - Returns `{ data, isLoading, isFetching, isError, error, refetch }`.
 */

import { computed, toValue } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import type { DeliveryRouteResponseDto } from '../interfaces/delivery-route.types'

export function useDeliveryRouteDetail(id: MaybeRefOrGetter<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const idRef = computed(() => toValue(id))

  const query = useQuery<DeliveryRouteResponseDto>({
    queryKey: computed(() =>
      deliveryRouteQueryKeys.detail(tenantId.value, idRef.value),
    ),
    queryFn: () => deliveryRoutesApi.getById(idRef.value),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    enabled: computed(() => idRef.value.length > 0 && tenantId.value !== ''),
  })

  return {
    /** The route DTO (or `undefined` on initial load / 404). */
    data: computed(() => query.data.value as DeliveryRouteResponseDto | undefined),
    /** True while the FIRST fetch is in-flight (no cached data yet). */
    isLoading: query.isLoading,
    /** True while ANY fetch (including background refetch) is in-flight. */
    isFetching: query.isFetching,
    /** True after the queryFn rejected. The view owns the error routing. */
    isError: query.isError,
    /** The last error, or null. */
    error: query.error,
    /** Imperative refetch (used after a 409 conflict resync, etc.). */
    refetch: query.refetch,
  }
}
