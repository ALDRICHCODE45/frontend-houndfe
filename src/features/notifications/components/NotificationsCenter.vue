<script setup lang="ts">
/**
 * NotificationsCenter — bell, panel and the alerts for a hidden tab, for a session that has a
 * tenant. One unread poller feeds the badge, the panel and the alerts.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationAlerts } from '../composables/useNotificationAlerts'
import { useNotificationsAccess } from '../composables/useNotificationsAccess'
import { useUnreadCount } from '../composables/useUnreadCount'
import { notificationDetailPath } from '../utils/notification-format'
import NotificationsBell from './NotificationsBell.vue'
import NotificationsPanel from './NotificationsPanel.vue'

const router = useRouter()
const open = ref(false)

const { count, isError } = useUnreadCount()
const { tenantId } = useNotificationsAccess()

useNotificationAlerts({
  count,
  tenantId,
  onOpenRequest: (requestId) => {
    const path = notificationDetailPath(requestId)
    if (path) void router.push(path)
  },
})
</script>

<template>
  <div class="contents">
    <NotificationsBell :count="count" :open="open" :stale="isError" @click="open = !open" />
    <NotificationsPanel v-model:open="open" :unread-count="count ?? 0" :count-error="isError" />
  </div>
</template>
