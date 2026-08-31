<script setup lang="ts">
/**
 * DriverCockpitHeader — S4 of `driver-route-cockpit-redesign` (design.md §2-§3,
 * §6, §9.3; specs/driver-cockpit-shell REQ-DCS-002, REQ-DCS-007 emit + disabled,
 * REQ-DRC-111 header touch/focus).
 *
 * Presentational sticky panel-contained mobile-first header for the driver
 * cockpit. NEVER owns server state; never imports vue-router, useQuery, useMutation,
 * useQueryClient, or HTTP code (REQ-DCS-002, design §6 invariant).
 *
 * Typed props:
 *   route      — full DeliveryRouteResponseDto (non-null; mounted only after
 *                the view resolves a matching DTO — REQ-DCS-001).
 *   progress   — `{ completed, total }` from useDriverRouteCockpit(route).
 *   isFetching — true while the detail observer is fetching; disables refresh
 *                and the click handler early-returns (REQ-DCS-007).
 *
 * Typed emits:
 *   back         — fires once on back activation (parent owns nav).
 *   refresh      — fires once on refresh while idle.
 *   open-history — fires with `{ trigger: HTMLElement }` so the parent can
 *                  restore focus to the originating control (REQ-DCK-008).
 *
 * Surface (single source of truth — copy.ts + DELIVERY_ROUTE_STATUS_* maps):
 *   - Back, identity (`route.driver?.name ?? 'Ruta'`), lifecycle
 *     StatusDotBadge (label + tone), "{completed}/{total}" progress, history,
 *     refresh (`aria-label="Actualizar ruta"`).
 *
 * Touch + a11y (REQ-DRC-111): every interactive control is 44×44
 * (`min-h-11 min-w-11`) + `focus-visible:ring-2 focus-visible:ring-primary`;
 * semantic dark/light tokens (`bg-default`, `border-default`, `text-muted`);
 * `min-w-0 truncate` keeps 320px viewports from horizontally overflowing.
 *
 * Scope pin: this header owns identity / lifecycle / progress / back / history /
 * refresh ONLY — never ETA, distance, next-preview, or map (those are S5 + S8).
 */

import { computed } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
} from '../../interfaces/delivery-route.types'
import type { CockpitProgress } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

const props = defineProps<{
  route: DeliveryRouteResponseDto
  progress: CockpitProgress
  isFetching: boolean
}>()

const emit = defineEmits<{
  back: []
  refresh: []
  'open-history': [payload: { trigger: HTMLElement }]
}>()

const identity = computed<string>(
  () => props.route.driver?.name ?? DELIVERY_ROUTE_COPY.cockpit.header.identityFallback,
)
const statusLabel = computed<string>(
  () => DELIVERY_ROUTE_STATUS_LABELS[props.route.status],
)
const statusTone = computed(() => DELIVERY_ROUTE_STATUS_TONES[props.route.status])
const progressLabel = computed<string>(
  () => `${props.progress.completed}/${props.progress.total}`,
)
const refreshAriaLabel = computed<string>(
  () => DELIVERY_ROUTE_COPY.cockpit.header.refreshAriaLabel,
)
const backAriaLabel = computed<string>(
  // S4 review correction: the back control's accessible name is sourced from
  // the canonical copy contract (DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel
  // already pins "Volver"). No inline Spanish literal in the template; copy.ts
  // remains the single Spanish source for the feature.
  () => DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel,
)

function onBack() {
  emit('back')
}
function onRefresh() {
  // Disabled-while-fetching guard mirrors the `disabled` attribute so the
  // contract holds even when click is synthesised (jsdom fires click on
  // disabled buttons). REQ-DCS-007.
  if (props.isFetching) return
  emit('refresh')
}
function onOpenHistory(event: MouseEvent) {
  emit('open-history', { trigger: event.currentTarget as HTMLElement })
}
</script>

<template>
  <!-- Sticky within the panel; three-column grid [back | summary | actions]. -->
  <header
    data-testid="cockpit-header-root"
    class="sticky top-0 z-10 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-default bg-default py-3 min-w-0"
  >
    <!-- Column 1: back -->
    <button
      type="button"
      data-testid="cockpit-header-back"
      :aria-label="backAriaLabel"
      class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      @click="onBack"
    >
      <UIcon name="i-lucide-arrow-left" class="size-5" />
    </button>

    <!-- Column 2: identity + metadata row -->
    <div class="min-w-0" data-testid="cockpit-header-summary">
      <span class="truncate text-sm font-medium text-default" data-testid="cockpit-header-identity">
        {{ identity }}
      </span>
      <div class="mt-1 flex items-center gap-2" data-testid="cockpit-header-meta">
        <StatusDotBadge
          :tone="statusTone"
          :label="statusLabel"
          :aria-label="`${DELIVERY_ROUTE_COPY.cockpit.header.identityFallback}: ${statusLabel}`"
        />
        <span class="font-mono text-xs text-muted" data-testid="cockpit-header-progress">
          {{ progressLabel }}
        </span>
      </div>
    </div>

    <!-- Column 3: right actions -->
    <div class="flex items-center gap-2" data-testid="cockpit-header-actions">
      <button
        type="button"
        data-testid="cockpit-header-history"
        :aria-label="DELIVERY_ROUTE_COPY.cockpit.drawer.historyTitle"
        class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md border border-default bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        @click="onOpenHistory"
      >
        <UIcon name="i-lucide-history" class="size-5" />
      </button>

      <button
        type="button"
        data-testid="cockpit-header-refresh"
        :aria-label="refreshAriaLabel"
        :disabled="isFetching"
        class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md border border-default bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        @click="onRefresh"
      >
        <UIcon name="i-lucide-refresh-cw" class="size-5" />
      </button>
    </div>
  </header>
</template>
