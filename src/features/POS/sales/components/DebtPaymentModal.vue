<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatPaymentMethod, getPaymentMethodColor } from '../utils/salePaymentMethod.utils'
import { useDebtPayment } from '../composables/useDebtPayment'
import type { CollectionPaymentMethod, PaymentEntry } from '../interfaces/sale.types'
import {
  MAX_PAYMENT_ENTRIES,
  addEntry,
  paidSum,
  updateEntry,
  removeEntry,
  validateAggregate,
  validateEntry,
} from '../utils/paymentEntries.utils'
import { newIdempotencyKey } from '../utils/idempotency.utils'

const props = defineProps<{
  open: boolean
  debtCents: number
  saleId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const entries = ref<PaymentEntry[]>([])
const idempotencyKey = ref('')
const inlineAggregateError = ref<string | null>(null)

const CARD_METHODS: CollectionPaymentMethod[] = ['card_credit', 'card_debit', 'transfer']

const methodOptions: ReadonlyArray<{ value: CollectionPaymentMethod; label: string; icon: string }> = [
  { value: 'cash', label: 'Efectivo', icon: 'i-lucide-banknote' },
  { value: 'card_credit', label: 'Tarjeta crédito', icon: 'i-lucide-credit-card' },
  { value: 'card_debit', label: 'Tarjeta débito', icon: 'i-lucide-wallet-cards' },
  { value: 'transfer', label: 'Transferencia', icon: 'i-lucide-arrow-right-left' },
] as const

const methodIconMap: Readonly<Record<CollectionPaymentMethod, string>> = {
  cash: 'i-lucide-banknote',
  card_credit: 'i-lucide-credit-card',
  card_debit: 'i-lucide-wallet-cards',
  transfer: 'i-lucide-arrow-right-left',
} as const

const {
  submitSafe,
  isSubmitting,
  externalErrorCode,
  shouldClose,
  resetError,
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

function getMethodCount(method: CollectionPaymentMethod): number {
  return entries.value.filter((e) => e.method === method).length
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

function handleMethodToggle(method: CollectionPaymentMethod): void {
  const existingIndex = entries.value.findIndex((e) => e.method === method)
  if (existingIndex >= 0) {
    entries.value = removeEntry(entries.value, existingIndex)
  } else {
    entries.value = addEntry(entries.value, method, props.debtCents)
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

  const result = await submitSafe({
    payload: { payments: entries.value },
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
    inlineAggregateError.value = 'El monto supera la deuda actual. Revisá el saldo.'
  }
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
              <p class="text-xs text-muted">Seleccioná los métodos de pago</p>
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
          <div class="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-center">
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
                :key="option.value"
                :data-testid="`payment-method-tile-${option.value}`"
                type="button"
                class="relative rounded-xl border px-3 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  getMethodCount(option.value) > 0
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-default bg-elevated hover:border-primary/40 hover:bg-primary/5'
                "
                :disabled="(getMethodCount(option.value) === 0 && !canAddEntry) || isSubmitting"
                @click="handleMethodToggle(option.value)"
              >
                <UBadge
                  v-if="getMethodCount(option.value) > 0"
                  class="absolute right-2 top-2"
                  size="sm"
                  :color="getMethodColor(option.value)"
                  variant="soft"
                >
                  {{ getMethodCount(option.value) }}
                </UBadge>
                <UIcon :name="option.icon" class="mb-2 size-6 text-primary" />
                <p class="text-sm font-semibold text-highlighted">{{ option.label }}</p>
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
              <p class="text-sm text-muted">Seleccioná un método de pago arriba</p>
            </div>

            <div
              v-for="(entry, index) in entries"
              :key="`entry-${index}`"
              :data-testid="`payment-entry-${index}`"
              class="space-y-3 rounded-xl border border-default bg-default px-3 py-3"
            >
              <div class="flex items-center gap-3">
                <UBadge :color="getMethodColor(entry.method)" variant="soft" size="lg" class="shrink-0">
                  <UIcon :name="methodIconMap[entry.method]" class="size-4" />
                </UBadge>

                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-highlighted">
                    {{ formatPaymentMethod(entry.method.toUpperCase()) }}
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
                  color="primary"
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
