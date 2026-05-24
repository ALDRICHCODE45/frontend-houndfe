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
  error?: string
  searchable?: boolean
}>(), {
  placeholder: 'Seleccionar opciones',
  includeNullOption: undefined,
  error: undefined,
  searchable: false,
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
  <UFormField :label="props.label" :error="props.error" class="w-full" data-testid="multi-select-enum-filter">
    <USelectMenu
      data-testid="enum-select"
      class="w-full"
      v-model="modelValue"
      :items="props.options"
      :placeholder="props.placeholder"
      :multiple="true"
      :search-input="props.searchable"
      value-key="value"
    >
      <template #default>
        <span class="truncate" data-testid="enum-trigger-label">{{ selectedLabel }}</span>
      </template>

      <template #content-bottom>
        <div v-if="props.includeNullOption">
        <USeparator class="my-1" />
        <div class="px-2 py-1">
          <UCheckbox
            v-model="includeNullValue"
            :label="props.includeNullOption"
            variant="list"
            data-testid="enum-include-null"
          />
        </div>
        </div>
      </template>
    </USelectMenu>
  </UFormField>
</template>
