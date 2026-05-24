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

const selectedLabel = computed(() => {
  if (modelValue.value.length === 0) return props.placeholder
  if (modelValue.value.length === 1) {
    return props.options.find(option => option.value === modelValue.value[0])?.label ?? modelValue.value[0]
  }

  if (modelValue.value.length <= 3) {
    return modelValue.value
      .map(value => props.options.find(option => option.value === value)?.label ?? value)
      .join(', ')
  }

  return `${modelValue.value.length} seleccionados`
})

</script>

<template>
  <UFormField :label="props.label" :error="props.error" class="w-full" data-testid="multi-select-async-filter">
    <USelectMenu
      data-testid="async-select"
      class="w-full"
      v-model="modelValue"
      :items="props.options"
      :placeholder="props.placeholder"
      :multiple="true"
      :search-input="true"
      value-key="value"
      :loading="props.loading"
    >
      <template #default>
        <span class="truncate" data-testid="async-trigger-label">{{ selectedLabel }}</span>
      </template>

      <template #content-bottom>
        <div v-if="props.includeNullOption">
        <USeparator class="my-1" />
        <div class="px-2 py-1">
          <UCheckbox
            v-model="includeNullValue"
            :label="props.includeNullOption"
            variant="list"
            data-testid="async-include-null"
          />
        </div>
        </div>
      </template>
    </USelectMenu>

    <p v-if="props.loading" class="mt-2 text-xs text-muted" data-testid="async-loading-hint">
      {{ props.loadingLabel }}
    </p>

  </UFormField>
</template>
