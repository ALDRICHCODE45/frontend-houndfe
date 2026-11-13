import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import { pollingInterval } from './polling'
import { useRealtimeOpen } from '@/core/realtime/polling'
import { useRequestAccess } from './useRequestAccess'

/** Tab and filter counters (and the nav badge), refetched every 30 s while the tab is visible. */
export function useRequestCounts() {
  const streamOpen = useRealtimeOpen()
  const { tenantId, enabled } = useRequestAccess()

  const query = useQuery({
    queryKey: computed(() => chatbotRequestKeys.counts(tenantId.value)),
    queryFn: ({ signal }) => chatbotRequestApi.getCounts({ signal }),
    enabled,
    staleTime: 15_000,
    retry: false,
    // Re-evaluated when the stream opens or closes (the closure holds the state it was built with).
    refetchInterval: computed(() => {
      const open = streamOpen.value
      return (query: Parameters<typeof pollingInterval>[0]) => pollingInterval(query, open)
    }),
  })

  return {
    counts: computed(() => (enabled.value ? (query.data.value ?? null) : null)),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: query.isFetching,
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    refetch: () => query.refetch(),
  }
}
