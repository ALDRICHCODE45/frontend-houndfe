import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { deliveryZonesApi } from '../api/deliveryZones.api'
import { deliveryZoneKeys } from '../constants/queryKeys'
import type { DeliveryZoneUpsertBody } from '../interfaces/delivery-zone.types'

/** Create/replace and deactivate a zone; both refresh the zones list of the branch. */
export function useZoneCommands() {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: deliveryZoneKeys.all(tenantId.value) })

  const upsert = useMutation({
    mutationFn: ({ zipCode, body }: { zipCode: string; body: DeliveryZoneUpsertBody }) =>
      deliveryZonesApi.upsert(zipCode, body),
    onSuccess: invalidate,
  })
  const deactivate = useMutation({
    mutationFn: (zipCode: string) => deliveryZonesApi.deactivate(zipCode),
    onSuccess: invalidate,
  })

  return { upsert, deactivate, invalidate }
}
