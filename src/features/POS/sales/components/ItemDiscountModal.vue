<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApplyItemDiscountPayload, SaleItem } from '../interfaces/sale.types'
import { currencyToCents, formatCentsMXN, normalizeDecimalInput } from '../utils/currency.utils'

const props = defineProps<{ open: boolean; item: SaleItem; onApplyDiscount: (itemId: string, payload: ApplyItemDiscountPayload) => Promise<unknown> }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const mode = ref<'amount' | 'percentage'>('amount')
const amountInput = ref('')
const percentInput = ref('')
const titleInput = ref('')
const error = ref<string | null>(null)

const amountCents = computed(() => {
  const normalized = normalizeDecimalInput(amountInput.value)
  const value = Number(normalized)
  if (!normalized || !Number.isFinite(value)) return null
  return currencyToCents(value)
})

const percentValue = computed(() => {
  const normalized = normalizeDecimalInput(percentInput.value)
  const value = Number(normalized)
  if (!normalized || !Number.isFinite(value)) return null
  return value
})

const previewDiscountCents = computed(() => {
  if (mode.value === 'amount') return amountCents.value ?? 0
  const percent = percentValue.value ?? 0
  return Math.round((props.item.unitPriceCents * percent) / 100)
})

const previewFinalCents = computed(() => props.item.unitPriceCents - previewDiscountCents.value)

const canSubmit = computed(() => {
  if (mode.value === 'amount') {
    return Number.isInteger(amountCents.value) && (amountCents.value ?? 0) > 0 && (amountCents.value ?? 0) < props.item.unitPriceCents
  }
  return (percentValue.value ?? 0) > 0 && (percentValue.value ?? 0) <= 100
})

async function submit() {
  error.value = null
  if (!canSubmit.value) {
    error.value = 'Ingresá un descuento válido.'
    return
  }

  const title = titleInput.value.trim()
  const payload: ApplyItemDiscountPayload =
    mode.value === 'amount'
      ? { type: 'amount', amountCents: amountCents.value ?? 0, ...(title ? { title } : {}) }
      : { type: 'percentage', percent: percentValue.value ?? 0, ...(title ? { title } : {}) }

  await props.onApplyDiscount(props.item.id, payload)
  emit('update:open', false)
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    mode.value = 'amount'
    amountInput.value = ''
    percentInput.value = ''
    titleInput.value = ''
    error.value = null
  },
)
</script>

<template>
  <UModal :open="open" title="Agregar descuento" :content="{ class: 'sm:max-w-lg' }" @update:open="emit('update:open', $event)">
    <template #body>
      <form id="item-discount-form" class="space-y-4" @submit.prevent="submit">
        <section class="rounded-lg border border-default p-3 space-y-2 bg-elevated/30">
          <p class="text-sm font-medium">Resumen del ítem</p>
          <p class="text-xs text-muted">Precio actual: {{ formatCentsMXN(item.unitPriceCents) }}</p>
        </section>

        <section class="rounded-lg border border-default p-3 space-y-3">
          <p class="text-sm font-medium">Modo de descuento</p>
          <div class="grid grid-cols-2 gap-2">
            <UButton type="button" class="w-full" label="Monto" :variant="mode === 'amount' ? 'solid' : 'outline'" @click="mode = 'amount'" />
            <UButton type="button" class="w-full" label="Porcentaje" :variant="mode === 'percentage' ? 'solid' : 'outline'" @click="mode = 'percentage'" />
          </div>
          <p v-if="mode === 'amount'" class="text-xs text-muted">Descontá un monto fijo en MXN sobre el precio unitario.</p>
          <p v-else class="text-xs text-muted">Aplicá un porcentaje del 0 al 100 sobre el precio unitario.</p>
        </section>

        <UFormField v-if="mode === 'amount'" label="Descuento en pesos (MXN)" description="Debe ser mayor a 0 y menor que el precio actual.">
          <UInput
            v-model="amountInput"
            class="w-full"
            type="text"
            inputmode="decimal"
            placeholder="Ej: 50"
          />
        </UFormField>

        <UFormField v-else label="Porcentaje de descuento (%)" description="Rango válido: mayor a 0 y hasta 100.">
          <UInput
            v-model="percentInput"
            class="w-full"
            type="text"
            inputmode="decimal"
            placeholder="Ej: 10"
          />
        </UFormField>

        <UFormField label="Título (opcional)">
          <UInput v-model="titleInput" class="w-full" placeholder="Ej: Promo especial" />
        </UFormField>

        <p class="text-xs text-muted font-medium">
          Precio actual: {{ formatCentsMXN(item.unitPriceCents) }} → Precio final: {{ formatCentsMXN(Math.max(previewFinalCents, 0)) }}
        </p>
        <UAlert v-if="error" color="warning" variant="soft" :description="error" />
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="soft" label="Cancelar" @click="emit('update:open', false)" />
        <UButton type="submit" form="item-discount-form" color="primary" label="Aplicar descuento" :disabled="!canSubmit" />
      </div>
    </template>
  </UModal>
</template>
