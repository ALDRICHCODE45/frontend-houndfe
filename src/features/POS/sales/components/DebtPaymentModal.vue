<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'
import type { DebtPaymentPayload, NonCreditPaymentMethod } from '../interfaces/sale.types'

const props = withDefaults(
  defineProps<{
    open: boolean
    saleId: string
    debtCents: number
    isSubmitting?: boolean
    externalError?: string | null
  }>(),
  {
    isSubmitting: false,
    externalError: null,
  },
)

const emit = defineEmits<{
  'update:open': [boolean]
  submit: [DebtPaymentPayload]
}>()

const method = ref<NonCreditPaymentMethod>('cash')
const amountMx = ref<number>(0)
const reference = ref('')
const inlineError = ref<string | null>(null)

const methods = [
  { label: 'Efectivo', value: 'cash' },
  { label: 'Tarjeta crédito', value: 'card_credit' },
  { label: 'Tarjeta débito', value: 'card_debit' },
  { label: 'Transferencia', value: 'transfer' },
] as const

const requiresReference = computed(() => method.value !== 'cash')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    amountMx.value = Math.max(0, props.debtCents / 100)
    method.value = 'cash'
    reference.value = ''
    inlineError.value = null
  },
  { immediate: true },
)

function closeModal() {
  emit('update:open', false)
}

function handleSubmit() {
  inlineError.value = null
  const rawAmount = Math.round(amountMx.value * 100)
  const amountCents = Math.min(Math.max(rawAmount, 1), props.debtCents)

  if (requiresReference.value && !reference.value.trim()) {
    inlineError.value = 'Ingresá la referencia para tarjeta o transferencia.'
    return
  }

  emit('submit', {
    method: method.value,
    amountCents,
    reference: requiresReference.value ? reference.value.trim() : undefined,
  })
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">Deuda actual: {{ formatCentsMXN(debtCents) }}</p>

        <UFormField label="Método">
          <USelect v-model="method" :items="methods" data-testid="debt-payment-method" />
        </UFormField>

        <UFormField label="Monto" help="Debe ser mayor o igual a $0.01 y no superar la deuda">
          <UInputNumber
            v-model="amountMx"
            :max="debtCents / 100"
            :disabled="isSubmitting"
            data-testid="debt-payment-amount"
          />
        </UFormField>

        <UFormField v-if="requiresReference" label="Referencia" :error="inlineError ?? undefined">
          <UInput v-model="reference" :disabled="isSubmitting" data-testid="debt-payment-reference" />
        </UFormField>

        <p v-if="!requiresReference && inlineError" class="text-sm text-error">{{ inlineError }}</p>
        <p v-if="externalError" class="text-sm text-error">{{ externalError }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" :disabled="isSubmitting" @click="closeModal">Cancelar</UButton>
        <UButton
          color="primary"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          data-testid="submit-debt-payment"
          @click="handleSubmit"
        >
          Registrar pago
        </UButton>
      </div>
    </template>
  </UModal>
</template>
