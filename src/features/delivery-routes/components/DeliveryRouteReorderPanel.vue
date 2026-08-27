<script setup lang="ts">
/**
 * DeliveryRouteReorderPanel — S5a (sdd delivery-routes, design.md §4.1, §10.2, REQ-DRM-009).
 *
 * Drag-and-drop reorder panel for a DRAFT route's stops. One panel = one route.
 *
 * Contract:
 *   - Renders the DRAFT route's stops sorted by `sortOrder` ASC.
 *   - Hidden entirely when `status !== 'DRAFT'` (DRM-009/010 gating).
 *   - Drag-and-drop uses `vuedraggable@4` over the already-installed `sortablejs`.
 *     Drag mutates a LOCAL ordered copy (`orderedStops`) — never the prop directly.
 *   - Each row also exposes ↑/↓ buttons that swap adjacent stops in the SAME
 *     local ordered copy (accessibility/touch fallback).
 *   - Explicit "Guardar orden" button (NEVER drag-end autosave) builds
 *     `orderedStopIds = orderedStops.map(s => s.id)` and calls
 *     `useReorderStops().mutateAsync({ id, payload })`.
 *   - Before sending, runs `assertReorderCoversStops(orderedStopIds, existingStopIds)`;
 *     on a non-null guard message, the request is BLOCKED and the message renders
 *     inline above the save button.
 *
 * The component is intentionally small (composition surface + a single draggable +
 * per-row controls). The DnD library is wrapped behind `<draggable>` (real
 * `vuedraggable` import) so swapping the library is one seam.
 */
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { useReorderStops } from '../composables/useReorderStops'
import {
  assertReorderCoversStops,
} from '../utils/delivery-route-actions.utils'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStop,
  DeliveryRouteStatus,
} from '../interfaces/delivery-route.types'

const props = defineProps<{
  /** The route the panel renders. Stops are sourced from `route.stops` sorted by `sortOrder` ASC. */
  route: DeliveryRouteResponseDto
}>()

// ─── Local ordered copy ────────────────────────────────────────────────────
// The draggable + the ↑/↓ buttons both mutate THIS ref; the parent prop is
// never mutated directly. Reset whenever the route id changes (covers the
// common case where the manager opens a different route in the same panel slot).
const orderedStops = ref<DeliveryRouteStop[]>([])

// ─── Inline guard error ─────────────────────────────────────────────────────
const reorderError = ref<string>('')

function sortedStops(stops: readonly DeliveryRouteStop[]): DeliveryRouteStop[] {
  return [...stops].sort((a, b) => a.sortOrder - b.sortOrder)
}

watch(
  () => [props.route.id, props.route.stops] as const,
  ([_id, stops]) => {
    orderedStops.value = sortedStops(stops)
    reorderError.value = ''
  },
  { immediate: true },
)

// ─── Status gating ──────────────────────────────────────────────────────────
const isDraft = computed<boolean>(() => props.route.status === ('DRAFT' as DeliveryRouteStatus))

// ─── Reorder mutation ───────────────────────────────────────────────────────
const { mutateAsync: reorderStops, isPending } = useReorderStops()

async function onSave() {
  reorderError.value = ''
  const orderedStopIds = orderedStops.value.map((stop) => stop.id)
  const existingStopIds = props.route.stops.map((stop) => stop.id)
  const guardMessage = assertReorderCoversStops(orderedStopIds, existingStopIds)
  if (guardMessage !== null) {
    reorderError.value = guardMessage
    return
  }
  try {
    await reorderStops({ id: props.route.id, payload: { orderedStopIds } })
    // Success path: toast + invalidation fire from the composable's onSuccess.
  } catch {
    // Error already surfaced via the composable's onError toast; the inline
    // guard message stays cleared (the panel did not cause the failure).
  }
}

// ─── Per-row ↑/↓ fallback handlers ──────────────────────────────────────────
//
// Both ↑/↓ mutate the SAME local ordered copy that vuedraggable mutates on drag.
// That guarantees the spec assertion "DnD + ↑/↓ converge to the same ordered
// array" holds at the implementation level (one shared ref).

function moveStopByIndex(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= orderedStops.value.length) return
  const next = [...orderedStops.value]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(target, 0, moved)
  orderedStops.value = next
}

function moveUp(index: number) {
  moveStopByIndex(index, -1)
}

function moveDown(index: number) {
  moveStopByIndex(index, 1)
}

