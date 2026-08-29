<script setup lang="ts">
/**
 * DriverOperationalStops — S5 (design §3-§4; REQ-DCS-003/004; REQ-DRC-112).
 * Mobile-first current + next operational hierarchy. No server state /
 * router / query / HTTP. Props { currentStop, nextStop, notes, hasStops,
 * isTerminal }. Emits 'open-stop' [StopTrigger]. Current (REQ-DCS-003):
 * PENDING gold · IN_PROGRESS navy · other muted. Next (REQ-DCS-004): no
 * map/ETA/distance; terminal beats non-terminal on empty branches.
 */

import { computed } from 'vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import type { DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../copy'
import type { StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'

const props = defineProps<{
  currentStop: DeliveryRouteStop | null
  nextStop: DeliveryRouteStop | null
  notes: string | null
  hasStops: boolean
  isTerminal: boolean
}>()

const emit = defineEmits<{ 'open-stop': [payload: StopTrigger] }>()

// Current derivations.
const currentPositionLabel = computed<string | null>(() =>
  props.currentStop ? `Parada ${props.currentStop.sortOrder + 1}` : null,
)
const currentFolio = computed<string | null>(
  () => props.currentStop?.saleFolio || null,
)
const currentCustomerName = computed<string>(
  () =>
    props.currentStop?.customer?.name ??
    DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback,
)
const currentAvatarSeed = computed<string>(
  () => props.currentStop?.id ?? 'cockpit-current-fallback',
)
const currentFormattedAddress = computed<string>(() =>
  props.currentStop?.shippingAddress ? formatAddress(props.currentStop.shippingAddress) : '',
)
// PENDING gold · IN_PROGRESS navy · other muted. Hue markers pinned by spec.
const currentEmphasisClass = computed<string>(() => {
  if (!props.currentStop) return ''
  switch (props.currentStop.status) {
    case 'PENDING': return 'border-l-4 border-[#f6bb13] bg-[#f6bb13]/10'
    case 'IN_PROGRESS': return 'border-l-4 border-[#173968] bg-[#173968]/10'
    default: return 'border-l-4 border-default bg-default/60'
  }
})
const trimmedNotes = computed<string>(() => props.notes?.trim() ?? '')
const hasNotes = computed<boolean>(() => trimmedNotes.value.length > 0)

// Next derivations.
const showNextSection = computed<boolean>(() => props.hasStops)
const nextLabel = computed<string | null>(() =>
  props.nextStop
    ? DELIVERY_ROUTE_COPY.cockpit.operational.nextLabel.replace('{N}', String(props.nextStop.sortOrder + 1))
    : null,
)
const nextCustomerName = computed<string>(
  () => props.nextStop?.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback,
)
const nextFolio = computed<string | null>(() => props.nextStop?.saleFolio || null)
const nextFormattedAddress = computed<string>(() =>
  props.nextStop?.shippingAddress ? formatAddress(props.nextStop.shippingAddress) : '',
)
// Empty-branch precedence (terminal beats non-terminal; hasStops already gates).
const nextEmptyLabel = computed<{ variant: 'last' | 'no-more' | null; text: string }>(() => {
  if (props.nextStop) return { variant: null, text: '' }
  if (props.isTerminal) {
    return { variant: 'no-more', text: DELIVERY_ROUTE_COPY.cockpit.operational.nextNoMore }
  }
  return { variant: 'last', text: DELIVERY_ROUTE_COPY.cockpit.operational.nextLastStop }
})

// Shared emit — originating element for focus return (REQ-DCK-008).
function openStop(stopId: string, event: MouseEvent) {
  emit('open-stop', { stopId, trigger: event.currentTarget as HTMLElement })
}
</script>

<template>
  <section data-testid="cockpit-operational-stops" class="flex flex-col gap-4 px-4 py-4">
    <section data-testid="cockpit-current-section" class="flex flex-col gap-2">
      <p
        v-if="!currentStop"
        class="text-sm text-muted"
        data-testid="cockpit-current-fallback"
      >{{ DELIVERY_ROUTE_COPY.cockpit.operational.currentFallback }}</p>
      <button
        v-else
        type="button"
        :class="[
          'flex w-full flex-col items-start gap-2 rounded-md px-3 py-3 text-left min-h-11',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          currentEmphasisClass,
        ]"
        data-testid="cockpit-current-card"
        @click="openStop(currentStop.id, $event)"
      >
        <header class="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-wide text-muted">
          <span data-testid="cockpit-current-position">{{ currentPositionLabel }}</span>
          <span v-if="currentFolio" class="font-mono normal-case" data-testid="cockpit-current-folio">· {{ currentFolio }}</span>
        </header>
        <div class="flex w-full items-center gap-3">
          <EntityAvatar :name="currentCustomerName" :seed="currentAvatarSeed" size="md" data-testid="cockpit-current-avatar" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium text-default" data-testid="cockpit-current-customer">{{ currentCustomerName }}</span>
            <span v-if="currentFormattedAddress" class="truncate text-xs text-muted" data-testid="cockpit-current-address">{{ currentFormattedAddress }}</span>
          </div>
        </div>
        <p v-if="hasNotes" class="w-full text-xs text-muted" data-testid="cockpit-current-notes">
          <span class="font-medium text-default">{{ DELIVERY_ROUTE_COPY.cockpit.operational.notesLabel }}:</span>
          {{ trimmedNotes }}
        </p>
      </button>
    </section>

    <section v-if="showNextSection" data-testid="cockpit-next-section" class="flex flex-col gap-2">
      <button
        v-if="nextStop"
        type="button"
        class="flex w-full flex-col items-start gap-1 rounded-md border border-default bg-default/60 px-3 py-3 text-left min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        data-testid="cockpit-next-card"
        @click="openStop(nextStop.id, $event)"
      >
        <header class="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
          <span data-testid="cockpit-next-label">{{ nextLabel }}</span>
          <span v-if="nextFolio" class="font-mono normal-case" data-testid="cockpit-next-folio">· {{ nextFolio }}</span>
        </header>
        <span class="truncate text-sm text-default" data-testid="cockpit-next-customer">{{ nextCustomerName }}</span>
        <span v-if="nextFormattedAddress" class="truncate text-xs text-muted" data-testid="cockpit-next-address">{{ nextFormattedAddress }}</span>
      </button>
      <p v-else-if="nextEmptyLabel.variant === 'no-more'" class="text-xs text-muted" data-testid="cockpit-next-empty-no-more">{{ nextEmptyLabel.text }}</p>
      <p v-else class="text-xs text-muted" data-testid="cockpit-next-empty-last">{{ nextEmptyLabel.text }}</p>
    </section>
  </section>
</template>
