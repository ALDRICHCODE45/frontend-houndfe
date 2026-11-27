import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { useTablePageSize } from '@/core/shared/composables/useTablePageSize'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { zoneValidationsApi } from '../api/deliveryZones.api'
import { zoneValidationKeys } from '../constants/queryKeys'

/** Countdowns run on the client; the queue is refetched now and then for new requesters and levels. */
export const VALIDATIONS_REFETCH_MS = 60_000

/** Pending queue, earliest deadline first (the backend's order). */
export function useZoneValidationsQueue() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  // The page size is remembered across reloads under the table's persistKey (page-size-memory S3),
  // so the first request already asks for it.
  const { pageSize } = useTablePageSize({ persistKey: 'shipping-zone-validations', defaultPageSize: 20 })
  const pagination = ref({ pageIndex: 0, pageSize: pageSize.value })
  watch(
    () => pagination.value.pageSize,
    (size) => {
      pageSize.value = size
    },
  )
  const params = computed(() => ({ page: pagination.value.pageIndex + 1, limit: pagination.value.pageSize }))
  const enabled = computed(() => tenantId.value.length > 0 && auth.userCan('validate', 'DeliveryZone'))

  const query = useQuery({
    queryKey: computed(() => zoneValidationKeys.list(tenantId.value, params.value)),
    queryFn: ({ signal }) => zoneValidationsApi.list(params.value, signal),
    enabled,
    retry: false,
    refetchInterval: VALIDATIONS_REFETCH_MS,
    placeholderData: keepPreviousData,
  })

  return {
    pagination,
    validations: computed(() => query.data.value?.data ?? []),
    totalCount: computed(() => query.data.value?.pagination.totalCount ?? 0),
    pageCount: computed(() => query.data.value?.pagination.pageCount ?? 0),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

/** One validation, PENDING or RESOLVED. */
export function useZoneValidationDetail(id: MaybeRefOrGetter<string | null>) {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  const enabled = computed(
    () => Boolean(toValue(id)) && tenantId.value.length > 0 && auth.userCan('validate', 'DeliveryZone'),
  )
  const query = useQuery({
    queryKey: computed(() => zoneValidationKeys.detail(tenantId.value, toValue(id) ?? '')),
    queryFn: ({ signal }) => zoneValidationsApi.get(toValue(id)!, signal),
    enabled,
    retry: false,
    refetchInterval: VALIDATIONS_REFETCH_MS,
  })
  return {
    validation: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
