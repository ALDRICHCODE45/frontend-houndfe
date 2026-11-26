<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { useDebtPayment } from '../composables/useDebtPayment'
import { useSalePaymentMethods } from '../composables/useSalePaymentMethods'
import type { CollectionPaymentMethod, PaymentEntry } from '../interfaces/sale.types'
import { PAYMENT_METHOD } from '../constants/sale.constants' // sdd/magic-string-constants slice 3 — lowercase contract.
import {
  MAX_PAYMENT_ENTRIES,
  addEntry,
  normalizeReferenceInput,
  paidSum,
  updateEntry,
  removeEntry,
  validateAggregate,
  validateEntry,
} from '../utils/paymentEntries.utils'
import { newIdempotencyKey } from '../utils/idempotency.utils'
import {
  buildMergedMethodOptions,
  findEntryIndex,
  getMethodCount,
  paymentEntryKey,
  paymentMethodTileKey,
  resolveEntryDisplay,
  type PaymentMethodTile,
} from '../utils/paymentMethodTile.utils'
import { PAYMENT_METHOD_CATEGORY_ICONS } from '@/core/shared/constants/payment-method-category'
// payment-split T2 (S2-S5, S7): the shared split helper and controls, target = `debtCents`.
import TenderSplitControl from '@/core/shared/components/payments/TenderSplitControl.vue'
import TenderRemainingButton from '@/core/shared/components/payments/TenderRemainingButton.vue'
import type { SplitControlTender } from '@/core/shared/components/payments/splitControl.types'
import { applyTenderAmounts } from '@/core/shared/payments/tenderSplit'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import { useCashSaleSession } from '@/features/POS/cash-register/composables/useCashSaleSession'
import { useCashAccess } from '@/features/POS/cash-register/composables/useCashAccess'
import { useCashRegisterNames } from '../composables/useCashRegisterNames'
import CashSaleSessionPicker from './CashSaleSessionPicker.vue'
// Style-cleanup U2 (owner S3 «una sola pieza»): the shared, marker-free payment-sheet look, so
// this sheet renders the same from the customer history and from the sale detail.
import '@/core/shared/components/payments/payment-sheet.css'

