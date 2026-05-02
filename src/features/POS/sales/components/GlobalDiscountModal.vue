<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApplyGlobalDiscountPayload, GlobalDiscountStrategy } from '../interfaces/sale.types'
import { currencyToCents, normalizeDecimalInput } from '../utils/currency.utils'

const props = defineProps<{
  open: boolean
  itemCount: number
  hasExistingDiscounts: boolean
  onApplyGlobalDiscount: (payload: ApplyGlobalDiscountPayload) => Promise<unknown>
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const mode = ref<'amount' | 'percentage'>('percentage')
const strategy = ref<GlobalDiscountStrategy>('replace')
const amountInput = ref('')
const percentInput = ref('')
const titleInput = ref('')
const error = ref<string | null>(null)
const isSubmitting = ref(false)

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

const canSubmit = computed(() => {
  if (isSubmitting.value) return false
  if (mode.value === 'amount') {
    return Number.isInteger(amountCents.value) && (amountCents.value ?? 0) > 0
  }
  return (percentValue.value ?? 0) > 0 && (percentValue.value ?? 0) <= 99
})

async function submit() {
  error.value = null
  if (!canSubmit.value) {
    error.value = 'Ingresá un descuento válido.'
    return
  }

  isSubmitting.value = true
  try {
    const title = titleInput.value.trim()
    const base = {
      ...(title ? { discountTitle: title } : {}),
      strategy: strategy.value,
    }

    const payload: ApplyGlobalDiscountPayload =
      mode.value === 'amount'
        ? { type: 'amount', amountCents: amountCents.value ?? 0, ...base }
        : { type: 'percentage', percent: percentValue.value ?? 0, ...base }

    await props.onApplyGlobalDiscount(payload)
    emit('update:open', false)
  } catch {
    error.value = 'No se pudo aplicar el descuento. Intentá de nuevo.'
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    mode.value = 'percentage'
    strategy.value = 'replace'
    amountInput.value = ''
    percentInput.value = ''
    titleInput.value = ''
    error.value = null
    isSubmitting.value = false
  },
)
</script>

<template>
  <UModal :open="open" title="Descuento global" :content="{ class: 'sm:max-w-lg' }" @update:open="emit('update:open', $event)">
    <template #body>
      <form id="global-discount-form" class="space-y-4" @submit.prevent="submit">
        <!-- Info section -->
        <section class="rounded-lg border border-default p-3 space-y-1 bg-elevated/30">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-badge-percent" class="h-4 w-4 text-primary" />
            <p class="text-sm font-medium text-highlighted">Aplicar a toda la venta</p>
          </div>
          <p class="text-xs text-muted">
            El descuento se aplicará a los <strong>{{ itemCount }} {{ itemCount === 1 ? 'producto' : 'productos' }}</strong> del carrito.
          </p>
        </section>

        <!-- Mode toggle -->
        <section class="rounded-lg border border-default p-3 space-y-3">
          <p class="text-sm font-medium">Tipo de descuento</p>
          <div class="grid grid-cols-2 gap-2">
            <UButton type="button" class="w-full" label="Porcentaje" :variant="mode === 'percentage' ? 'solid' : 'outline'" @click="mode = 'percentage'" />
            <UButton type="button" class="w-full" label="Monto fijo" :variant="mode === 'amount' ? 'solid' : 'outline'" @click="mode = 'amount'" />
          </div>
          <p v-if="mode === 'percentage'" class="text-xs text-muted">Aplicá un porcentaje (1–99%) sobre el precio unitario de cada producto.</p>
          <p v-else class="text-xs text-muted">Descontá un monto fijo en MXN a cada producto. Si algún producto tiene precio menor, se omitirá.</p>
        </section>

        <!-- Input fields -->
        <UFormField v-if="mode === 'percentage'" label="Porcentaje de descuento (%)" description="Rango válido: 1 a 99.">
          <UInput
            v-model="percentInput"
            class="w-full"
            type="text"
            inputmode="decimal"
            placeholder="Ej: 10"
          />
        </UFormField>

        <UFormField v-else label="Descuento en pesos (MXN)" description="Se aplica a cada producto individualmente.">
          <UInput
            v-model="amountInput"
            class="w-full"
            type="text"
            inputmode="decimal"
            placeholder="Ej: 50"
          />
        </UFormField>

        <UFormField label="Título (opcional)">
          <UInput v-model="titleInput" class="w-full" placeholder="Ej: Promo del día" />
        </UFormField>

        <!-- Strategy toggle (only shown when items already have discounts) -->
        <section v-if="hasExistingDiscounts" class="rounded-lg border border-default p-3 space-y-3">
          <p class="text-sm font-medium">Descuentos existentes</p>
          <p class="text-xs text-muted">Algunos productos ya tienen descuento. ¿Qué hacer con ellos?</p>
          <div class="grid grid-cols-2 gap-2">
            <UButton
              type="button"
              class="w-full"
              :variant="strategy === 'replace' ? 'solid' : 'outline'"
              @click="strategy = 'replace'"
            >
              <template #leading>
                <UIcon name="i-lucide-replace" class="h-4 w-4" />
              </template>
              Reemplazar
            </UButton>
            <UButton
              type="button"
              class="w-full"
              :variant="strategy === 'skip' ? 'solid' : 'outline'"
              @click="strategy = 'skip'"
            >
              <template #leading>
                <UIcon name="i-lucide-shield-check" class="h-4 w-4" />
              </template>
              Mantener
            </UButton>
          </div>
          <p v-if="strategy === 'replace'" class="text-xs text-muted">
            Se reemplazarán todos los descuentos actuales con el nuevo descuento global.
          </p>
          <p v-else class="text-xs text-muted">
            Los productos que ya tienen descuento lo mantendrán. Solo se aplicará a los que no tienen.
          </p>
        </section>

        <UAlert v-if="error" color="warning" variant="soft" :description="error" />
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="soft" label="Cancelar" @click="emit('update:open', false)" />
        <UButton
          type="submit"
          form="global-discount-form"
          color="primary"
          label="Aplicar a todos"
          :disabled="!canSubmit"
          :loading="isSubmitting"
        />
      </div>
    </template>
  </UModal>
</template>
