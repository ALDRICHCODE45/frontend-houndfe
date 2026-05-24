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

</script>

<template>
  <UFormField :label="props.label" :error="props.error" data-testid="multi-select-async-filter">
    <USelectMenu
      data-testid="async-select"
      :model-value="props.modelValue"
      :items="props.options"
      :placeholder="props.placeholder"
      :multiple="true"
      :searchable="true"
      value-key="value"
      :loading="props.loading"
      @update:model-value="(value: unknown) => emit('update:modelValue', (value as string[]) ?? [])"
    />

    <p v-if="props.loading" class="mt-2 text-xs text-muted" data-testid="async-loading-hint">
      {{ props.loadingLabel }}
    </p>

    <div v-if="props.includeNullOption" class="mt-2 flex items-center gap-2">
      <UCheckbox
        :model-value="props.includeNullValue"
        @update:model-value="(value: unknown) => emit('update:includeNullValue', Boolean(value))"
      />
      <span class="text-sm text-muted">{{ props.includeNullOption }}</span>
    </div>
  </UFormField>
</template>
