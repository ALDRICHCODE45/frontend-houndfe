import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { SaleDueDateError } from '../interfaces/sale.types'
import type { SaleDueDateErrorCode } from '../interfaces/sale.types'

interface DomainErrorResponse {
  error?: string
}

const KNOWN_CODES: SaleDueDateErrorCode[] = [
  'INVALID_DUE_DATE',
  'SALE_ALREADY_PAID',
  'SALE_NOT_FOUND',
  'SALE_UPDATE_FORBIDDEN',
]

function parseDueDateError(error: unknown): SaleDueDateError | null {
  if (error instanceof SaleDueDateError) return error
  const code = (error as AxiosError<DomainErrorResponse>)?.response?.data?.error
  if (code && KNOWN_CODES.includes(code as SaleDueDateErrorCode)) {
    return new SaleDueDateError(code as SaleDueDateErrorCode)
  }
  return null
}

export function useSaleDueDate(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const lastError = ref<SaleDueDateError | null>(null)

  const setDueDateMutation = useMutation({
    mutationFn: async (dueDate: string | null) => {
      try {
        return await saleApi.setDueDate(toValue(saleId), { dueDate })
      } catch (error) {
        throw parseDueDateError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await queryClient.invalidateQueries({
        queryKey: saleQueryKeys.detail(tenantId.value, toValue(saleId)),
      })
    },
    onError: (error) => {
      lastError.value = parseDueDateError(error)
    },
  })

  return {
    setDueDate: (dueDate: string | null) => setDueDateMutation.mutateAsync(dueDate),
    isPending: computed(() => setDueDateMutation.isPending.value),
    lastError: computed(() => lastError.value),
  }
}