const props = defineProps<{
  open: boolean
  debtCents: number
  saleId: string
  // sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): the parent
  // increments this counter when a debt charge resolves a catalog error; the
  // modal then drops every entry carrying a `paymentMethodId` (custom tiles)
  // and preserves fixed entries. The increment dispatch lands in S5A.
  catalogClearSignal?: number
  /**
   * Optional teleport boundary marker forwarded to the installed slideover
   * content root. Absent by default, which preserves this modal's original
   * `ui` value and every existing consumer's presentation.
   */
  portalClass?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const entries = ref<PaymentEntry[]>([])
// payment-split S5: tenders added once the debt was covered. They show a blank amount and no
// amount error until the cashier types or a helper fills them; the confirm stays blocked
// meanwhile (the gate below validates every entry as is).
const blankKeys = ref<ReadonlySet<string>>(new Set())
const idempotencyKey = ref('')
const inlineAggregateError = ref<string | null>(null)

const CARD_METHODS: CollectionPaymentMethod[] = [
  PAYMENT_METHOD.CARD_CREDIT,
  PAYMENT_METHOD.CARD_DEBIT,
  PAYMENT_METHOD.TRANSFER,
]

// sdd custom-payment-methods S4B (REQ-PT-004): merged tile options — the 4
// fixed tiles followed by every active custom method from the projection.
// Empty / failed projection degrades to fixed-only (REQ-PT-005 / 006).
const { data: projection } = useSalePaymentMethods()
const methodOptions = computed<PaymentMethodTile[]>(() => buildMergedMethodOptions(projection.value ?? []))

function tileTestId(tile: PaymentMethodTile): string {
  if (tile.kind === 'custom') return `payment-method-tile-custom-${tile.paymentMethodId}`
  // Debt modal legacy testids: every fixed tile keeps
  // `payment-method-tile-${value}` (design §1.4 — no testid drift).
  return `payment-method-tile-${tile.value}`
}

const {
  submitSafe,
  isSubmitting,
  externalErrorCode,
  shouldClose,
  resetError,
  // sdd custom-payment-methods S5A (design §8.3): the composable's own
  // clear-selection signal — incremented by useDebtPayment.onError on
  // catalog errors; the watch below drops custom entries.
  catalogClearSignal,
} = useDebtPayment(props.saleId)

// BE handoff 24 §3: a CASH payment without `cashSessionId` is outside every till (the drawer shows
// it as a surplus at close), so CASH goes into the user's OPEN session, read from the same source
// as the POS charge (useCashSaleSession: own + OPEN + current tenant). One open session is used
// as is; several follow the POS picker rule (an explicit choice, never automatic); none blocks
// the CASH payment. Card/transfer enter no drawer and go without a session, as before.
const cashSaleSession = useCashSaleSession()
const cashAccess = useCashAccess()
const CAJA_PATH = '/pos/caja'
// Only a user who may open a till (create:CashSession) is sent to Caja; anyone else would hit
// a dead end there, so they are told who can take the cash instead.
const canOpenCashSession = computed(() => cashAccess.canOpenSession.value)
const registerNames = useCashRegisterNames()
const hasCashEntry = computed(() => entries.value.some((entry) => entry.method === PAYMENT_METHOD.CASH))
const openCashSessions = computed(() => cashSaleSession.availableSessions.value)
const needsCashSessionPick = computed(() => openCashSessions.value.length > 1)
const cashSessionId = computed<string | null>(() => {
  const sessions = openCashSessions.value
  if (sessions.length === 1) return sessions[0]!.id
  if (sessions.length > 1 && cashSaleSession.isSelectionEligible.value) return cashSaleSession.selectedId.value
  return null
})
const cashSessionLoading = computed(() => cashSaleSession.isFetching.value)
const cashSessionLoadFailed = computed(
  () => hasCashEntry.value && !cashSessionLoading.value && cashSaleSession.isError.value,
)
const cashSessionMissing = computed(
  () =>
    hasCashEntry.value &&
    !cashSessionLoading.value &&
    !cashSaleSession.isError.value &&
    openCashSessions.value.length === 0,
)
const cashSessionBlocks = computed(() => hasCashEntry.value && cashSessionId.value === null)

/** Live recheck at submit: several sessions need a still-valid explicit choice. */
function resolveCashSessionForSubmit(): string | null {
  if (needsCashSessionPick.value && !cashSaleSession.revalidateSelection()) return null
  return cashSessionId.value
}

const receivedCents = computed(() => paidSum(entries.value))
const remainingCents = computed(() => Math.max(0, props.debtCents - receivedCents.value))
const aggregateError = computed(() => inlineAggregateError.value ?? validateAggregate(entries.value, props.debtCents) ?? null)
const entryErrors = computed(() => entries.value.map((entry) => validateEntry(entry)))
const hasEntryErrors = computed(() => entryErrors.value.some((errors) => Object.keys(errors).length > 0))
const isBlank = (entry: PaymentEntry) => blankKeys.value.has(paymentEntryKey(entry))
/** What each entry shows: a blank tender (S5) hides its amount error, the gate does not. */
const shownEntryErrors = computed(() =>
  entries.value.map((entry, index) => (isBlank(entry) ? {} : (entryErrors.value[index] ?? {}))),
)
function unmarkBlank(keys: Iterable<string>) {
  const next = new Set(blankKeys.value)
  for (const key of keys) next.delete(key)
  if (next.size !== blankKeys.value.size) blankKeys.value = next
}
const entryLabels = computed(() => entries.value.map((entry) => resolveEntryDisplay(entry, methodOptions.value).label))
const splitTenders = computed<SplitControlTender[]>(() =>
  entries.value.map((entry, index) => ({
    key: paymentEntryKey(entry),
    label: entryLabels.value[index] ?? '',
    method: entry.method,
    amountCents: entry.amountCents,
  })),
)
// The parser error of each typed amount, by entry key; it blocks the payment while present.
const amountTextErrors = ref<Record<string, string>>({})
const hasAmountTextErrors = computed(() => entries.value.some((entry) => amountTextErrors.value[paymentEntryKey(entry)]))
// A removed entry's money field unmounts, and a re-added one remounts clean,
// so the parse error of an entry that is gone must go with it.
watch(entries, (current) => {
  const live = new Set(current.map(paymentEntryKey))
  const kept = Object.fromEntries(Object.entries(amountTextErrors.value).filter(([key]) => live.has(key)))
  if (Object.keys(kept).length !== Object.keys(amountTextErrors.value).length) amountTextErrors.value = kept
  unmarkBlank([...blankKeys.value].filter((key) => !live.has(key)))
})
const canSubmit = computed(
  () =>
    entries.value.length > 0 &&
    !aggregateError.value &&
    !hasEntryErrors.value &&
    !hasAmountTextErrors.value &&
    !cashSessionBlocks.value &&
    !isSubmitting.value,
)
const canAddEntry = computed(() => entries.value.length < MAX_PAYMENT_ENTRIES)

// Presentation-only merge: keep the modal's existing width/body overrides and
// append the optional caller boundary when opted in. An absent prop yields the
// exact previous value (`sm:max-w-lg`), so no consumer changes.
const slideoverUi = computed(() => ({
  content: props.portalClass ? `sm:max-w-lg ${props.portalClass}` : 'sm:max-w-lg',
  body: 'p-0 flex flex-col h-full',
}))

function entryNeedsReference(method: CollectionPaymentMethod): boolean {
  return CARD_METHODS.includes(method)
}

function resetState() {
  entries.value = []
  amountTextErrors.value = {}
  blankKeys.value = new Set()
  idempotencyKey.value = newIdempotencyKey()
  inlineAggregateError.value = null
  cashSaleSession.clearSelection()
  resetError()
}

function close() {
  emit('update:open', false)
}

// handleMethodToggle(tile) — tile-identity matcher (design §1.2/§1.4). The grid
// passes the WHOLE tile; the matcher resolves the selection key as
// `paymentMethodId ?? method` and addEntry threads the UUID for customs, so a
// fixed tile never toggles a custom entry of the same category and two customs
// of the same category never collide (REQ-PT-001).
function handleMethodToggle(tile: PaymentMethodTile): void {
  const existingIndex = findEntryIndex(entries.value, tile)
  if (existingIndex >= 0) {
    entries.value = removeEntry(entries.value, existingIndex)
  } else {
    // payment-split S5: the new method takes what is still due (never more, S7); blank when covered.
    const next = addEntry(entries.value, tile.value, props.debtCents, tile.paymentMethodId)
    const added = next.length > entries.value.length ? next[next.length - 1] : undefined
    if (added && added.amountCents === 0) blankKeys.value = new Set([...blankKeys.value, paymentEntryKey(added)])
    entries.value = next
  }
}

function handleAmountChange(index: number, amountCents: number | null): void {
  const entry = entries.value[index]
  if (entry) unmarkBlank([paymentEntryKey(entry)])
  entries.value = updateEntry(entries.value, index, { amountCents: Math.max(0, amountCents ?? 0) })
}

/** Amounts from the split helpers, one per tender: written exactly like typed amounts. */
function handleSplitApply(amounts: number[]): void {
  if (isSubmitting.value || amounts.length !== entries.value.length) return
  unmarkBlank(entries.value.map(paymentEntryKey))
  entries.value = applyTenderAmounts(entries.value, amounts)
}

function handleAmountValidation(entry: PaymentEntry, error: string | null): void {
  const { [paymentEntryKey(entry)]: _previous, ...rest } = amountTextErrors.value
  void _previous
  amountTextErrors.value = error ? { ...rest, [paymentEntryKey(entry)]: error } : rest
}

function handleReferenceChange(index: number, reference: string): void {
  entries.value = updateEntry(entries.value, index, { reference })
}

function handleEntryRemove(index: number): void {
  entries.value = removeEntry(entries.value, index)
}

async function handleSubmit() {
  if (!canSubmit.value) return

  // sales-pos-charge WU-C.3 (REQ-NEW-10): normalize each entry's reference
  // before crossing the wire — empty/whitespace becomes "omit the key" so
  // the backend defaults to null instead of receiving `reference: ''`.
  const normalizedPayments = entries.value.map((entry) => {
    const normalized = normalizeReferenceInput(entry.reference ?? undefined)
    // Treat null and undefined the same: omit the key entirely so the
    // backend never receives `reference: null` (spec REQ-NEW-10).
    if (normalized === null || normalized === undefined) {
      const { reference: _omitted, ...rest } = entry
      void _omitted
      return rest
    }
    return { ...entry, reference: normalized }
  })

  const sessionId = hasCashEntry.value ? resolveCashSessionForSubmit() : null
  if (hasCashEntry.value && sessionId === null) return

  const result = await submitSafe({
    payload: sessionId === null ? { payments: normalizedPayments } : { payments: normalizedPayments, cashSessionId: sessionId },
    idempotencyKey: idempotencyKey.value,
  })

  if (!result) return

  emit('success')
  close()
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    resetState()
    // Fresh own/OPEN sessions each time the sheet opens (a till may have opened meanwhile).
    void cashSaleSession.refetch()
  },
)

