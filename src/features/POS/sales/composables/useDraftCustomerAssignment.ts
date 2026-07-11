import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { DraftCustomerAssignmentErrorCode, Sale } from '../interfaces/sale.types'
import { replaceSaleInCache } from './useSalesDrafts'

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
  const tenantId = useSafeTenantId()
  const lastError = ref<DraftCustomerAssignmentError | null>(null)
  const draftsKey = computed(() => saleQueryKeys.drafts(tenantId.value))



  const assignCustomerMutation = useMutation({
    mutationFn: async ({ customerId, preserveShipping }: { customerId: string; preserveShipping?: boolean }) => {
      try {
        const resolvedSaleId = toValue(saleId)
        const payload: { customerId: string; shippingAddressId?: string | null } = { customerId }

        if (preserveShipping) {
          const drafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
          const currentDraft = drafts.find((draft) => draft.id === resolvedSaleId)
          if (currentDraft?.shippingAddress?.id) {
            payload.shippingAddressId = currentDraft.shippingAddress.id
          }
        }

        return await saleApi.assignCustomer(resolvedSaleId, payload)
      } catch (error) {
        throw parseAssignmentError(error) ?? error
      }
    },
    onSuccess: async (updatedSale) => {
      lastError.value = null
      const drafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(drafts, updatedSale))
      // Customer-scoped promos depend on the assigned customer (backend
      // contract §5, §2.2, §5 line 51-54). Mirror the useSalesDrafts pattern
      // so the "Promociones disponibles" list re-reads after assign.
      queryClient.invalidateQueries({
        queryKey: saleQueryKeys.applicablePromotions(tenantId.value, toValue(saleId)),
      })
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
      const resolvedSaleId = toValue(saleId)
      const drafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      const currentDraft = drafts.find((draft) => draft.id === resolvedSaleId)

      if (currentDraft) {
        // Unassigning customer also clears shipping address (per backend behavior)
        const updatedDraft: Sale = { ...currentDraft, customer: null, shippingAddress: null }
        queryClient.setQueryData(draftsKey.value, replaceSaleInCache(drafts, updatedDraft))
      }
      // Customer-scoped promos no longer match when the customer is dropped.
      queryClient.invalidateQueries({
        queryKey: saleQueryKeys.applicablePromotions(tenantId.value, resolvedSaleId),
      })
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
    onSuccess: async (updatedSale) => {
      lastError.value = null
      const drafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(drafts, updatedSale))
      // Shipping-address-scoped promos may now apply (or stop applying).
      queryClient.invalidateQueries({
        queryKey: saleQueryKeys.applicablePromotions(tenantId.value, toValue(saleId)),
      })
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
      const resolvedSaleId = toValue(saleId)
      const drafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      const currentDraft = drafts.find((draft) => draft.id === resolvedSaleId)

      if (currentDraft) {
        // Clear only shipping address, preserve customer
        const updatedDraft: Sale = { ...currentDraft, shippingAddress: null }
        queryClient.setQueryData(draftsKey.value, replaceSaleInCache(drafts, updatedDraft))
      }
      // Shipping-address-scoped promos may stop applying.
      queryClient.invalidateQueries({
        queryKey: saleQueryKeys.applicablePromotions(tenantId.value, resolvedSaleId),
      })
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
