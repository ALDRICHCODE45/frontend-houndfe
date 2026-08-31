<script lang="ts">
/**
 * driverCockpitReducer — S10 (design §3, §7, §9.3, §10; REQ-DCS-001/009, REQ-DCK-006/008, REQ-DRC-104/112).
 * Co-located inside the SFC as a normal `<script lang="ts">` block alongside `<script setup>` so the spec can
 * unit-test the transition table directly. Pure / no I/O. Eight phases:
 * CLOSED → DRAWER_STOP → CLOSING → CLOSED; same path for DRAWER_HISTORY plus
 * CLOSING_TO_SWITCH for stop↔history, CLOSING_TO_CONFIRM for drawer→modal,
 * CONFIRM (open) → MUTATING (after accept) → CLOSED (after settle).
 */
export type CockpitPhase = 'CLOSED' | 'DRAWER_STOP' | 'DRAWER_HISTORY' | 'CLOSING' | 'CLOSING_TO_SWITCH' | 'CLOSING_TO_CONFIRM' | 'CONFIRM' | 'MUTATING'

export interface CockpitState {
  phase: CockpitPhase
  selectedStopId: string | null
  pendingConfirmationStopId: string | null
  nextDrawerMode: 'stop' | 'history' | null
  nextConfirmationStopId: string | null
}

export type CockpitAction =
  | { type: 'OPEN_STOP'; stopId: string }
  | { type: 'OPEN_HISTORY' }
  | { type: 'DRAWER_UPDATE_OPEN_FALSE' }
  | { type: 'DRAWER_CLOSED' }
  | { type: 'REQUEST_CONFIRM'; stopId: string }
  | { type: 'CANCEL_CONFIRM' }
  | { type: 'ACCEPT_CONFIRM' }
  | { type: 'MUTATION_SETTLED' }

export const initialCockpitState: CockpitState = { phase: 'CLOSED', selectedStopId: null, pendingConfirmationStopId: null, nextDrawerMode: null, nextConfirmationStopId: null }

// Phase sets pre-close (drawer still mounted, animation in flight, or modal visible).
const DRAWER_OPEN = new Set<CockpitPhase>(['DRAWER_STOP', 'DRAWER_HISTORY', 'CLOSING', 'CLOSING_TO_SWITCH', 'CLOSING_TO_CONFIRM'])
const REQ_CONFIRM_OK = new Set<CockpitPhase>(['DRAWER_STOP', 'DRAWER_HISTORY', 'CLOSING', 'CLOSING_TO_SWITCH'])

export function reduceCockpit(state: CockpitState, action: CockpitAction): CockpitState {
  switch (action.type) {
    case 'OPEN_STOP': {
      if (state.phase === 'DRAWER_STOP' && state.selectedStopId === action.stopId) return state // idempotent same stop
      if (DRAWER_OPEN.has(state.phase)) return { ...state, phase: 'CLOSING_TO_SWITCH', selectedStopId: action.stopId, nextDrawerMode: 'stop' }
      return { ...state, phase: 'DRAWER_STOP', selectedStopId: action.stopId }
    }
    case 'OPEN_HISTORY': {
      if (state.phase === 'DRAWER_HISTORY') return state
      if (DRAWER_OPEN.has(state.phase)) return { ...state, phase: 'CLOSING_TO_SWITCH', selectedStopId: null, nextDrawerMode: 'history' }
      return { ...state, phase: 'DRAWER_HISTORY', selectedStopId: null }
    }
    case 'DRAWER_UPDATE_OPEN_FALSE': {
      if (state.phase === 'DRAWER_STOP' || state.phase === 'DRAWER_HISTORY') return { ...state, phase: 'CLOSING' }
      return state
    }
    case 'DRAWER_CLOSED': {
      if (state.phase === 'CLOSING') return { ...state, phase: 'CLOSED' }
      if (state.phase === 'CLOSING_TO_SWITCH' && state.nextDrawerMode) {
        return state.nextDrawerMode === 'history'
          ? { ...state, phase: 'DRAWER_HISTORY', selectedStopId: null, nextDrawerMode: null }
          : { ...state, phase: 'DRAWER_STOP', nextDrawerMode: null }
      }
      if (state.phase === 'CLOSING_TO_CONFIRM' && state.nextConfirmationStopId) {
        return { ...state, phase: 'CONFIRM', pendingConfirmationStopId: state.nextConfirmationStopId, nextConfirmationStopId: null }
      }
      return state
    }
    case 'REQUEST_CONFIRM': {
      if (state.phase === 'CONFIRM' || state.phase === 'MUTATING') return state // block duplicates
      if (REQ_CONFIRM_OK.has(state.phase)) return { ...state, phase: 'CLOSING_TO_CONFIRM', nextConfirmationStopId: action.stopId }
      if (state.phase === 'CLOSED') return { ...state, phase: 'CONFIRM', pendingConfirmationStopId: action.stopId }
      return state
    }
    case 'CANCEL_CONFIRM': {
      if (state.phase === 'CONFIRM') return { ...state, phase: 'CLOSED', pendingConfirmationStopId: null }
      return state
    }
    case 'ACCEPT_CONFIRM': {
      if (state.phase === 'CONFIRM' && state.pendingConfirmationStopId) return { ...state, phase: 'MUTATING', pendingConfirmationStopId: null }
      return state
    }
    case 'MUTATION_SETTLED': {
      if (state.phase === 'MUTATING') return { ...state, phase: 'CLOSED' }
      return state
    }
  }
}
</script>

