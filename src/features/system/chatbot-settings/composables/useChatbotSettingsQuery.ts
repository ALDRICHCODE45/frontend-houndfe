import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { chatbotSettingsApi } from '../api/chatbotSettings.api'
import { chatbotSettingsKeys } from '../constants/queryKeys'
import { useChatbotSettingsAccess } from './useChatbotSettingsAccess'

/**
 * `GET /chatbot-settings` under the tenant key, only with `read:ChatbotSettings`. A branch that never
 * saved answers the defaults with `version: 0`, so there is no synthetic fallback. No focus refetch and
 * no retry: the draft owns the screen while someone edits.
 */
export function useChatbotSettingsQuery() {
  const { tenantId, enabled } = useChatbotSettingsAccess()

  const query = useQuery({
    queryKey: computed(() => chatbotSettingsKeys.detail(tenantId.value)),
    queryFn: ({ signal }) => chatbotSettingsApi.get({ signal }),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return {
    settings: computed(() => (enabled.value ? query.data.value : undefined)),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    refetch: async () => {
      const result = await query.refetch()
      return result.data
    },
  }
}
