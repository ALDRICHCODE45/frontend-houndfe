<script setup lang="ts">
/**
 * TransferDeliveryRouteStopModal — T3 S2/S4 draft-to-draft stop move dialog.
 *
 * Opens from the per-stop "Mover" action on a DRAFT route. The user picks a
 * DRAFT destination route, then reaches an EXPLICIT confirmation step — the
 * mutation is never fired on selection alone.
 *
 * Contract:
 *   - Source and destination must differ: the origin route is excluded from the
 *     options (`filterTransferDestinations`), and the destination list is only
 *     `GET /delivery-routes?status=DRAFT`.
 *   - The dialog is a thin surface: `useTransferDeliveryRouteStop` owns cache
 *     invalidation + the success toast; `useDraftTransferDestinations` owns the
 *     list fetch. Both are mocked in the co-located spec.
 *   - STALE DESTINATION (verifier finding 1): the effective destination is
 *     ALWAYS re-derived from the fresh candidate list. If the chosen candidate
 *     disappears (or stops being DRAFT) during confirmation, the dialog returns
 *     to the choose step with an actionable notice and NEVER submits the stored
 *     id. No client-side permission claim is made — only the documented
 *     DRAFT-only/self-exclusion contract.
 *   - PENDING CONTEXT RACE (verifier finding 2): each request captures immutable
 *     origin/stop/destination + a context generation. A completion only closes
 *     the dialog or injects an error when it still matches the live context; a
 *     stale success may still invalidate caches inside the composable but can
 *     never close the new dialog. Duplicate-submit protection is scoped to the
 *     live context.
 *   - ACCESSIBILITY (verifier finding 3): the destination picker implements a
 *     keyboard-navigable radiogroup (arrow/Home/End/Space/Enter) with a roving
 *     tabindex; errors are announced via `role="alert"`.
 *   - On failure the dialog STAYS OPEN and renders the meaningful reason
 *     (422 flat reason / 403 permission) via `resolveTransferErrorMessage`.
 *   - Selection + step reset whenever the dialog opens or the origin route /
 *     stop changes.
 */
import { computed, ref, watch } from 'vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import {
  useDraftTransferDestinations,
  useTransferDeliveryRouteStop,
  filterTransferDestinations,
} from '../composables/useTransferDeliveryRouteStop'
import {
  resolveTransferDestinationsErrorMessage,
  resolveTransferErrorMessage,
} from '../interfaces/errors'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../interfaces/delivery-route.types'

