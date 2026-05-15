import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import type { DraftCustomerAssignmentErrorCode, Sale } from '../interfaces/sale.types'

interface DomainErrorResponse {
  error?: string
}

export class DraftCustomerAssignmentError extends Error {
  constructor(public readonly code: DraftCustomerAssignmentErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'DraftCustomerAssignmentError'
  }
}

function parseAssignmentError(error: unknown): DraftCustomerAssignmentError | null {
  if (error instanceof DraftCustomerAssignmentError) {
    return error
  }

  const code = (error as AxiosError<DomainErrorResponse>)?.response?.data?.error
  const knownCodes: DraftCustomerAssignmentErrorCode[] = [
    'CUSTOMER_NOT_FOUND',
    'SHIPPING_ADDRESS_NOT_FOUND',
    'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER',
    'SHIPPING_ADDRESS_REQUIRES_CUSTOMER',
    'SALE_NOT_DRAFT',
    'SALE_UPDATE_FORBIDDEN',
  ]

  if (code && knownCodes.includes(code as DraftCustomerAssignmentErrorCode)) {
    return new DraftCustomerAssignmentError(code as DraftCustomerAssignmentErrorCode)
  }

  return null
}

export function useDraftCustomerAssignment(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const lastError = ref<DraftCustomerAssignmentError | null>(null)

  const invalidateDraft = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sale-draft', toValue(saleId)] })
  }

  const assignCustomerMutation = useMutation({
    mutationFn: async ({ customerId, preserveShipping }: { customerId: string; preserveShipping?: boolean }) => {
      try {
        const resolvedSaleId = toValue(saleId)
        const payload: { customerId: string; shippingAddressId?: string | null } = { customerId }

        if (preserveShipping) {
          const currentDraft = queryClient.getQueryData<Sale>(['sale-draft', resolvedSaleId])
          if (currentDraft?.shippingAddress?.id) {
            payload.shippingAddressId = currentDraft.shippingAddress.id
          }
        }

        return await saleApi.assignCustomer(resolvedSaleId, payload)
      } catch (error) {
        throw parseAssignmentError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await invalidateDraft()
    },
    onError: (error) => {
      lastError.value = parseAssignmentError(error)
    },
  })

  const unassignCustomerMutation = useMutation({
    mutationFn: async () => {
      try {
        await saleApi.unassignCustomer(toValue(saleId))
      } catch (error) {
        throw parseAssignmentError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await invalidateDraft()
    },
    onError: (error) => {
      lastError.value = parseAssignmentError(error)
    },
  })

  const setShippingAddressMutation = useMutation({
    mutationFn: async ({ shippingAddressId }: { shippingAddressId: string | null }) => {
      try {
        return await saleApi.assignShippingAddress(toValue(saleId), { shippingAddressId })
      } catch (error) {
        throw parseAssignmentError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await invalidateDraft()
    },
    onError: (error) => {
      lastError.value = parseAssignmentError(error)
    },
  })

  const clearShippingAddressMutation = useMutation({
    mutationFn: async () => {
      try {
        await saleApi.unassignShippingAddress(toValue(saleId))
      } catch (error) {
        throw parseAssignmentError(error) ?? error
      }
    },
    onSuccess: async () => {
      lastError.value = null
      await invalidateDraft()
    },
    onError: (error) => {
      lastError.value = parseAssignmentError(error)
    },
  })

  return {
    assignCustomer: assignCustomerMutation.mutateAsync,
    unassignCustomer: unassignCustomerMutation.mutateAsync,
    setShippingAddress: setShippingAddressMutation.mutateAsync,
    clearShippingAddress: clearShippingAddressMutation.mutateAsync,
    isPending: computed(
      () =>
        assignCustomerMutation.isPending.value
        || unassignCustomerMutation.isPending.value
        || setShippingAddressMutation.isPending.value
        || clearShippingAddressMutation.isPending.value,
    ),
    lastError: computed(() => lastError.value),
  }
}