<script setup lang="ts">
/**
 * DriverRouteCockpit — S10 (design §3, §7, §9.3, §10; REQ-DCS-001/009, REQ-DCK-006/008, REQ-DRC-104/112).
 * Non-null { route, isFetching, canCheckIn, checkInPending } composition surface; emits back / refresh /
 * request-check-in(stopId) exactly once. Owns ONLY local UI state (selected stop id, drawer mode/phase,
 * pending confirmation stop id, focus-return element). NEVER imports vue-router, useQuery, useMutation,
 * useQueryClient, axios, fetch(). DOM order: header → operational (current then next) → spine → footer;
 * one drawer + sibling ConfirmModal as overlays (no portal overlap; modal opens only after synthesized
 * closed for drawer-origin confirm; full-bleed root inside the panel, no fixed/absolute, tabindex="-1"
 * focus fallback, body has matching bottom clearance).
 */
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import DriverCockpitHeader from './DriverCockpitHeader.vue'
import DriverOperationalStops from './DriverOperationalStops.vue'
import DriverRouteSpine from './DriverRouteSpine.vue'
import DriverCockpitFooter from './DriverCockpitFooter.vue'
import DriverCockpitDrawer from './DriverCockpitDrawer.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { useDriverRouteCockpit } from '../../composables/cockpit/useDriverRouteCockpit'
import { useCockpitBreakpoint } from '../../composables/cockpit/useCockpitBreakpoint'
import type { CockpitProgress, StopTrigger, DrawerMode } from '../../composables/cockpit/useDriverRouteCockpit'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../copy'

// Props + emits (REQ-DCS-001 / REQ-DRC-104).
const props = defineProps<{ route: DeliveryRouteResponseDto; isFetching: boolean; canCheckIn: boolean; checkInPending: boolean }>()
const emit = defineEmits<{ back: []; refresh: []; 'request-check-in': [stopId: string] }>()

// Single breakpoint authority (S2 of `driver-cockpit-responsive-polish`; REQ-DCK-009).
// The cockpit owns the ONE invocation; the overlay receives `isDesktop` as a
// REQUIRED prop. Children MUST NOT call `useCockpitBreakpoint` themselves.
const { isDesktop } = useCockpitBreakpoint()

// Derived state (one selector pass per route change).
const derived = useDriverRouteCockpit(() => props.route)
const currentStop = computed(() => derived.value.currentStop)
const nextStop = computed(() => derived.value.nextStop)
const spineNodes = computed(() => derived.value.spine)
const progress = computed<CockpitProgress>(() => derived.value.progress)
const hasStops = computed(() => derived.value.hasStops)
const isTerminal = computed(() => derived.value.isTerminal)
const notes = computed(() => derived.value.notes)
const routeTerminal = computed(() => derived.value.isTerminal)
const findStop = (id: string | null): DeliveryRouteStop | null => (id ? (props.route.stops.find((s) => s.id === id) ?? null) : null)
const drawerStop = computed<DeliveryRouteStop | null>(() => findStop(state.value.selectedStopId))