const props = withDefaults(
  defineProps<{
    /** Dialog open state — two-way bound via v-model:open. */
    open: boolean
    /** The DRAFT route the stop currently belongs to. */
    originRouteId: string
    /** The stop being moved (null when the dialog is closed / not yet chosen). */
    stop?: DeliveryRouteStop | null
  }>(),
  {
    stop: null,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Emitted after a successful move, before the dialog closes. */
  moved: [payload: { destinationRouteId: string }]
}>()

// ─── Local step + selection state ─────────────────────────────────────────────
const step = ref<'select' | 'confirm'>('select')
const selectedDestinationId = ref<string | null>(null)
const submitError = ref<string | null>(null)
const selectionNotice = ref<string | null>(null)
const submitting = ref(false)
const optionsContainer = ref<HTMLElement | null>(null)

// Context generation — bumped on every open/close/origin/stop change so stale
// completions can be discarded. Never reused.
let contextGeneration = 0
let inFlightGeneration: number | null = null

const { mutateAsync: transferStop } = useTransferDeliveryRouteStop()
const {
  data: destinations,
  isLoading: destinationsLoading,
  isError: destinationsIsError,
  error: destinationsErrorRaw,
  refetch: refetchDestinations,
} = useDraftTransferDestinations({ enabled: () => props.open })

// Busy is scoped to THIS context (a stale in-flight request never blocks a new
// context). `submitting` is set synchronously on submit and cleared only when
// the matching generation settles.
const busy = computed<boolean>(() => submitting.value)

// ─── Destination options (origin excluded) ────────────────────────────────────
const destinationOptions = computed<DeliveryRouteResponseDto[]>(() =>
  filterTransferDestinations(destinations.value, props.originRouteId),
)

const destinationsError = computed<string | null>(() =>
  destinationsIsError.value
    ? resolveTransferDestinationsErrorMessage(
        destinationsErrorRaw.value,
        DELIVERY_ROUTE_COPY.transfer.destinationsError,
      )
    : null,
)

// Effective destination — re-derived from the FRESH candidates every time. A
// stored id that vanished, or that is no longer DRAFT, yields null so the
// submit path is blocked.
const selectedDestination = computed<DeliveryRouteResponseDto | null>(() => {
  const id = selectedDestinationId.value
  if (!id) return null
  const candidate = destinationOptions.value.find((route) => route.id === id)
  if (!candidate) return null
  if (candidate.status !== 'DRAFT') return null
  return candidate
})

const canContinue = computed<boolean>(() => selectedDestination.value !== null)

// ─── Reset / generation bump on context change ────────────────────────────────
watch(
  () => [props.open, props.originRouteId, props.stop?.id] as const,
  () => {
    contextGeneration += 1
    inFlightGeneration = null
    submitting.value = false
    step.value = 'select'
    selectedDestinationId.value = null
    submitError.value = null
    selectionNotice.value = null
  },
  { immediate: true },
)

// ─── Stale-destination guard during confirmation ──────────────────────────────
watch(selectedDestination, (destination) => {
  if (step.value !== 'confirm') return
  if (destination) return
  // The chosen destination is no longer a valid DRAFT candidate: return to the
  // choose step with an actionable notice. The stored id is cleared so a stale
  // submit can never happen.
  step.value = 'select'
  selectedDestinationId.value = null
  selectionNotice.value = DELIVERY_ROUTE_COPY.transfer.destinationUnavailable
})

// ─── Copy interpolation ────────────────────────────────────────────────────────
const stopFolio = computed<string>(
  () => props.stop?.saleFolio ?? props.stop?.id?.slice(0, 8) ?? '—',
)

function destinationLabel(route: DeliveryRouteResponseDto): string {
  const driver = route.driver?.name ?? DELIVERY_ROUTE_COPY.transfer.driverFallback
  return `${driver} · ${route.id.slice(0, 8)}`
}

const confirmBody = computed<string>(() =>
  DELIVERY_ROUTE_COPY.transfer.confirmBody
    .replace('{folio}', stopFolio.value)
    .replace('{destination}', selectedDestination.value ? destinationLabel(selectedDestination.value) : ''),
)

const modalTitle = computed<string>(() =>
  step.value === 'confirm' ? DELIVERY_ROUTE_COPY.transfer.confirmTitle : DELIVERY_ROUTE_COPY.transfer.title,
)

const modalDescription = computed<string>(() =>
  step.value === 'select' ? DELIVERY_ROUTE_COPY.transfer.description : '',
)

// ─── Keyboard navigation (radiogroup) ─────────────────────────────────────────
function optionTabindex(routeId: string): number {
  const selectedId = selectedDestinationId.value
  if (selectedId) return selectedId === routeId ? 0 : -1
  return destinationOptions.value[0]?.id === routeId ? 0 : -1
}

function focusOption(index: number): void {
  const buttons = optionsContainer.value?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  buttons?.[index]?.focus()
}

function onOptionKeydown(event: KeyboardEvent, index: number): void {
  const options = destinationOptions.value
  if (options.length === 0) return
  const lastIndex = options.length - 1
  let nextIndex: number | null = null

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = index >= lastIndex ? 0 : index + 1
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = index <= 0 ? lastIndex : index - 1
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = lastIndex
      break
    case ' ':
    case 'Enter': {
      event.preventDefault()
      const option = options[index]
      if (option) selectDestination(option.id)
      return
    }
    default:
      return
  }

  event.preventDefault()
  const option = options[nextIndex]
  if (!option) return
  selectDestination(option.id)
  focusOption(nextIndex)
}

// ─── Actions ──────────────────────────────────────────────────────────────────
function selectDestination(routeId: string): void {
  selectedDestinationId.value = routeId
  submitError.value = null
  selectionNotice.value = null
}

function goToConfirm(): void {
  if (!canContinue.value) return
  submitError.value = null
  step.value = 'confirm'
}

function backToSelect(): void {
  if (busy.value) return
  submitError.value = null
  step.value = 'select'
}

function close(): void {
  if (busy.value) return
  emit('update:open', false)
}

function retryDestinations(): void {
  void refetchDestinations()
}

