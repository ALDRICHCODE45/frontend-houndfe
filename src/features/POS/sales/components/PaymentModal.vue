<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChargeSalePayload, LegacyChargePayload, NonCreditPaymentMethod, PaymentEntry, SaleDraftCustomer } from '../interfaces/sale.types'
import { PAYMENT_METHOD } from '../constants/sale.constants' // sdd/magic-string-constants slice 3 — lowercase contract.
import DateFieldPopover from './DateFieldPopover.vue'
import { newIdempotencyKey } from '../utils/idempotency.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { getPaymentMethodColor } from '../utils/salePaymentMethod.utils'
import { normalizeReferenceInput } from '../utils/paymentEntries.utils'
import { useSalePaymentMethods } from '../composables/useSalePaymentMethods'
import {
  buildMergedMethodOptions,
  findEntryIndex,
  getMethodCount,
  paymentEntryKey,
  paymentMethodTileKey,
  resolveEntryDisplay,
  type EntryDisplay,
  type PaymentMethodTile,
} from '../utils/paymentMethodTile.utils'
import { PAYMENT_METHOD_CATEGORY_ICONS } from '@/core/shared/constants/payment-method-category'

const props = defineProps<{
  open: boolean
  totalCents: number
  saleId: string
  customer?: SaleDraftCustomer | null
  isSubmitting?: boolean
  externalError?: string | null
  // sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): the parent
  // increments this counter when a charge resolves a catalog error; the modal
  // then drops every entry carrying a `paymentMethodId` (custom tiles) and
  // preserves fixed entries. The increment dispatch lands in S5A.
  catalogClearSignal?: number
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [{ saleId: string; payload: ChargeSalePayload; idempotencyKey: string }]
  'request-assign-customer': []
}>()

type PaymentEntryForm = {
  method: NonCreditPaymentMethod
  amountPesos: number
  reference: string
  // sdd custom-payment-methods S4B (REQ-CAT-001 / design §1.3): present ONLY
  // for custom tiles; absent for fixed tiles (legacy byte-identical).
  paymentMethodId?: string
}

const CARD_METHODS: NonCreditPaymentMethod[] = [
  PAYMENT_METHOD.CARD_CREDIT,
  PAYMENT_METHOD.CARD_DEBIT,
  PAYMENT_METHOD.TRANSFER,
]
const MAX_ENTRIES = 5

const entries = ref<PaymentEntryForm[]>([])
const inlineError = ref<string | null>(null)
const idempotencyKey = ref<string>('')
const dueDateInput = ref<string | null>(null)
const isDueDateExpanded = ref(false)