// Local UI state (the FOUR things the cockpit owns).
const state = ref<CockpitState>({ ...initialCockpitState })
const focusReturnEl = shallowRef<HTMLElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

// Overlay surface (single drawer truth = reducer phase).
const drawerOpen = computed<boolean>(() => state.value.phase === 'DRAWER_STOP' || state.value.phase === 'DRAWER_HISTORY')
const drawerMode = computed<DrawerMode>(() => (state.value.phase === 'DRAWER_HISTORY' ? 'history' : 'stop'))
const isConfirmOpen = computed<boolean>(() => state.value.phase === 'CONFIRM')

// Confirmation copy (REQ-DCK-006 / REQ-DRC-104).
const confirmStop = computed(() => findStop(state.value.pendingConfirmationStopId))
const confirmCustomer = computed<string>(() => confirmStop.value?.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
const confirmPosition = computed<string>(() => (confirmStop.value ? String(confirmStop.value.sortOrder + 1) : ''))
const confirmFolio = computed<string>(() => confirmStop.value?.saleFolio?.trim() ?? '')
const confirmTitle = computed<string>(() => DELIVERY_ROUTE_COPY.cockpit.confirm.title)
const confirmBody = computed<string>(() => { const tpl = DELIVERY_ROUTE_COPY.cockpit.confirm.body.replace('{customer}', confirmCustomer.value).replace('{N}', confirmPosition.value) ; return confirmFolio.value.length > 0 ? tpl.replace('{folio}', confirmFolio.value) : tpl.replace(' ({folio})', '') })

// State → focus + emit side effects (drawerOpen is now a pure phase projection above).
function captureFocus(trigger: HTMLElement | null): void { if (trigger) focusReturnEl.value = trigger }
function restoreFocus(): void {
  // nextTick defers until after Vue flushes DOM updates so the cockpit root is mounted + tabindex=-1 has taken effect for the fallback path. preventScroll preserves the panel scroll position (REQ-DCK-008).
  nextTick(() => {
    const origin = focusReturnEl.value
    if (origin && typeof (origin as HTMLElement).focus === 'function' && (origin as Node).isConnected) { (origin as HTMLElement).focus({ preventScroll: true }) ; focusReturnEl.value = null ; return }
    if (rootRef.value && typeof rootRef.value.focus === 'function') rootRef.value.focus({ preventScroll: true })
    focusReturnEl.value = null
  })
}
// restoreFocus ONLY on the settle paths (CLOSED); drawer-initiated confirm (→CONFIRM) and mode switch (→DRAWER_*) keep the origin captured for the subsequent cancel/mutation.
function applyAction(action: CockpitAction, opts?: { restoreFocus?: boolean }): void {
  state.value = reduceCockpit(state.value, action) ; if (opts?.restoreFocus && state.value.phase === 'CLOSED') restoreFocus()
}

// Event handlers (forwarded props + per-surface transitions).
function onHeaderBack(): void { emit('back') }
function onHeaderRefresh(): void { if (!props.checkInPending) emit('refresh') }
function onHeaderOpenHistory(p: { trigger: HTMLElement | null }): void { captureFocus(p.trigger) ; applyAction({ type: 'OPEN_HISTORY' }) }
function onOpenStop(p: StopTrigger): void { if (!props.checkInPending) { captureFocus(p.trigger) ; applyAction({ type: 'OPEN_STOP', stopId: p.stopId }) } }
function onFooterRequestConfirm(p: StopTrigger): void { if (!props.checkInPending) { captureFocus(p.trigger) ; applyAction({ type: 'REQUEST_CONFIRM', stopId: p.stopId }) } }
function onDrawerUpdateOpen(v: boolean): void { if (v === false) applyAction({ type: 'DRAWER_UPDATE_OPEN_FALSE' }) }
function onDrawerClosed(): void { applyAction({ type: 'DRAWER_CLOSED' }, { restoreFocus: true }) }
function onDrawerRequestConfirm(p: StopTrigger): void { if (!props.checkInPending) { captureFocus(p.trigger) ; applyAction({ type: 'REQUEST_CONFIRM', stopId: p.stopId }) } }
function onConfirm(): void {
  if (state.value.phase !== 'CONFIRM') return ; const stopId = state.value.pendingConfirmationStopId ; if (!stopId) return
  state.value = reduceCockpit(state.value, { type: 'ACCEPT_CONFIRM' }) ; emit('request-check-in', stopId)
}
function onConfirmCancel(): void { if (state.value.phase === 'CONFIRM') applyAction({ type: 'CANCEL_CONFIRM' }, { restoreFocus: true }) }
function onConfirmUpdateOpen(v: boolean): void { if (!v) onConfirmCancel() }

// Mutation settles when checkInPending flips true → false (REQ-DCK-008).
watch(() => props.checkInPending, (next, prev) => { if (prev && !next && state.value.phase === 'MUTATING') applyAction({ type: 'MUTATION_SETTLED' }, { restoreFocus: true }) })
</script>

<template>
  <!-- S4 of `driver-cockpit-responsive-polish` (REQ-DCS-011/012): the parent
       detail-view wrapper (`px-4 sm:px-6 lg:px-10`) IS the single horizontal
       gutter authority — the cockpit MUST NOT cancel it with `-m-4 sm:-m-6`
       and MUST NOT add a nested `px-4 sm:px-6` on the body or header/footer.
       The root uses a containing-panel-aware height chain (`h-full` + justified
       `min-h-[calc(100dvh-4rem)]`); raw `min-h-[100dvh]` / `min-h-[100svh]`
       are forbidden (overshoot the global navbar). Body retains `flex-1 min-h-0`
       so it grows and the sticky footer reaches the visible bottom. Body
       padding-bottom (`pb-20`) mirrors the footer's safe-area inset so the
       sticky footer never overlaps tail content. tabindex="-1" gives the
       focus fallback when the originating element is no longer connected. -->
  <section ref="rootRef" tabindex="-1" data-testid="cockpit-root" class="flex h-full min-h-[calc(100dvh-4rem)] w-full min-w-0 flex-col gap-0 outline-none">
    <DriverCockpitHeader :route="props.route" :progress="progress" :is-fetching="props.isFetching" @back="onHeaderBack" @refresh="onHeaderRefresh" @open-history="onHeaderOpenHistory" />
    <div data-testid="cockpit-body" class="flex w-full min-w-0 flex-1 min-h-0 flex-col gap-4 py-4 pb-20">
      <DriverOperationalStops :current-stop="currentStop" :next-stop="nextStop" :notes="notes" :has-stops="hasStops" :is-terminal="isTerminal" @open-stop="onOpenStop" />
      <DriverRouteSpine :nodes="spineNodes" @select-stop="onOpenStop" />
    </div>
    <DriverCockpitFooter :route-status="props.route.status" :current-stop="currentStop" :progress="progress" :has-stops="hasStops" :can-check-in="props.canCheckIn" :check-in-pending="props.checkInPending" :is-desktop="isDesktop" @request-confirm="onFooterRequestConfirm" @open-history="onHeaderOpenHistory" />
    <!-- Overlay surface: one drawer + sibling ConfirmModal (never an overlap). -->
    <DriverCockpitDrawer :open="drawerOpen" :mode="drawerMode" :route="props.route" :stop="drawerStop" :route-terminal="routeTerminal" :can-check-in="props.canCheckIn" :check-in-pending="props.checkInPending" :is-desktop="isDesktop" @update:open="onDrawerUpdateOpen" @closed="onDrawerClosed" @request-confirm="onDrawerRequestConfirm" />
    <ConfirmModal :open="isConfirmOpen" :title="confirmTitle" :description="confirmBody" :confirm-label="DELIVERY_ROUTE_COPY.cockpit.confirm.confirmLabel" :cancel-label="DELIVERY_ROUTE_COPY.cockpit.confirm.cancelLabel" confirm-color="primary" @update:open="onConfirmUpdateOpen" @confirm="onConfirm" @cancel="onConfirmCancel" />
  </section>
</template>
