<script setup lang="ts">
import { computed } from 'vue'

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
  error?: string
  searchable?: boolean
}>(), {
  includeNullValue: false,
  includeNullOption: undefined,
  error: undefined,
  searchable: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string[]): void
  (event: 'update:includeNullValue', value: boolean): void
}>()

const selectedLabel = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder
  if (props.modelValue.length === 1) {
    return props.options.find(option => option.value === props.modelValue[0])?.label ?? props.modelValue[0]
  }

  return `${props.modelValue.length} seleccionados`
})

const includeNullChecked = computed({
  get: () => Boolean(props.includeNullValue),
  set: (value: boolean) => {
    emit('update:includeNullValue', value)
  },
})
</script>

<template>
  <UFormField :label="props.label" :error="props.error" class="w-full" data-testid="multi-select-enum-filter">
    <USelectMenu
      data-testid="enum-select"
      class="w-full"
      :model-value="props.modelValue"
      :items="props.options"
      :placeholder="props.placeholder"
      :multiple="true"
      :search-input="props.searchable"
      value-key="value"
      @update:model-value="(value: unknown) => emit('update:modelValue', (value as string[]) ?? [])"
    >
      <template #default>
        <span class="truncate" data-testid="enum-trigger-label">{{ selectedLabel }}</span>
      </template>

      <template #content-bottom>
        <div v-if="props.includeNullOption">
        <USeparator class="my-1" />
        <div class="px-2 py-1">
          <UCheckbox
            v-model="includeNullChecked"
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
