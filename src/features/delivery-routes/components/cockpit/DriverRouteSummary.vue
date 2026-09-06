<script setup lang="ts">
/**
 * DriverRouteSummary — truthful route summary of the driver cockpit route-page
 * evolution. Presentational only: props { progress, counts }, no emits, no
 * server state / router / query / mutation / HTTP.
 *
 * Owns:
 *   - Accessible delivered progress: role="progressbar" with aria-valuemin /
 *     aria-valuemax / aria-valuenow and an aria-label interpolated from
 *     copy.ts ("{completed} de {total} paradas entregadas"). The visual fill
 *     width is the delivered percentage (reduced-motion safe).
 *   - Truthful stop counts from existing data ONLY: Entregadas (delivered),
 *     Pendientes (pending + in progress = still actionable), Total, and
 *     Omitidas surfaced only when skipped > 0. No package counts, ETA,
 *     duration, distance, or "updated now" — none of that exists in the DTO.
 *   - Zero-stop edge: NO progressbar (aria-valuemax=0 is invalid ARIA); a
 *     dedicated empty line renders instead.
 *
 * All user-visible literals bind from copy.ts.
 */
import { computed } from 'vue'
import type { CockpitProgress, CockpitStopCounts } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

const props = defineProps<{
  progress: CockpitProgress
  counts: CockpitStopCounts
}>()

const hasStops = computed<boolean>(() => props.counts.total > 0)
const progressAriaLabel = computed<string>(() =>
  DELIVERY_ROUTE_COPY.cockpit.summary.progressAriaLabel
    .replace('{completed}', String(props.progress.completed))
    .replace('{total}', String(props.progress.total)),
)
const fillPercent = computed<string>(() => {
  if (props.counts.total === 0) return '0%'
  const pct = Math.round((props.progress.completed / props.counts.total) * 100)
  return `${Math.min(100, Math.max(0, pct))}%`
})
const actionablePending = computed<number>(() => props.counts.pending + props.counts.inProgress)
const showSkipped = computed<boolean>(() => props.counts.skipped > 0)
</script>

<template>
  <section
    data-testid="driver-route-summary"
    class="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-default bg-default p-3 max-sm:p-2.5"
  >
    <template v-if="hasStops">
      <div
        role="progressbar"
        data-testid="driver-route-summary-progress"
        :aria-valuenow="props.progress.completed"
        aria-valuemin="0"
        :aria-valuemax="props.counts.total"
        :aria-label="progressAriaLabel"
        class="h-2 w-full overflow-hidden rounded-full bg-elevated"
      >
        <div
          data-testid="driver-route-summary-progress-fill"
          class="h-full rounded-full bg-coco-gold-500 transition-[width] motion-reduce:transition-none"
          :style="{ width: fillPercent }"
        />
      </div>
      <dl
        data-testid="driver-route-summary-counts"
        class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
      >
        <div class="flex items-baseline gap-1.5">
          <dt>{{ DELIVERY_ROUTE_COPY.cockpit.summary.deliveredLabel }}</dt>
          <dd class="font-mono font-medium text-default">{{ props.counts.delivered }}</dd>
        </div>
        <div class="flex items-baseline gap-1.5">
          <dt>{{ DELIVERY_ROUTE_COPY.cockpit.summary.pendingLabel }}</dt>
          <dd class="font-mono font-medium text-default">{{ actionablePending }}</dd>
        </div>
        <div v-if="showSkipped" class="flex items-baseline gap-1.5">
          <dt>{{ DELIVERY_ROUTE_COPY.cockpit.summary.skippedLabel }}</dt>
          <dd class="font-mono font-medium text-default">{{ props.counts.skipped }}</dd>
        </div>
        <div class="flex items-baseline gap-1.5">
          <dt>{{ DELIVERY_ROUTE_COPY.cockpit.summary.totalLabel }}</dt>
          <dd class="font-mono font-medium text-default">{{ props.counts.total }}</dd>
        </div>
      </dl>
    </template>
    <p v-else data-testid="driver-route-summary-empty" class="text-sm text-muted">
      {{ DELIVERY_ROUTE_COPY.cockpit.summary.emptyLabel }}
    </p>
  </section>
</template>
