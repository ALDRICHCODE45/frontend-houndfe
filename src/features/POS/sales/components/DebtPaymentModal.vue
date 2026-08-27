<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { getPaymentMethodColor } from '../utils/salePaymentMethod.utils'
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

const props = defineProps<{
  open: boolean
  debtCents: number
  saleId: string
  // sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): the parent
  // increments this counter when a debt charge resolves a catalog error; the
  // modal then drops every entry carrying a `paymentMethodId` (custom tiles)
  // and preserves fixed entries. The increment dispatch lands in S5A.
  catalogClearSignal?: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const entries = ref<PaymentEntry[]>([])
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

const receivedCents = computed(() => paidSum(entries.value))
const remainingCents = computed(() => Math.max(0, props.debtCents - receivedCents.value))
const aggregateError = computed(() => inlineAggregateError.value ?? validateAggregate(entries.value, props.debtCents) ?? null)
const entryErrors = computed(() => entries.value.map((entry) => validateEntry(entry)))
const hasEntryErrors = computed(() => entryErrors.value.some((errors) => Object.keys(errors).length > 0))
const canSubmit = computed(() => entries.value.length > 0 && !aggregateError.value && !hasEntryErrors.value && !isSubmitting.value)
const canAddEntry = computed(() => entries.value.length < MAX_PAYMENT_ENTRIES)

// --- Entry form state (pesos for UInputNumber) ---
type EntryForm = { method: CollectionPaymentMethod; amountPesos: number; reference: string }
const entryForms = computed<EntryForm[]>(() =>
  entries.value.map((e) => ({
    method: e.method,
    amountPesos: e.amountCents / 100,
    reference: e.reference ?? '',
  })),
)

function entryNeedsReference(method: CollectionPaymentMethod): boolean {
  return CARD_METHODS.includes(method)
}

function getMethodColor(method: CollectionPaymentMethod): string {
  return getPaymentMethodColor(method.toUpperCase())
}

function resetState() {
  entries.value = []
  idempotencyKey.value = newIdempotencyKey()
  inlineAggregateError.value = null
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
    entries.value = addEntry(entries.value, tile.value, props.debtCents, tile.paymentMethodId)
  }
}

function handleAmountChange(index: number, amountPesos: number): void {
  entries.value = updateEntry(entries.value, index, { amountCents: Math.max(0, Math.round(amountPesos * 100)) })
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

  const result = await submitSafe({
    payload: { payments: normalizedPayments },
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
    inset
    :ui="{
      content: 'sm:max-w-lg',
      body: 'p-0 flex flex-col h-full',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex h-full max-h-[100dvh] flex-col">
        <!-- Header -->
        <div class="shrink-0 space-y-4 border-b border-default px-5 py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-lg font-bold text-highlighted">Cobrar deuda</p>
              <p class="text-xs text-muted">Selecciona los métodos de pago</p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :disabled="isSubmitting"
              @click="close"
            />
          </div>

          <!-- Total banner -->
          <div class="rounded-2xl border border-coco-gold-500/20 bg-coco-gold-500/5 px-5 py-4 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Deuda pendiente</p>
            <p class="mt-1 text-4xl font-black tabular-nums text-highlighted">{{ formatCentsMXN(debtCents) }}</p>
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <!-- Method picker grid -->
          <section class="space-y-3">
            <p class="text-sm font-semibold text-highlighted">Métodos de pago</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="option in methodOptions"
                :key="paymentMethodTileKey(option)"
                :data-testid="tileTestId(option)"
                type="button"
                class="relative rounded-xl border px-3 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  getMethodCount(entries, option) > 0
                    ? 'border-coco-gold-500/40 bg-coco-gold-500/5'
                    : 'border-default bg-elevated hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5'
                "
                :disabled="(getMethodCount(entries, option) === 0 && !canAddEntry) || isSubmitting"
                @click="handleMethodToggle(option)"
              >
                <UBadge
                  v-if="getMethodCount(entries, option) > 0"
                  class="absolute right-2 top-2"
                  size="sm"
                  :color="getMethodColor(option.value)"
                  variant="soft"
                >
                  {{ getMethodCount(entries, option) }}
                </UBadge>
                <UIcon :name="option.icon" class="mb-2 size-6 text-coco-gold-700 dark:text-coco-gold-400" />
                <p class="text-sm font-semibold text-highlighted">{{ option.label }}</p>
                <!-- REQ-PT-007: custom tiles render the subtitle as a grey sub-line (trimmed, when present) -->
                <p
                  v-if="option.kind === 'custom' && (option.subtitle?.trim() ?? '') !== ''"
                  :data-testid="`payment-method-tile-subtitle-${option.paymentMethodId}`"
                  class="text-xs text-muted"
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

            <div
              v-if="entries.length === 0"
              class="rounded-xl border border-dashed border-default bg-elevated px-4 py-6 text-center"
            >
              <p class="text-sm text-muted">Selecciona un método de pago arriba</p>
            </div>

            <div
              v-for="(entry, index) in entries"
              :key="paymentEntryKey(entry)"
              :data-testid="`payment-entry-${index}`"
              class="space-y-3 rounded-xl border border-default bg-default px-3 py-3"
            >
              <div class="flex items-center gap-3">
                <UBadge :color="getMethodColor(entry.method)" variant="soft" size="lg" class="shrink-0">
                  <UIcon :name="PAYMENT_METHOD_CATEGORY_ICONS[entry.method]" class="size-4" />
                </UBadge>

                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-highlighted">
                    {{ resolveEntryDisplay(entry, methodOptions).label }}
                  </p>
                </div>

                <UButton
                  :data-testid="`remove-payment-entry-${index}`"
                  type="button"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :disabled="isSubmitting"
                  @click="handleEntryRemove(index)"
                />
              </div>

              <UFormField label="Monto" :error="entryErrors[index]?.amountCents">
                <UInputNumber
                  :data-testid="`payment-amount-${index}`"
                  :model-value="entryForms[index]?.amountPesos ?? 0"
                  :min="0"
                  :step="1"
                  :disabled="isSubmitting"
                  :format-options="{
                    style: 'currency',
                    currency: 'MXN',
                    currencyDisplay: 'narrowSymbol',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }"
                  color="warning"
                  variant="outline"
                  class="w-full"
                  @update:model-value="handleAmountChange(index, $event ?? 0)"
                />
              </UFormField>

              <UFormField
                v-if="entryNeedsReference(entry.method)"
                label="Referencia"
                :error="entryErrors[index]?.reference"
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
          </section>
        </div>

        <!-- Sticky footer -->
        <div class="shrink-0 space-y-3 border-t border-default bg-default px-5 py-4">
          <!-- Totals row -->
          <div class="rounded-xl border border-default bg-elevated px-4 py-3 text-sm">
            <div class="flex items-center justify-between gap-2">
              <p>Recibido: <span class="font-semibold">{{ formatCentsMXN(receivedCents) }}</span></p>
              <p>
                Restante:
                <span class="font-semibold" :class="remainingCents > 0 ? 'text-error' : 'text-success'">
                  {{ formatCentsMXN(remainingCents) }}
                </span>
              </p>
            </div>
          </div>

          <!-- Aggregate / inline error -->
          <p v-if="aggregateError" class="text-sm text-error">{{ aggregateError }}</p>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" :disabled="isSubmitting" @click="close">
              Cancelar
            </UButton>
            <UButton
              data-testid="confirm-debt-payment"
              color="primary"
              :loading="isSubmitting"
              :disabled="!canSubmit"
              class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
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
