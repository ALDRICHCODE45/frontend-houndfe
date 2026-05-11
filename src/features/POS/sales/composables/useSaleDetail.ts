import { computed, watch, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleApi } from '../api/sale.api'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

export function useSaleDetail(id: ComputedRef<string>) {
  const authStore = useAuthStore()
  const router = useRouter()
  const toast = useToast()

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

  watch(
    () => query.error.value,
    (error) => {
      if (!error) return
      const status = (
        error as
          | { response?: { status?: number }; status?: number; statusCode?: number }
          | null
      )?.response?.status
        ?? (error as { status?: number } | null)?.status
        ?? (error as { statusCode?: number } | null)?.statusCode
      const message = status === 404 ? 'Venta no encontrada' : 'No pudimos cargar la venta'
      toast.add({ title: message, color: 'error' })
      void router.push('/pos/ventas')
    },
  )

  return {
    sale: computed(() => query.data.value),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
  }
}
