<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-2" data-testid="multi-select-enum-filter">
    <label class="text-sm font-medium text-highlighted">{{ props.label }}</label>

    <USelectMenu
      :model-value="props.modelValue"
      :items="props.options"
      :placeholder="props.placeholder"
      :multiple="true"
      :searchable="props.searchable"
      value-key="value"
      @update:model-value="(value: unknown) => emit('update:modelValue', (value as string[]) ?? [])"
    />

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
