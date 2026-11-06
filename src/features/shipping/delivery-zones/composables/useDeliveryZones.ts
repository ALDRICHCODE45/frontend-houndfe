import { computed, ref, shallowRef, watch } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { deliveryZonesApi } from '../api/deliveryZones.api'
import { deliveryZoneKeys } from '../constants/queryKeys'
import type { DeliveryZoneListParams, DeliveryZoneType } from '../interfaces/delivery-zone.types'

export type ZoneActiveFilter = 'ACTIVE' | 'INACTIVE' | 'ALL'
export const DEFAULT_ZONE_ACTIVE: ZoneActiveFilter = 'ACTIVE'

/** Zones list: search, type and active filters over the server page (`page` = pageIndex + 1). */
export function useDeliveryZones() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  const search = ref('')
  const debouncedSearch = refDebounced(search, 300)
  const type = shallowRef<DeliveryZoneType | undefined>(undefined)
  const active = shallowRef<ZoneActiveFilter>(DEFAULT_ZONE_ACTIVE)
  const pagination = ref({ pageIndex: 0, pageSize: 20 })

  watch([debouncedSearch, type, active, tenantId], () => {
    pagination.value = { ...pagination.value, pageIndex: 0 }
  })

  const params = computed<DeliveryZoneListParams>(() => ({
    page: pagination.value.pageIndex + 1,
    limit: pagination.value.pageSize,
    search: debouncedSearch.value.trim(),
    type: type.value,
    active: active.value === 'ALL' ? undefined : active.value === 'ACTIVE',
  }))
  const enabled = computed(() => tenantId.value.length > 0 && auth.userCan('read', 'DeliveryZone'))

  const query = useQuery({
    queryKey: computed(() => deliveryZoneKeys.list(tenantId.value, params.value)),
    queryFn: ({ signal }) => deliveryZonesApi.list(params.value, signal),
    enabled,
    retry: false,
    // Paging keeps the rows on screen; the table shows its progress bar meanwhile.
    placeholderData: keepPreviousData,
  })

  const filtered = computed(
    () => search.value.trim() !== '' || type.value !== undefined || active.value !== DEFAULT_ZONE_ACTIVE,
  )
  function clearFilters() {
    search.value = ''
    type.value = undefined
    active.value = DEFAULT_ZONE_ACTIVE
  }

  return {
    search,
    type,
    active,
    pagination,
    filtered,
    clearFilters,
    zones: computed(() => query.data.value?.data ?? []),
    totalCount: computed(() => query.data.value?.pagination.totalCount ?? 0),
    pageCount: computed(() => query.data.value?.pagination.pageCount ?? 0),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
