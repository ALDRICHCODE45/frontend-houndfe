import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import { useRequestAccess } from './useRequestAccess'

/**
 * People a request can be reassigned to (`GET /chatbot-requests/assignable-users`, the exact set
 * the reassign route accepts). The backend answers `403` without `update:ChatbotRequestAssignment`,
 * so the call is only made with it, and only while the picker is wanted (`enabled`).
 */
export function useAssignableUsers(options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const auth = useAuthStore()
  const { tenantId, enabled: canRead } = useRequestAccess()
  const enabled = computed(
    () =>
      canRead.value &&
      auth.userCan('update', 'ChatbotRequestAssignment') &&
      (options.enabled === undefined || toValue(options.enabled)),
  )

  const query = useQuery({
    queryKey: computed(() => chatbotRequestKeys.assignableUsers(tenantId.value)),
    queryFn: ({ signal }) => chatbotRequestApi.listAssignableUsers({ signal }),
    enabled,
    staleTime: 60_000,
    retry: false,
  })

  return {
    users: computed(() => (enabled.value ? (query.data.value?.items ?? []) : [])),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    refetch: () => query.refetch(),
  }
}
