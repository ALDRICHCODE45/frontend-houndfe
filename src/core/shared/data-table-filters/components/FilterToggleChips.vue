<script setup lang="ts">
/**
 * A short option filter of the filters sheet as toggle chips (HfToggleChips): same state as the
 * dropdown (MultiSelectEnumFilter), so values, serialization and URL params do not change.
 * • Multiple choice: a click appends the value (pick order, like the dropdown) or removes it;
 *   «Limpiar (N)» clears the values and the «sin valor» flag.
 * • `single`: one value at most, the last pick wins and a second click clears.
 * • `includeNullOption` adds a «sin valor» chip bound to the include-null flag.
 */
import { computed, useId } from 'vue'
import { HfToggleChips, type HfToggleChipItem } from '@/core/shared/components/selection'
import type { FilterOption } from '../schema/types'

const props = withDefaults(defineProps<{
  label: string
  options: readonly FilterOption[]
  includeNullOption?: string
  single?: boolean
  error?: string
}>(), {
  includeNullOption: undefined,
  single: false,
  error: undefined,
})

const modelValue = defineModel<string[]>({ default: () => [] })
const includeNullValue = defineModel<boolean>('includeNullValue', { default: false })

// The same sentinel as MultiSelectEnumFilter; never reaches the state.
const INCLUDE_NULL_SENTINEL = '__INCLUDE_NULL__'

const labelId = `filter-chips-label-${useId()}`
const errorId = `${labelId}-error`

const items = computed<HfToggleChipItem[]>(() => [
  ...props.options.map(option => ({ value: option.value, label: option.label })),
  ...(props.includeNullOption ? [{ value: INCLUDE_NULL_SENTINEL, label: props.includeNullOption }] : []),
])

const pressed = computed<string[]>(() => {
  const values = modelValue.value ?? []
  return props.includeNullOption && includeNullValue.value ? [...values, INCLUDE_NULL_SENTINEL] : values
})

function onUpdate(next: string[]) {
  // HfToggleChips emits [] for «Limpiar (N)» and for the last pressed chip turned off.
  if (next.length === 0) {
    clear()
    return
  }
  const current = pressed.value
  const added = next.find(value => !current.includes(value))
  const removed = current.find(value => !next.includes(value))

  if (added === INCLUDE_NULL_SENTINEL || removed === INCLUDE_NULL_SENTINEL) {
    includeNullValue.value = added === INCLUDE_NULL_SENTINEL
    return
  }

  const values = modelValue.value ?? []
  if (added !== undefined) modelValue.value = props.single ? [added] : [...values, added]
  else if (removed !== undefined) modelValue.value = values.filter(value => value !== removed)
}

function clear() {
  modelValue.value = []
  if (props.includeNullOption) includeNullValue.value = false
}
</script>

<template>
  <div class="w-full space-y-2" data-testid="filter-toggle-chips">
    <span :id="labelId" class="block text-sm font-medium text-default">{{ props.label }}</span>
    <HfToggleChips
      :items="items"
      :model-value="pressed"
      :labelledby="labelId"
      :aria-describedby="props.error ? errorId : undefined"
      :clearable="!props.single"
      @update:model-value="onUpdate"
    />
    <p v-if="props.error" :id="errorId" class="text-sm text-error">{{ props.error }}</p>
  </div>
</template>
