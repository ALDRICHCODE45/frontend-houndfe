/** DriverStopPanel — S3 (REQ-DCK-002/003; REQ-DRC-106). Stop-mode drawer body: props { stop; mapReady } · no emits · no internal header/title/close/delivery action (the overlay owns chrome + action gating/emission). Never owns server state or overlays. */
<script setup lang="ts">
import { computed } from 'vue'
import AddressMapPicker, { pinToGeoPoint } from '@/core/shared/components/AddressMapPicker.vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import {
  canOpenExternalMap, canCopyAddress, canOpenEmail,
  openExternalMap, copyAddressToClipboard, openEmail,
  type QuickActionResult,
} from '../../utils/cockpit/driverCockpitQuickActions'
import type { DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../copy'

declare const useToast: () => { add: (o: { title: string; color?: string }) => void }

const props = defineProps<{
  stop: DeliveryRouteStop
  mapReady: boolean
}>()

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
const anyQuickActionVisible = computed(() => canMap.value || canCopy.value || canMail.value)

const QUICK_BTN_CLASS = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-default bg-default px-4 py-2 text-sm font-medium text-default hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

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
</script>

<template>
  <article data-testid="stop-panel-root" class="flex flex-col gap-4 px-4 py-4 min-w-0">
    <div data-testid="stop-panel-meta" class="flex flex-col gap-1 min-w-0">
      <span class="flex items-center gap-x-2 text-xs uppercase tracking-wide text-muted">
        <span data-testid="stop-panel-position">{{ positionLabel }}</span>
        <span v-if="folioLabel" class="font-mono normal-case" data-testid="stop-panel-folio">· {{ folioLabel }}</span>
      </span>
      <span class="text-base font-medium text-default" data-testid="stop-panel-customer">{{ customerName }}</span>
    </div>

    <p v-if="hasAddress" class="w-full min-w-0 max-w-full truncate text-sm text-default" data-testid="stop-panel-address">{{ formattedAddress }}</p>

    <AddressMapPicker v-if="showMap" mode="read" :model-value="mapPin" :popup-text="formattedAddress" />

    <div v-if="anyQuickActionVisible" data-testid="stop-panel-quick-actions" class="flex flex-wrap items-center gap-2">
      <button v-for="action in visibleQuickActions" :key="action.id" type="button" :data-testid="action.testId" :aria-label="action.label" :class="QUICK_BTN_CLASS"
        @click="action.run()">
        <UIcon :name="action.icon" class="size-5" aria-hidden="true" />{{ action.label }}
      </button>
    </div>
  </article>
</template>