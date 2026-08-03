<script setup lang="ts">
/**
 * `QuotationPriceOverrideModal.vue` — dedicated price-override modal for a
 * quotation item.
 *
 * Unlike the sales module there is NO per-item price-list mode for
 * quotations — the backend only exposes a manual unit-price override
 * (`PATCH /quotations/drafts/:id/items/:itemId/price`). The cashier sees the
 * product + current unit price and types the new value; `onSubmit` is the
 * parent's mutation wrapper so the modal stays decoupled from TanStack Query.
 *
 * Parent contract (props down / events up):
 *   - Props: `open` (boolean), `item` (QuotationItemResponseDto),
 *     `onSubmit` ((itemId, unitPriceCents) => Promise<unknown>).
 *   - Emits: `update:open` (false on cancel / dismiss / successful submit).
 */
import { computed, ref, watch } from 'vue'
import type { QuotationItemResponseDto } from '../interfaces/quotation.types'
import { formatCentsMXN } from '../utils/currency.utils'

const props = withDefaults(
  defineProps<{
    open: boolean
    item: QuotationItemResponseDto
    onSubmit: (itemId: string, unitPriceCents: number) => Promise<unknown>
  }>(),
  {
    onSubmit: async () => {},
  },
)
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const customPriceInput = ref('')
const validationError = ref<string | null>(null)
const apiError = ref<string | null>(null)
const isSubmitting = ref(false)

const customPriceCents = computed<number | null>(() => {
  const normalized = String(customPriceInput.value ?? '').replace(',', '.').trim()
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null

  return Math.round(value * 100)
})

const canSubmit = computed(
  () => Number.isInteger(customPriceCents.value) && (customPriceCents.value ?? 0) >= 1,
)

async function submit(): Promise<void> {
  validationError.value = null
  apiError.value = null
  if (!canSubmit.value) {
    validationError.value = 'Ingresa un precio válido mayor a 0.'
    return
  }

  isSubmitting.value = true
  try {
    await props.onSubmit(props.item.id, customPriceCents.value ?? 0)
    emit('update:open', false)
  } catch {
    apiError.value = 'No se pudo aplicar el cambio de precio. Reintenta.'
  } finally {
    isSubmitting.value = false
  }
}

// Reset local state every time the modal opens so a previous value/error
// doesn't leak into the next attempt.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      customPriceInput.value = ''
      validationError.value = null
      apiError.value = null
    }
  },
  { immediate: true },
)
</script>

<template>
  <UModal
    :open="open"
    title="Cambiar precio"
    :content="{ class: 'sm:max-w-xl' }"
    data-testid="price-override-modal"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form id="quotation-price-override-form" class="space-y-4" @submit.prevent="submit">
        <section class="rounded-lg border border-default p-3 space-y-2 bg-elevated/30">
          <p class="text-sm font-medium">{{ props.item.productName }}</p>
          <p class="text-xs text-muted" data-testid="price-override-current-price">
            Precio actual: {{ formatCentsMXN(props.item.unitPriceCents) }}
          </p>
        </section>

        <UFormField label="Precio manual (MXN)" description="Ingresa un valor mayor a 0.">
          <UInput
            v-model="customPriceInput"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Ej: 500"
            class="w-full"
            data-testid="price-override-input"
            @keydown.enter.prevent="submit"
          />
        </UFormField>

        <UAlert
          v-if="validationError"
          color="warning"
          variant="soft"
          :description="validationError"
          data-testid="price-override-error"
        />
        <UAlert
          v-if="apiError"
          color="error"
          variant="soft"
          :description="apiError"
          data-testid="price-override-api-error"
        />
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          label="Cancelar"
          data-testid="price-override-cancel"
          @click="emit('update:open', false)"
        />
        <UButton
          type="submit"
          form="quotation-price-override-form"
          color="primary"
          label="Aplicar"
          :disabled="!canSubmit"
          data-testid="price-override-submit"
        />
      </div>
    </template>
  </UModal>
</template>
