/** DriverStopPanel — S8 (REQ-DCK-003/005; REQ-DRC-106). Stop-mode drawer body: props { stop; routeTerminal; canCheckIn; checkInPending; mapReady } · emits close[]+request-confirm[StopTrigger] · never owns server state or overlays. */
<script setup lang="ts">
import { computed } from 'vue'
import AddressMapPicker, { pinToGeoPoint } from '@/core/shared/components/AddressMapPicker.vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import {
  canOpenExternalMap, canCopyAddress, canOpenEmail,
  openExternalMap, copyAddressToClipboard, openEmail,
  type QuickActionResult,
} from '../../utils/cockpit/driverCockpitQuickActions'
import type { StopTrigger } from '../../composables/cockpit/useDriverRouteCockpit'
import type { DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../copy'

declare const useToast: () => { add: (o: { title: string; color?: string }) => void }

const props = defineProps<{
  stop: DeliveryRouteStop
  routeTerminal: boolean
  canCheckIn: boolean
  checkInPending: boolean
  mapReady: boolean
}>()
const emit = defineEmits<{ close: []; 'request-confirm': [payload: StopTrigger] }>()

const coords = computed(() => ({
  latitude: props.stop.shippingAddress?.latitude ?? null,
  longitude: props.stop.shippingAddress?.longitude ?? null,
}))
const formattedAddress = computed(() => props.stop.shippingAddress ? formatAddress(props.stop.shippingAddress) : '')
const hasAddress = computed(() => formattedAddress.value.trim().length > 0)
const mapPin = computed(() => props.mapReady ? pinToGeoPoint(coords.value) : null)
const showMap = computed(() => mapPin.value !== null)

const customerName = computed(() => props.stop.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
const customerEmail = computed(() => props.stop.customer?.email?.trim() ?? '')
const positionLabel = computed(() => DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel.replace('{N}', String(props.stop.sortOrder + 1)))
const folioLabel = computed<string | null>(() => { const f = props.stop.saleFolio?.trim() ?? '' ; return f.length > 0 ? f : null })

const canMap = computed(() => canOpenExternalMap({ address: formattedAddress.value, ...coords.value }))
const canCopy = computed(() => canCopyAddress(formattedAddress.value))
const canMail = computed(() => canOpenEmail(customerEmail.value))
const secondaryActionVisible = computed(() => props.stop.status === 'PENDING' && !props.routeTerminal && props.canCheckIn)
const anyQuickActionVisible = computed(() => canMap.value || canCopy.value || canMail.value)

const QUICK_BTN_CLASS = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-default bg-default px-4 py-2 text-sm font-medium text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

// B3 review: one unified settled-result handler routes BOTH ok + failure through useToast.
// Ordered typed visible-action list (map → copy → email) drives a single template loop.
type QuickActionId = 'map' | 'copy' | 'email'
interface VisibleQuickAction { id: QuickActionId; testId: string; label: string; icon: string; run: () => void | Promise<void> }

const visibleQuickActions = computed<VisibleQuickAction[]>(() => {
  const qa = DELIVERY_ROUTE_COPY.cockpit.quickActions
  const actions: VisibleQuickAction[] = []
  if (canMap.value) actions.push({ id: 'map', testId: 'stop-panel-quick-map', label: qa.map, icon: 'i-lucide-map', run: () => runMap() })
  if (canCopy.value) actions.push({ id: 'copy', testId: 'stop-panel-quick-copy', label: qa.copyAddress, icon: 'i-lucide-copy', run: () => runCopy() })
  if (canMail.value) actions.push({ id: 'email', testId: 'stop-panel-quick-email', label: qa.email, icon: 'i-lucide-mail', run: () => runEmail() })
  return actions
})

function settled(id: QuickActionId, result: QuickActionResult): void {
  const qa = DELIVERY_ROUTE_COPY.cockpit.quickActions
  const successKey = (`success${id[0]!.toUpperCase()}${id.slice(1)}`) as 'successMap' | 'successCopy' | 'successEmail'
  useToast().add({ title: result.ok ? qa[successKey] : result.message, color: result.ok ? 'success' : 'error' })
}
function runMap() { settled('map', openExternalMap({ address: formattedAddress.value, ...coords.value })) }
async function runCopy() { settled('copy', await copyAddressToClipboard(formattedAddress.value)) }
function runEmail() { settled('email', openEmail(customerEmail.value)) }

function onClose() { emit('close') }
function onSecondary(event: MouseEvent) {
  if (props.checkInPending) return
  emit('request-confirm', { stopId: props.stop.id, trigger: event.currentTarget as HTMLElement })
}
</script>

<template>
  <article data-testid="stop-panel-root" class="flex flex-col gap-4 px-4 py-4 min-w-0">
    <header data-testid="stop-panel-header" class="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default bg-default px-4 py-3 min-w-0">
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="flex items-center gap-x-2 text-xs uppercase tracking-wide text-muted">
          <span data-testid="stop-panel-position">{{ positionLabel }}</span>
          <span v-if="folioLabel" class="font-mono normal-case" data-testid="stop-panel-folio">· {{ folioLabel }}</span>
        </span>
        <span class="truncate text-base font-medium text-default" data-testid="stop-panel-customer">{{ customerName }}</span>
      </div>
      <button type="button" data-testid="stop-panel-close" :aria-label="DELIVERY_ROUTE_COPY.cockpit.drawer.close"
        class="flex-none inline-flex items-center justify-center min-h-11 min-w-11 rounded-md bg-default text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        @click="onClose">
        <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
      </button>
    </header>

    <p v-if="hasAddress" class="w-full min-w-0 max-w-full truncate text-sm text-default" data-testid="stop-panel-address">{{ formattedAddress }}</p>

    <AddressMapPicker v-if="showMap" mode="read" :model-value="mapPin" :popup-text="formattedAddress" />

    <div v-if="anyQuickActionVisible" data-testid="stop-panel-quick-actions" class="flex flex-wrap items-center gap-2">
      <button v-for="action in visibleQuickActions" :key="action.id" type="button" :data-testid="action.testId" :aria-label="action.label" :class="QUICK_BTN_CLASS"
        @click="action.run()">
        <UIcon :name="action.icon" class="size-5" aria-hidden="true" />{{ action.label }}
      </button>
    </div>

    <button v-if="secondaryActionVisible" type="button" data-testid="stop-panel-secondary-action"
      :aria-label="`${customerName} — ${DELIVERY_ROUTE_COPY.actions.checkIn}`" :disabled="checkInPending"
      class="inline-flex min-h-11 min-w-11 w-full items-center justify-center gap-2 rounded-md bg-coco-gold-500 px-6 py-3 text-sm font-semibold text-coco-neutral-950 shadow-sm transition hover:bg-coco-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-coco-gold-500/60"
      @click="onSecondary">
      <UIcon name="i-lucide-check" class="size-5" aria-hidden="true" />{{ DELIVERY_ROUTE_COPY.actions.checkIn }}
    </button>
  </article>
</template>
