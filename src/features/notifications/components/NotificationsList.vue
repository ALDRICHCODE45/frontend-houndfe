<script setup lang="ts">
/**
 * NotificationsList — the body of the panel: groups «Hoy» / «Antes», «Ver anteriores» by cursor
 * and every state of the list (loading, empty, «Todo leído», error). Presentational: the panel
 * owns the queries.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import type { NotificationItem } from '../interfaces/notifications.types'
import { groupByDay } from '../utils/notification-format'
import NotificationRow from './NotificationRow.vue'

const props = defineProps<{
  items: NotificationItem[]
  tab: 'all' | 'unread'
  isLoading: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  now: Date
}>()
const emit = defineEmits<{
  open: [item: NotificationItem]
  mark: [item: NotificationItem]
  retry: []
  more: []
  'show-all': []
}>()

const groups = computed(() => groupByDay(props.items, props.now))
const showError = computed(() => props.isError && props.items.length === 0)
</script>

<template>
  <div class="nt-list">
    <div v-if="isLoading" aria-busy="true" aria-label="Cargando notificaciones">
      <div v-for="n in 5" :key="n" class="nt-skel" aria-hidden="true">
        <span class="nt-skel__tile" />
        <span class="nt-skel__lines"><span style="width: 60%" /><span style="width: 85%" /></span>
      </div>
    </div>

    <EmptyState
      v-else-if="showError"
      kind="error"
      title="No se pudieron cargar las notificaciones"
      description="Tus avisos siguen ahí. Revisa tu conexión e inténtalo de nuevo."
      action-label="Reintentar"
      @action="emit('retry')"
    />

    <template v-else-if="items.length === 0">
      <EmptyState
        v-if="tab === 'unread'"
        icon="i-lucide-circle-check"
        title="Todo leído"
        description="No tienes avisos sin leer."
        action-label="Ver todas"
        action-test-id="show-all"
        @action="emit('show-all')"
      />
      <EmptyState
        v-else
        icon="i-lucide-bell"
        title="No tienes avisos"
        description="Aquí verás las solicitudes nuevas, las que te reasignen y los avisos de tiempo."
      />
    </template>

    <template v-else>
      <section v-for="group in groups" :key="group.key" :aria-label="group.label">
        <h3 class="nt-group">{{ group.label }}</h3>
        <ul>
          <NotificationRow
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :now="now"
            @open="emit('open', $event)"
            @mark="emit('mark', $event)"
          />
        </ul>
      </section>

      <div v-if="hasNextPage" class="nt-more">
        <UButton
          data-testid="load-more"
          label="Ver anteriores"
          color="neutral"
          variant="outline"
          block
          :loading="isFetchingNextPage"
          :disabled="isFetchingNextPage"
          @click="emit('more')"
        />
      </div>
      <p v-else-if="tab === 'all'" class="nt-end">Llegaste al final de tus notificaciones.</p>
    </template>
  </div>
</template>
