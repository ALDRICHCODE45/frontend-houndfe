import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { chatbotRequestApi } from '../api/chatbot-request.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotRequestAuditItem } from '../interfaces/chatbot-request.types'
import { AUDIT_PAGE_SIZE } from './polling'
import { useRequestAccess } from './useRequestAccess'

export interface UseRequestAuditOptions {
  /** The detail already carries the 20 latest events: turn this on for «Ver más». */
  enabled?: MaybeRefOrGetter<boolean>
}

/** Audit events of one request, newest first, cursor-paginated (`auditNextCursor` of the detail). */
export function useRequestAudit(
  id: MaybeRefOrGetter<string | null | undefined>,
  options: UseRequestAuditOptions = {},
) {
  const { tenantId, enabled: canRead } = useRequestAccess()
  const requestId = computed(() => toValue(id)?.trim() ?? '')
  const enabled = computed(
    () => canRead.value && requestId.value.length > 0 && (options.enabled ? toValue(options.enabled) : true),
  )
  const params = { limit: AUDIT_PAGE_SIZE }

  const query = useInfiniteQuery({
    queryKey: computed(() => chatbotRequestKeys.audit(tenantId.value, requestId.value, params)),
    queryFn: ({ pageParam, signal }) =>
      chatbotRequestApi.listAudit(requestId.value, { ...params, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    staleTime: 15_000,
    retry: false,
  })

  const events = computed<ChatbotRequestAuditItem[]>(() => {
    if (!enabled.value) return []
    const seen = new Set<string>()
    const merged: ChatbotRequestAuditItem[] = []
    for (const page of query.data.value?.pages ?? []) {
      for (const event of page.items) {
        if (seen.has(event.id)) continue
        seen.add(event.id)
        merged.push(event)
      }
    }
    return merged
  })

  return {
    events,
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetchingNextPage: query.isFetchingNextPage,
    isError: computed(() => enabled.value && query.isError.value),
    error: query.error,
    hasNextPage: computed(() => enabled.value && query.hasNextPage.value),
    fetchNextPage: () => query.fetchNextPage(),
    refetch: () => query.refetch(),
  }
}
