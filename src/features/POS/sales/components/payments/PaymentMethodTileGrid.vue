<script setup lang="ts">
import type { CollectionPaymentMethod } from '../../interfaces/sale.types'
import { COLLECTION_PAYMENT_METHODS } from '../../utils/paymentEntries.utils'
import { PAYMENT_METHOD_CONFIG } from './paymentMethod.config'

const props = withDefaults(defineProps<{
  methods?: CollectionPaymentMethod[]
  disabled?: boolean
  disabledMethods?: CollectionPaymentMethod[]
  maxReached?: boolean
}>(), {
  methods: () => COLLECTION_PAYMENT_METHODS,
  disabled: false,
  disabledMethods: () => [],
  maxReached: false,
})

const emit = defineEmits<{
  select: [method: CollectionPaymentMethod]
}>()

function isTileDisabled(method: CollectionPaymentMethod): boolean {
  if (props.disabled) return true
  return props.disabledMethods.includes(method)
}

function handleSelect(method: CollectionPaymentMethod): void {
  if (isTileDisabled(method)) return
  emit('select', method)
}
</script>

<template>
  <div class="space-y-2">
    <div data-testid="payment-method-grid" class="grid grid-cols-2 gap-3">
      <UButton
        v-for="method in methods"
        :key="method"
        :data-testid="`payment-method-tile-${method}`"
        variant="outline"
        color="neutral"
        class="justify-start"
        :disabled="isTileDisabled(method)"
        @click="handleSelect(method)"
      >
        <template #leading>
          <UIcon :data-testid="`payment-method-icon-${method}`" :name="PAYMENT_METHOD_CONFIG[method].icon" />
        </template>

        {{ PAYMENT_METHOD_CONFIG[method].label }}
      </UButton>
    </div>

    <p v-if="maxReached" class="text-xs text-warning-600">Máximo 5 pagos</p>
  </div>
</template>
