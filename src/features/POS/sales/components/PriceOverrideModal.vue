<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { saleApi } from '../api/sale.api'
import type { OverrideItemPricePayload } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  open: boolean
  saleId: string
  itemId: string
  onSubmit: (itemId: string, payload: OverrideItemPricePayload) => Promise<unknown>
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const mode = ref<'price_list' | 'custom'>('price_list')
const selectedPriceListId = ref('')
const customPriceInput = ref('')
const validationError = ref<string | null>(null)
const apiError = ref<string | null>(null)
const isLoading = ref(false)
const options = ref<Array<{ priceListId: string; priceListName: string; priceCents: number; isCurrent: boolean }>>([])

const customPriceCents = computed<number | null>(() => {
  const normalized = String(customPriceInput.value ?? '').replace(',', '.').trim()
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null

  return Math.round(value * 100)
})

const canSubmit = computed(() => {
  if (mode.value === 'price_list') return selectedPriceListId.value.length > 0
  return Number.isInteger(customPriceCents.value) && (customPriceCents.value ?? 0) >= 1
})

async function loadAvailablePrices() {
  isLoading.value = true
  apiError.value = null
  try {
    const response = await saleApi.getAvailablePrices(props.saleId, props.itemId)
    options.value = response.prices
    const current = response.prices.find((opt) => opt.isCurrent)
    selectedPriceListId.value = current?.priceListId ?? ''
  } catch {
    apiError.value = 'No se pudieron cargar los precios disponibles. Reintentá.'
  } finally {
    isLoading.value = false
  }
}

async function submit() {
  validationError.value = null
  apiError.value = null
  if (mode.value === 'custom' && !canSubmit.value) {
    validationError.value = 'Ingresá un precio válido mayor a 0.'
    return
  }
  if (mode.value === 'price_list' && !selectedPriceListId.value) {
    validationError.value = 'Seleccioná una lista de precios.'
    return
  }

  try {
    if (mode.value === 'price_list') {
      await props.onSubmit(props.itemId, { priceListId: selectedPriceListId.value })
    } else {
      await props.onSubmit(props.itemId, { customPriceCents: customPriceCents.value ?? 0 })
    }
    emit('update:open', false)
  } catch {
    apiError.value = 'No se pudo aplicar el cambio de precio. Reintentá.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      mode.value = 'price_list'
      customPriceInput.value = ''
      validationError.value = null
      void loadAvailablePrices()
    }
  },
  { immediate: true },
)
</script>

<template>
  <UModal :open="open" title="Cambiar precio" :content="{ class: 'sm:max-w-xl' }" @update:open="emit('update:open', $event)">
    <template #body>
      <form id="price-override-form" class="space-y-4" @submit.prevent="submit">
        <section class="rounded-lg border border-default p-3 space-y-2 bg-elevated/30">
          <p class="text-sm font-medium">Contexto del precio</p>
          <p class="text-xs text-muted">Elegí una lista vigente o definí un valor manual para este ítem.</p>
        </section>

        <div v-if="isLoading" class="text-sm text-muted">Cargando precios...</div>

        <div v-else-if="apiError" class="space-y-3">
          <UAlert color="error" variant="soft" :description="apiError" />
          <UButton type="button" variant="soft" label="Reintentar" @click="loadAvailablePrices" />
        </div>

        <div v-else class="space-y-4">
          <section class="rounded-lg border border-default p-3 space-y-3">
            <p class="text-sm font-medium">Seleccioná el origen del precio</p>
            <div class="grid grid-cols-2 gap-2 w-full">
              <UButton type="button" class="w-full" :variant="mode === 'price_list' ? 'solid' : 'outline'" label="Desde lista" @click="mode = 'price_list'" />
              <UButton type="button" class="w-full" :variant="mode === 'custom' ? 'solid' : 'outline'" label="Personalizado" @click="mode = 'custom'" />
            </div>
            <p v-if="mode === 'custom'" class="text-xs text-muted">Aplicá un precio personalizado en pesos (MXN).</p>
            <p v-else class="text-xs text-muted">Seleccioná una alternativa de lista para reemplazar el valor actual.</p>
          </section>

          <div class="rounded-lg border border-default p-3">
            <URadioGroup
              v-if="mode === 'price_list'"
              v-model="selectedPriceListId"
              value-key="priceListId"
              :items="options.map((option) => ({
                ...option,
                label: `${option.priceListName} - ${formatCentsMXN(option.priceCents)}`,
                description: option.isCurrent ? 'Precio actual' : undefined,
              }))"
            />

            <UFormField v-else label="Precio manual (MXN)" description="Ingresá un valor mayor a 0.">
              <UInput
                v-model="customPriceInput"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ej: 500"
                @keydown.enter.prevent="submit"
              />
            </UFormField>
          </div>

          <UAlert v-if="validationError" color="warning" variant="soft" :description="validationError" />
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="soft" label="Cancelar" @click="emit('update:open', false)" />
        <UButton type="submit" form="price-override-form" color="primary" label="Aplicar" :disabled="!canSubmit" />
      </div>
    </template>
  </UModal>
</template>
