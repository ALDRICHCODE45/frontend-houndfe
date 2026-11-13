import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import { readRequestError } from '../utils/requestErrors'
import { detailPollingInterval } from './polling'
import { useRequestAccess } from './useRequestAccess'

/**
 * One request (the email deep link), refetched every 30 s while the tab is visible (every 4 s while its
 * live session is STARTING or ENDING). No `keepPreviousData`: another id must never show the previous request's actions. A `404` is a gone
 * request (or another branch's): not retried and polling stops.
 */
export function useRequestDetail(id: MaybeRefOrGetter<string | null | undefined>) {
  const { tenantId, enabled: canRead } = useRequestAccess()
  const requestId = computed(() => toValue(id)?.trim() ?? '')
  const enabled = computed(() => canRead.value && requestId.value.length > 0)

  const query = useQuery({
    queryKey: computed(() => chatbotRequestKeys.detail(tenantId.value, requestId.value)),
    queryFn: ({ signal }) => chatbotRequestApi.getDetail(requestId.value, { signal }),
    enabled,
    staleTime: 15_000,
    retry: false,
    refetchInterval: detailPollingInterval,
  })

  return {
    detail: computed(() => (enabled.value ? (query.data.value ?? null) : null)),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: query.isFetching,
    isError: computed(() => enabled.value && query.isError.value),
    isNotFound: computed(() => enabled.value && readRequestError(query.error.value).status === 404),
    error: query.error,
    refetch: () => query.refetch(),
  }
}
