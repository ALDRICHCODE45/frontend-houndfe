<script setup lang="ts">
/**
 * NotificationRow — one notice of the panel (design 02-panel-lateral `itemHTML`).
 *
 * The whole row leads to the request (`/chatbot/solicitudes/:requestId`); without a request it is a
 * button. A plain click emits `open` (the panel marks it read, navigates and closes); a modified
 * click (new tab) lets the browser follow the link and emits `mark` so it still counts as read.
 * `title` and `body` come from the server as plain text and are rendered as text, never HTML.
 */
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { NotificationItem } from '../interfaces/notifications.types'
import {
  fullTime,
  notificationDetailPath,
  notificationMeta,
  relativeTime,
} from '../utils/notification-format'

const props = defineProps<{ item: NotificationItem; now: Date }>()
const emit = defineEmits<{ open: [item: NotificationItem]; mark: [item: NotificationItem] }>()

const meta = computed(() => notificationMeta(props.item.type))
const path = computed(() => notificationDetailPath(props.item.requestId))
const unread = computed(() => props.item.readAt === null)
const when = computed(() => relativeTime(props.item.createdAt, props.now))

function onClick(event: MouseEvent) {
  const modified = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
  if (path.value && modified) {
    emit('mark', props.item)
    return
  }
  if (path.value) event.preventDefault()
  emit('open', props.item)
}
</script>

<template>
  <li class="nt" :class="{ 'is-unread': unread }">
    <component
      :is="path ? 'a' : 'button'"
      class="nt-link"
      :href="path ?? undefined"
      :type="path ? undefined : 'button'"
      @click="onClick"
    >
      <span class="nt-tile" :data-tone="meta.tone" aria-hidden="true">
        <UIcon :name="meta.icon" class="size-5" />
      </span>
      <span class="nt-text">
        <span class="nt-title">
          <span v-if="unread" class="sr-only">Sin leer. </span>{{ item.title }}
        </span>
        <span class="nt-body">{{ item.body }}</span>
        <span class="nt-chips">
          <StatusBadge
            data-testid="notification-type"
            :label="meta.label"
            :tone="meta.tone"
            aria-prefix="Tipo:"
          />
        </span>
      </span>
      <span class="nt-meta">
        <time :datetime="item.createdAt" :title="fullTime(item.createdAt)">{{ when }}</time>
        <span v-if="unread" data-testid="unread-dot" class="nt-dot" aria-hidden="true" />
      </span>
    </component>
  </li>
</template>
