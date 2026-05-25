<script setup lang="ts">
import { computed } from 'vue'
import type { PaymentEntry } from '../../interfaces/sale.types'
import { currencyToCents } from '../../utils/currency.utils'
import { PAYMENT_METHOD_CONFIG } from './paymentMethod.config'

type EntryPatch = Partial<Pick<PaymentEntry, 'amountCents' | 'reference'>>

const props = withDefaults(defineProps<{
  entry: PaymentEntry
  index: number
  remaining: number
  validation?: {
    amountCents?: string
    reference?: string
  }
  disabled?: boolean
}>(), {
  validation: () => ({}),
  disabled: false,
})

const emit = defineEmits<{
  update: [index: number, patch: EntryPatch]
  remove: [index: number]
}>()

const amountPesos = computed<number>({
  get() {
    return props.entry.amountCents / 100
  },
  set(value) {
    const nextAmountCents = currencyToCents(value)
    emit('update', props.index, { amountCents: nextAmountCents })
  },
})

const requiresReference = computed(() => props.entry.method !== 'cash')

function onReferenceInput(value: string): void {
  emit('update', props.index, { reference: value })
}

function handleRemove(): void {
  emit('remove', props.index)
}
</script>

<template>
  <div
    :data-testid="`payment-entry-${index}`"
    class="rounded-lg border border-(--ui-border) p-3 space-y-3"
  >
    <div class="flex items-center justify-between gap-3">
      <UBadge color="neutral" variant="soft" :label="PAYMENT_METHOD_CONFIG[entry.method].label" />

      <UButton
        :data-testid="`payment-entry-remove-${index}`"
        icon="i-lucide-trash"
        color="error"
        variant="ghost"
        :disabled="disabled"
        @click="handleRemove"
      />
    </div>

    <UFormField label="Monto" :error="validation.amountCents">
      <UInputNumber
        :data-testid="`payment-entry-amount-${index}`"
        v-model="amountPesos"
        :min="0"
        :step="0.01"
        :format-options="{ style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol' }"
        :disabled="disabled"
      />
    </UFormField>

    <UFormField v-if="requiresReference" label="Referencia" :error="validation.reference">
      <UInput
        :data-testid="`payment-entry-reference-${index}`"
        :model-value="entry.reference ?? ''"
        :disabled="disabled"
        @update:model-value="onReferenceInput"
      />
    </UFormField>
  </div>
</template>
