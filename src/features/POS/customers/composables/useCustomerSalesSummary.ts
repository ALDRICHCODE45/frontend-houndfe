/**
 * The customer page's KPI metrics (customers-module T5): `GET /customers/:customerId/sales-summary`
 * (handoff 32 §5), read:Sale. 403 (no permission) and 404 (unknown customer or another branch)
 * are final answers: never retried, and the strip is hidden for them. Other failures retry once
 * and offer «Reintentar».
 *
 * The key sits under the customer history prefix, so a collection or a debt payment (which
 * refresh that prefix) refreshes the strip too.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerDetailApi, customerDetailQueryKeys } from '../api/customer-detail.api'
import type { CustomerSalesSummaryResponse } from '../interfaces/customer.types'

export function customerDetailHttpStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return e?.response?.status ?? e?.status ?? e?.statusCode
}

const FINAL_STATUSES = new Set([400, 401, 403, 404])

export function useCustomerSalesSummary(options: {
  customerId: MaybeRefOrGetter<string | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
}) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId ?? '')
  const customerId = computed(() => toValue(options.customerId) || '')
  const canRead = computed(
    () => typeof authStore.userCan === 'function' && authStore.userCan('read', 'Sale'),
  )

  const query = useQuery<CustomerSalesSummaryResponse>({
    queryKey: computed(() => customerDetailQueryKeys.salesSummary(tenantId.value, customerId.value)),
    queryFn: () => customerDetailApi.getSalesSummary(customerId.value),
    enabled: computed(
      () => toValue(options.enabled) && canRead.value && !!tenantId.value && !!customerId.value,
    ),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      const status = customerDetailHttpStatus(error)
      if (status !== undefined && FINAL_STATUSES.has(status)) return false
      return failureCount < 1
    },
  })

  // Never the previous customer's metrics while the next one loads (the route reuses the page).
  const metrics = computed(() => {
    const data = query.data.value
    return data && data.customerId === customerId.value ? data.metrics : undefined
  })
  const status = computed(() => (query.isError.value ? customerDetailHttpStatus(query.error.value) : undefined))
  /** 403/404: nothing to show (the page itself handles a missing customer). */
  const isHidden = computed(() => status.value === 403 || status.value === 404)
  const isFailed = computed(() => query.isError.value && !isHidden.value && !metrics.value)

  return {
    metrics,
    isLoading: query.isLoading,
    isHidden,
    isFailed,
    refetch: query.refetch,
  }
}
