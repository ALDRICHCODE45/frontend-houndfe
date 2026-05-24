<script setup lang="ts">
import { computed, ref } from 'vue'

type PrimitiveOption = {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  options: PrimitiveOption[]
  label: string
  placeholder: string
  includeNullOption?: string
  includeNullValue?: boolean
  loading?: boolean
  loadingLabel?: string
  error?: string
}>(), {
  includeNullOption: undefined,
  includeNullValue: false,
  loading: false,
  loadingLabel: 'Cargando opciones...',
  error: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string[]): void
  (event: 'update:includeNullValue', value: boolean): void
}>()

const search = ref('')

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) {
    return props.options
  }

  return props.options.filter(option => option.label.toLowerCase().includes(query))
})

function updateSearch(value: unknown) {
  search.value = String(value ?? '')
}
</script>

<template>
  <div class="space-y-2" data-testid="multi-select-async-filter">
    <label class="text-sm font-medium text-highlighted">{{ props.label }}</label>

    <UInput
      data-testid="async-search"
      :model-value="search"
      placeholder="Buscar"
      @update:model-value="updateSearch"
    />

    <USelectMenu
      :model-value="props.modelValue"
      :items="filteredOptions"
      :placeholder="props.placeholder"
      :multiple="true"
      :searchable="true"
      value-key="value"
      :loading="props.loading"
      @update:model-value="(value: unknown) => emit('update:modelValue', (value as string[]) ?? [])"
    />

    <p v-if="props.loading" class="text-xs text-muted" data-testid="async-loading-hint">
      {{ props.loadingLabel }}
    </p>

    <div v-if="props.includeNullOption" class="flex items-center gap-2">
      <UCheckbox
        :model-value="props.includeNullValue"
        @update:model-value="(value: unknown) => emit('update:includeNullValue', Boolean(value))"
      />
      <span class="text-sm text-muted">{{ props.includeNullOption }}</span>
    </div>

    <p v-if="props.error" class="text-sm text-error">{{ props.error }}</p>
  </div>
</template>
