<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: { min?: number; max?: number }
  label: string
  unit?: string
  step?: number
  error?: string
}>(), {
  unit: '$',
  step: 100,
  error: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: { min?: number; max?: number }): void
}>()

const minDisplay = ref<number | undefined>(props.modelValue.min !== undefined ? props.modelValue.min / 100 : undefined)
const maxDisplay = ref<number | undefined>(props.modelValue.max !== undefined ? props.modelValue.max / 100 : undefined)

watch(() => props.modelValue, (next) => {
  minDisplay.value = next.min !== undefined ? next.min / 100 : undefined
  maxDisplay.value = next.max !== undefined ? next.max / 100 : undefined
}, { deep: true })

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
    next.min = Math.round(minDisplay.value * 100)
  }

  if (maxDisplay.value !== undefined) {
    next.max = Math.round(maxDisplay.value * 100)
  }

  emit('update:modelValue', next)
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
  <UFormField :label="props.label" :error="resolvedError" data-testid="numeric-range-filter">
    <div class="grid grid-cols-2 gap-2">
      <UInputNumber
        data-testid="numeric-min"
        :min="0"
        :step="props.step"
        :model-value="minDisplay"
        :format-options="{ style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }"
        placeholder="$ mín"
        @update:model-value="updateMin"
      />

      <UInputNumber
        data-testid="numeric-max"
        :min="0"
        :step="props.step"
        :model-value="maxDisplay"
        :format-options="{ style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }"
        placeholder="$ máx"
        @update:model-value="updateMax"
      />
    </div>
  </UFormField>
</template>
