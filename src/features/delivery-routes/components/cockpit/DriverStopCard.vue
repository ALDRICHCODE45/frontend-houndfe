<script setup lang="ts">
/**
 * DriverStopCard — rich single-stop card of the driver cockpit route-page
 * evolution. Presentational only: no server state, router, query, mutation,
 * HTTP; no overlays (the cockpit owns drawer/confirmation/focus).
 *
 * One `<article>` per stop with:
 *   - 1-based sequence number + "Parada {N}" position label (copy template).
 *   - Semantic status label (shared DELIVERY_ROUTE_STOP_STATUS_LABELS map).
 *   - Optional mono folio (omitted entirely when null/blank).
 *   - Customer name with the copy.ts fallback for null customers.
 *   - Formatted address via the shared `formatAddress` (hidden when absent).
 *   - Current emphasis (data-current + gold rail — the single signature
 *     operational anchor) and a "Siguiente" badge on the derived next stop.
 *
 * Separate native controls, never nested buttons:
 *   - "Ver detalles" always rendered → emits 'open-details' [{ stopId, trigger }].
 *   - "Marcar entregada" rendered only when `showCheckIn` is true (the cockpit
 *     derives the single current PENDING stop on an ACTIVE route with
 *     permission) → emits 'check-in' [{ stopId, trigger }]. Disabled while
 *     checkInPending and the handler early-returns, so a disabled click can
 *     never emit.
 *
 * Long strings: customer + folio truncate intentionally; the address wraps to a
 * controlled two lines (no aggressive single-line truncation on mobile, no
 * horizontal overflow); the action row stacks on narrow widths; every control is
 * ≥44px with a visible focus ring. All user-visible literals bind from copy.ts.
 */
import { computed } from 'vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import {
  DELIVERY_ROUTE_STOP_STATUS_LABELS,
  type DeliveryRouteStop,
} from '../../interfaces/delivery-route.types'
import type { CockpitNodeState, StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

const props = defineProps<{
  stop: DeliveryRouteStop
  nodeState: CockpitNodeState
  isCurrent: boolean
  isNext: boolean
  showCheckIn: boolean
  checkInPending: boolean
}>()

const emit = defineEmits<{
  'open-details': [payload: StopTrigger]
  'check-in': [payload: StopTrigger]
}>()

const positionLabel = computed<string>(() =>
  DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel.replace('{N}', String(props.stop.sortOrder + 1)),
)
const statusLabel = computed<string>(() => DELIVERY_ROUTE_STOP_STATUS_LABELS[props.stop.status])
const folio = computed<string>(() => props.stop.saleFolio?.trim() ?? '')
const hasFolio = computed<boolean>(() => folio.value.length > 0)
const customerName = computed<string>(
  () => props.stop.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback,
)
const formattedAddress = computed<string>(
  () => (props.stop.shippingAddress ? formatAddress(props.stop.shippingAddress) : ''),
)
const hasAddress = computed<boolean>(() => formattedAddress.value.length > 0)

// Current emphasis follows the Coco palette (gold for the actionable anchor);
// the semantic status label carries meaning — color is never the only signal.
const cardClass = computed<string[]>(() => [
  'relative flex w-full min-w-0 flex-col gap-3 rounded-lg border bg-default p-3 max-sm:p-2.5',
  'focus-visible:outline-none',
  props.isCurrent ? 'border-coco-gold-500 border-l-4' : 'border-default',
])

const sequenceClass = computed<string[]>(() => [
  'flex h-8 w-8 max-sm:h-7 max-sm:w-7 flex-none items-center justify-center rounded-full font-mono text-sm font-semibold',
  props.isCurrent
    ? 'bg-coco-gold-500 text-coco-neutral-950'
    : 'bg-elevated text-muted',
])

function openDetails(event: MouseEvent): void {
  emit('open-details', { stopId: props.stop.id, trigger: event.currentTarget as HTMLElement })
}
function checkIn(event: MouseEvent): void {
  // Guard mirrors the disabled attribute so a synthesized click on a disabled
  // button can never emit (REQ-DRC-104 exactly-once discipline).
  if (props.checkInPending) return
  emit('check-in', { stopId: props.stop.id, trigger: event.currentTarget as HTMLElement })
}
</script>

<template>
  <article
    :data-testid="`driver-stop-card-${props.stop.id}`"
    :data-stop-id="props.stop.id"
    :data-node-state="props.nodeState"
    :data-current="String(props.isCurrent)"
    :class="cardClass"
  >
    <div class="flex w-full min-w-0 items-center gap-3 max-sm:gap-2">
      <span :class="sequenceClass" aria-hidden="true" data-testid="driver-stop-card-sequence">
        {{ props.stop.sortOrder + 1 }}
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span data-testid="driver-stop-card-position">{{ positionLabel }}</span>
          <span data-testid="driver-stop-card-status" class="font-medium">{{ statusLabel }}</span>
          <span
            v-if="props.isNext"
            data-testid="driver-stop-card-next-badge"
            class="rounded-full border border-coco-gold-500 px-2 py-0.5 text-[11px] font-medium text-default"
          >{{ DELIVERY_ROUTE_COPY.cockpit.stops.nextBadge }}</span>
          <span
            v-if="hasFolio"
            data-testid="driver-stop-card-folio"
            class="min-w-0 truncate font-mono normal-case"
          >· {{ folio }}</span>
        </div>
        <span data-testid="driver-stop-card-customer" class="min-w-0 truncate text-sm font-medium text-default">
          {{ customerName }}
        </span>
        <span
          v-if="hasAddress"
          data-testid="driver-stop-card-address"
          class="min-w-0 whitespace-normal break-words line-clamp-2 text-xs text-muted"
        >{{ formattedAddress }}</span>
      </div>
    </div>

    <div
      data-testid="driver-stop-card-actions"
      class="flex flex-wrap items-center justify-end gap-2 max-sm:flex-col max-sm:items-stretch"
    >
      <button
        type="button"
        data-testid="driver-stop-card-details"
        class="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-default bg-default px-4 py-2 text-sm font-medium text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary max-sm:w-full"
        @click="openDetails"
      >
        <UIcon name="i-lucide-eye" class="size-4" aria-hidden="true" />
        {{ DELIVERY_ROUTE_COPY.cockpit.stops.detailsLabel }}
      </button>
      <button
        v-if="props.showCheckIn"
        type="button"
        data-testid="driver-stop-card-check-in"
        :aria-label="`${customerName} - ${DELIVERY_ROUTE_COPY.actions.checkIn}`"
        :disabled="props.checkInPending"
        class="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md bg-coco-gold-500 px-4 py-2 text-sm font-semibold text-coco-neutral-950 shadow-sm transition hover:bg-coco-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-coco-gold-500/60 motion-reduce:transition-none max-sm:w-full"
        @click="checkIn"
      >
        <UIcon name="i-lucide-check" class="size-4" aria-hidden="true" />
        {{ DELIVERY_ROUTE_COPY.actions.checkIn }}
      </button>
    </div>
  </article>
</template>
