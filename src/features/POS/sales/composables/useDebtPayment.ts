import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type {
  DebtPaymentDomainErrorCode,
  DebtPaymentPayload,
  DebtPaymentResponse,
} from '../interfaces/sale.types'
import { SALE_PAYMENT_STATUS } from '../constants/sale.constants' // sdd/magic-string-constants slice 3
import { getSalePaymentErrorAction } from '../utils/salePaymentErrors.utils'
import { applyCatalogChargeErrorAction } from '../utils/paymentMethodChargeErrors.utils' // sdd custom-payment-methods S5A

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.stubGlobal('useToast', () => ({ add: mockFn })).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

interface DomainErrorResponse {
  error?: string
  message?: string
}

interface DebtPaymentMutationInput {
  payload: DebtPaymentPayload
  idempotencyKey: string
}

const CLOSE_CODES: ReadonlySet<string> = new Set([
  'NO_OUTSTANDING_DEBT',
  'SALE_NOT_CONFIRMABLE_FOR_PAYMENT',
  'SALE_NOT_FOUND',
])

const REFETCH_DETAIL_CODES: ReadonlySet<string> = new Set([
  'PAYMENT_EXCEEDS_DEBT',
  'NO_OUTSTANDING_DEBT',
  'SALE_NOT_CONFIRMABLE_FOR_PAYMENT',
])

const INVALIDATE_LIST_CODES: ReadonlySet<string> = new Set([
  'SALE_NOT_FOUND',
])

export function useDebtPayment(saleId: string) {
  const tenantId = useSafeTenantId()
  const queryClient = useQueryClient()
  const toast = useToast()

  // sdd custom-payment-methods S5A (design §8.3 / REQ-CAT-007..009): the
  // clear-selection signal handed to DebtPaymentModal. Incremented in the
  // catalog-error branch of onError; the modal's watch drops every entry
  // carrying a `paymentMethodId` (custom tiles).
  const catalogClearSignal = ref(0)

  const externalErrorCode = ref<DebtPaymentDomainErrorCode | null>(null)
  const shouldClose = ref(false)

  const mutation = useMutation({
    mutationFn: async (input: DebtPaymentMutationInput) => {
      return await saleApi.registerDebtPayment(saleId, input.payload, input.idempotencyKey)
    },
    onSuccess: (data: DebtPaymentResponse) => {
      void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, saleId) })
      void queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmed(tenantId.value) })

      const title = data.paymentStatus === SALE_PAYMENT_STATUS.PAID ? 'Venta pagada' : 'Pago parcial registrado'
      toast.add({ title, color: 'success' })
    },
    onError: (error: AxiosError<DomainErrorResponse>) => {
      // sdd custom-payment-methods S5A (REQ-CAT-011): catalog charge errors
      // resolve FIRST — clear/refetch/toast per design §8.2 — and short-circuit
      // BEFORE the legacy getSalePaymentErrorAction path.
      if (applyCatalogChargeErrorAction(error, { queryClient, tenantId, toast, catalogClearSignal }).handled) {
        return
      }

      const code = error.response?.data?.error

      if (code && REFETCH_DETAIL_CODES.has(code)) {
        void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, saleId) })
      }

      if (code && INVALIDATE_LIST_CODES.has(code)) {
        void queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmed(tenantId.value) })
      }

      if (code === 'PAYMENT_EXCEEDS_DEBT') {
        externalErrorCode.value = code
        shouldClose.value = false
        return
      }

      if (code && CLOSE_CODES.has(code)) {
        shouldClose.value = true
      }

      if (code) {
        const action = getSalePaymentErrorAction(code as Parameters<typeof getSalePaymentErrorAction>[0])
        // S5A TRIANGULATE: an unknown code yields undefined here (the map is
        // total over ChargeDomainErrorCode only) — fall through to the generic
        // toast instead of crashing on action.message.
        if (action) {
          toast.add({ title: action.message, color: 'error' })
          return
        }
      }

      toast.add({
        title: 'No pudimos registrar el pago',
        description: error.response?.data?.message ?? 'Reintenta en unos segundos.',
        color: 'error',
      })
    },
  })

  function resetError() {
    externalErrorCode.value = null
    shouldClose.value = false
  }

  async function submitSafe(input: DebtPaymentMutationInput): Promise<DebtPaymentResponse | undefined> {
    try {
      return await mutation.mutateAsync(input)
    } catch {
      // Error already handled by onError — swallow rejection so callers don't need try/catch
      return undefined
    }
  }

  return {
    submit: mutation.mutateAsync,
    submitSafe,
    isSubmitting: computed(() => mutation.isPending.value),
    externalErrorCode,
    shouldClose,
    resetError,
    // sdd custom-payment-methods S5A (design §8.3): consumed by
    // DebtPaymentModal's watch to drop custom entries after a catalog error.
    catalogClearSignal,
  }
}
