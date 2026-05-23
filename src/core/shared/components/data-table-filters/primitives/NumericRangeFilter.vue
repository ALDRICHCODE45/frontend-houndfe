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
  step: 1,
  error: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: { min?: number; max?: number }): void
}>()

const minDisplay = ref(props.modelValue.min !== undefined ? String(props.modelValue.min / 100) : '')
const maxDisplay = ref(props.modelValue.max !== undefined ? String(props.modelValue.max / 100) : '')

watch(() => props.modelValue, (next) => {
  minDisplay.value = next.min !== undefined ? String(next.min / 100) : ''
  maxDisplay.value = next.max !== undefined ? String(next.max / 100) : ''
}, { deep: true })

const localError = computed(() => {
  const min = minDisplay.value === '' ? undefined : Number(minDisplay.value)
  const max = maxDisplay.value === '' ? undefined : Number(maxDisplay.value)

  if (min !== undefined && max !== undefined && min > max) {
    return 'El rango está invertido'
  }

  return undefined
})

const resolvedError = computed(() => props.error ?? localError.value)

function emitRange() {
  const next: { min?: number; max?: number } = {}

  if (minDisplay.value !== '') {
    next.min = Math.round(Number(minDisplay.value) * 100)
  }

  if (maxDisplay.value !== '') {
    next.max = Math.round(Number(maxDisplay.value) * 100)
  }

  emit('update:modelValue', next)
}

function updateMin(value: unknown) {
  minDisplay.value = String(value ?? '')
  emitRange()
}

function updateMax(value: unknown) {
  maxDisplay.value = String(value ?? '')
  emitRange()
}
</script>

<template>
  <div class="space-y-2" data-testid="numeric-range-filter">
    <label class="text-sm font-medium text-highlighted">{{ props.label }}</label>

    <div class="grid grid-cols-2 gap-2">
      <UInput
        data-testid="numeric-min"
        type="number"
        :step="props.step"
        :model-value="minDisplay"
        :placeholder="`${props.unit} mín`"
        @update:model-value="updateMin"
      />

      <UInput
        data-testid="numeric-max"
        type="number"
        :step="props.step"
        :model-value="maxDisplay"
        :placeholder="`${props.unit} máx`"
        @update:model-value="updateMax"
      />
    </div>

    <p v-if="resolvedError" class="text-sm text-error">{{ resolvedError }}</p>
  </div>
</template>
