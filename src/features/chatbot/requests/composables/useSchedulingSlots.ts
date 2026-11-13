import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotSchedulingSlots, ChatbotSchedulingSlotsUpdate } from '../interfaces/chatbot-request.types'
import { requestErrorMessage } from '../utils/requestErrors'
import { useRequestAccess } from './useRequestAccess'

/**
 * The staff slot picker of a reschedule (`GET /chatbot-requests/:id/scheduling/slots`, handoff 21 §2):
 * up to 24 blocks in the branch zone plus `whatsappWindowClosesAt`. Read when the sheet opens
 * (`enabled`), always fresh, never retried (`422 SCHEDULING_DISABLED` is an answer, not a glitch).
 * `replaceSlots` swaps in the fresh list of a `409 SLOT_UNAVAILABLE` without another request.
 */
export function useSchedulingSlots(
  id: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const queryClient = useQueryClient()
  const { tenantId, enabled: canRead } = useRequestAccess()
  const requestId = computed(() => toValue(id)?.trim() ?? '')
  const enabled = computed(
    () =>
      canRead.value &&
      requestId.value.length > 0 &&
      (options.enabled === undefined || toValue(options.enabled)),
  )
  const key = computed(() => chatbotRequestKeys.schedulingSlots(tenantId.value, requestId.value))

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => chatbotRequestApi.getSchedulingSlots(requestId.value, { signal }),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  function replaceSlots(update: ChatbotSchedulingSlotsUpdate): void {
    queryClient.setQueryData<ChatbotSchedulingSlots>(key.value, (previous) => ({
      ...previous,
      slots: update.slots,
      timeZone: update.timeZone || previous?.timeZone || '',
      whatsappWindowClosesAt: update.whatsappWindowClosesAt,
    }))
  }

  return {
    data: computed(() => (enabled.value ? (query.data.value ?? null) : null)),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => enabled.value && query.isError.value),
    errorMessage: computed(() => (enabled.value && query.isError.value ? requestErrorMessage(query.error.value) : null)),
    refetch: () => query.refetch(),
    replaceSlots,
  }
}
