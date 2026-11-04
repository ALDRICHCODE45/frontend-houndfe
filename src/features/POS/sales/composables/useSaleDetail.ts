import { computed, type ComputedRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleApi } from '../api/sale.api'

function errorStatus(error: unknown): number | undefined {
  const e = error as
    | { response?: { status?: number }; status?: number; statusCode?: number }
    | null
  return e?.response?.status ?? e?.status ?? e?.statusCode
}

export function useSaleDetail(id: ComputedRef<string>) {
  const authStore = useAuthStore()

  const query = useQuery({
    queryKey: computed(() => saleQueryKeys.detail(authStore.currentTenantId, id.value)),
    queryFn: async () => {
      try {
        return await saleApi.getById(id.value)
      } catch (error) {
        throw error
      }
    },
    retry: false,
    enabled: computed(() => id.value.length > 0),
  })

  // A missing sale is a state of the page, not a failure to report: the view
  // shows it in place with a way back, so nothing redirects or toasts here.
  const isNotFound = computed(() => errorStatus(query.error.value) === 404)

  return {
    sale: computed(() => query.data.value),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value && !isNotFound.value),
    isNotFound,
    refetch: () => query.refetch(),
  }
}
