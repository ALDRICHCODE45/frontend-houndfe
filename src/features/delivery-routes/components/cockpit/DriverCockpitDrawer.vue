<script lang="ts">
/**
 * driverCockpitDrawerAdapter — S9 of `driver-route-cockpit-redesign`
 * (REQ-DCK-001). Pure helper translating one native
 * `animationEnd(open: boolean)` from Nuxt UI v4 UDrawer into the drawer's
 * custom `closed` synthesis contract: animationEnd(true) only marks opening
 * settled (`mapReady=true`); animationEnd(false) emits `closed` exactly once
 * per close (mapReady does not reset — drawer is already hidden).
 *
 * Co-located inside the SFC (alongside <script setup>) and exported as named
 * bindings so the spec can import `adaptDrawerAnimationEnd` directly; the
 * SFC consumes it locally without an import (same module scope).
 */

export interface DrawerAnimationAdapterInput {
  openAfter: boolean
  previousMapReady: boolean
  previousClosedEmitted: boolean
}

export interface DrawerAnimationAdapterOutput {
  mapReady: boolean
  emitClosed: boolean
}

export function adaptDrawerAnimationEnd(
  input: DrawerAnimationAdapterInput,
): DrawerAnimationAdapterOutput {
  if (input.openAfter) return { mapReady: true, emitClosed: false }
  return { mapReady: input.previousMapReady, emitClosed: !input.previousClosedEmitted }
}
</script>

<script setup lang="ts">
/**
 * DriverCockpitDrawer — S9 of `driver-route-cockpit-redesign` (design.md §3, §7;
 *  specs/driver-cockpit-drawer REQ-DCK-001/002/004/006/007/008;
 *  specs/delivery-route-check-in REQ-DRC-105).
 *
 * Exactly one Nuxt UI v4 UDrawer (portal modal) — stop mode mounts
 * DriverStopPanel; history mode mounts DeliveryRouteTimeline DIRECTLY (no
 * wrapper SFC, no modification). Custom `closed` event synthesized ONLY from
 * native animationEnd(false); native close / update:open(false) begin closure
 * but never complete it; animationEnd(true) marks opening settled
 * (mapReady=true) and never emits closed. Sticky central-copy header >=44px
 * close + 85dvh scrollable body. Reduced-motion override reaches the actual
 * UDrawer overlay + content slots via the `ui` prop so vaul-vue's
 * DrawerOverlay / DrawerContent honor it (not just our inner header).
 *
 * Typed props: { open; mode: 'stop'|'history'; route; stop; routeTerminal;
 *   canCheckIn; checkInPending }.
 * Typed emits: 'update:open':[boolean] / 'closed':[] /
 *   'request-confirm':[StopTrigger].
 * B3 REFACTOR: mode → content mapping (`modeContent`) drives a single
 * dynamic `<component :is>` render instead of v-if/v-else-if branches.
 *
 * Source invariants (REQ-DCK-001/008; design section 6): NEVER imports
 * vue-router, useQuery, useMutation, useQueryClient, useCheckInStop, axios, or
 * fetch(. The drawer is fully controlled by `open`; the parent owns the
 * close -> animationEnd(false) -> reopen orchestration for mode switches.
 */
import { computed, ref, watch, type Component } from 'vue'
import DriverStopPanel from './DriverStopPanel.vue'
import DeliveryRouteTimeline from '../DeliveryRouteTimeline.vue'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStop,
} from '../../interfaces/delivery-route.types'
import type {
  DrawerMode,
  StopTrigger,
} from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

// ─── Props / emits ──────────────────────────────────────────────────────────────
const props = defineProps<{
  open: boolean
  mode: DrawerMode
  route: DeliveryRouteResponseDto
  stop: DeliveryRouteStop | null
  routeTerminal: boolean
  canCheckIn: boolean
  checkInPending: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  closed: []
  'request-confirm': [payload: StopTrigger]
}>()

// ─── Local UI state (mapReady + closed-synthesis guard) ─────────────────────────
const mapReady = ref(false)
const closingAnnounced = ref(false)
// Template ref to the inner UDrawer — accessed by integration tests via
// `wrapper.vm.drawerRef.$emit(...)` to drive the native event sequence.
const drawerRef = ref<unknown>(null)

watch(() => props.open, (next) => {
  if (next) { mapReady.value = false ; closingAnnounced.value = false }
}, { immediate: true })

