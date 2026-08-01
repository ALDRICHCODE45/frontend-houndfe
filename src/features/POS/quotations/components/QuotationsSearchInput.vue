<script setup lang="ts">
/**
 * QuotationsSearchInput — S3 / REQ-QTN-002.
 *
 * Presentational debounced search field. Parents wire it with v-model
 * (the value itself is a string); debounce lives in `useQuotationsList`
 * (via `refDebounced` on the parent ref), so this component is just the
 * input + a clear button.
 *
 * Keeping this in its own component makes the list view testable — the
 * real `UInput` is auto-imported by Nuxt UI, and vue-test-utils'
 * `stubs` option does NOT override auto-imported globals. A tiny child
 * component CAN be stubbed in tests.
 */

import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showClear = computed(() => props.modelValue.length > 0)

function onInput(value: string): void {
  emit('update:modelValue', value)
}

function clear(): void {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="relative w-full lg:w-72" data-testid="quotation-search-wrapper">
    <UInput
      :model-value="modelValue"
      :placeholder="placeholder ?? 'Buscar por cliente…'"
      :loading="loading"
      icon="i-lucide-search"
      size="lg"
      data-testid="quotation-search-input"
      @update:model-value="onInput"
    />
    <button
      v-if="showClear"
      type="button"
      class="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-elevated/60 hover:text-default"
      aria-label="Limpiar búsqueda"
      data-testid="quotation-search-clear"
      @click="clear"
    >
      <UIcon name="i-lucide-x" class="size-4" />
    </button>
  </div>
</template>
