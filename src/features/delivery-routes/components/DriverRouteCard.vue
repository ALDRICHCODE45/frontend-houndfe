<script setup lang="ts">
/**
 * DriverRouteCard — S6b (sdd delivery-routes, design.md §4.2, §11, REQ-DRC-001..008)
 *
 * Mobile-first card for ONE own ACTIVE route. Used by the driver branch of
 * `DeliveryRoutesListView`. The driver list is card-first — distinct from the
 * manager's dense table (design §4.1 vs §4.2) — because a phone UI favours
 * touch-sized surfaces over a multi-column grid.
 *
 * Surface:
 *   - Status badge (tone + Spanish label) sourced from `DELIVERY_ROUTE_STATUS_*`
 *     maps. Single source of truth shared with the manager table.
 *   - Short route id (first 8 chars + ellipsis) — the driver has no folio, so
 *     the id IS the human reference.
 *   - Driver name from `route.driver?.name` (em-dash fallback when null — the
 *     route is the driver's own, but the projection is defensive).
 *   - Stop-progress counter from `buildStopProgress(route.stops)` — `"Sin
 *     paradas"` when `stops.length === 0`, otherwise `"{completed}/{total}"`.
 *
 * Interaction:
 *   - The ENTIRE card is a tap target (REQ-DRC-007 mobile-first affordance).
 *     Tapping it (click or keyboard activation) emits `select` with the route
 *     id; the parent owns navigation so the card stays decoupled from
 *     vue-router.
 *   - The tap target is a native <button> under the hood — keyboard activation
 *     fires the same `select` emit (Enter / Space).
 *
 * Loading / empty / error states are owned by the parent list view (the card
 * is the row renderer). The card itself receives a non-null route.
 */

import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { buildStopProgress } from '../utils/delivery-route-actions.utils'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStatus,
} from '../interfaces/delivery-route.types'

const props = defineProps<{
  /** The route this card represents. The list view renders one card per route. */
  route: DeliveryRouteResponseDto
}>()

const emit = defineEmits<{
  /** Fired on tap / keyboard activation. Carries the route id; the parent owns navigation. */
  select: [routeId: string]
}>()

const statusLabel = computed(() => DELIVERY_ROUTE_STATUS_LABELS[props.route.status])
const statusTone = computed(() => DELIVERY_ROUTE_STATUS_TONES[props.route.status])

const shortRouteId = computed(() => {
  const id = props.route.id
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
})

const driverName = computed(() => props.route.driver?.name ?? '—')

const stopProgress = computed(() => buildStopProgress(props.route.stops))

/**
 * Tap handler — the parent owns navigation; we just emit the route id so the
 * card is decoupled from vue-router.
 */
function onTap() {
  emit('select', props.route.id)
}

/**
 * Keyboard activation — Enter / Space both fire `select` (the native <button>
 * handles Space on `keyup`, but for keyboard parity we accept both keys on
 * keydown so the test surface is predictable and screen-reader activation
 * works regardless of focus timing).
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    emit('select', props.route.id)
  }
}
</script>

<template>
  <!--
    Tap target = the entire card. Native <button> gives us keyboard activation
    (Enter / Space) for free, so a11y parity is automatic. The mobile polish
    pass (S7) tunes the min-height to ≥44px without changing this structure.
  -->
  <button
    type="button"
    data-testid="driver-route-card"
    class="flex w-full flex-col gap-2 rounded-lg border border-default bg-default p-4 text-left transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    @click="onTap"
    @keydown="onKeydown"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="font-mono text-sm">{{ shortRouteId }}</span>
      <StatusDotBadge :tone="statusTone" :label="statusLabel" />
    </div>

    <div class="flex items-center justify-between gap-3 text-sm">
      <span class="truncate">{{ driverName }}</span>
      <span class="text-muted">{{ stopProgress }}</span>
    </div>
  </button>
</template>
