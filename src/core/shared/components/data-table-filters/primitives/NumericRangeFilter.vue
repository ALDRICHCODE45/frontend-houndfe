<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  unit?: string
  formatAs?: 'currency' | 'plain'
  step?: number
  displayDivisor?: number
  error?: string
}>(), {
  unit: '$',
  formatAs: 'currency',
  step: 1,
  displayDivisor: 1,
  error: undefined,
})

const modelValue = defineModel<{ min?: number; max?: number }>({ default: () => ({}) })

const minDisplay = ref<number | undefined>(modelValue.value.min !== undefined ? modelValue.value.min / props.displayDivisor : undefined)
const maxDisplay = ref<number | undefined>(modelValue.value.max !== undefined ? modelValue.value.max / props.displayDivisor : undefined)

watch(() => modelValue.value, (next) => {
  minDisplay.value = next.min !== undefined ? next.min / props.displayDivisor : undefined
  maxDisplay.value = next.max !== undefined ? next.max / props.displayDivisor : undefined
}, { deep: true })

const formatOptions = computed<Intl.NumberFormatOptions | undefined>(() => {
  if (props.formatAs === 'currency') {
    return { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }
  }

  return undefined
})

const localError = computed(() => {
  const min = minDisplay.value
  const max = maxDisplay.value

  if (min !== undefined && max !== undefined && min > max) {
    return 'El rango está invertido'
  }

  return undefined
})

const resolvedError = computed(() => props.error ?? localError.value)

function emitRange() {
  const next: { min?: number; max?: number } = {}

  if (minDisplay.value !== undefined) {
    next.min = Math.round(minDisplay.value * props.displayDivisor)
  }

  if (maxDisplay.value !== undefined) {
    next.max = Math.round(maxDisplay.value * props.displayDivisor)
  }

  modelValue.value = next
}

function updateMin(value: unknown) {
  minDisplay.value = typeof value === 'number' ? value : undefined
  emitRange()
}

function updateMax(value: unknown) {
  maxDisplay.value = typeof value === 'number' ? value : undefined
  emitRange()
}
</script>

<template>
  <UFormField :label="props.label" :error="resolvedError" class="w-full" data-testid="numeric-range-filter">
    <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <UInputNumber
        data-testid="numeric-min"
        class="w-full"
        :min="0"
        :step="props.step"
        :model-value="minDisplay"
        :format-options="formatOptions"
        :increment="false"
        :decrement="false"
        placeholder="$ mín"
        @update:model-value="updateMin"
      />

      <span class="text-sm text-muted" data-testid="numeric-separator">—</span>

      <UInputNumber
        data-testid="numeric-max"
        class="w-full"
        :min="0"
        :step="props.step"
        :model-value="maxDisplay"
        :format-options="formatOptions"
        :increment="false"
        :decrement="false"
        placeholder="$ máx"
        @update:model-value="updateMax"
      />
    </div>
  </UFormField>
</template>
