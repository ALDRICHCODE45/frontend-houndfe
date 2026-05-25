<script setup lang="ts">
import { computed } from 'vue'

type PrimitiveOption = {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  options: PrimitiveOption[]
  label: string
  placeholder?: string
  includeNullOption?: string
  loading?: boolean
  loadingLabel?: string
  error?: string
}>(), {
  placeholder: 'Seleccionar opciones',
  includeNullOption: undefined,
  loading: false,
  loadingLabel: 'Cargando opciones...',
  error: undefined,
})

const modelValue = defineModel<string[]>({ default: () => [] })
const includeNullValue = defineModel<boolean>('includeNullValue', { default: false })

const INCLUDE_NULL_SENTINEL = '__INCLUDE_NULL__'

const displayItems = computed(() => {
  if (!props.includeNullOption) return props.options
  return [
    ...props.options,
    { value: INCLUDE_NULL_SENTINEL, label: props.includeNullOption },
  ]
})

const selectionWithSentinel = computed<string[]>({
  get() {
    return includeNullValue.value
      ? [...modelValue.value, INCLUDE_NULL_SENTINEL]
      : modelValue.value
  },
  set(next) {
    const hasSentinel = next.includes(INCLUDE_NULL_SENTINEL)
    const realValues = next.filter(v => v !== INCLUDE_NULL_SENTINEL)
    modelValue.value = realValues
    if (props.includeNullOption) {
      includeNullValue.value = hasSentinel
    }
  },
})

function lowerFirst(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

const selectedLabel = computed(() => {
  const includeNullLabel = props.includeNullOption
  const hasIncludeNull = includeNullValue.value && typeof includeNullLabel === 'string'

  if (modelValue.value.length === 0) {
    if (hasIncludeNull) return includeNullLabel
    return props.placeholder
  }

  const selectedLabels = modelValue.value
    .map(value => props.options.find(option => option.value === value)?.label ?? value)

  if (hasIncludeNull) {
    if (modelValue.value.length <= 2) {
      return [...selectedLabels, lowerFirst(includeNullLabel)].join(', ')
    }

    return `${modelValue.value.length + 1} seleccionados`
  }

  if (modelValue.value.length === 1) {
    return props.options.find(option => option.value === modelValue.value[0])?.label ?? modelValue.value[0]
  }

  if (modelValue.value.length <= 3) {
    return selectedLabels.join(', ')
  }

  return `${modelValue.value.length} seleccionados`
})

</script>

<template>
  <UFormField :label="props.label" :error="props.error" class="w-full" data-testid="multi-select-async-filter">
    <USelectMenu
      data-testid="async-select"
      class="w-full"
      v-model="selectionWithSentinel"
      :items="displayItems"
      :placeholder="props.placeholder"
      :multiple="true"
      :search-input="true"
      value-key="value"
      :loading="props.loading"
    >
      <template #default>
        <span class="truncate" data-testid="async-trigger-label">{{ selectedLabel }}</span>
      </template>
    </USelectMenu>

    <p v-if="props.loading" class="mt-2 text-xs text-muted" data-testid="async-loading-hint">
      {{ props.loadingLabel }}
    </p>

  </UFormField>
</template>
