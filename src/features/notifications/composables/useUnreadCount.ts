import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { notificationsApi } from '../api/notifications.api'
import { notificationKeys } from '../constants/queryKeys'
import { useNotificationsAccess } from './useNotificationsAccess'

/**
 * Unread badge of the bell. The backend has no push yet (SSE, handoff 17, is not consumed): the
 * count is read every 30 s while the tab is visible (`refetchIntervalInBackground` stays off).
 */
export const UNREAD_COUNT_REFETCH_MS = 30_000

export function useUnreadCount() {
  const { tenantId, enabled } = useNotificationsAccess()

  const query = useQuery({
    queryKey: computed(() => notificationKeys.unreadCount(tenantId.value)),
    queryFn: ({ signal }) => notificationsApi.unreadCount({ signal }),
    enabled,
    staleTime: 15_000,
    retry: false,
    refetchInterval: UNREAD_COUNT_REFETCH_MS,
  })

  return {
    /** `null` while unknown (loading, disabled, or failed before any value). */
    count: computed<number | null>(() => (enabled.value ? (query.data.value?.count ?? null) : null)),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    /** The last read failed: the number may be out of date. */
    isError: computed(() => enabled.value && query.isError.value),
    refetch: () => query.refetch(),
  }
}
