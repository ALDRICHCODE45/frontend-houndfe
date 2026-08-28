<script setup lang="ts">
/**
 * DriverStopDetail — S6b (sdd delivery-routes, design.md §4.2, §6.3, §7.2, §11,
 * REQ-DRC-001..008)
 *
 * One-stop card used by the driver branch of `DeliveryRouteDetailView`.
 * Field stop detail is the driver's primary action surface — isolated from the
 * list / detail orchestration so the parent's branching decision is the only
 * orchestration in the route view (vue-best-practices composition-surface rule).
 *
 * Surface (per stop):
 *   - `customer.name` from the stop projection. Falls back to
 *     "Cliente sin nombre" when the projection is null (a sale without a
 *     primary contact still needs an address card on the driver's phone).
 *   - `formatAddress(stop.shippingAddress)` — the shared label-first formatter
 *     from S3a (single source of truth, design §8.1).
 *   - Read-only `<AddressMapPicker mode="read">` ONLY when both `latitude` and
 *     `longitude` are non-null (REQ-AMP-002). When either is missing, the map
 *     is HIDDEN and only the formatted address renders — the driver still gets
 *     the destination string (REQ-AMP-007 tile-failure swallow is owned by the
 *     picker itself).
 *   - Check-in button (the driver's primary affordance):
 *       * DISABLED when `stop.status !== 'PENDING'` (REQ-DRC-003 / §11) — the
 *         button stays mounted (visible) so the driver sees the work was done,
 *         but cannot fire a duplicate request (REQ-DRC-005 idempotency).
 *       * Spinner while `isPending` is true (mirrors the Nuxt UI loading
 *         affordance).
 *
 * Interaction:
 *   - The check-in click invokes `useCheckInStop().mutateAsync({ id, stopId })`
 *     directly. The composable owns the success toast, invalidations, and the
 *     422/404 domain-error routing (REQ-DRC-004..007).
 *   - We do NOT emit a `check-in` event: the parent view doesn't need the
 *     payload — the mutation is self-contained. Wiring goes through the
 *     composable, not the event bus. (Same shape as `DeliveryRouteReorderPanel`
 *     — child owns the mutation wiring.)
 */

import { computed } from 'vue'
import AddressMapPicker from '@/core/shared/components/AddressMapPicker.vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import { useCheckInStop } from '../composables/useCheckInStop'
import { DELIVERY_ROUTE_COPY } from '../copy'
import type { DeliveryRouteStop } from '../interfaces/delivery-route.types'

const props = defineProps<{
  /** The stop this card represents. The detail view renders one card per stop. */
  stop: DeliveryRouteStop
  /** The parent route id (used as the path arg for the check-in mutation). */
  routeId: string
}>()

const { mutateAsync: checkIn, isPending } = useCheckInStop()

// ─── Address rendering ──────────────────────────────────────────────────────
// `formatAddress` accepts a superset input (design §8.1); the stop projection
// carries `label`, so the label-first ordering is exact. When the projection
// is null, `formattedAddress` collapses to '' — the template gates the row
// entirely so the driver never sees a stray comma.
const formattedAddress = computed<string>(() => {
  return props.stop.shippingAddress ? formatAddress(props.stop.shippingAddress) : ''
})

const customerName = computed<string>(
  () => props.stop.customer?.name ?? 'Cliente sin nombre',
)

// ─── Map gating ─────────────────────────────────────────────────────────────
// The map is HIDDEN when either coordinate is missing or non-finite (REQ-AMP-002).
// `pinToGeoPoint` (exported from AddressMapPicker) is the same helper the
// AddressModal uses; centralizing the gate prevents the stop detail from
// diverging from the customer address form's coord semantics.
const coords = computed<{ lat: number; lng: number } | null>(() => {
  const addr = props.stop.shippingAddress
  if (!addr) return null
  const lat = addr.latitude
  const lng = addr.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
})

const showMap = computed<boolean>(() => coords.value !== null)
const mapPin = computed<{ lat: number; lng: number } | null>(() => coords.value)

// ─── Check-in button state ──────────────────────────────────────────────────
const canCheckIn = computed<boolean>(() => props.stop.status === 'PENDING')

/**
 * Check-in click — early-return on a disabled button so the dispatcher can
 * never fire on a non-PENDING stop (REQ-DRC-005 idempotency).
 */
async function onCheckIn() {
  if (!canCheckIn.value) return
  try {
    await checkIn({ id: props.routeId, stopId: props.stop.id })
    // Success toast + invalidations fire from the composable.
  } catch {
    // Error toast + invalidations fire from the composable's onError router.
  }
}
</script>

<template>
  <article
    data-testid="driver-stop-detail"
    class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4"
  >
    <header class="flex flex-col gap-1">
      <span class="text-xs uppercase tracking-wide text-muted">
        Parada {{ stop.sortOrder + 1 }}
      </span>
      <h3 class="text-base font-medium" data-testid="driver-stop-customer-name">
        {{ customerName }}
      </h3>
    </header>

    <p
      v-if="formattedAddress"
      class="text-sm text-default"
      data-testid="driver-stop-address"
    >
      {{ formattedAddress }}
    </p>

    <AddressMapPicker
      v-if="showMap"
      mode="read"
      :model-value="mapPin"
      :popup-text="formattedAddress"
    />

    <UButton
      color="primary"
      variant="solid"
      block
      :label="DELIVERY_ROUTE_COPY.actions.checkIn"
      :loading="isPending"
      :disabled="!canCheckIn"
      data-testid="driver-stop-check-in-button"
      @click="onCheckIn"
    />
  </article>
</template>
