import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { notificationsApi } from '../api/notifications.api'
import { notificationKeys } from '../constants/queryKeys'
import { adjustCount, restoreSnapshot, stampRead, takeSnapshot } from '../utils/notification-cache'
import { useNotificationsAccess } from './useNotificationsAccess'

/**
 * Marks every unread notice of this branch as read (`POST /notifications/read-all`). Optimistic:
 * the badge goes to zero and the loaded rows turn read; a refusal puts them back so the user can retry.
 */
export function useMarkAllRead() {
  const client = useQueryClient()
  const { tenantId } = useNotificationsAccess()

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      const tenant = tenantId.value
      await client.cancelQueries({ queryKey: notificationKeys.all(tenant) })
      const snapshot = takeSnapshot(client, tenant)
      adjustCount(client, tenant, () => 0)
      stampRead(client, tenant, 'all')
      return { tenant, snapshot }
    },
    onError: (_error, _vars, context) => {
      if (context) restoreSnapshot(client, context.tenant, context.snapshot)
    },
    onSettled: (_data, _error, _vars, context) => {
      void client.invalidateQueries({ queryKey: notificationKeys.all(context?.tenant ?? tenantId.value) })
    },
  })
}
