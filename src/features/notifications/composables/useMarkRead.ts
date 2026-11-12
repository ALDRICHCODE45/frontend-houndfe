import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { notificationsApi } from '../api/notifications.api'
import { notificationKeys } from '../constants/queryKeys'
import {
  adjustCount,
  isLoadedUnread,
  restoreSnapshot,
  stampRead,
  takeSnapshot,
} from '../utils/notification-cache'
import { useNotificationsAccess } from './useNotificationsAccess'

/**
 * Marks one notice as read. Optimistic: the badge goes down and the row turns read before the
 * server answers; a refusal puts both back. The settled mutation invalidates the branch's notices.
 */
export function useMarkRead() {
  const client = useQueryClient()
  const { tenantId } = useNotificationsAccess()

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      const tenant = tenantId.value
      await client.cancelQueries({ queryKey: notificationKeys.all(tenant) })
      const snapshot = takeSnapshot(client, tenant)
      if (isLoadedUnread(client, tenant, id)) adjustCount(client, tenant, (count) => count - 1)
      stampRead(client, tenant, [id])
      return { tenant, snapshot }
    },
    onError: (_error, _id, context) => {
      if (context) restoreSnapshot(client, context.tenant, context.snapshot)
    },
    onSettled: (_data, _error, _id, context) => {
      void client.invalidateQueries({ queryKey: notificationKeys.all(context?.tenant ?? tenantId.value) })
    },
  })
}
