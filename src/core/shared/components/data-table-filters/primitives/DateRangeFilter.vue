<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { endOfDayUTC } from '@/features/POS/sales/utils/saleDate.utils'

const props = defineProps<{
  modelValue: { from?: string; to?: string }
  label: string
  error?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: { from?: string; to?: string }): void
}>()

function toDateInput(value?: string): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function startOfDayUTC(value: string): string {
  return `${value}T00:00:00.000Z`
}

const fromDate = ref(toDateInput(props.modelValue.from))
const toDate = ref(toDateInput(props.modelValue.to))

watch(() => props.modelValue, (next) => {
  fromDate.value = toDateInput(next.from)
  toDate.value = toDateInput(next.to)
}, { deep: true })

const localError = computed(() => {
  if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
    return 'El rango está invertido'
  }

  return undefined
})

const resolvedError = computed(() => props.error ?? localError.value)

function emitRange() {
  const payload: { from?: string; to?: string } = {}

  if (fromDate.value) {
    payload.from = startOfDayUTC(fromDate.value)
  }

  if (toDate.value) {
    payload.to = endOfDayUTC(toDate.value)
  }

  emit('update:modelValue', payload)
}

function updateFrom(value: unknown) {
  fromDate.value = String(value ?? '')
  emitRange()
}

function updateTo(value: unknown) {
  toDate.value = String(value ?? '')
  emitRange()
}
</script>

<template>
  <div class="space-y-2" data-testid="date-range-filter">
    <label class="text-sm font-medium text-highlighted">{{ props.label }}</label>

    <div class="grid grid-cols-2 gap-2">
      <UInput
        data-testid="date-from"
        type="date"
        :model-value="fromDate"
        @update:model-value="updateFrom"
      />

      <UInput
        data-testid="date-to"
        type="date"
        :model-value="toDate"
        @update:model-value="updateTo"
      />
    </div>

    <p v-if="resolvedError" class="text-sm text-error">{{ resolvedError }}</p>
  </div>
</template>
