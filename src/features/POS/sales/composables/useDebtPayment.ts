import { computed } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { ChargeDomainErrorCode, DebtPaymentPayload } from '../interfaces/sale.types'
import { getSalePaymentErrorAction } from '../utils/salePaymentErrors.utils'
import { newIdempotencyKey } from '../utils/idempotency.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

interface DomainErrorResponse {
  error?: ChargeDomainErrorCode
  message?: string
}

export function useDebtPayment(saleId: string) {
  const tenantId = useSafeTenantId()
  const queryClient = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: async (payload: DebtPaymentPayload) => {
      const idempotencyKey = newIdempotencyKey()
      return await saleApi.registerDebtPayment(saleId, payload, idempotencyKey)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, saleId) })
      await queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmed(tenantId.value) })
      toast.add({ title: 'Pago registrado', color: 'success' })
    },
    onError: async (error: AxiosError<DomainErrorResponse>) => {
      const code = error.response?.data?.error

      if (code === 'NO_OUTSTANDING_DEBT' || code === 'PAYMENT_EXCEEDS_DEBT') {
        await queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, saleId) })
      }

      if (code) {
        const action = getSalePaymentErrorAction(code)
        toast.add({ title: action.message, color: 'error' })
        return
      }

      toast.add({
        title: 'No pudimos registrar el pago',
        description: error.response?.data?.message ?? 'Reintentá en unos segundos.',
        color: 'error',
      })
    },
  })

  return {
    submit: mutation.mutateAsync,
    isSubmitting: computed(() => mutation.isPending.value),
    externalError: computed(() => (mutation.isError.value ? 'No pudimos registrar el pago de deuda' : null)),
  }
}