function todayISODate(): string {
  const t = new Date()
  const yyyy = t.getFullYear()
  const mm = String(t.getMonth() + 1).padStart(2, '0')
  const dd = String(t.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const minDueDate = computed(() => todayISODate())
const isDueDateValid = computed(() => {
  if (!dueDateInput.value) return true // empty is valid (optional)
  return dueDateInput.value >= minDueDate.value
})

// sdd custom-payment-methods S4B (REQ-PT-004): merged tile options — the 4
// fixed tiles followed by every active custom method from the projection.
// Empty / failed projection degrades to fixed-only (REQ-PT-005 / 006).
const { data: projection } = useSalePaymentMethods()
const methodOptions = computed<PaymentMethodTile[]>(() => buildMergedMethodOptions(projection.value ?? []))

function tileTestId(tile: PaymentMethodTile): string {
  if (tile.kind === 'custom') return `payment-method-tile-custom-${tile.paymentMethodId}`
  // Legacy testids: cash keeps `add-payment-entry`, the other fixed tiles
  // keep `payment-method-tile-${value}` (design §1.4 — no testid drift).
  if (tile.value === PAYMENT_METHOD.CASH) return 'add-payment-entry'
  return `payment-method-tile-${tile.value}`
}

const totalFormatted = computed(() => formatCentsMXN(props.totalCents))
const paidSumCents = computed(() => {
  return entries.value.reduce((sum, entry) => sum + Math.max(0, Math.round(entry.amountPesos * 100)), 0)
})
const hasCashPayment = computed(() => entries.value.some((entry) => entry.method === PAYMENT_METHOD.CASH))
const remainingCents = computed(() => props.totalCents - paidSumCents.value)
const hasCustomer = computed(() => props.customer != null)
const isPartial = computed(() => paidSumCents.value < props.totalCents)
const debtToGenerateCents = computed(() => Math.max(0, props.totalCents - paidSumCents.value))
const canSubmitPartial = computed(() => hasCustomer.value && isPartial.value)
const changeDueCents = computed(() => {
  if (!hasCashPayment.value || isPartial.value) return 0
  return paidSumCents.value - props.totalCents
})
const canAddEntry = computed(() => entries.value.length < MAX_ENTRIES)
const canSubmit = computed(
  () => !props.isSubmitting && (entries.value.length === 0 ? hasCustomer.value : (!isPartial.value || canSubmitPartial.value)) && !inlineError.value,
)
const confirmButtonLabel = computed(() => {
  if (entries.value.length === 0 && hasCustomer.value) {
    return `Confirmar cobro · Deuda ${formatCentsMXN(debtToGenerateCents.value)}`
  }
  if (isPartial.value && hasCustomer.value) {
    return `Confirmar cobro · Deuda ${formatCentsMXN(debtToGenerateCents.value)}`
  }

  return 'Confirmar cobro'
})

function entryNeedsReference(method: NonCreditPaymentMethod): boolean {
  return CARD_METHODS.includes(method)
}

// ── sdd custom-payment-methods S4B — wire projection helpers ────────────────────
//
// `toWireEntry` is THE single normalization from a form row to the wire
// `PaymentEntry` shape. It forwards `paymentMethodId` ONLY when present
// (custom tiles), so fixed entries stay byte-identical (REQ-CAT-001 / §1.3).
function toWireEntry(entry: PaymentEntryForm): PaymentEntry {
  const payment: PaymentEntry = {
    method: entry.method,
    amountCents: Math.max(0, Math.round(entry.amountPesos * 100)),
  }

  if (entry.paymentMethodId !== undefined) {
    payment.paymentMethodId = entry.paymentMethodId
  }

  return payment
}

// Wire projection of the current form rows — single source for tile matching
// (toggle / count badge / entries-list key), 1:1 with `entries`.
const wireEntries = computed<PaymentEntry[]>(() => entries.value.map(toWireEntry))

// Entries-list display labels: catalog name for custom entries, base category
// label for fixed entries (design §1.4 — resolveEntryDisplay, single source).
const entryDisplays = computed<EntryDisplay[]>(() =>
  entries.value.map((entry) => resolveEntryDisplay(toWireEntry(entry), methodOptions.value)),
)

function createDefaultEntry(tile: PaymentMethodTile): PaymentEntryForm {
  const entry: PaymentEntryForm = {
    method: tile.value,
    amountPesos: tile.value === PAYMENT_METHOD.CASH ? props.totalCents / 100 : 0,
    reference: '',
  }

  // paymentMethodId is set ONLY for custom tiles (REQ-CAT-001 / design §1.3).
  if (tile.kind === 'custom') {
    entry.paymentMethodId = tile.paymentMethodId
  }

  return entry
}

function normalizeEntries(): PaymentEntry[] {
  // sales-pos-charge WU-C.2 (REQ-NEW-9): reference is optional for non-CASH
  // entries. `normalizeReferenceInput` trims; an empty/whitespace input
  // becomes `undefined`, which we treat as "omit the key" — the backend
  // defaults the reference to null on save. A non-empty trimmed string is
  // passed through verbatim.
  return entries.value
    .map((entry) => {
      const payment = toWireEntry(entry)

      if (entryNeedsReference(entry.method)) {
        // Treat null and undefined the same: omit the key entirely so the
        // backend never receives `reference: null` (the spec requires
        // omitting, REQ-NEW-9). Only forward non-empty trimmed strings.
        const normalized = normalizeReferenceInput(entry.reference)
        if (normalized !== null && normalized !== undefined) {
          payment.reference = normalized
        }
      }

      return payment
    })
    .filter((payment) => payment.amountCents > 0) // Filter out zero-amount entries
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    entries.value = [] // Start with empty list, no preselected payment
    inlineError.value = null
    idempotencyKey.value = newIdempotencyKey()
    dueDateInput.value = null
    isDueDateExpanded.value = false
  },
  { immediate: true },
)

// The "no customer + partial/empty payment" state is communicated by the UAlert
// in the footer (with its CTA). Do NOT duplicate that message in inlineError —
// it would render twice (yellow alert + red inline text). inlineError is kept
// for orthogonal validation messages (due-date in the past, etc.).
watch([isPartial, hasCustomer, entries], () => {
  if (!props.open) return
  inlineError.value = null
}, { deep: true })

// sdd custom-payment-methods S4B: entry construction is tile-aware so custom
// tiles thread their UUID while fixed tiles stay byte-identical (REQ-CAT-001).
// The no-arg `addEntry()` was dead code (nothing called it) and is replaced by
// the tile-aware versions below.
function addEntryWithMethod(tile: PaymentMethodTile) {
  if (!canAddEntry.value) return
  entries.value.push(createDefaultEntry(tile))
}

// toggleMethod(tile) — tile-identity matcher (design §1.2/§1.4). The grid
// passes the WHOLE tile; the matcher resolves the selection key as
// `paymentMethodId ?? method`, so a fixed tile never toggles a custom entry of
// the same category and two customs of the same category never collide.
function toggleMethod(tile: PaymentMethodTile) {
  const existingIndex = findEntryIndex(wireEntries.value, tile)

  if (existingIndex >= 0) {
    // Remove the matching entry (toggle off) — only the identity-matched row.
    entries.value = entries.value.filter((_entry, index) => index !== existingIndex)
  } else {
    // Add new entry (toggle on)
    if (canAddEntry.value) {
      entries.value.push(createDefaultEntry(tile))
    }
  }
}

function removeEntry(index: number) {
  if (entries.value.length <= 1) return
  entries.value = entries.value.filter((_entry, currentIndex) => currentIndex !== index)
}

function validate(): boolean {
  // sales-pos-charge WU-C.2 (REQ-NEW-9): reference is OPTIONAL. We no
  // longer block submit on missing reference. The remaining gates:
  //   1. "no customer + partial/empty payment" — handled by the UAlert in
  //      the footer; validate() just blocks submit silently (no inline msg).
  //   2. due-date must be today or later, if specified.
  if (entries.value.length === 0 && !hasCustomer.value) {
    return false
  }

  if (isPartial.value && !hasCustomer.value) {
    return false
  }

  if (!isDueDateValid.value) {
    inlineError.value = 'La fecha de vencimiento debe ser hoy o posterior'
    return false
  }

  inlineError.value = null
  return true
}

function buildPayload(): ChargeSalePayload {
  const payments = normalizeEntries()
  const dueDate = dueDateInput.value || undefined

  if (payments.length === 1) {
    const single = payments[0]
    if (!single) {
      return dueDate ? { payments, dueDate } : { payments }
    }

    // sdd custom-payment-methods S4B (REQ-CAT-002 / design §1.3): flatten a
    // single-entry charge into the legacy single-payment shape, forwarding
    // `paymentMethodId` ONLY when the entry is a custom tile (fixed entries
    // stay byte-identical).
    const legacy: LegacyChargePayload = {
      method: single.method,
      amountCents: single.amountCents,
    }
    if (single.paymentMethodId !== undefined) {
      legacy.paymentMethodId = single.paymentMethodId
    }
    if (dueDate) {
      legacy.dueDate = dueDate
    }
    return legacy
  }

  return dueDate ? { payments, dueDate } : { payments }
}

function handleSubmit() {
  if (!validate()) return
  if (!canSubmit.value) return

  emit('submit', {
    saleId: props.saleId,
    payload: buildPayload(),
    idempotencyKey: idempotencyKey.value,
  })
}

watch(
  () => props.totalCents,
  () => {
    if (!props.open || entries.value.length !== 1) return
    if (entries.value[0]) {
      entries.value[0].amountPesos = props.totalCents / 100
    }
  },
)

// sales-pos-charge WU-C.2: keep idempotency-key regeneration on any entry
// change (amount, method, reference) so the cashier can't replay a stale
// charge request after editing fields. The previous reference-error
// bookkeeping has been removed since REQ-NEW-9 made reference optional.
watch(
  entries,
  () => {
    if (!props.open) return
    idempotencyKey.value = newIdempotencyKey()
  },
  { deep: true },
)

watch(entries, (next) => {
  if (!props.open || next.length === 0) return
  if (next.length <= MAX_ENTRIES) return
  entries.value = next.slice(0, MAX_ENTRIES)
})

// sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): when the parent
// increments `catalogClearSignal` (a charge resolved a catalog error), drop
// EVERY entry carrying a `paymentMethodId` (custom tiles) and preserve the
// fixed entries. The deep `entries` watcher above then regenerates the
// idempotency key, so the follow-up submit is a fresh request.
watch(
  () => props.catalogClearSignal,
  () => {
    if (!props.open) return
    entries.value = entries.value.filter((entry) => entry.paymentMethodId === undefined)
  },
)

function getMethodColor(method: NonCreditPaymentMethod): string {
  return getPaymentMethodColor(method.toUpperCase())
}
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
              <p class="text-lg font-bold text-highlighted">Cobrar venta</p>
              <p class="text-xs text-muted">Selecciona los métodos de pago</p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :disabled="isSubmitting"
              @click="emit('update:open', false)"
            />
          </div>

          <div class="rounded-2xl border border-coco-gold-500/20 bg-coco-gold-500/5 px-5 py-4 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Total a cobrar</p>
            <p class="mt-1 text-4xl font-black tabular-nums text-highlighted">{{ totalFormatted }}</p>
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
                :data-method="option.value"
                type="button"
                class="relative rounded-xl border px-3 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  getMethodCount(wireEntries, option) > 0
                    ? 'border-coco-gold-500/40 bg-coco-gold-500/5'
                    : 'border-default bg-elevated hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5'
                "
                :disabled="getMethodCount(wireEntries, option) === 0 && !canAddEntry || isSubmitting"
                @click="toggleMethod(option)"
              >
                <UBadge
                  v-if="getMethodCount(wireEntries, option) > 0"
                  class="absolute right-2 top-2"
                  size="sm"
                  :color="getMethodColor(option.value)"
                  variant="soft"
                >
                  {{ getMethodCount(wireEntries, option) }}
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
              :key="paymentEntryKey(wireEntries[index])"
              :data-testid="`payment-entry-${index}`"
              class="space-y-3 rounded-xl border border-default bg-default px-3 py-3"
            >
              <div class="flex items-center gap-3">
                <UBadge :color="getMethodColor(entry.method)" variant="soft" size="lg" class="shrink-0">
                  <UIcon :name="PAYMENT_METHOD_CATEGORY_ICONS[entry.method]" class="size-4" />
                </UBadge>

                <div class="min-w-0 flex-1">
                  <p :data-testid="`payment-method-${index}`" class="text-sm font-semibold text-highlighted">
                    {{ entryDisplays[index]?.label }}
                  </p>
                </div>

                <UButton
                  v-if="entries.length > 1"
                  :data-testid="`remove-payment-entry-${index}`"
                  type="button"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :disabled="isSubmitting"
                  @click="removeEntry(index)"
                />
              </div>

              <UFormField label="Monto recibido">
                <UInputNumber
                  :data-testid="`payment-amount-${index}`"
                  v-model="entry.amountPesos"
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
                />
              </UFormField>

              <UFormField
                v-if="entryNeedsReference(entry.method)"
                label="Referencia (opcional)"
              >
                <UInput
                  :data-testid="`payment-reference-${index}`"
                  v-model="entry.reference"
                  placeholder="Ej: VOUCHER-123"
                  :disabled="isSubmitting"
                />
                </UFormField>
              </div>
            </section>

            <!-- Optional due date for resulting debt — collapsed by default -->
            <section data-testid="due-date-section">
              <button
                v-if="!isDueDateExpanded && !dueDateInput"
                type="button"
                data-testid="expand-due-date"
                class="flex items-center gap-1.5 text-xs text-coco-gold-700 dark:text-coco-gold-400 hover:underline disabled:opacity-50"
                :disabled="isSubmitting"
                @click="isDueDateExpanded = true"
              >
                <UIcon name="i-lucide-calendar-plus" class="size-3.5" />
                Agregar fecha de vencimiento
              </button>

              <div v-else class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium text-highlighted">Vencimiento</p>
                  <button
                    type="button"
                    data-testid="collapse-due-date"
                    class="text-xs text-muted hover:underline"
                    :disabled="isSubmitting"
                    @click="dueDateInput = null; isDueDateExpanded = false"
                  >
                    Quitar
                  </button>
                </div>
                <p class="text-xs text-muted">
                  Fecha en que vence la deuda generada. Si no la indicás, el sistema aplica el plazo por defecto.
                </p>
                <DateFieldPopover
                  v-model="dueDateInput"
                  testid="due-date-input"
                  placeholder="Elegir fecha"
                  :disabled="isSubmitting"
                  :min-iso="minDueDate"
                />
              </div>
            </section>
          </div>

        <!-- Sticky footer -->
        <div class="shrink-0 space-y-3 border-t border-default bg-default px-5 py-4">
          <div class="rounded-xl border border-default bg-elevated px-4 py-3 text-sm">
            <div class="flex items-center justify-between gap-2">
              <p>Recibido: <span class="font-semibold">{{ formatCentsMXN(paidSumCents) }}</span></p>
              <p>Restante: <span class="font-semibold">{{ formatCentsMXN(Math.max(remainingCents, 0)) }}</span></p>
            </div>
            <p v-if="changeDueCents > 0" class="mt-1">
              Cambio: <span class="font-semibold">{{ formatCentsMXN(changeDueCents) }}</span>
            </p>
          </div>

          <UAlert
            v-if="(isPartial || entries.length === 0) && !hasCustomer"
            color="warning"
            variant="soft"
            icon="i-lucide-info"
            title="Asigna un cliente para registrar una venta con deuda"
            description="Asigna un cliente para registrar una venta con deuda"
          >
            <template #actions>
              <UButton
                data-testid="assign-customer-cta"
                color="warning"
                variant="soft"
                size="sm"
                @click="emit('request-assign-customer')"
              >
                Asignar cliente
              </UButton>
            </template>
          </UAlert>

          <div
            v-if="(isPartial || entries.length === 0) && hasCustomer"
            class="flex items-center justify-between gap-2 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm"
          >
            <p class="text-highlighted">Deuda a generar: <span class="font-semibold">{{ formatCentsMXN(debtToGenerateCents) }}</span></p>
          </div>

          <p v-if="inlineError || externalError" class="text-sm text-error">{{ inlineError ?? externalError }}</p>

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" :disabled="isSubmitting" @click="emit('update:open', false)">
              Cancelar
            </UButton>
            <UButton
              data-testid="confirm-charge"
              color="primary"
              :loading="isSubmitting"
              :disabled="!canSubmit"
              class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
              @click="handleSubmit"
            >
              {{ confirmButtonLabel }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
