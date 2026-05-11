<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChargeSalePayload, PaymentMethod } from '../interfaces/sale.types'
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

const method = ref<PaymentMethod>('cash')
const amountPesos = ref<number>(props.totalCents / 100)
const inlineError = ref<string | null>(null)
const idempotencyKey = ref<string>('')

const methodOptions = [
  { value: 'cash', label: 'Efectivo', icon: 'i-lucide-banknote' },
  { value: 'card_credit', label: 'Tarjeta crédito', icon: 'i-lucide-credit-card' },
  { value: 'card_debit', label: 'Tarjeta débito', icon: 'i-lucide-badge-credit-card' },
  { value: 'transfer', label: 'Transferencia', icon: 'i-lucide-arrow-right-left' },
] as const

const isCash = computed(() => method.value === 'cash')
const totalFormatted = computed(() => formatCentsMXN(props.totalCents))
const amountCents = computed(() => Math.round(amountPesos.value * 100))
const inputHelpText = computed(() => {
  if (isCash.value) return 'Ingresá el efectivo recibido. Puede ser mayor al total para calcular cambio.'
  return 'Este método debe cubrir el total exacto de la venta.'
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    method.value = 'cash'
    amountPesos.value = props.totalCents / 100
    inlineError.value = null
    idempotencyKey.value = newIdempotencyKey()
  },
  { immediate: true },
)

watch(method, (next, prev) => {
  if (!props.open || next === prev) return
  amountPesos.value = props.totalCents / 100
  idempotencyKey.value = newIdempotencyKey()
})

watch(amountPesos, (next, prev) => {
  if (!props.open || next === prev || !isCash.value) return
  idempotencyKey.value = newIdempotencyKey()
})

function validate(): string | null {
  if (isCash.value) {
    return amountCents.value >= props.totalCents ? null : 'El monto recibido es insuficiente'
  }
  return amountCents.value === props.totalCents ? null : 'El monto debe ser exacto'
}

function handleSubmit() {
  inlineError.value = validate()
  if (inlineError.value) return

  emit('submit', {
    saleId: props.saleId,
    payload: {
      method: method.value,
      amountCents: amountCents.value,
    },
    idempotencyKey: idempotencyKey.value,
  })
}
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

      <div class="space-y-3">
        <p class="text-sm font-semibold text-highlighted">Método de pago</p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <UButton
            v-for="option in methodOptions"
            :key="option.value"
            type="button"
            color="neutral"
            :variant="method === option.value ? 'subtle' : 'outline'"
            size="lg"
            class="justify-start rounded-xl px-4 py-3 text-left"
            :class="method === option.value ? 'ring-2 ring-primary/70 bg-primary/10' : ''"
            @click="method = option.value"
          >
            <template #leading>
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon :name="option.icon" class="h-5 w-5" />
              </span>
            </template>
            <span class="font-semibold">{{ option.label }}</span>
          </UButton>
        </div>
      </div>

      <UFormField label="Monto recibido" :help="inputHelpText" :error="inlineError ?? externalError ?? undefined">
        <UInputNumber
          v-model="amountPesos"
          :min="0"
          :step="1"
          :readonly="!isCash"
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
          size="xl"
          class="w-full"
        />
      </UFormField>
    </template>

    <template #footer>
      <p class="text-xs text-muted">
        {{ isCash ? 'Se calculará cambio si recibís más del total.' : 'Se registrará como pago exacto.' }}
      </p>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" :disabled="isSubmitting" @click="emit('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="primary" :loading="isSubmitting" :disabled="isSubmitting" @click="handleSubmit">
          Confirmar cobro
        </UButton>
      </div>
    </template>
  </UModal>
</template>
