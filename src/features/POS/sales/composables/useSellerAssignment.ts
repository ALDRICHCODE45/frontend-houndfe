import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { SellerAssignmentError } from '../interfaces/sale.types'
import type { SellerAssignmentErrorCode } from '../interfaces/sale.types'

interface DomainErrorResponse {
  error?: string
}

const KNOWN_CODES: SellerAssignmentErrorCode[] = [
  'SELLER_NOT_FOUND',
  'SELLER_NOT_ASSIGNABLE',
  'SALE_NOT_FOUND',
  'SALE_UPDATE_FORBIDDEN',
]

function parseSellerError(error: unknown): SellerAssignmentError | null {
  if (error instanceof SellerAssignmentError) {
    return error
  }
  const code = (error as AxiosError<DomainErrorResponse>)?.response?.data?.error
  if (code && KNOWN_CODES.includes(code as SellerAssignmentErrorCode)) {
    return new SellerAssignmentError(code as SellerAssignmentErrorCode)
  }
  return null
}

export function useSellerAssignment(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const lastError = ref<SellerAssignmentError | null>(null)

  const invalidateDetail = async () => {
    await queryClient.invalidateQueries({
      queryKey: saleQueryKeys.detail(tenantId.value, toValue(saleId)),
    })
  }

  const assignSellerMutation = useMutation({
    mutationFn: async (sellerUserId: string) => {
      try {
        return await saleApi.assignSeller(toValue(saleId), { sellerUserId })
      } catch (error) {
        throw parseSellerError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await invalidateDetail()
    },
    onError: (error) => {
      lastError.value = parseSellerError(error)
    },
  })

  const unassignSellerMutation = useMutation({
    mutationFn: async () => {
      try {
        await saleApi.unassignSeller(toValue(saleId))
      } catch (error) {
        throw parseSellerError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await invalidateDetail()
    },
    onError: (error) => {
      lastError.value = parseSellerError(error)
    },
  })

  return {
    assignSeller: (sellerUserId: string) => assignSellerMutation.mutateAsync(sellerUserId),
    unassignSeller: () => unassignSellerMutation.mutateAsync(),
    isPending: computed(
      () => assignSellerMutation.isPending.value || unassignSellerMutation.isPending.value,
    ),
    lastError: computed(() => lastError.value),
  }
}
