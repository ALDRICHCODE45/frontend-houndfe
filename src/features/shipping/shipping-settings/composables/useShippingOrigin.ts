// useShippingOrigin — GET/PUT of the pickup address (handoff §6). The PUT
// answers the saved record, which becomes the cached read.

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { shippingSettingsApi } from '../api/shippingSettings.api'
import type { ShippingOriginBody } from '../interfaces/shipping-settings.types'
import { shippingSettingsKeys } from './shippingSettingsKeys'

export function useShippingOrigin(
  tenantId: MaybeRefOrGetter<string>,
  canRead: MaybeRefOrGetter<boolean>,
) {
  const queryClient = useQueryClient()
  const key = computed(() => shippingSettingsKeys.origin(toValue(tenantId)))

  const query = useQuery({
    queryKey: key,
    queryFn: () => shippingSettingsApi.getOrigin(toValue(tenantId)),
    enabled: computed(() => toValue(tenantId).length > 0 && toValue(canRead)),
  })

  const save = useMutation({
    mutationFn: (body: ShippingOriginBody) => shippingSettingsApi.putOrigin(toValue(tenantId), body),
    onSuccess: (saved) => queryClient.setQueryData(key.value, saved),
  })

  return { query, save }
}