watch(entries, () => {
  if (!props.open) return
  idempotencyKey.value = newIdempotencyKey()
  inlineAggregateError.value = null
}, { deep: true })

watch(shouldClose, (value) => {
  if (!value) return
  close()
})

watch(externalErrorCode, (code) => {
  if (code === 'PAYMENT_EXCEEDS_DEBT') {
    inlineAggregateError.value = 'El monto supera la deuda actual. Revisa el saldo.'
  }
})

// sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): when the parent
// increments `catalogClearSignal` (a debt charge resolved a catalog error),
// drop EVERY entry carrying a `paymentMethodId` (custom tiles) and preserve
// the fixed entries. The deep `entries` watcher above then regenerates the
// idempotency key, so the follow-up submit is a fresh request.
watch(
  () => props.catalogClearSignal,
  () => {
    if (!props.open) return
    entries.value = entries.value.filter((entry) => entry.paymentMethodId === undefined)
  },
)

// sdd custom-payment-methods S5A (design §8.3): the composable's own signal
// (incremented in useDebtPayment.onError's catalog branch) drives the same
// custom-entry filter. Mirrors the S4B prop watch above.
watch(catalogClearSignal, () => {
  if (!props.open) return
  entries.value = entries.value.filter((entry) => entry.paymentMethodId === undefined)
})
</script>