async function confirmMove(): Promise<void> {
  // Always re-derive from the fresh candidates — never trust the stored id.
  const destination = selectedDestination.value
  const stopId = props.stop?.id

  if (!destination || !stopId) {
    if (selectedDestinationId.value !== null) {
      selectedDestinationId.value = null
      selectionNotice.value = DELIVERY_ROUTE_COPY.transfer.destinationUnavailable
    }
    step.value = 'select'
    return
  }

  // Duplicate submit is scoped to the live context.
  if (inFlightGeneration === contextGeneration) return

  // Immutable request snapshot for this context generation.
  const generation = contextGeneration
  const request = {
    originRouteId: props.originRouteId,
    stopId,
    destinationRouteId: destination.id,
  }
  inFlightGeneration = generation
  submitting.value = true
  submitError.value = null

  try {
    // The composable invalidates caches on success even for a stale context.
    await transferStop(request)
    if (generation !== contextGeneration) return // stale success: never close the new context
    emit('moved', { destinationRouteId: request.destinationRouteId })
    emit('update:open', false)
  } catch (error) {
    if (generation !== contextGeneration) return // stale failure: never inject into the new context
    submitError.value = resolveTransferErrorMessage(error)
  } finally {
    if (inFlightGeneration === generation) {
      inFlightGeneration = null
      submitting.value = false
    }
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :description="modalDescription"
    :dismissible="!busy"
    :close="!busy"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <template #body>
      <!-- Step 1 — destination selection (origin excluded). -->
      <div
        v-if="step === 'select'"
        data-testid="transfer-step-select"
        class="flex flex-col gap-3"
      >
        <p class="text-sm text-muted">
          {{ DELIVERY_ROUTE_COPY.transfer.selectLabel }}
        </p>

        <p
          v-if="selectionNotice"
          data-testid="transfer-selection-notice"
          role="status"
          aria-live="polite"
          class="text-sm text-warning"
        >
          {{ selectionNotice }}
        </p>

        <p
          v-if="destinationsLoading"
          data-testid="transfer-destinations-loading"
          class="text-sm text-muted"
        >
          {{ DELIVERY_ROUTE_COPY.transfer.loading }}
        </p>

        <div
          v-else-if="destinationsError"
          data-testid="transfer-destinations-error"
          role="alert"
          class="flex flex-col gap-2 rounded-md border border-default p-3"
        >
          <p class="text-sm text-error">{{ destinationsError }}</p>
          <div>
            <UButton
              color="neutral"
              variant="outline"
              :label="DELIVERY_ROUTE_COPY.transfer.retry"
              data-testid="transfer-destinations-retry"
              @click="retryDestinations"
            />
          </div>
        </div>

        <p
          v-else-if="destinationOptions.length === 0"
          data-testid="transfer-destinations-empty"
          class="text-sm text-muted"
        >
          {{ DELIVERY_ROUTE_COPY.transfer.empty }}
        </p>

        <div
          v-else
          ref="optionsContainer"
          role="radiogroup"
          :aria-label="DELIVERY_ROUTE_COPY.transfer.selectLabel"
          class="flex flex-col gap-2"
        >
          <button
            v-for="(route, index) in destinationOptions"
            :key="route.id"
            type="button"
            role="radio"
            :aria-checked="selectedDestinationId === route.id"
            :tabindex="optionTabindex(route.id)"
            :data-testid="`transfer-destination-${route.id}`"
            :data-selected="String(selectedDestinationId === route.id)"
            class="flex w-full flex-col items-start rounded-md border border-default px-3 py-2 text-left text-sm transition-colors hover:bg-elevated/50 aria-checked:border-primary aria-checked:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            @click="selectDestination(route.id)"
            @keydown="onOptionKeydown($event, index)"
          >
            <span class="font-medium">{{ destinationLabel(route) }}</span>
            <span class="text-xs text-muted">
              {{ DELIVERY_ROUTE_COPY.cockpit.summary.totalLabel }}: {{ route.stops.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- Step 2 — explicit confirmation. -->
      <div
        v-else
        data-testid="transfer-step-confirm"
        class="flex flex-col gap-3"
      >
        <p data-testid="transfer-summary" class="text-sm">
          {{ confirmBody }}
        </p>
        <p
          v-if="submitError"
          data-testid="transfer-error"
          role="alert"
          class="text-sm text-error"
        >
          {{ submitError }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <template v-if="step === 'select'">
          <UButton
            color="neutral"
            variant="outline"
            :label="DELIVERY_ROUTE_COPY.transfer.cancelLabel"
            data-testid="transfer-cancel"
            @click="close"
          />
          <UButton
            color="primary"
            :label="DELIVERY_ROUTE_COPY.transfer.continueLabel"
            :disabled="!canContinue"
            data-testid="transfer-continue"
            @click="goToConfirm"
          />
        </template>
        <template v-else>
          <UButton
            color="neutral"
            variant="outline"
            :label="DELIVERY_ROUTE_COPY.transfer.backLabel"
            :disabled="busy"
            data-testid="transfer-back"
            @click="backToSelect"
          />
          <UButton
            color="primary"
            :label="DELIVERY_ROUTE_COPY.transfer.confirmLabel"
            :loading="busy"
            :disabled="busy || !canContinue"
            data-testid="transfer-confirm"
            @click="confirmMove"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
