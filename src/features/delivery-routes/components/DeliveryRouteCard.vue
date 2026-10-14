<script setup lang="ts">
/**
 * DeliveryRouteCard — manager card for one route (cards view of the list).
 *
 * Same values, status meaning and gated actions as the table row: the parent
 * passes the already-gated menu sections and owns navigation and mutations.
 */
import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
} from '../interfaces/delivery-route.types'
import type { DeliveryRouteRowActionItem } from '../utils/delivery-route-actions.utils'
import {
  buildRouteDisplayName,
  formatRouteDateTime,
  getRouteCreatedAt,
  getRouteCustomers,
  getRouteProgress,
  shortRouteId,
} from '../utils/delivery-route-list.utils'

const props = defineProps<{
  route: DeliveryRouteResponseDto
  actions: DeliveryRouteRowActionItem[][]
  portalClass?: string
}>()

const emit = defineEmits<{
  open: [routeId: string]
}>()

const name = computed(() => buildRouteDisplayName(props.route))
const customers = computed(() => getRouteCustomers(props.route))
const progress = computed(() => getRouteProgress(props.route))
const createdAt = computed(() => formatRouteDateTime(getRouteCreatedAt(props.route)))
const startedAt = computed(() => formatRouteDateTime(props.route.startedAt))
/** The end of a route is its completion or its cancellation (same as the table). */
const endedAt = computed(() =>
  formatRouteDateTime(props.route.completedAt ?? props.route.cancelledAt),
)
</script>

<template>
  <article
    class="delivery-routes-card flex min-w-0 flex-col gap-3 p-4"
    data-testid="delivery-route-card"
  >
    <div class="flex items-start justify-between gap-2">
      <button
        type="button"
        class="delivery-routes-name-link min-w-0 text-left"
        data-testid="delivery-route-card-open"
        @click="emit('open', route.id)"
      >
        <span class="block text-sm font-semibold">{{ name }}</span>
        <span class="delivery-routes-id block font-mono text-xs">{{ shortRouteId(route.id) }}</span>
      </button>
      <UDropdownMenu
        :items="actions"
        :content="{ align: 'end' }"
        :ui="portalClass ? { content: portalClass } : undefined"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          class="size-9 shrink-0"
          aria-label="Acciones de la ruta"
        />
      </UDropdownMenu>
    </div>

    <StatusDotBadge
      :tone="DELIVERY_ROUTE_STATUS_TONES[route.status]"
      :label="DELIVERY_ROUTE_STATUS_LABELS[route.status]"
      compact
    />

    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between text-xs">
        <span class="delivery-routes-muted">Progreso</span>
        <span class="tabular-nums">
          {{ progress.total === 0 ? 'Sin paradas' : `${progress.completed}/${progress.total}` }}
        </span>
      </div>
      <div
        class="delivery-routes-progress"
        role="progressbar"
        :aria-valuenow="progress.percent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Progreso de entregas: ${progress.percent}%`"
      >
        <span :style="{ width: `${progress.percent}%` }" />
      </div>
    </div>

    <dl class="grid grid-cols-1 gap-2 text-xs">
      <div class="min-w-0">
        <dt class="delivery-routes-muted">Clientes</dt>
        <dd class="break-words">{{ customers.length ? customers.join(', ') : '—' }}</dd>
      </div>
      <div class="min-w-0">
        <dt class="delivery-routes-muted">Creada</dt>
        <dd>{{ createdAt }}</dd>
      </div>
      <div class="grid min-w-0 grid-cols-2 gap-2">
        <div class="min-w-0">
          <dt class="delivery-routes-muted">Inicio</dt>
          <dd>{{ startedAt }}</dd>
        </div>
        <div class="min-w-0">
          <dt class="delivery-routes-muted">Fin</dt>
          <dd>{{ endedAt }}</dd>
        </div>
      </div>
      <div v-if="route.notes" class="min-w-0">
        <dt class="delivery-routes-muted">Notas</dt>
        <dd class="break-words">{{ route.notes }}</dd>
      </div>
    </dl>
  </article>
</template>