<template>
  <USlideover
    :open="open"
    title="Cobrar deuda"
    description="Selecciona los métodos de pago"
    inset
    :ui="slideoverUi"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex h-full max-h-[100dvh] flex-col">
        <!-- Header -->
        <div class="shrink-0 space-y-4 border-b border-default px-5 py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-lg font-semibold text-(--hf-heading)">Cobrar deuda</p>
              <p class="text-xs text-muted">Selecciona los métodos de pago</p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Cerrar cobro de deuda"
              :disabled="isSubmitting"
              @click="close"
            />
          </div>

          <!-- Total banner -->
          <div class="hf-pay-total">
            <p class="hf-pay-total-label">Deuda pendiente</p>
            <p class="hf-figure hf-pay-total-value">{{ formatCentsMXN(debtCents) }}</p>
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <!-- Method picker grid -->
          <section class="space-y-3">
            <p class="text-sm font-semibold text-highlighted">Métodos de pago</p>
            <div class="hf-pay-methods">
              <button
                v-for="option in methodOptions"
                :key="paymentMethodTileKey(option)"
                :data-testid="tileTestId(option)"
                :aria-pressed="getMethodCount(entries, option) > 0"
                type="button"
                class="hf-pay-tile"
                :disabled="(getMethodCount(entries, option) === 0 && !canAddEntry) || isSubmitting"
                @click="handleMethodToggle(option)"
              >
                <UIcon :name="option.icon" class="hf-pay-tile-icon" />
                <p class="hf-pay-tile-label">{{ option.label }}</p>
                <span v-if="getMethodCount(entries, option) > 0" class="hf-pay-tile-count">
                  {{ getMethodCount(entries, option) }}
                </span>
                <!-- REQ-PT-007: custom tiles render the subtitle as a grey sub-line (trimmed, when present) -->
                <p
                  v-if="option.kind === 'custom' && (option.subtitle?.trim() ?? '') !== ''"
                  :data-testid="`payment-method-tile-subtitle-${option.paymentMethodId}`"
                  class="hf-pay-tile-subtitle text-muted"
                >
                  {{ option.subtitle }}
                </p>
              </button>
            </div>
            <p v-if="!canAddEntry" class="text-xs text-warning">Máximo {{ MAX_PAYMENT_ENTRIES }} pagos</p>
          </section>

          <USeparator />

          <!-- Payment entries -->
          <section class="space-y-3">
            <p class="text-sm font-semibold text-highlighted">Pagos agregados</p>

            <div v-if="entries.length === 0" class="hf-pay-empty">
              <p>Selecciona un método de pago arriba</p>
            </div>

            <div v-else class="hf-pay-entries">
              <div
                v-for="(entry, index) in entries"
                :key="paymentEntryKey(entry)"
                :data-testid="`payment-entry-${index}`"
                class="hf-pay-entry"
              >
                <div class="hf-pay-entry-head">
                  <UIcon :name="PAYMENT_METHOD_CATEGORY_ICONS[entry.method]" class="hf-pay-entry-icon" />

                  <p class="hf-pay-entry-label">
                    {{ entryLabels[index] }}
                  </p>

                  <TenderRemainingButton
                    :data-testid="`payment-fill-remaining-${index}`"
                    :tenders="entries"
                    :index="index"
                    :target-cents="debtCents"
                    :label="entryLabels[index] ?? ''"
                    :disabled="isSubmitting"
                    @fill="handleAmountChange(index, $event)"
                  />

                  <UButton
                    :data-testid="`remove-payment-entry-${index}`"
                    :aria-label="`Eliminar pago ${index + 1}`"
                    type="button"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    :disabled="isSubmitting"
                    @click="handleEntryRemove(index)"
                  />
                </div>

                <UFormField label="Monto" :error="shownEntryErrors[index]?.amountCents">
                  <HfMoneyInput
                    :id="`debt-payment-amount-${index}`"
                    :data-testid="`payment-amount-${index}`"
                    :model-value="isBlank(entry) ? null : entry.amountCents"
                    :disabled="isSubmitting"
                    class="w-full"
                    @update:model-value="handleAmountChange(index, $event)"
                    @validation="handleAmountValidation(entry, $event)"
                  />
                </UFormField>

                <UFormField
                  v-if="entryNeedsReference(entry.method)"
                  label="Referencia"
                  :error="shownEntryErrors[index]?.reference"
                >
                  <UInput
                    :data-testid="`payment-reference-${index}`"
                    :model-value="entry.reference ?? ''"
                    placeholder="Ej: VOUCHER-123"
                    :disabled="isSubmitting"
                    @update:model-value="handleReferenceChange(index, $event)"
                  />
                </UFormField>
              </div>
            </div>

            <TenderSplitControl
              :tenders="splitTenders"
              :target-cents="debtCents"
              :disabled="isSubmitting"
              @apply="handleSplitApply"
            />
          </section>

          <!-- BE handoff 24 §3: where the cash goes. Only with a CASH entry. -->
          <section v-if="hasCashEntry" class="space-y-2" data-testid="debt-cash-session">
            <p v-if="cashSessionLoading && openCashSessions.length === 0" class="text-xs text-muted">
              Buscando tu caja abierta…
            </p>
            <p v-else-if="cashSessionLoadFailed" class="text-sm text-(--hf-danger)" data-testid="debt-cash-session-error">
              No se pudo revisar tu caja, así que no puedes cobrar en efectivo por ahora.
            </p>
            <div
              v-else-if="cashSessionMissing"
              class="hf-pay-panel space-y-2"
              role="alert"
              data-testid="debt-cash-session-missing"
            >
              <template v-if="canOpenCashSession">
                <p class="text-sm font-semibold text-(--hf-warning)">Abre tu caja para cobrar en efectivo.</p>
                <p class="text-xs text-muted">Tarjeta y transferencia se pueden cobrar sin caja.</p>
              </template>
              <p v-else class="text-sm font-semibold text-(--hf-warning)" data-testid="debt-cash-session-cannot-open">
                No puedes abrir caja. Pide a un cajero que cobre en efectivo o cobra con tarjeta o transferencia.
              </p>
              <UButton
                v-if="canOpenCashSession"
                data-testid="debt-cash-session-open-caja"
                :to="CAJA_PATH"
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-wallet"
              >
                Ir a Caja
              </UButton>
            </div>
            <template v-else-if="needsCashSessionPick">
              <CashSaleSessionPicker
                :sessions="openCashSessions"
                :selected-id="cashSaleSession.selectedId.value"
                :is-selection-eligible="cashSaleSession.isSelectionEligible.value"
                :is-fetching="cashSaleSession.isFetching.value"
                :is-error="cashSaleSession.isError.value"
                :page="cashSaleSession.page.value"
                :page-count="cashSaleSession.pageCount.value"
                :total="cashSaleSession.total.value"
                :portal-class="portalClass"
                :register-names="registerNames"
                :allow-unbound="false"
                @update:selected-id="cashSaleSession.selectSession($event)"
                @update:page="cashSaleSession.setPage($event)"
              />
              <p v-if="cashSessionId === null" class="text-xs text-muted" data-testid="debt-cash-session-pick">
                Elige la caja donde entra el efectivo.
              </p>
            </template>
          </section>
        </div>

        <!-- Sticky footer -->
        <div class="shrink-0 space-y-3 border-t border-default bg-default px-5 py-4">
          <!-- Totals row -->
          <div class="hf-pay-summary">
            <div class="hf-pay-summary-row">
              <p>Recibido: <span class="hf-pay-summary-value">{{ formatCentsMXN(receivedCents) }}</span></p>
              <p>
                Restante:
                <span class="hf-pay-summary-value" :class="remainingCents > 0 ? 'text-(--hf-warning)' : 'text-(--hf-success)'">
                  {{ formatCentsMXN(remainingCents) }}
                </span>
              </p>
            </div>
          </div>

          <!-- Aggregate / inline error -->
          <p v-if="aggregateError" class="text-sm text-(--hf-danger)">{{ aggregateError }}</p>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" :disabled="isSubmitting" @click="close">
              Cancelar
            </UButton>
            <UButton
              data-testid="confirm-debt-payment"
              :loading="isSubmitting"
              :disabled="!canSubmit"
              class="hf-primary-control sales-detail-primary-action"
              @click="handleSubmit"
            >
              Confirmar cobro
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
