<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../../utils/currency.utils'

const props = defineProps<{
  totalCents: number
  receivedCents: number
  error?: string
}>()

const remainingCents = computed(() => props.totalCents - props.receivedCents)
const remainingClass = computed(() => {
  if (remainingCents.value === 0) return 'text-success-600'
  return 'text-error-500'
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between text-sm">
      <p>
        Recibido:
        <span class="font-semibold">{{ formatCentsMXN(receivedCents) }}</span>
      </p>
      <p>
        Restante:
        <span :data-testid="'payment-remaining-value'" :class="['font-semibold', remainingClass]">
          {{ formatCentsMXN(remainingCents) }}
        </span>
      </p>
    </div>

    <p v-if="error" class="text-sm text-error-500">{{ error }}</p>
  </div>
</template>
