<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChargeSalePayload, NonCreditPaymentMethod, PaymentEntry } from '../interfaces/sale.types'
import { newIdempotencyKey } from '../utils/idempotency.utils'
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  open: boolean
  totalCents: number
  saleId: string
  isSubmitting?: boolean
  externalError?: string | null
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [{ saleId: string; payload: ChargeSalePayload; idempotencyKey: string }]
}>()

type PaymentEntryForm = {
  method: NonCreditPaymentMethod
  amountPesos: number
  reference: string
}

const CARD_METHODS: NonCreditPaymentMethod[] = ['card_credit', 'card_debit', 'transfer']
const MAX_ENTRIES = 5

const entries = ref<PaymentEntryForm[]>([])
const inlineError = ref<string | null>(null)
const referenceErrorByIndex = ref<Record<number, string>>({})
const idempotencyKey = ref<string>('')

const methodOptions: ReadonlyArray<{ value: NonCreditPaymentMethod; label: string; icon: string }> = [
  { value: 'cash', label: 'Efectivo', icon: 'i-lucide-banknote' },
  { value: 'card_credit', label: 'Tarjeta crédito', icon: 'i-lucide-credit-card' },
  { value: 'card_debit', label: 'Tarjeta débito', icon: 'i-lucide-badge-credit-card' },
  { value: 'transfer', label: 'Transferencia', icon: 'i-lucide-arrow-right-left' },
] as const

const totalFormatted = computed(() => formatCentsMXN(props.totalCents))
const paidSumCents = computed(() => {
  return entries.value.reduce((sum, entry) => sum + Math.max(0, Math.round(entry.amountPesos * 100)), 0)
})
const hasCashPayment = computed(() => entries.value.some((entry) => entry.method === 'cash'))
const remainingCents = computed(() => props.totalCents - paidSumCents.value)
const isPartialWithoutCustomer = computed(() => paidSumCents.value < props.totalCents)
const changeDueCents = computed(() => {
  if (!hasCashPayment.value || paidSumCents.value < props.totalCents) return 0
  return paidSumCents.value - props.totalCents
})
const canAddEntry = computed(() => entries.value.length < MAX_ENTRIES)
const canSubmit = computed(
  () => !props.isSubmitting && !isPartialWithoutCustomer.value && !inlineError.value && !hasReferenceErrors.value,
)
const hasReferenceErrors = computed(() => Object.keys(referenceErrorByIndex.value).length > 0)

function createDefaultEntry(): PaymentEntryForm {
  return {
    method: 'cash',
    amountPesos: props.totalCents / 100,
    reference: '',
  }
}

function entryNeedsReference(method: NonCreditPaymentMethod): boolean {
  return CARD_METHODS.includes(method)
}

