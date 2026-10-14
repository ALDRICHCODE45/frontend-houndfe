import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStatus,
} from '../interfaces/delivery-route.types'
import {
  countRoutesByStatus,
  queryDeliveryRoutes,
  type DeliveryRouteStatusFilter,
} from '../utils/delivery-route-list.utils'

/** Search, sort and page changes reuse the cached list inside this window. */
const FULL_LIST_STALE_TIME_MS = 30_000

/**
 * useDeliveryRoutesTable — manager listing over the full flat route list.
 *
 * The backend returns every route in one flat array, so search, status
 * filter, sorting and pagination run client-side (`queryDeliveryRoutes`).
 * `useServerTable` appends its params to the query key, so the raw list lives
 * in its own cached slot (`[...listPrefix, 'full-list', status]`) and each
 * keystroke or sort change re-slices it instead of refetching. Both slots sit
 * under `deliveryRouteQueryKeys.listPrefix(tenantId)`, so mutation
 * invalidations still refresh everything atomically.
 *
 * `status` is the API-side filter (driver entry point); the manager list
 * passes `undefined` and narrows with the exposed `statusFilter` instead.
 */
export function useDeliveryRoutesTable(status?: DeliveryRouteStatus) {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()
  const tenantId = computed(() => authStore.currentTenantId)

  const fullList = ref<DeliveryRouteResponseDto[]>([])
  const statusFilter = ref<DeliveryRouteStatusFilter>('ALL')
  const statusCounts = computed(() => countRoutesByStatus(fullList.value))

  const table = useServerTable<DeliveryRouteResponseDto>({
    queryKey: () => [...deliveryRouteQueryKeys.listPrefix(tenantId.value), statusFilter.value],
    queryFn: async (params) => {
      const rows = await queryClient.fetchQuery({
        queryKey: [
          ...deliveryRouteQueryKeys.listPrefix(tenantId.value),
          'full-list',
          status ?? 'ALL',
        ],
        queryFn: () => deliveryRoutesApi.list(status),
        staleTime: FULL_LIST_STALE_TIME_MS,
      })
      fullList.value = rows
      return queryDeliveryRoutes(rows, {
        status: statusFilter.value,
        search: params.globalFilter ?? '',
        sorting: params.sorting,
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
      })
    },
    defaultPageSize: 10,
    persistKey: 'pos-delivery-routes',
    defaultSorting: [{ id: 'createdAt', desc: true }],
    defaultPinning: { left: [], right: ['actions'] },
    urlSync: false,
  })

  /**
   * Manual refresh must reach the server: the cached full list would otherwise
   * be reused for its stale window.
   */
  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: [...deliveryRouteQueryKeys.listPrefix(tenantId.value), 'full-list'],
    })
    await table.refresh()
  }

  return {
    ...table,
    refresh,
    fullList,
    statusFilter,
    statusCounts,
  }
}
