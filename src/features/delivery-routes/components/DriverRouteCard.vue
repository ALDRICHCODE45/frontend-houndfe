<script setup lang="ts">
/**
 * DriverRouteCard — mission card for ONE own ACTIVE route (driver branch of
 * `DeliveryRoutesListView`, sdd delivery-routes S6b; rich mission redesign).
 *
 * Surface (view model from `buildDriverRouteMission`):
 *   - Title "Ruta del 14 oct" + short id reference; the driver's own name is
 *     not repeated (the list is server-scoped to the driver).
 *   - Status badge from the shared `DELIVERY_ROUTE_STATUS_*` maps, start time
 *     and time on route (refreshed every minute).
 *   - Progress bar "3 de 8 entregadas" (+ skipped count).
 *   - Target stop (the cockpit's current stop): position, customer, folio and
 *     address; "Todas las paradas atendidas" once nothing is left.
 *   - Route notes and a "Continuar ruta" / "Ver ruta" call to action.
 *
 * Interaction: the ENTIRE card is one native <button> tap target (REQ-DRC-007,
 * ≥44px); click or Enter / Space emit `select` with the route id and the
 * parent owns navigation. The CTA is a visual affordance inside that target,
 * not a nested button.
 */

import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { buildDriverRouteMission } from '../utils/delivery-route-driver.utils'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
} from '../interfaces/delivery-route.types'

const props = defineProps<{
  /** The route this card represents. The list view renders one card per route. */
  route: DeliveryRouteResponseDto
}>()

const emit = defineEmits<{
  /** Fired on tap / keyboard activation. Carries the route id; the parent owns navigation. */
  select: [routeId: string]
}>()

const now = useNow({ interval: 60_000 })

const statusLabel = computed(() => DELIVERY_ROUTE_STATUS_LABELS[props.route.status])
const statusTone = computed(() => DELIVERY_ROUTE_STATUS_TONES[props.route.status])
const mission = computed(() => buildDriverRouteMission(props.route, now.value))
const progressAriaLabel = computed(
  () => `${mission.value.progress.completed} de ${mission.value.progress.total} paradas entregadas`,
)

function onTap() {
  emit('select', props.route.id)
}

/**
 * Keyboard activation — Enter / Space both fire `select` on keydown so the
 * test surface is predictable and screen-reader activation works regardless
 * of focus timing.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    emit('select', props.route.id)
  }
}
</script>

<template>
  <!-- `min-h-11` keeps the ≥44px touch target (REQ-DRC-008 / design §11). -->
  <button
    type="button"
    data-testid="driver-route-card"
    class="delivery-routes-mission group flex min-h-11 w-full flex-col gap-4 rounded-xl border border-default bg-default p-4 text-left shadow-sm transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
    @click="onTap"
    @keydown="onKeydown"
  >
    <header class="flex w-full min-w-0 items-start justify-between gap-3">
      <div class="flex min-w-0 flex-col gap-1">
        <span
          class="truncate text-base font-semibold text-highlighted"
          data-testid="driver-route-card-title"
        >{{ mission.title }}</span>
        <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span class="font-mono">#{{ mission.reference }}</span>
          <template v-if="mission.startedAtLabel">
            <span aria-hidden="true">·</span>
            <span>{{ mission.startedAtLabel }}</span>
          </template>
        </span>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1">
        <StatusDotBadge :tone="statusTone" :label="statusLabel" />
        <span
          v-if="mission.elapsedLabel"
          class="flex items-center gap-1 text-xs text-muted"
          data-testid="driver-route-card-elapsed"
        >
          <UIcon name="i-lucide-timer" class="size-3.5" aria-hidden="true" />
          {{ mission.elapsedLabel }}
        </span>
      </div>
    </header>

    <section class="flex w-full flex-col gap-2">
      <div
        v-if="mission.progress.total > 0"
        role="progressbar"
        data-testid="driver-route-card-progress"
        :aria-valuenow="mission.progress.completed"
        aria-valuemin="0"
        :aria-valuemax="mission.progress.total"
        :aria-label="progressAriaLabel"
        class="h-2 w-full overflow-hidden rounded-full bg-elevated"
      >
        <div
          data-testid="driver-route-card-progress-fill"
          class="delivery-routes-progress-fill h-full rounded-full transition-[width] motion-reduce:transition-none"
          :style="{ width: `${mission.progress.percent}%` }"
        />
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span class="font-medium text-default">{{ mission.progressLabel }}</span>
        <span v-if="mission.skippedLabel" class="text-xs text-muted">{{ mission.skippedLabel }}</span>
      </div>
    </section>

    <section
      v-if="mission.target"
      class="delivery-routes-mission-target flex w-full min-w-0 flex-col gap-1.5 rounded-lg p-3"
      data-testid="driver-route-card-target"
    >
      <span class="text-xs font-medium uppercase tracking-wide text-muted">{{ mission.target.heading }}</span>
      <div class="flex min-w-0 items-center gap-2">
        <span class="delivery-routes-mission-position flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold">
          #{{ mission.target.position }}
        </span>
        <span class="min-w-0 truncate font-medium text-default">{{ mission.target.customer }}</span>
        <span v-if="mission.target.folio" class="shrink-0 font-mono text-xs text-muted">{{ mission.target.folio }}</span>
      </div>
      <span v-if="mission.target.address" class="flex min-w-0 items-start gap-1.5 text-sm text-muted">
        <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span class="line-clamp-2">{{ mission.target.address }}</span>
      </span>
    </section>

    <p
      v-else-if="mission.doneLabel"
      class="flex items-center gap-2 text-sm text-muted"
      data-testid="driver-route-card-done"
    >
      <UIcon name="i-lucide-circle-check" class="size-4 shrink-0" aria-hidden="true" />
      {{ mission.doneLabel }}
    </p>

    <p
      v-if="mission.notes"
      class="flex min-w-0 items-start gap-1.5 text-sm text-muted"
      data-testid="driver-route-card-notes"
    >
      <UIcon name="i-lucide-notebook-pen" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span class="line-clamp-2">{{ mission.notes }}</span>
    </p>

    <footer class="mt-auto flex w-full justify-end">
      <span
        class="hf-primary-control inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        data-testid="driver-route-card-cta"
      >
        {{ mission.ctaLabel }}
        <UIcon name="i-lucide-arrow-right" class="size-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </span>
    </footer>
  </button>
</template>
