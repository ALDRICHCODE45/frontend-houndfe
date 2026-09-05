<script setup lang="ts">
/**
 * DriverRouteSpine — S6 of `driver-route-cockpit-redesign`, evolved by the
 * route-page redesign (REQ-DCS-005, REQ-DRC-111 spine a11y). Mobile-first
 * accessible ordered sequence rendered as RICH STOP CARDS: the spine owns the
 * ordered <ol> ("Recorrido de la ruta"), the backend order (verbatim, never
 * re-sorted), and the "Sin paradas" empty state; each <li> hosts one
 * DriverStopCard (sequence / status / folio / customer / address, current+next
 * emphasis, separate native controls).
 *
 * The single direct "Marcar entregada" CTA is GATED BY THE PARENT: the cockpit
 * derives `showCheckInStopId` (the one current PENDING stop on an ACTIVE route
 * with permission) — the spine never derives permissions itself. Card
 * activations are forwarded verbatim as 'open-details' / 'check-in'
 * [StopTrigger] so the cockpit keeps drawer, confirmation, and exactly-once
 * mutation ownership. No server state, router, query, mutation, HTTP.
 */
import DriverStopCard from './DriverStopCard.vue'
import type { CockpitSpineNode, StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

defineProps<{
  nodes: readonly CockpitSpineNode[]
  /** Stop id allowed to carry the single direct check-in CTA; null = none. */
  showCheckInStopId: string | null
  checkInPending: boolean
}>()
const emit = defineEmits<{
  'open-details': [payload: StopTrigger]
  'check-in': [payload: StopTrigger]
}>()

const emptySpineCopy = DELIVERY_ROUTE_COPY.cockpit.operational.emptySpine
const rootAriaLabel = DELIVERY_ROUTE_COPY.cockpit.spine.rootAriaLabel

function onOpenDetails(payload: StopTrigger): void {
  emit('open-details', payload)
}
function onCheckIn(payload: StopTrigger): void {
  emit('check-in', payload)
}
</script>

<template>
  <p
    v-if="nodes.length === 0"
    data-testid="cockpit-spine-empty"
    class="px-4 py-6 text-center text-sm text-muted"
  >{{ emptySpineCopy }}</p>
  <ol
    v-else
    data-testid="cockpit-spine-root"
    :aria-label="rootAriaLabel"
    class="flex flex-col gap-2 min-w-0"
  >
    <li v-for="node in nodes" :key="node.stop.id" class="min-w-0">
      <DriverStopCard
        :stop="node.stop"
        :node-state="node.nodeState"
        :is-current="node.isCurrent"
        :is-next="node.isNext"
        :show-check-in="node.stop.id === showCheckInStopId"
        :check-in-pending="checkInPending"
        @open-details="onOpenDetails"
        @check-in="onCheckIn"
      />
    </li>
  </ol>
</template>
