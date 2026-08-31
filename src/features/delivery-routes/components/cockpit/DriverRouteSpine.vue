<script setup lang="ts">
/**
 * DriverRouteSpine — S6 of `driver-route-cockpit-redesign` (REQ-DCS-005,
 * REQ-DRC-111 spine a11y). Mobile-first accessible ordered sequence. Strict
 * no-re-sort: input `nodes` are rendered in input order verbatim. No server
 * state, router, query, mutation, HTTP. Typed props { nodes }, typed emit
 * 'select-stop' [StopTrigger]. B2: every user-visible literal (root aria,
 * per-node aria template, visible "Parada N") is bound from `copy.ts`.
 */
import { computed } from 'vue'
import { DELIVERY_ROUTE_STOP_STATUS_LABELS } from '../../interfaces/delivery-route.types'
import type { CockpitSpineNode, StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

defineProps<{ nodes: readonly CockpitSpineNode[] }>()
const emit = defineEmits<{ 'select-stop': [payload: StopTrigger] }>()

const emptySpineCopy = computed<string>(() => DELIVERY_ROUTE_COPY.cockpit.operational.emptySpine)
const customerFallback = computed<string>(() => DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
const rootAriaLabel = computed<string>(() => DELIVERY_ROUTE_COPY.cockpit.spine.rootAriaLabel)

function statusLabel(s: CockpitSpineNode['stop']['status']): string {
  return DELIVERY_ROUTE_STOP_STATUS_LABELS[s]
}
function customerName(node: CockpitSpineNode): string {
  return node.stop.customer?.name ?? customerFallback.value
}
function positionLabel(sortOrder: number): string {
  return DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel.replace('{N}', String(sortOrder + 1))
}
function nodeAriaLabel(node: CockpitSpineNode): string {
  return DELIVERY_ROUTE_COPY.cockpit.spine.nodeAriaLabel
    .replace('{N}', String(node.stop.sortOrder + 1))
    .replace('{status}', statusLabel(node.stop.status))
    .replace('{customer}', customerName(node))
}
function onSelect(node: CockpitSpineNode, event: MouseEvent): void {
  // Native <button> collapses Enter/Space into a single click activation.
  emit('select-stop', { stopId: node.stop.id, trigger: event.currentTarget as HTMLElement })
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
    class="flex flex-col gap-0 border-l border-default pl-0 min-w-0"
  >
    <li v-for="(node, index) in nodes" :key="node.stop.id" class="relative pl-6 max-sm:pl-5 py-1">
      <span
        v-if="index < nodes.length - 1"
        data-testid="cockpit-spine-connector"
        aria-hidden="true"
        class="absolute left-0 top-5 -ml-[3px] h-2 w-2 rounded-full bg-primary"
      />
      <button
        type="button"
        :data-testid="`cockpit-spine-node-${node.stop.id}`"
        :data-stop-id="node.stop.id"
        :aria-label="nodeAriaLabel(node)"
        :class="[
          'flex w-full items-center gap-2 max-sm:gap-1.5 rounded-md border bg-default px-3 max-sm:px-2.5 py-2 text-left min-h-11 min-w-11',
          node.isCurrent ? 'border-primary border-l-4' : 'border-default',
          'hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        ]"
        @click="onSelect(node, $event)"
      >
        <span
          v-if="node.isCurrent"
          data-testid="cockpit-spine-current-marker"
          aria-hidden="true"
          class="inline-flex h-5 w-5 max-sm:h-4 max-sm:w-4 flex-none items-center justify-center rounded-full bg-primary text-xs text-primary-contrast"
        >→</span>
        <span class="flex-none font-mono text-xs max-sm:text-[11px] text-muted" data-testid="cockpit-spine-position">{{ positionLabel(node.stop.sortOrder) }}</span>
        <span class="min-w-0 flex-1 truncate text-sm text-default" data-testid="cockpit-spine-customer">{{ customerName(node) }}</span>
        <span class="flex-none text-xs max-sm:text-[11px] text-muted" data-testid="cockpit-spine-status-label">{{ statusLabel(node.stop.status) }}</span>
      </button>
    </li>
  </ol>
</template>
