<script setup lang="ts">
/**
 * NotificationsPanel — direction B of the notifications design: a modal side panel (440 px; full
 * width on mobile) over a scrim, with «Todas» / «Sin leer», the list, «Marcar todas como leídas»
 * and the link to /perfil. Esc, the scrim and ✕ close it; the dialog traps focus.
 *
 * It owns the list query and the two mark-read mutations. The unread count comes from the host
 * (one poller for the bell and the panel).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNow } from '@vueuse/core'
import '../styles/notifications.css'
import type { NotificationItem } from '../interfaces/notifications.types'
import { useMarkAllRead } from '../composables/useMarkAllRead'
import { useMarkRead } from '../composables/useMarkRead'
import { useNotifications } from '../composables/useNotifications'
import { countLabel, notificationDetailPath } from '../utils/notification-format'
import NotificationsList from './NotificationsList.vue'

const props = defineProps<{
  open: boolean
  /** Unread notices of the branch (the bell's number). */
  unreadCount: number
  /** The count could not be refreshed. */
  countError: boolean
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const router = useRouter()
const now = useNow({ interval: 60_000 })

const tab = ref<'all' | 'unread'>('all')
const list = useNotifications({ unread: () => tab.value === 'unread', active: () => props.open })
const markRead = useMarkRead()
const markAll = useMarkAllRead()

// Each opening starts clean: «Todas» and no leftover error.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    tab.value = 'all'
    markAll.reset()
  },
)

const markAllDisabled = computed(
  () => props.unreadCount <= 0 || list.isError.value || markAll.isPending.value,
)

function close() {
  emit('update:open', false)
}

function markIfUnread(item: NotificationItem) {
  if (item.readAt === null) markRead.mutate(item.id)
}

function openItem(item: NotificationItem) {
  markIfUnread(item)
  const path = notificationDetailPath(item.requestId)
  if (path) void router.push(path)
  close()
}
</script>

<template>
  <USlideover
    :open="open"
    title="Notificaciones"
    description="Tus avisos sobre solicitudes del chatbot"
    side="right"
    :close="{ 'aria-label': 'Cerrar notificaciones' }"
    :ui="{
      content:
        'w-full max-w-full sm:max-w-[440px] notifications-panel hf-theme hf-ui motion-reduce:transition-none',
      header: 'notifications-panel__header',
      description: 'sr-only',
      body: 'notifications-panel__body',
      footer: 'notifications-panel__footer',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #actions>
      <span v-if="unreadCount > 0" class="nt-count">{{ countLabel(unreadCount) }} sin leer</span>
      <UButton
        to="/perfil"
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="ghost"
        aria-label="Preferencias de notificaciones"
        @click="close"
      />
    </template>

    <template #body>
      <div class="nt-tabs" role="group" aria-label="Mostrar">
        <button type="button" :aria-pressed="tab === 'all'" @click="tab = 'all'">Todas</button>
        <button type="button" :aria-pressed="tab === 'unread'" @click="tab = 'unread'">
          Sin leer<span v-if="unreadCount > 0" class="nt-tabs__count"> {{ countLabel(unreadCount) }}</span>
        </button>
      </div>

      <div class="nt-scroll">
        <div v-if="countError" class="nt-alert is-warning" role="status">
          <UIcon name="i-lucide-bell-off" class="nt-alert__icon" aria-hidden="true" />
          <div>
            <strong>El conteo puede estar desfasado</strong>
            No se pudo actualizar el número de la campana; se reintenta solo.
          </div>
        </div>

        <div v-if="markAll.isError.value" class="nt-alert is-danger" role="alert">
          <UIcon name="i-lucide-triangle-alert" class="nt-alert__icon" aria-hidden="true" />
          <div>
            <strong>No se pudieron marcar como leídas</strong>
            Tus avisos siguen sin leer; no se perdió nada. Puedes reintentarlo.
            <div class="nt-alert__actions">
              <UButton
                label="Reintentar"
                size="sm"
                color="neutral"
                variant="outline"
                :loading="markAll.isPending.value"
                @click="markAll.mutate()"
              />
            </div>
          </div>
        </div>

        <NotificationsList
          :items="list.items.value"
          :tab="tab"
          :is-loading="list.isLoading.value"
          :is-error="list.isError.value"
          :has-next-page="list.hasNextPage.value"
          :is-fetching-next-page="list.isFetchingNextPage.value"
          :now="now"
          @open="openItem"
          @mark="markIfUnread"
          @retry="list.reload()"
          @more="list.fetchNextPage()"
          @show-all="tab = 'all'"
        />
      </div>
    </template>

    <template #footer>
      <UButton
        label="Marcar todas como leídas"
        icon="i-lucide-check-check"
        color="neutral"
        variant="outline"
        :disabled="markAllDisabled"
        :aria-describedby="unreadCount <= 0 ? 'nt-why' : undefined"
        @click="markAll.mutate()"
      />
      <UButton to="/perfil" label="Preferencias" color="neutral" variant="ghost" @click="close" />
      <span v-if="unreadCount <= 0" id="nt-why" class="nt-why">No hay avisos sin leer.</span>
    </template>
  </USlideover>
</template>
