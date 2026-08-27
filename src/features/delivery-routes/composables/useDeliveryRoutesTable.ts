import { computed, ref } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import {
  deliveryRoutesApi,
  paginateDeliveryRoutes,
} from '../api/delivery-routes.api'
import type { DeliveryRouteResponseDto, DeliveryRouteStatus } from '../interfaces/delivery-route.types'

/**
 * useDeliveryRoutesTable — LOCKED single-source wrapper (sdd delivery-routes, design.md §6.2).
 *
 * Mirrors `usePaymentDetailsTable`: `useServerTable` only surfaces the page
 * slice (`data`), but the manager list needs the FULL flat list for row-action
 * gating (e.g. "can this DRAFT be started?" depends on `route.stops.length`,
 * which only `fullList` knows without an extra fetch per row). The backend list
 * is flat and client-paginated, so:
 *
 *   - ONE fetch captures the full array in `fullList`,
 *   - the same fetch returns the page slice via `paginateDeliveryRoutes`,
 *   - cache key prefix is `deliveryRouteQueryKeys.listPrefix(tenantId)` (NOT
 *     `list(tenantId, {})`) so `invalidateQueries({queryKey:listPrefix(t)})`
 *     refetches every page/filter slot atomically.
 *
 * The `status` param is the driver-branch entry point (e.g. `'ACTIVE'`); the
 * manager list passes `undefined`. `deliveryRoutesApi.list(status)` already
 * omits the `params.status` key when status is undefined (axios-native), so
 * no extra branching is needed.
 */
export function useDeliveryRoutesTable(status?: DeliveryRouteStatus) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const fullList = ref<DeliveryRouteResponseDto[]>([])

  const table = useServerTable<DeliveryRouteResponseDto>({
    queryKey: () => deliveryRouteQueryKeys.listPrefix(tenantId.value),
    queryFn: async (params) => {
      const rows = await deliveryRoutesApi.list(status)
      fullList.value = rows
      return paginateDeliveryRoutes(rows, params)
    },
    defaultPageSize: 10,
    persistKey: 'pos-delivery-routes',
    defaultSorting: [{ id: 'updatedAt', desc: true }],
    defaultPinning: { left: [], right: ['actions'] },
    urlSync: false,
  })

  return {
    ...table,
    fullList,
  }
}
