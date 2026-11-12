import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import { useRequestAccess } from './useRequestAccess'

/**
 * Open requests of the same customer, subtype and conversation a request can be merged into
 * (`GET /chatbot-requests/:id/merge-candidates`). The backend needs `update:ChatbotRequest` besides
 * `read`, so the call is only made with it, and only while the merge picker is wanted (`enabled`).
 */
export function useMergeCandidates(
  id: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const auth = useAuthStore()
  const { tenantId, enabled: canRead } = useRequestAccess()
  const requestId = computed(() => toValue(id)?.trim() ?? '')
  const enabled = computed(
    () =>
      canRead.value &&
      auth.userCan('update', 'ChatbotRequest') &&
      requestId.value.length > 0 &&
      (options.enabled === undefined || toValue(options.enabled)),
  )

  const query = useQuery({
    queryKey: computed(() => chatbotRequestKeys.mergeCandidates(tenantId.value, requestId.value)),
    queryFn: ({ signal }) => chatbotRequestApi.listMergeCandidates(requestId.value, { signal }),
    enabled,
    staleTime: 0,
    retry: false,
  })

  return {
    candidates: computed(() => (enabled.value ? (query.data.value?.items ?? []) : [])),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    refetch: () => query.refetch(),
  }
}
