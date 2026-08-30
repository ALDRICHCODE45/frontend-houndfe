<script lang="ts">
/**
 * driverCockpitAdapters — S9 + S2 (REQ-DCK-001/009). Pure helpers translating
 * each container's settled native lifecycle into the drawer's custom `closed`
 * synthesis contract. `update:open(false)` (intent-to-close) is NEVER accepted
 * by either adapter — both react ONLY to settled lifecycle events.
 *
 *  - `adaptDrawerAnimationEnd` (S9): UDrawer `animationEnd(open)`.
 *      true  → mapReady=true; never emits closed.
 *      false → emits closed exactly once per settled close; mapReady stays.
 *
 *  - `adaptSlideoverLifecycle` (S2): USlideover colon-named `@after:enter` /
 *      `@after:leave` (reka-ui DialogContent).
 *      'enter' → mapReady=true; never emits closed.
 *      'leave' → emits closed exactly once per settled close; mapReady stays.
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

export function adaptDrawerAnimationEnd(input: DrawerAnimationAdapterInput): DrawerAnimationAdapterOutput {
  if (input.openAfter) return { mapReady: true, emitClosed: false }
  return { mapReady: input.previousMapReady, emitClosed: !input.previousClosedEmitted }
}

export interface SlideoverLifecycleAdapterInput {
  phase: 'enter' | 'leave'
  previousMapReady: boolean
  previousClosedEmitted: boolean
}

export interface SlideoverLifecycleAdapterOutput {
  mapReady: boolean
  emitClosed: boolean
}

export function adaptSlideoverLifecycle(input: SlideoverLifecycleAdapterInput): SlideoverLifecycleAdapterOutput {
  if (input.phase === 'enter') return { mapReady: true, emitClosed: false }
  return { mapReady: input.previousMapReady, emitClosed: !input.previousClosedEmitted }
}
</script>

<script setup lang="ts">
/**
 * DriverCockpitDrawer — S9 + S2 (REQ-DCK-001/002/004/006/007/008/009; REQ-DRC-105).
 *
 * Viewport-adaptive cockpit overlay: exactly one Nuxt UI container mounted at a
 * time. On lg+ (Tailwind 1024px, aligned with the app shell) the active
 * surface is `USlideover side="right" inset` (slideover `#footer` slot owns the gated
 * `Marcar entregada` per REQ-DCK-002/003, REQ-DCS-006) or, below lg, `UDrawer direction="bottom"`
 * (body-only — page footer owns the mobile action). Container selection reads the REQUIRED
 * `isDesktop: boolean` prop owned by DriverRouteCockpit (single caller of
 * `useCockpitBreakpoint`); this SFC MUST NOT import the composable and MUST NOT provide an
 * optional fallback.
 *
 * `closed` is synthesized ONLY from each container's settled native lifecycle
 * (UDrawer `animationEnd(false)` / USlideover `@after:leave`). Intent-to-close
 * (`update:open(false)`) begins closure but never completes it. Opening
 * signals (`animationEnd(true)` / `@after:enter`) mark opening settled and
 * never emit closed.
 *
 * Breakpoint swap (REQ-DCK-009): the parent owns `open` / `mode` / selected
 * stop. Crossing 1024px while open unmounts the previous container WITHOUT
 * emitting closed and resets `mapReady`. If a close transition is in flight
 * (open=false but `closingAnnounced` not yet true) when the breakpoint flips,
 * the active surface is FROZEN until its settled close fires; the latest
 * breakpoint is then adopted before any reducer-driven reopen.
 *
 * Source invariants: NEVER imports vue-router, useQuery, useMutation,
 * useQueryClient, useCheckInStop, axios, fetch(, @vueuse/core, or
 * useCockpitBreakpoint. The drawer is fully controlled by `open`.
 */
