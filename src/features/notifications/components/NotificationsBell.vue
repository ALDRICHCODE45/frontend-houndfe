<script setup lang="ts">
/**
 * NotificationsBell — topbar button with the unread badge (design 02 `bellHTML`). The badge is
 * decorative (`aria-hidden`): the aria-label carries the count. The parent toggles the panel.
 */
import { computed } from 'vue'
import '../styles/notifications.css'
import { bellLabel, countLabel } from '../utils/notification-format'

const props = defineProps<{
  /** `null` while unknown. */
  count: number | null
  open: boolean
  /** The count could not be refreshed: the number may be out of date. */
  stale: boolean
}>()
const emit = defineEmits<{ click: [event: MouseEvent] }>()

const label = computed(() => bellLabel(props.count ?? 0, props.stale))
</script>

<template>
  <span class="notifications-bell">
    <UButton
      :icon="stale ? 'i-lucide-bell-off' : 'i-lucide-bell'"
      color="neutral"
      variant="ghost"
      class="hf-shell-icon-button"
      :ui="{ leadingIcon: 'shrink-0 size-4.5' }"
      :aria-label="label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="emit('click', $event)"
    />
    <span
      v-if="count"
      data-testid="bell-badge"
      class="notifications-bell__badge"
      :class="{ 'is-stale': stale }"
      aria-hidden="true"
    >
      {{ countLabel(count) }}
    </span>
  </span>
</template>
