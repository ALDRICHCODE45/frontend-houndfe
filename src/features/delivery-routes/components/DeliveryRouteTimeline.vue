<script setup lang="ts">
/**
 * DeliveryRouteTimeline — S6b (sdd delivery-routes, design.md §4.2, §4.4, §5.1, §11)
 *
 * Read-only vertical timeline for the delivery-route detail. Renders the 5
 * backend event types in backend `at` ASC order (the client NEVER re-sorts —
 * design §5.1). New component, NOT a `SaleDetailTimeline` generalization, per
 * design §4.4: payloads/colors differ, no COMMENT edit/delete affordance.
 *
 * Five event types (backend §4):
 *   1. ROUTE_CREATED    — actor is ALWAYS null (creator not persisted).
 *                         The row renders NO actor line.
 *   2. ROUTE_STARTED    — actor (driver) optional; render the name when present.
 *   3. STOP_CHECKED_IN  — has `stopId` + `sortOrder`; renders the position as
 *                         `"Parada {sortOrder + 1}"` (1-based human-facing).
 *   4. ROUTE_COMPLETED  — actor optional.
 *   5. ROUTE_CANCELLED  — actor optional.
 *
 * Surface:
 *   - Each row carries a stable `data-testid="timeline-row-<event>-<stopId?>"`
 *     so the spec (and future e2e suites) can target a specific row.
 *   - All copy is sourced from `DELIVERY_ROUTE_COPY.timeline.*` — the single
 *     Spanish copy source (design §11).
 *   - No edit / delete affordance; no emits. Read-only.
 *
 * The component receives a `DeliveryRouteResponseDto` prop so the parent
 * detail view can pass the same DTO the rest of the surface consumes — no
 * second shape.
 */

import { computed } from 'vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStopStatus,
  DeliveryRouteTimelineEvent,
} from '../interfaces/delivery-route.types'

const props = defineProps<{
  /** The route whose timeline is rendered (timeline is sourced from `route.timeline`). */
  route: DeliveryRouteResponseDto
}>()

// ─── Per-event label + icon source ──────────────────────────────────────────
// Single source — no per-row string templates scattered across the template.
// Keeping a typed map here (instead of inline ternaries) means adding a 6th
// event type is a compile-time error in this file.

interface TimelineRowViewModel {
  /** Stable testid for the row (used by specs and e2e). */
  testId: string
  /** Spanish label (sourced from DELIVERY_ROUTE_COPY.timeline). */
  label: string
  /** Optional stop position for STOP_CHECKED_IN. */
  stopPosition?: string
  /** Optional actor name (when the event's actor is non-null). */
  actorName?: string | null
  /** Optional stop status label (used for STOP_CHECKED_IN icon hint). */
  stopStatus?: DeliveryRouteStopStatus
}

function buildRow(event: DeliveryRouteTimelineEvent): TimelineRowViewModel {
  switch (event.type) {
    case 'ROUTE_CREATED':
      return {
        testId: 'timeline-row-ROUTE_CREATED',
        label: DELIVERY_ROUTE_COPY.timeline.routeCreated,
        // actor is ALWAYS null — no actor line renders (design §4.4).
      }
    case 'ROUTE_STARTED':
      return {
        testId: 'timeline-row-ROUTE_STARTED',
        label: DELIVERY_ROUTE_COPY.timeline.routeStarted,
        actorName: event.actor?.name ?? null,
      }
    case 'STOP_CHECKED_IN':
      return {
        testId: `timeline-row-STOP_CHECKED_IN-${event.stopId}`,
        label: DELIVERY_ROUTE_COPY.timeline.stopCheckedIn,
        // 1-based human-facing position (sortOrder is 0-based in the DTO).
        stopPosition: `Parada ${event.sortOrder + 1}`,
        actorName: event.actor?.name ?? null,
      }
    case 'ROUTE_COMPLETED':
      return {
        testId: 'timeline-row-ROUTE_COMPLETED',
        label: DELIVERY_ROUTE_COPY.timeline.routeCompleted,
        actorName: event.actor?.name ?? null,
      }
    case 'ROUTE_CANCELLED':
      return {
        testId: 'timeline-row-ROUTE_CANCELLED',
        label: DELIVERY_ROUTE_COPY.timeline.routeCancelled,
        actorName: event.actor?.name ?? null,
      }
  }
}

const rows = computed<TimelineRowViewModel[]>(() =>
  props.route.timeline.map((event) => buildRow(event)),
)
</script>

<template>
  <section
    data-testid="delivery-route-timeline"
    class="flex flex-col gap-2"
    aria-label="Historial de la ruta"
  >
    <h3 class="text-sm font-medium">Historial</h3>

    <ol
      v-if="rows.length > 0"
      class="flex flex-col gap-3 border-l border-default pl-4"
      data-testid="delivery-route-timeline-list"
    >
      <li
        v-for="(row, index) in rows"
        :key="`${row.testId}-${index}`"
        :data-testid="row.testId"
        class="relative flex flex-col gap-0.5"
      >
        <span class="absolute -left-[1.4rem] top-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        <span class="text-sm font-medium">{{ row.label }}</span>
        <span
          v-if="row.stopPosition"
          class="text-xs text-muted"
          data-testid="timeline-row-stop-position"
        >
          {{ row.stopPosition }}
        </span>
        <span
          v-if="row.actorName"
          class="text-xs text-muted"
          data-testid="timeline-row-actor"
        >
          {{ row.actorName }}
        </span>
      </li>
    </ol>

    <p
      v-else
      class="text-sm text-muted"
      data-testid="delivery-route-timeline-empty"
    >
      Sin eventos registrados
    </p>
  </section>
</template>