function normalizeEntries(): PaymentEntry[] {
  return entries.value.map((entry) => {
    const payment: PaymentEntry = {
      method: entry.method,
      amountCents: Math.max(0, Math.round(entry.amountPesos * 100)),
    }

    if (entryNeedsReference(entry.method)) {
      payment.reference = entry.reference.trim()
    }

    return payment
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    entries.value = [createDefaultEntry()]
    inlineError.value = null
    referenceErrorByIndex.value = {}
    idempotencyKey.value = newIdempotencyKey()
  },
  { immediate: true },
)

watch(
  entries,
  () => {
    if (!props.open) return
    inlineError.value = null
    idempotencyKey.value = newIdempotencyKey()
  },
  { deep: true },
)

watch(isPartialWithoutCustomer, (isPartial) => {
  if (!props.open) return
  if (!isPartial) {
    inlineError.value = null
    return
  }
  inlineError.value = 'Para pago parcial asigná un cliente (próximamente)'
})

function addEntry() {
  if (!canAddEntry.value) return
  entries.value.push({ method: 'cash', amountPesos: 0, reference: '' })
}

function removeEntry(index: number) {
  if (entries.value.length <= 1) return
  entries.value = entries.value.filter((_entry, currentIndex) => currentIndex !== index)
}

function validate(): boolean {
  referenceErrorByIndex.value = {}

  entries.value.forEach((entry, index) => {
    if (entryNeedsReference(entry.method) && entry.reference.trim().length === 0) {
      referenceErrorByIndex.value[index] = 'Ingresá la referencia para tarjeta o transferencia'
    }
  })

  if (Object.keys(referenceErrorByIndex.value).length > 0) {
    inlineError.value = 'Ingresá la referencia para tarjeta o transferencia'
    return false
  }

  if (isPartialWithoutCustomer.value) {
    inlineError.value = 'Para pago parcial asigná un cliente (próximamente)'
    return false
  }

  inlineError.value = null
  return true
}

function buildPayload(): ChargeSalePayload {
  const payments = normalizeEntries()
  if (payments.length === 1) {
    const single = payments[0]
    if (!single) {
      return { payments }
    }
    return {
      method: single.method,
      amountCents: single.amountCents,
    }
  }

  return { payments }
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

watch(entries, (next) => {
  if (!props.open || next.length === 0) return
  if (next.length <= MAX_ENTRIES) return
  entries.value = next.slice(0, MAX_ENTRIES)
})

watch(referenceErrorByIndex, () => {
  if (!props.open) return
  if (Object.keys(referenceErrorByIndex.value).length === 0 && inlineError.value === 'Ingresá la referencia para tarjeta o transferencia') {
    inlineError.value = null
  }
})
</script>

<template>
  <UModal
    :open="open"
    title="Cobrar venta"
    description="Seleccioná un método de pago para confirmar la venta."
    :ui="{
      content: 'sm:max-w-xl',
      body: 'space-y-6',
      footer: 'justify-between',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Total a cobrar</p>
        <p class="mt-1 text-4xl font-black tabular-nums text-highlighted">{{ totalFormatted }}</p>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-highlighted">Métodos de pago</p>
          <UButton
            data-testid="add-payment-entry"
            type="button"
            color="neutral"
            variant="soft"
            :disabled="!canAddEntry || isSubmitting"
            @click="addEntry"
          >
            Agregar método
          </UButton>
        </div>

        <div
          v-for="(entry, index) in entries"
          :key="`entry-${index}`"
          :data-testid="`payment-entry-${index}`"
          class="space-y-3 rounded-xl border border-default p-4"
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <UFormField label="Método">
              <USelect
                :data-testid="`payment-method-${index}`"
                v-model="entry.method"
                :items="methodOptions"
                value-key="value"
                :disabled="isSubmitting"
              />
            </UFormField>

            <UButton
              v-if="entries.length > 1"
              :data-testid="`remove-payment-entry-${index}`"
              type="button"
              color="error"
              variant="ghost"
              :disabled="isSubmitting"
              @click="removeEntry(index)"
            >
              Quitar
            </UButton>
          </div>

          <UFormField label="Monto recibido" :error="referenceErrorByIndex[index]">
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
              color="primary"
              variant="outline"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="entryNeedsReference(entry.method)"
            label="Referencia"
            :error="referenceErrorByIndex[index]"
          >
            <UInput
              :data-testid="`payment-reference-${index}`"
              v-model="entry.reference"
              placeholder="Ej: VOUCHER-123"
              :disabled="isSubmitting"
            />
          </UFormField>
        </div>
      </div>

      <div class="space-y-1 rounded-xl border border-default bg-elevated px-4 py-3 text-sm">
        <p>Total recibido: <span class="font-semibold">{{ formatCentsMXN(paidSumCents) }}</span></p>
        <p>Restante: <span class="font-semibold">{{ formatCentsMXN(Math.max(remainingCents, 0)) }}</span></p>
        <p v-if="changeDueCents > 0">Cambio: <span class="font-semibold">{{ formatCentsMXN(changeDueCents) }}</span></p>
      </div>

      <p v-if="inlineError || externalError" class="text-sm text-error">{{ inlineError ?? externalError }}</p>
    </template>

    <template #footer>
      <p class="text-xs text-muted">
        {{ isPartialWithoutCustomer ? 'Para pago parcial asigná un cliente (próximamente)' : 'Podés combinar hasta 5 métodos.' }}
      </p>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" :disabled="isSubmitting" @click="emit('update:open', false)">
          Cancelar
        </UButton>
        <UButton
          data-testid="confirm-charge"
          color="primary"
          :loading="isSubmitting"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          Confirmar cobro
        </UButton>
      </div>
    </template>
  </UModal>
</template>