// ─── Drag handler ──────────────────────────────────────────────────────────
// vuedraggable mutates the v-model directly (it's the documented contract);
// we don't need a separate handler. The "save" path is the only one that fires
// the mutation — drag-end NEVER autosaves (REQ-DRM-009).

function onDragChange(_evt: unknown) {
  // Intentional no-op: the v-model mutation already happened in-place.
  // We deliberately do NOT call the mutation here — the save button owns it.
}

// ─── Test-only handle (used by co-located strict-TDD spec) ─────────────────
// Mirrors the slideover's `__test` pattern: exposes the same `orderedStops` ref
// the draggable writes to, so the spec can drive the same path vuedraggable
// takes without reaching into Sortable.js in jsdom. Production code MUST NOT
// consume this handle — it lives behind a `__test` prefix.
defineExpose({
  __testOrderedStopIds: {
    get value(): string[] {
      return orderedStops.value.map((stop) => stop.id)
    },
    set value(next: string[]) {
      // Drive the local ordered copy from a flat id list — the spec uses this
      // to simulate the draggable's in-place mutation. We resolve each id to
      // its stop object by looking up the current `route.stops` (so unknown
      // ids surface the same way they would via the real draggable).
      const byId = new Map(props.route.stops.map((stop) => [stop.id, stop]))
      orderedStops.value = next
        .map((id) => byId.get(id))
        .filter((stop): stop is DeliveryRouteStop => stop !== undefined)
    },
  },
})

// ─── Template helpers ───────────────────────────────────────────────────────
function folioFor(stop: DeliveryRouteStop): string {
  return stop.saleFolio ?? stop.id.slice(0, 8)
}

function customerName(stop: DeliveryRouteStop): string {
  return stop.customer?.name ?? 'Cliente sin nombre'
}
</script>

<template>
  <!--
    Non-DRAFT gating (DRM-009/010): the panel renders nothing when the route
    isn't a DRAFT. We render a placeholder marker so the spec can assert
    "hidden entirely" without scraping the DOM for absence of children.
  -->
  <div
    v-if="!isDraft"
    data-testid="delivery-route-reorder-panel-hidden"
    aria-hidden="true"
  />

  <section
    v-else
    data-testid="delivery-route-reorder-panel"
    class="flex flex-col gap-3"
  >
    <header class="flex items-center justify-between">
      <h3 class="text-sm font-medium">Reordenar paradas</h3>
      <span class="text-xs text-muted">{{ orderedStops.length }} paradas</span>
    </header>

    <draggable
      v-model="orderedStops"
      :item-key="(stop: DeliveryRouteStop) => stop.id"
      tag="ul"
      handle=".delivery-route-reorder-handle"
      ghost-class="opacity-50"
      chosen-class="ring-2 ring-primary"
      class="flex flex-col gap-2"
      data-testid="delivery-route-reorder-list"
      @change="onDragChange"
    >
      <template #item="{ element: stop, index: i }">
        <li
          :data-testid="`reorder-row-${stop.id}`"
          :data-index="i"
          class="flex items-center gap-3 rounded-md border border-default bg-default px-3 py-2"
        >
          <span
            class="delivery-route-reorder-handle cursor-grab text-muted"
            data-testid="reorder-handle"
            aria-hidden="true"
          >
            ⋮⋮
          </span>
          <span class="flex-1 truncate text-sm">
            <span class="font-medium">{{ folioFor(stop) }}</span>
            <span class="ml-2 text-muted">{{ customerName(stop) }}</span>
          </span>
          <div class="flex items-center gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-up"
              :disabled="i === 0"
              :data-testid="`reorder-up-${stop.id}`"
              aria-label="Mover arriba"
              @click="moveUp(i)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-down"
              :disabled="i === orderedStops.length - 1"
              :data-testid="`reorder-down-${stop.id}`"
              aria-label="Mover abajo"
              @click="moveDown(i)"
            />
          </div>
        </li>
      </template>
    </draggable>

    <p
      v-if="reorderError"
      data-testid="reorder-guard-error"
      class="text-xs text-error"
      role="alert"
    >
      {{ reorderError }}
    </p>

    <div class="flex justify-end">
      <UButton
        label="Guardar orden"
        color="primary"
        :loading="isPending"
        data-testid="reorder-save-button"
        @click="onSave"
      />
    </div>
  </section>
</template>
