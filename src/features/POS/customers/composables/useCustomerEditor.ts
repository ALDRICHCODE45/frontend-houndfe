/**
 * The customer editor session (customers-module T4): load the detail, save it, and add, change or
 * remove its addresses, with the same toasts and stale-session guards the customers list had.
 * Moved out of CustomersView so the customer page opens the same `CustomerUpsertSlideover`.
 *
 * Every open bumps a session number; a reply for an older session (the person reopened or closed
 * the editor meanwhile) never touches the form. The list's create flow shares the session and the
 * field errors through `beginSession` / `isSession` / `formErrors`.
 */
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerApi } from '../api/customer.api'
import { mapCustomerDomainError } from '../utils/customerFormError'
import type {
  CreateCustomerAddressPayload,
  CustomerDetail,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

export function useCustomerEditor() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const canUpdate = computed(() => authStore.userCan('update', 'Customer'))

  const isEditOpen = ref(false)
  const selectedCustomer = ref<CustomerDetail | null>(null)
  const selectedCustomerId = ref<string | null>(null)
  const formErrors = ref<Partial<Record<string, string>>>({})
  let editSession = 0
  let loadingEdit = false

  /** A fresh session with an empty, closed editor (the list's «Crear cliente» starts here too). */
  function beginSession(): number {
    editSession++
    loadingEdit = false
    isEditOpen.value = false
    selectedCustomer.value = null
    selectedCustomerId.value = null
    formErrors.value = {}
    return editSession
  }

  function isSession(session: number) {
    return session === editSession
  }

  function currentSession() {
    return editSession
  }

  function clearFormContext() {
    editSession++
    selectedCustomer.value = null
    selectedCustomerId.value = null
    formErrors.value = {}
  }

  function isLoadingEdit() {
    return loadingEdit
  }

  function isCurrentEdit(customerId: string, session: number) {
    return session === editSession && isEditOpen.value && selectedCustomerId.value === customerId
  }

  const updateMutation = useMutation({
    mutationFn: (payload: { customerId: string; values: UpdateCustomerPayload; session: number }) =>
      customerApi.update(payload.customerId, payload.values),
    onSuccess: async (_, variables) => {
      if (isCurrentEdit(variables.customerId, variables.session)) {
        isEditOpen.value = false
        clearFormContext()
      }
      toast.add({
        title: 'Cliente actualizado',
        description: 'Los cambios se guardaron correctamente.',
        color: 'success',
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) }),
        queryClient.invalidateQueries({
          queryKey: customerQueryKeys.detail(tenantId.value, variables.customerId),
        }),
      ])
    },
    onError: (error, { customerId, session }) => {
      if (!isCurrentEdit(customerId, session)) return
      const { message, fields } = mapCustomerDomainError(error)
      formErrors.value = fields
      toast.add({ title: 'Error al actualizar cliente', description: message, color: 'error' })
    },
  })

  async function refreshAddressSelection(customerId: string, session: number) {
    if (!isCurrentEdit(customerId, session)) return
    try {
      const refreshed = await customerApi.getById(customerId)
      if (isCurrentEdit(customerId, session)) selectedCustomer.value = refreshed
    } catch {
      toast.add({
        title: 'Dirección guardada',
        description:
          'La dirección se guardó, pero no se pudo actualizar la vista. Reabre el cliente para verla.',
        color: 'warning',
      })
    }
  }

  async function invalidateAddressList(customerId: string) {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) }),
        // The customer page reads the detail: its «Datos y direcciones» follows the change.
        queryClient.invalidateQueries({
          queryKey: customerQueryKeys.detail(tenantId.value, customerId),
        }),
      ])
    } catch {
      toast.add({
        title: 'Dirección guardada',
        description: 'La lista no se pudo actualizar. Recarga para ver los cambios.',
        color: 'warning',
      })
    }
  }

  const createAddressMutation = useMutation({
    mutationFn: ({
      customerId,
      payload,
    }: {
      customerId: string
      payload: CreateCustomerAddressPayload
      session: number
    }) => customerApi.createAddress(customerId, payload),
    onSuccess: async (_, { customerId, session }) => {
      toast.add({
        title: 'Dirección añadida',
        description: 'La dirección se añadió correctamente.',
        color: 'success',
      })

      await refreshAddressSelection(customerId, session)
      await invalidateAddressList(customerId)
    },
    onError: (error) => {
      const { message } = mapCustomerDomainError(error)
      toast.add({ title: 'Error al añadir dirección', description: message, color: 'error' })
    },
  })

  const updateAddressMutation = useMutation({
    mutationFn: ({
      customerId,
      addressId,
      payload,
    }: {
      customerId: string
      addressId: string
      payload: CreateCustomerAddressPayload
      session: number
    }) => customerApi.updateAddress(customerId, addressId, payload),
    onSuccess: async (_, { customerId, session }) => {
      toast.add({
        title: 'Dirección actualizada',
        description: 'La dirección se actualizó correctamente.',
        color: 'success',
      })

      await refreshAddressSelection(customerId, session)
      await invalidateAddressList(customerId)
    },
    onError: (error) => {
      const { message } = mapCustomerDomainError(error)
      toast.add({ title: 'Error al actualizar dirección', description: message, color: 'error' })
    },
  })

  const removeAddressMutation = useMutation({
    mutationFn: ({
      customerId,
      addressId,
    }: {
      customerId: string
      addressId: string
      session: number
    }) => customerApi.removeAddress(customerId, addressId),
    onSuccess: async (_, { customerId, session }) => {
      toast.add({
        title: 'Dirección eliminada',
        description: 'La dirección se eliminó correctamente.',
        color: 'success',
      })

      await refreshAddressSelection(customerId, session)
      await invalidateAddressList(customerId)
    },
    onError: (error) => {
      const { message } = mapCustomerDomainError(error)
      toast.add({ title: 'Error al eliminar dirección', description: message, color: 'error' })
    },
  })

  const isPending = computed(
    () =>
      updateMutation.isPending.value ||
      createAddressMutation.isPending.value ||
      updateAddressMutation.isPending.value ||
      removeAddressMutation.isPending.value,
  )

  /** Loads the detail and opens the editor; `false` when it could not be loaded (toast shown). */
  async function openEdit(customerId: string): Promise<boolean> {
    if (!canUpdate.value) return false
    const session = ++editSession
    loadingEdit = true
    isEditOpen.value = false
    selectedCustomer.value = null
    selectedCustomerId.value = null
    try {
      formErrors.value = {}
      const detail = await customerApi.getById(customerId)
      if (session !== editSession) return false
      loadingEdit = false
      selectedCustomer.value = detail
      selectedCustomerId.value = customerId
      isEditOpen.value = true
      return true
    } catch {
      if (session !== editSession) return false
      loadingEdit = false
      toast.add({
        title: 'No se pudo abrir el editor',
        description: 'No pudimos cargar el detalle del cliente.',
        color: 'error',
      })
      return false
    }
  }

  function submitEdit(values: UpdateCustomerPayload) {
    if (!selectedCustomerId.value || !isEditOpen.value) return
    updateMutation.mutate({ customerId: selectedCustomerId.value, values, session: editSession })
  }

  async function createAddress(
    customerId: string,
    payload: CreateCustomerAddressPayload,
    acknowledge?: (saved: boolean) => void,
  ) {
    if (!isCurrentEdit(customerId, editSession)) return
    const session = editSession
    try {
      await createAddressMutation.mutateAsync({ customerId, payload, session })
      acknowledge?.(true)
    } catch {
      acknowledge?.(false)
    }
  }

  async function updateAddress(
    customerId: string,
    addressId: string,
    payload: CreateCustomerAddressPayload,
    acknowledge?: (saved: boolean) => void,
  ) {
    if (!isCurrentEdit(customerId, editSession)) return
    const session = editSession
    try {
      await updateAddressMutation.mutateAsync({ customerId, addressId, payload, session })
      acknowledge?.(true)
    } catch {
      acknowledge?.(false)
    }
  }

  function removeAddress(customerId: string, addressId: string) {
    if (!isCurrentEdit(customerId, editSession)) return
    removeAddressMutation.mutate({ customerId, addressId, session: editSession })
  }

  /** The slideover closed: forget the form unless a load or another editor is still going. */
  function onClosed(otherEditorOpen = false) {
    if (!loadingEdit && !otherEditorOpen && !isEditOpen.value) clearFormContext()
  }

  return {
    isEditOpen,
    selectedCustomer,
    selectedCustomerId,
    formErrors,
    isPending,
    beginSession,
    isSession,
    currentSession,
    clearFormContext,
    isLoadingEdit,
    openEdit,
    submitEdit,
    createAddress,
    updateAddress,
    removeAddress,
    onClosed,
  }
}
