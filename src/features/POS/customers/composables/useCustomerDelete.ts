/**
 * «Eliminar…» of a customer (customers-module T4): the confirmation, `DELETE /customers/:id`, its
 * toasts and the S10 backorders refusal. Moved out of CustomersView so the customer page reuses it;
 * `onDeleted` lets the page go back to the list.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerApi } from '../api/customer.api'
import { mapCustomerDomainError } from '../utils/customerFormError'
import {
  CUSTOMER_HAS_ACTIVE_BACKORDERS_MESSAGE,
  isCustomerHasActiveBackordersError,
} from '../utils/customerDeleteError'
import type { Customer } from '../interfaces/customer.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

export function useCustomerDelete(options: { onDeleted?: (customerId: string) => void } = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const canDelete = computed(() => authStore.userCan('delete', 'Customer'))

  const confirmState = ref({
    open: false,
    description: '',
    onConfirm: () => {},
  })

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => customerApi.remove(customerId),
    onSuccess: async (_, customerId) => {
      toast.add({
        title: 'Cliente eliminado',
        description: 'El cliente fue eliminado correctamente.',
        color: 'success',
      })
      options.onDeleted?.(customerId)

      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) })
    },
    onError: (error) => {
      // S10: the customer has a backorder WAITING or RESERVED; say what to do and keep it in the list.
      if (isCustomerHasActiveBackordersError(error)) {
        toast.add({
          title: 'Cliente con pedido por reposición',
          description: CUSTOMER_HAS_ACTIVE_BACKORDERS_MESSAGE,
          color: 'warning',
        })
        return
      }
      const { message } = mapCustomerDomainError(error)
      toast.add({ title: 'Error al eliminar cliente', description: message, color: 'error' })
    },
  })

  /** Asks first; nothing happens without delete:Customer. */
  function requestDelete(customer: Pick<Customer, 'id' | 'fullName'>) {
    if (!canDelete.value) return
    confirmState.value = {
      open: true,
      description: `¿Quieres eliminar al cliente ${customer.fullName}?`,
      onConfirm: () => deleteMutation.mutate(customer.id),
    }
  }

  function confirm() {
    confirmState.value.onConfirm()
    confirmState.value.open = false
  }

  function setConfirmOpen(open: boolean) {
    confirmState.value.open = open
  }

  return {
    confirmState,
    isDeleting: deleteMutation.isPending,
    requestDelete,
    confirm,
    setConfirmOpen,
  }
}
