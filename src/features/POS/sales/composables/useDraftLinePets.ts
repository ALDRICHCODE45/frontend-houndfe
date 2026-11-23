import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { petQueryKeys, usePetsList } from '@/features/POS/customers/pets/usePets'
import { saleApi } from '../api/sale.api'
import type { Sale } from '../interfaces/sale.types'
import { readSaleLinePetError } from '../utils/saleLinePet.utils'
import { reconcileDraftMutationInCache } from './useSalesDrafts'

declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'error' }) => void
}

/**
 * Line pet picker of a POS draft (handoff 27 §5.2): the ACTIVE pets of the sale customer and the
 * `PUT …/items/:itemId/pet` write. A success replaces the draft from the response; a failure leaves
 * the draft as it was, shows the Spanish copy and reloads the pets when they changed underneath.
 */
export function useDraftLinePets(
  saleId: MaybeRefOrGetter<string | null | undefined>,
  customerId: MaybeRefOrGetter<string | null | undefined>,
) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const toast = useToast()
  const petsQuery = usePetsList(customerId, 'ACTIVE')

  const mutation = useMutation({
    mutationFn: ({ itemId, petId }: { itemId: string; petId: string | null }) =>
      saleApi.setItemPet(toValue(saleId)!, itemId, { petId }),
    onSuccess: (updatedSale) => {
      const key = saleQueryKeys.drafts(tenantId.value)
      const drafts = queryClient.getQueryData<Sale[]>(key) ?? []
      queryClient.setQueryData(key, reconcileDraftMutationInCache(drafts, updatedSale))
    },
  })

  async function setLinePet(itemId: string, petId: string | null): Promise<boolean> {
    if (!toValue(saleId)) return false
    try {
      await mutation.mutateAsync({ itemId, petId })
      return true
    } catch (err) {
      const error = readSaleLinePetError(err)
      toast.add({ title: 'Error', description: error.message, color: 'error' })
      const customer = toValue(customerId)
      if (error.reloadPets && customer) {
        void queryClient.invalidateQueries({ queryKey: petQueryKeys.all(tenantId.value, customer) })
      }
      return false
    }
  }

  return {
    pets: computed(() => petsQuery.data.value ?? []),
    setLinePet,
    isPending: computed(() => mutation.isPending.value),
  }
}
