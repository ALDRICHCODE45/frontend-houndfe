import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { CustomerSalesMonth } from '../interfaces/sale.types'

/**
 * Sales history backend data T1 (S4, handoff 28 §4): the customer's monthly totals for the chart in
 * the customer history. `read:Sale` (not `read:Customer`); without it nothing is fetched. Errors,
 * including `404 CUSTOMER_NOT_FOUND`, surface as `isError` so the chart can hide with a retry.
 */
export interface UseCustomerSalesMonthlyOptions {
  customerId: MaybeRefOrGetter<string | null | undefined>
  open: MaybeRefOrGetter<boolean>
  /** 1–24 (backend), default 12. */
  months?: MaybeRefOrGetter<number>
}

interface MonthlyCacheEntry {
  ownerCustomerId: string
  months: CustomerSalesMonth[]
}

function httpStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return e?.response?.status ?? e?.status ?? e?.statusCode
}

export function useCustomerSalesMonthly(options: UseCustomerSalesMonthlyOptions) {
  const authStore = useAuthStore()

  const customerId = computed(() => toValue(options.customerId) || undefined)
  const months = computed(() => toValue(options.months) ?? 12)
  const tenantId = computed(() => authStore.currentTenantId)
  const canRead = computed(
    () => typeof authStore.userCan === 'function' && authStore.userCan('read', 'Sale'),
  )
  const enabled = computed(
    () =>
      toValue(options.open) &&
      canRead.value &&
      Boolean(tenantId.value) &&
      Boolean(customerId.value),
  )

  const query = useQuery<MonthlyCacheEntry>({
    queryKey: computed(() =>
      saleQueryKeys.customerMonthly(tenantId.value, customerId.value as string, months.value),
    ),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = httpStatus(error)
      if (status !== undefined && status >= 400 && status < 500) return false
      return failureCount < 1
    },
    queryFn: async ({ signal }) => {
      const id = customerId.value as string
      const response = await saleApi.getCustomerSalesMonthly(id, months.value, { signal })
      return { ownerCustomerId: id, months: response.months }
    },
  })

  // Never the months of the previous customer while the next one loads.
  const data = computed(() => {
    const entry = query.data.value
    return entry && entry.ownerCustomerId === customerId.value ? entry.months : undefined
  })

  return {
    canRead,
    months: data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
