// useShippingBoxes — the tenant's boxes and their writes (handoff §5). Every
// write invalidates only this tenant's list; nothing is written optimistically.

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { shippingSettingsApi } from '../api/shippingSettings.api'
import type { ShippingBoxBody, ShippingBoxPatch } from '../interfaces/shipping-settings.types'
import { shippingSettingsKeys } from './shippingSettingsKeys'

export function useShippingBoxes(
  tenantId: MaybeRefOrGetter<string>,
  canRead: MaybeRefOrGetter<boolean>,
) {
  const queryClient = useQueryClient()
  const key = computed(() => shippingSettingsKeys.boxes(toValue(tenantId)))
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key.value })

  const query = useQuery({
    queryKey: key,
    queryFn: () => shippingSettingsApi.listBoxes(toValue(tenantId)),
    enabled: computed(() => toValue(tenantId).length > 0 && toValue(canRead)),
  })

  const create = useMutation({
    mutationFn: (body: ShippingBoxBody) => shippingSettingsApi.createBox(toValue(tenantId), body),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ boxId, patch }: { boxId: string; patch: ShippingBoxPatch }) =>
      shippingSettingsApi.updateBox(toValue(tenantId), boxId, patch),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (boxId: string) => shippingSettingsApi.deleteBox(toValue(tenantId), boxId),
    onSuccess: invalidate,
  })

  return { query, create, update, remove }
}
