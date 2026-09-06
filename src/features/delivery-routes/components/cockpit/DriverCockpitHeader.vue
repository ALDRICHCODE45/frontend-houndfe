<script setup lang="ts">
/**
 * DriverCockpitHeader — S4 of `driver-route-cockpit-redesign` (design.md §2-§3,
 * §6, §9.3; specs/driver-cockpit-shell REQ-DCS-002, REQ-DCS-007 emit + disabled,
 * REQ-DRC-111 header touch/focus) + user-approved header refinement.
 *
 * Presentational sticky compact CARD (rounded-xl, border-default, bg-default,
 * restrained shadow, p-3 mobile / p-4 desktop, intentional `top-3` sticky
 * offset) with a three-column composition: [back | flexible route content |
 * ONE ghost overflow trigger]. NEVER owns server state; never imports
 * vue-router, useQuery, useMutation, useQueryClient, or HTTP code (REQ-DCS-002).
 *
 * Typed props:
 *   route      — full DeliveryRouteResponseDto (non-null; mounted only after
 *                the view resolves a matching DTO — REQ-DCS-001).
 *   isFetching — true while the detail observer is fetching; disables the
 *                refresh menu item AND the handler early-returns (REQ-DCS-007).
 *
 * Refined-out (redundant / duplicated elsewhere):
 *   - driver identity line (driver-only cockpit; collided with the title),
 *   - "{completed}/{total}" progress fraction (the summary card below owns
 *     progress),
 *   - the separate visible history + refresh buttons.
 *
 * Typed emits:
 *   back         — fires once on back activation (parent owns nav).
 *   refresh      — fires ONCE per selection while idle (guarded when fetching).
 *   open-history — fires ONCE per selection with the menu trigger element so
 *                  the parent can restore focus (REQ-DCK-008).
 *
 * Overflow menu: one UDropdownMenu, two keyboard-accessible items in order —
 * "Ver historial" (cockpit.footer.viewHistory) then "Actualizar ruta"
 * (cockpit.header.refreshAriaLabel) — reusing the existing icons + copy keys;
 * the trigger's accessible label is cockpit.header.actionsLabel.
 *
 * Surface (single source of truth — copy.ts + DELIVERY_ROUTE_STATUS_* maps):
 *   - Back, title "Ruta de entrega", lifecycle StatusDotBadge (label + tone),
 *     compact uppercase 8-char route id (FULL id as native `title`), truthful
 *     lifecycle timestamp line.
 *
 * Touch + a11y (REQ-DRC-111): every interactive control is 44×44
 * (`min-h-11 min-w-11`) + `focus-visible:ring-2 focus-visible:ring-primary`;
 * semantic dark/light tokens only (no raw hex); `min-w-0 truncate` keeps 320px
 * viewports from horizontally overlapping or overflowing.
 *
 * Scope pin: this header owns identity / lifecycle / back / overflow-menu ONLY
 * — never ETA, distance, next-preview, or map (those are S5 + S8).
 */

import { computed, useTemplateRef } from 'vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { formatTimelineTimestamp } from '../DeliveryRouteTimeline.vue'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
} from '../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../copy'

const props = defineProps<{
  route: DeliveryRouteResponseDto
  isFetching: boolean
}>()

const emit = defineEmits<{
  back: []
  refresh: []
  'open-history': [payload: { trigger: HTMLElement | null }]
}>()

// Route-page evolution: page identity + truthful route id.
const pageTitle = computed<string>(() => DELIVERY_ROUTE_COPY.cockpit.header.title)
// Route-page evolution: ONE lifecycle line derived ONLY from existing route
// timestamps (startedAt / completedAt / cancelledAt). Precedence: terminal
// state beats start; a missing/unparseable timestamp degrades to the copy.ts
// fallback date or renders NO line at all — never a fabricated date, and no
// zone / scheduled context (the backend does not supply them).
function lifecycleDate(iso: string): string {
  return formatTimelineTimestamp(iso) || DELIVERY_ROUTE_COPY.timeline.timestampFallback
}
const lifecycleLabel = computed<string | null>(() => {
  const tpl = DELIVERY_ROUTE_COPY.cockpit.lifecycle
  if (props.route.status === 'CANCELLED' && props.route.cancelledAt) {
    return tpl.cancelled.replace('{date}', lifecycleDate(props.route.cancelledAt))
  }
  if (props.route.status === 'COMPLETED' && props.route.completedAt) {
    return tpl.completed.replace('{date}', lifecycleDate(props.route.completedAt))
  }
  if (props.route.startedAt) {
    return tpl.started.replace('{date}', lifecycleDate(props.route.startedAt))
  }
  return null
})
const statusLabel = computed<string>(
  () => DELIVERY_ROUTE_STATUS_LABELS[props.route.status],
)
const statusTone = computed(() => DELIVERY_ROUTE_STATUS_TONES[props.route.status])
// Route-page evolution: compact human-readable route identifier (first 8
// characters, uppercase) keeps the 320px metadata row stable; the FULL id
// stays available as the native `title` (accessible description).
const routeIdShort = computed<string>(() => props.route.id.slice(0, 8).toUpperCase())
const backAriaLabel = computed<string>(
  // S4 review correction: the back control's accessible name is sourced from
  // the canonical copy contract (DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel
  // already pins "Volver"). No inline Spanish literal in the template; copy.ts
  // remains the single Spanish source for the feature.
  () => DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel,
)

