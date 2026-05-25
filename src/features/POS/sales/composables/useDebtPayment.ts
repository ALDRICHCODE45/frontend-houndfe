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
import { getSalePaymentErrorAction } from '../utils/salePaymentErrors.utils'

interface ToastApi {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

// useToast is auto-imported globally by Nuxt UI plugin at runtime.
// In test environment, stub it via vi.stubGlobal or globalThis.useToast.
function resolveToast(): ToastApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (globalThis as any).useToast
  if (typeof fn === 'function') return fn()
  throw new Error('useToast is not available. Ensure Nuxt UI plugin is installed or mock it in tests.')
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
  const toast = resolveToast()

  const externalErrorCode = ref<DebtPaymentDomainErrorCode | null>(null)
  const shouldClose = ref(false)

  const mutation = useMutation({
    mutationFn: async (input: DebtPaymentMutationInput) => {
      return await saleApi.registerDebtPayment(saleId, input.payload, input.idempotencyKey)
    },
    onSuccess: (data: DebtPaymentResponse) => {
      void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, saleId) })
      void queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmed(tenantId.value) })

      const title = data.paymentStatus === 'PAID' ? 'Venta pagada' : 'Pago parcial registrado'
      toast.add({ title, color: 'success' })
    },
    onError: (error: AxiosError<DomainErrorResponse>) => {
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
  }
}