import { computed, ref, watch, type Component } from 'vue'
import DriverStopPanel from './DriverStopPanel.vue'
import DeliveryRouteTimeline from '../DeliveryRouteTimeline.vue'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import type { DrawerMode, StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../copy'

const props = defineProps<{
  open: boolean
  mode: DrawerMode
  route: DeliveryRouteResponseDto
  stop: DeliveryRouteStop | null
  routeTerminal: boolean
  canCheckIn: boolean
  checkInPending: boolean
  isDesktop: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  closed: []
  'request-confirm': [payload: StopTrigger]
}>()

// Surface state: `surface` = desired branch; `pendingSurface` = deferred swap mid-close;
// `activeSurface` = what's mounted (null while settled-closed).
type Surface = 'drawer' | 'slideover'
const surface = ref<Surface>(props.isDesktop ? 'slideover' : 'drawer')
const pendingSurface = ref<Surface | null>(null)
const activeSurface = ref<Surface | null>(props.open ? surface.value : null)

// Local UI state + per-surface template refs for integration tests.
const mapReady = ref(false)
const closingAnnounced = ref(false)
const drawerRef = ref<unknown>(null)
const slideoverRef = ref<unknown>(null)

// Breakpoint swap (REQ-DCK-009): mount new surface immediately only while open=true;
// queue a deferred swap when a close is in flight; resolved on the next reducer reopen.
watch(() => props.isDesktop, (next) => {
  const target: Surface = next ? 'slideover' : 'drawer'
  surface.value = target
  if (props.open) {
    activeSurface.value = target ; mapReady.value = false ; pendingSurface.value = null
  } else if (!closingAnnounced.value) {
    pendingSurface.value = target
  }
})
watch(() => props.open, (next) => {
  if (next) {
    mapReady.value = false ; closingAnnounced.value = false
    activeSurface.value = surface.value ; pendingSurface.value = null
  }
}, { immediate: true })
watch(closingAnnounced, (announced) => {
  if (announced && !props.open) activeSurface.value = null
})

const title = computed<string>(() => {
  if (props.mode === 'history') return DELIVERY_ROUTE_COPY.cockpit.drawer.historyTitle
  const s = props.stop
  const position = (s?.sortOrder ?? 0) + 1
  const customer = s?.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback
  return DELIVERY_ROUTE_COPY.cockpit.drawer.stopTitle
    .replace('{N}', String(position))
    .replace('{customer}', customer)
})

const secondaryActionVisible = computed(() => props.mode === 'stop' && props.stop?.status === 'PENDING' && !props.routeTerminal && props.canCheckIn)
const overlayFooterActionAriaLabel = computed(() => `${props.stop?.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback} — ${DELIVERY_ROUTE_COPY.actions.checkIn}`)
function onOverlayFooterAction(event: MouseEvent) { if (props.checkInPending || !props.stop) return ; emit('request-confirm', { stopId: props.stop.id, trigger: event.currentTarget as HTMLElement }) }

// Typed mode → content mapping (REQ-DRC-105): one `<component :is>` render, no wrapper SFC.
interface StopModeContentProps { stop: DeliveryRouteStop; mapReady: boolean }
interface HistoryModeContentProps { route: DeliveryRouteResponseDto }
type ModeContent =
  | { component: typeof DriverStopPanel; props: StopModeContentProps }
  | { component: typeof DeliveryRouteTimeline; props: HistoryModeContentProps }
  | null

const modeContent = computed<ModeContent>(() => {
  if (props.mode === 'history') return { component: DeliveryRouteTimeline, props: { route: props.route } }
  if (props.mode === 'stop' && props.stop) return {
    component: DriverStopPanel,
    props: { stop: props.stop, mapReady: mapReady.value },
  }
  return null
})

// Motion-reduce override on each container's overlay + content slots (via `ui` prop).
const drawerUi = {
  content: 'motion-reduce:transition-none motion-reduce:duration-0',
  overlay: 'motion-reduce:transition-none motion-reduce:duration-0',
}
const slideoverUi = {
  content: 'motion-reduce:transition-none motion-reduce:duration-0',
  overlay: 'motion-reduce:transition-none motion-reduce:duration-0',
}

// Native-event handlers. Drawer (UDrawer) adapter unchanged from S9; slideover is new in S2.
function onDrawerUpdateOpen(value: boolean) {
  if (value === false) emit('update:open', false)
}
function onDrawerClose() { emit('update:open', false) }
function onDrawerRelease(openAfter: boolean) {
  if (openAfter === false) emit('update:open', false)
}
function onDrawerAnimationEnd(openAfter: boolean) {
  const result = adaptDrawerAnimationEnd({ openAfter, previousMapReady: mapReady.value, previousClosedEmitted: closingAnnounced.value })
  mapReady.value = result.mapReady
  if (result.emitClosed) { closingAnnounced.value = true ; emit('closed') }
}
// Slideover (USlideover) — colon-named `@after:enter` / `@after:leave` (reka-ui DialogContent).
function onSlideoverUpdateOpen(value: boolean) {
  if (value === false) emit('update:open', false)
}
function onSlideoverAfterEnter() {
  mapReady.value = adaptSlideoverLifecycle({ phase: 'enter', previousMapReady: mapReady.value, previousClosedEmitted: closingAnnounced.value }).mapReady
}
function onSlideoverAfterLeave() {
  const result = adaptSlideoverLifecycle({ phase: 'leave', previousMapReady: mapReady.value, previousClosedEmitted: closingAnnounced.value })
  mapReady.value = result.mapReady
  if (result.emitClosed) { closingAnnounced.value = true ; emit('closed') }
}

// Panel-internal close actions (S3 panel no longer emits; close-only path lives in the overlay's header button).
function onPanelClose() { emit('update:open', false) }
function onModeContentClose() { emit('update:open', false) }
</script>

<template>
  <!-- One active surface at a time (REQ-DCK-001/009). `activeSurface === null`
       means settled-closed; the next reducer-driven reopen mounts the desired surface. -->
  <UDrawer
    v-if="activeSurface === 'drawer'"
    ref="drawerRef"
    :open="open" :title="title" direction="bottom"
    :dismissible="true" :modal="true" :portal="true"
    :handle="false" :overlay="true" :ui="drawerUi"
    data-testid="driver-cockpit-drawer-root"
    @update:open="onDrawerUpdateOpen" @close="onDrawerClose"
    @release="onDrawerRelease" @drag="() => {}"
    @animationEnd="onDrawerAnimationEnd"
  >
    <template #header>
      <header data-testid="driver-cockpit-drawer-header" class="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default bg-default px-4 py-3 min-w-0 motion-reduce:transition-none">
        <span class="flex min-w-0 flex-1 items-center justify-center text-center text-base font-medium text-default" data-testid="driver-cockpit-drawer-title">{{ title }}</span>
        <button type="button" data-testid="driver-cockpit-drawer-close" :aria-label="DELIVERY_ROUTE_COPY.cockpit.drawer.close" class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" @click="onPanelClose">
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </header>
    </template>
    <template #body>
      <div data-testid="driver-cockpit-drawer-body" class="max-h-[85dvh] overflow-y-auto motion-reduce:transition-none">
        <component :is="modeContent.component as Component" v-if="modeContent" v-bind="modeContent.props" @close="onModeContentClose" />
      </div>
    </template>
  </UDrawer>
  <USlideover
    v-else-if="activeSurface === 'slideover'"
    ref="slideoverRef"
    :open="open" :title="title" side="right" inset
    :dismissible="true" :modal="true" :portal="true" :ui="slideoverUi"
    data-testid="driver-cockpit-slideover-root"
    @update:open="onSlideoverUpdateOpen"
    @after:enter="onSlideoverAfterEnter" @after:leave="onSlideoverAfterLeave"
  >
    <template #header>
      <header data-testid="driver-cockpit-slideover-header" class="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default bg-default px-4 py-3 min-w-0 motion-reduce:transition-none">
        <span class="flex min-w-0 flex-1 items-center justify-center text-center text-base font-medium text-default" data-testid="driver-cockpit-slideover-title">{{ title }}</span>
        <button type="button" data-testid="driver-cockpit-slideover-close" :aria-label="DELIVERY_ROUTE_COPY.cockpit.drawer.close" class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" @click="onPanelClose">
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </header>
    </template>
    <template #body>
      <div data-testid="driver-cockpit-slideover-body" class="flex-1 overflow-y-auto motion-reduce:transition-none">
        <component :is="modeContent.component as Component" v-if="modeContent" v-bind="modeContent.props" @close="onModeContentClose" />
      </div>
    </template>
    <template #footer>
      <div v-if="secondaryActionVisible" data-testid="driver-cockpit-slideover-footer" class="border-t border-default bg-default p-4 motion-reduce:transition-none">
        <button type="button" data-testid="overlay-footer-action" :aria-label="overlayFooterActionAriaLabel" :disabled="props.checkInPending" class="mx-auto inline-flex min-h-11 min-w-11 w-full items-center justify-center gap-2 rounded-md bg-coco-gold-500 px-6 py-3 text-sm font-semibold text-coco-neutral-950 shadow-sm transition hover:bg-coco-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-coco-gold-500/60" @click="onOverlayFooterAction">
          <UIcon name="i-lucide-check" class="size-5" aria-hidden="true" />{{ DELIVERY_ROUTE_COPY.actions.checkIn }}
        </button>
      </div>
    </template>
  </USlideover>
</template>