// Header refinement: ONE overflow trigger. The trigger element is kept so the
// history selection can hand it to the parent for focus restoration
// (REQ-DCK-008). Items reuse existing copy keys + icons; order is pinned:
// "Ver historial" then "Actualizar ruta".
const menuTriggerEl = useTemplateRef<HTMLElement | null>('menuTrigger')
const menuItems = computed(() => [
  {
    label: DELIVERY_ROUTE_COPY.cockpit.footer.viewHistory,
    icon: 'i-lucide-history',
    onSelect: onOpenHistory,
  },
  {
    label: DELIVERY_ROUTE_COPY.cockpit.header.refreshAriaLabel,
    icon: 'i-lucide-refresh-cw',
    disabled: props.isFetching,
    onSelect: onRefresh,
  },
])

function onBack() {
  emit('back')
}
function onRefresh() {
  // Disabled-while-fetching guard mirrors the item's `disabled` flag so the
  // contract holds even when the item handler is invoked while fetching
  // (exactly-once while idle; nothing while busy). REQ-DCS-007.
  if (props.isFetching) return
  emit('refresh')
}
function onOpenHistory() {
  emit('open-history', { trigger: menuTriggerEl.value })
}
</script>

<template>
  <!-- Sticky compact card (intentional top-3 offset, not a flush strip);
       three-column composition [back | flexible summary | overflow trigger]. -->
  <header
    data-testid="cockpit-header-root"
    class="sticky top-3 z-10 flex min-w-0 items-center gap-2 rounded-xl border border-default bg-default p-3 shadow-sm sm:gap-3 sm:p-4"
  >
    <!-- Column 1: back -->
    <button
      type="button"
      data-testid="cockpit-header-back"
      :aria-label="backAriaLabel"
      class="inline-flex flex-none items-center justify-center min-h-11 min-w-11 rounded-md text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      @click="onBack"
    >
      <UIcon name="i-lucide-arrow-left" class="size-5" />
    </button>

    <!-- Column 2: title + metadata row (status + compact route id) + lifecycle -->
    <div class="min-w-0 flex-1" data-testid="cockpit-header-summary">
      <span class="block truncate text-base font-semibold text-default" data-testid="cockpit-header-title">
        {{ pageTitle }}
      </span>
      <div class="mt-1 flex min-w-0 flex-wrap items-center gap-2" data-testid="cockpit-header-meta">
        <StatusDotBadge
          :tone="statusTone"
          :label="statusLabel"
          :aria-label="`${DELIVERY_ROUTE_COPY.cockpit.header.identityFallback}: ${statusLabel}`"
        />
        <span
          class="min-w-0 truncate font-mono text-xs text-muted"
          data-testid="cockpit-header-route-id"
          :title="props.route.id"
        >{{ routeIdShort }}</span>
      </div>
      <p
        v-if="lifecycleLabel"
        class="mt-1 truncate text-xs text-muted"
        data-testid="cockpit-header-lifecycle"
      >{{ lifecycleLabel }}</p>
    </div>

    <!-- Column 3: single ghost overflow trigger (history + refresh moved here). -->
    <UDropdownMenu
      :items="menuItems"
      :content="{ align: 'end' as const }"
    >
      <button
        ref="menuTrigger"
        type="button"
        data-testid="cockpit-header-actions"
        :aria-label="DELIVERY_ROUTE_COPY.cockpit.header.actionsLabel"
        class="inline-flex flex-none items-center justify-center min-h-11 min-w-11 rounded-md text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <UIcon name="i-lucide-ellipsis-vertical" class="size-5" />
      </button>
    </UDropdownMenu>
  </header>
</template>
