import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { zoneValidationsApi } from '../api/deliveryZones.api'
import { zoneValidationKeys } from '../constants/queryKeys'

const COUNT_PARAMS = { page: 1, limit: 1 } as const

/**
 * Pending zone validations for the nav badge: the lightest page, read from
 * `pagination.totalCount`. Under the validations prefix, so a resolve refreshes
 * it; the chatbot opens new ones at any time, so it also polls. No request
 * without validate:DeliveryZone.
 */
export function usePendingZoneValidationsCount() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  const enabled = computed(() => tenantId.value.length > 0 && auth.userCan('validate', 'DeliveryZone'))

  const query = useQuery({
    queryKey: computed(() => zoneValidationKeys.list(tenantId.value, COUNT_PARAMS)),
    queryFn: ({ signal }) => zoneValidationsApi.list(COUNT_PARAMS, signal),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })

  return {
    count: computed(() => (enabled.value ? (query.data.value?.pagination.totalCount ?? 0) : 0)),
  }
}
