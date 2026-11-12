import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import { useRequestAccess } from './useRequestAccess'

/**
 * What approving or rejecting a zone request would settle (`GET /chatbot-requests/:id/zone-impact`):
 * «Esto resolverá N solicitudes de M clientes», plus the `setVersion` to send as
 * `expectedZoneSetVersion`. Read when the zone form opens (`enabled`), always fresh.
 */
export function useZoneImpact(
  id: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const { tenantId, enabled: canRead } = useRequestAccess()
  const requestId = computed(() => toValue(id)?.trim() ?? '')
  const enabled = computed(
    () =>
      canRead.value &&
      requestId.value.length > 0 &&
      (options.enabled === undefined || toValue(options.enabled)),
  )

  const query = useQuery({
    queryKey: computed(() => chatbotRequestKeys.zoneImpact(tenantId.value, requestId.value)),
    queryFn: ({ signal }) => chatbotRequestApi.getZoneImpact(requestId.value, { signal }),
    enabled,
    staleTime: 0,
    retry: false,
  })

  return {
    impact: computed(() => (enabled.value ? (query.data.value ?? null) : null)),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    refetch: () => query.refetch(),
  }
}
