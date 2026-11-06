// useOpeningHours — GET/PUT of the weekly hours (handoff §7). The PUT answers
// the saved week (Monday first, ranges sorted), which becomes the cached read.

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { shippingSettingsApi } from '../api/shippingSettings.api'
import type { OpeningHoursBody } from '../interfaces/shipping-settings.types'
import { shippingSettingsKeys } from './shippingSettingsKeys'

export function useOpeningHours(
  tenantId: MaybeRefOrGetter<string>,
  canRead: MaybeRefOrGetter<boolean>,
) {
  const queryClient = useQueryClient()
  const key = computed(() => shippingSettingsKeys.openingHours(toValue(tenantId)))

  const query = useQuery({
    queryKey: key,
    queryFn: () => shippingSettingsApi.getOpeningHours(toValue(tenantId)),
    enabled: computed(() => toValue(tenantId).length > 0 && toValue(canRead)),
  })

  const save = useMutation({
    mutationFn: (body: OpeningHoursBody) => shippingSettingsApi.putOpeningHours(toValue(tenantId), body),
    onSuccess: (saved) => queryClient.setQueryData(key.value, saved),
  })

  return { query, save }
}