// ─── Derived title (central copy, REQ-DCK-002) ───────────────────────────────────
const title = computed<string>(() => {
  if (props.mode === 'history') return DELIVERY_ROUTE_COPY.cockpit.drawer.historyTitle
  const s = props.stop
  const position = (s?.sortOrder ?? 0) + 1
  const customer = s?.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback
  return DELIVERY_ROUTE_COPY.cockpit.drawer.stopTitle
    .replace('{N}', String(position))
    .replace('{customer}', customer)
})

// ─── Typed mode → content mapping (B3 REFACTOR; REQ-DRC-105) ─────────────────────
// One mapping drives a single dynamic <component :is> render. History still
// directly uses DeliveryRouteTimeline; stop uses DriverStopPanel; no wrapper SFC.
interface StopModeContentProps { stop: DeliveryRouteStop; routeTerminal: boolean; canCheckIn: boolean; checkInPending: boolean; mapReady: boolean }
interface HistoryModeContentProps { route: DeliveryRouteResponseDto }
type ModeContent =
  | { component: typeof DriverStopPanel; props: StopModeContentProps }
  | { component: typeof DeliveryRouteTimeline; props: HistoryModeContentProps }
  | null

const modeContent = computed<ModeContent>(() => {
  if (props.mode === 'history') return { component: DeliveryRouteTimeline, props: { route: props.route } }
  if (props.mode === 'stop' && props.stop) return {
    component: DriverStopPanel,
    props: { stop: props.stop, routeTerminal: props.routeTerminal, canCheckIn: props.canCheckIn, checkInPending: props.checkInPending, mapReady: mapReady.value },
  }
  return null
})

// ─── B3: motion-reduce override on actual UDrawer overlay + content slots ───────
// vaul-vue's DrawerOverlay + DrawerContent animate via CSS; the override must
// reach them via UDrawer's `ui` prop (NOT just our inner header/body).
const drawerUi = {
  content: 'motion-reduce:transition-none motion-reduce:duration-0',
  overlay: 'motion-reduce:transition-none motion-reduce:duration-0',
}

// ─── Native-event handlers ──────────────────────────────────────────────────────
function onUpdateOpen(value: boolean) {
  if (value === false) emit('update:open', false)
}
function onClose() { emit('update:open', false) }
function onRelease(openAfter: boolean) {
  if (openAfter === false) emit('update:open', false)
}
function onAnimationEnd(openAfter: boolean) {
  const result = adaptDrawerAnimationEnd({
    openAfter,
    previousMapReady: mapReady.value,
    previousClosedEmitted: closingAnnounced.value,
  })
  mapReady.value = result.mapReady
  if (result.emitClosed) {
    closingAnnounced.value = true
    emit('closed')
  }
}
function onPanelClose() { emit('update:open', false) }
function onModeContentClose() { emit('update:open', false) }
function onModeContentRequestConfirm(payload: StopTrigger) { emit('request-confirm', payload) }
</script>

<template>
  <UDrawer
    ref="drawerRef"
    :open="open"
    :title="title"
    direction="bottom"
    :dismissible="true"
    :modal="true"
    :portal="true"
    :handle="false"
    :overlay="true"
    :ui="drawerUi"
    data-testid="driver-cockpit-drawer-root"
    @update:open="onUpdateOpen"
    @close="onClose"
    @release="onRelease"
    @drag="() => { /* drag completion is handled by vaul via update:open / release */ }"
    @animationEnd="onAnimationEnd"
  >
    <template #header>
      <header
        data-testid="driver-cockpit-drawer-header"
        class="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default bg-default px-4 py-3 min-w-0 motion-reduce:transition-none"
      >
        <span
          class="flex min-w-0 flex-1 items-center justify-center text-center text-base font-medium text-default"
          data-testid="driver-cockpit-drawer-title"
        >{{ title }}</span>
        <button
          type="button"
          data-testid="driver-cockpit-drawer-close"
          :aria-label="DELIVERY_ROUTE_COPY.cockpit.drawer.close"
          class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          @click="onPanelClose"
        >
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </header>
    </template>
    <template #body>
      <div
        data-testid="driver-cockpit-drawer-body"
        class="max-h-[85dvh] overflow-y-auto motion-reduce:transition-none"
      >
        <component
          :is="modeContent.component as Component"
          v-if="modeContent"
          v-bind="modeContent.props"
          @close="onModeContentClose"
          @request-confirm="onModeContentRequestConfirm"
        />
      </div>
    </template>
  </UDrawer>
</template>
