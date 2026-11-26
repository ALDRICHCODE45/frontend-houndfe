/**
 * `GET /customers/:id` for the customer page (customers-module T4), under `customerQueryKeys.detail`
 * so saving in the editor (which invalidates that key) refreshes the page. A 404 is «not found»,
 * never retried; read:Customer is checked by the route and again here.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerApi } from '../api/customer.api'
import type { CustomerDetail } from '../interfaces/customer.types'

function httpStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return e?.response?.status ?? e?.status ?? e?.statusCode
}

export function useCustomerDetail(customerId: MaybeRefOrGetter<string | null | undefined>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const id = computed(() => toValue(customerId) || '')
  const canRead = computed(
    () => typeof authStore.userCan === 'function' && authStore.userCan('read', 'Customer'),
  )

  const query = useQuery<CustomerDetail>({
    queryKey: computed(() => customerQueryKeys.detail(tenantId.value, id.value)),
    queryFn: () => customerApi.getById(id.value),
    enabled: computed(() => canRead.value && !!tenantId.value && !!id.value),
    staleTime: 30_000,
    // An HTTP answer is shown at once (404 «no encontrado», others with «Reintentar»); only a
    // dropped connection is retried once on its own.
    retry: (failureCount, error) => httpStatus(error) === undefined && failureCount < 1,
  })

  // Never the previous customer's data while the next one loads (the route reuses the page).
  const customer = computed(() => {
    const data = query.data.value
    return data && data.id === id.value ? data : undefined
  })
  const isNotFound = computed(() => query.isError.value && httpStatus(query.error.value) === 404)

  return {
    canRead,
    customer,
    isLoading: query.isLoading,
    isError: query.isError,
    isNotFound,
    refetch: query.refetch,
  }
}
