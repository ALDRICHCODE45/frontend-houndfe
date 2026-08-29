<script setup lang="ts">
/**
 * DriverCockpitFooter — S7 of `driver-route-cockpit-redesign` (design.md §3,
 * §9.2-§9.3; specs/driver-cockpit-shell REQ-DCS-006/008/009; REQ-DRC-111).
 *
 * Presentational four-mode footer. NEVER owns server state; never imports
 * vue-router / useQuery / useMutation / useQueryClient / HTTP (design §6).
 * NEVER mutates: no useCheckInStop / invalidate / refetch / mutateAsync —
 * the parent view owns the single check-in composable instance.
 *
 * Modes (exactly one per render; `mode` computed is the single source):
 *   - 'current-action' : non-terminal + current PENDING + canCheckIn. Central
 *       ≥44px primary delivery action (Coco gold), enabled while !checkInPending
 *       (handler early-returns so disabled clicks emit nothing). Emits
 *       'request-confirm' { stopId, trigger }.
 *   - 'in-progress'    : current IN_PROGRESS. One disabled indicator. No emit.
 *   - 'terminal'       : COMPLETED or CANCELLED. Summary copy + history action
 *       (≥44px, semantic muted). Emits 'open-history' { trigger }.
 *   - 'empty'          : null current / non-actionable current / !hasStops.
 *
 * Safe-area (REQ-DRC-111): footer root carries pb-[env(safe-area-inset-bottom)]
 * in EVERY mode. S10 root owns matching body padding-bottom clearance.
 * Touch + a11y: every interactive button ≥44×44 + focus-visible.
 */
import { computed } from 'vue'
import {
  DELIVERY_ROUTE_STOP_STATUS_LABELS,
  type DeliveryRouteStatus,
  type DeliveryRouteStop,
} from '../../interfaces/delivery-route.types'
import type { CockpitProgress, StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

const props = defineProps<{
  routeStatus: DeliveryRouteStatus
  currentStop: DeliveryRouteStop | null
  progress: CockpitProgress
  hasStops: boolean
  canCheckIn: boolean
  checkInPending: boolean
}>()

const emit = defineEmits<{
  'request-confirm': [payload: StopTrigger]
  'open-history': [payload: { trigger: HTMLElement }]
}>()

// Exactly one of four mutually exclusive branches. Single source of truth.
const mode = computed(() => {
  if (props.routeStatus === 'COMPLETED' || props.routeStatus === 'CANCELLED') return 'terminal'
  if (!props.hasStops) return 'empty'
  if (!props.currentStop) return 'empty'
  if (props.currentStop.status === 'IN_PROGRESS') return 'in-progress'
  if (props.currentStop.status === 'PENDING') return props.canCheckIn ? 'current-action' : 'empty'
  return 'empty' // SKIPPED / COMPLETED current → no actionable surface.
})

const actionLabel = computed(() => DELIVERY_ROUTE_COPY.actions.checkIn)
const inProgressLabel = computed(() => DELIVERY_ROUTE_STOP_STATUS_LABELS.IN_PROGRESS)
const actionAriaLabel = computed(
  () => `${props.currentStop?.customer?.name ?? actionLabel.value} — ${actionLabel.value}`,
)
const terminalTitle = computed(() =>
  props.routeStatus === 'COMPLETED'
    ? DELIVERY_ROUTE_COPY.cockpit.footer.completedTitle
    : DELIVERY_ROUTE_COPY.cockpit.footer.cancelledTitle,
)
const terminalSummary = computed(() =>
  props.routeStatus === 'COMPLETED'
    ? DELIVERY_ROUTE_COPY.cockpit.footer.completedSummary
        .replace('{completed}', String(props.progress.completed))
        .replace('{total}', String(props.progress.total))
    : DELIVERY_ROUTE_COPY.cockpit.footer.cancelledSummary,
)

function onAction(event: MouseEvent) {
  if (props.checkInPending || !props.currentStop) return
  emit('request-confirm', {
    stopId: props.currentStop.id,
    trigger: event.currentTarget as HTMLElement,
  })
}
function onHistory(event: MouseEvent) {
  emit('open-history', { trigger: event.currentTarget as HTMLElement })
}
</script>

<template>
  <footer
    data-testid="cockpit-footer-root"
    class="sticky bottom-0 z-10 flex w-full flex-col items-stretch gap-2 border-t border-default bg-default px-4 py-3 min-w-0 pb-[env(safe-area-inset-bottom)]"
  >
    <!-- current-action: primary delivery action (central, gold accent). -->
    <button
      v-if="mode === 'current-action'"
      type="button"
      data-testid="cockpit-footer-action"
      :aria-label="actionAriaLabel"
      :disabled="props.checkInPending"
      class="mx-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md bg-coco-gold-500 px-6 py-3 text-sm font-semibold text-coco-neutral-950 shadow-sm transition hover:bg-coco-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-coco-gold-500/60"
      @click="onAction"
    >
      {{ actionLabel }}
    </button>
    <!-- in-progress: one disabled indicator element (NO button, NO emit). -->
    <p
      v-else-if="mode === 'in-progress'"
      data-testid="cockpit-footer-in-progress"
      role="status"
      aria-live="polite"
      class="mx-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-default bg-default/60 px-6 py-2 text-sm font-medium text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" aria-hidden="true" />
      <span>{{ inProgressLabel }}</span>
    </p>
    <!-- terminal: summary copy + history action. -->
    <div
      v-else-if="mode === 'terminal'"
      data-testid="cockpit-footer-terminal"
      class="flex w-full flex-col items-center gap-1 text-center"
    >
      <p class="text-sm font-semibold text-default" data-testid="cockpit-footer-terminal-title">{{ terminalTitle }}</p>
      <p class="text-xs text-muted" data-testid="cockpit-footer-terminal-summary">{{ terminalSummary }}</p>
      <button
        type="button"
        data-testid="cockpit-footer-history"
        :aria-label="DELIVERY_ROUTE_COPY.cockpit.footer.viewHistory"
        class="mt-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-default bg-default px-5 py-2 text-sm font-medium text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        @click="onHistory"
      >
        <UIcon name="i-lucide-history" class="size-5" aria-hidden="true" />
        {{ DELIVERY_ROUTE_COPY.cockpit.footer.viewHistory }}
      </button>
    </div>
  </footer>
</template>