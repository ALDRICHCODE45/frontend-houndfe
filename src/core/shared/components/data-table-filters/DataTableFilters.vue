<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import DataTableFiltersChips, { type ActiveFilterChip } from './DataTableFiltersChips.vue'
import type { FilterDefinition, FilterState } from './types'
import MultiSelectEnumFilter from './primitives/MultiSelectEnumFilter.vue'
import NumericRangeFilter from './primitives/NumericRangeFilter.vue'
import DateRangeFilter from './primitives/DateRangeFilter.vue'
import MultiSelectAsyncFilter from './primitives/MultiSelectAsyncFilter.vue'
import { useTableFiltersUrlSync } from '@/core/shared/composables/useTableFiltersUrlSync'

const props = withDefaults(defineProps<{
  schema: FilterDefinition[]
  modelValue: FilterState
  errors?: Record<string, string>
  namespace?: string
}>(), {
  errors: () => ({}),
  namespace: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: FilterState): void
  (event: 'apply'): void
}>()

const open = ref(false)
const localState = ref<FilterState>({ ...props.modelValue })
const validationErrors = ref<Record<string, string>>({})

watch(() => props.modelValue, value => {
  localState.value = { ...value }
}, { deep: true })

useTableFiltersUrlSync(localState, { schema: props.schema, namespace: props.namespace })

const isDesktop = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
const slideoverSide = computed(() => (isDesktop.value ? 'right' : 'bottom'))

function toLabelValue(field: FilterDefinition): string | null {
  if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async') {
    const current = localState.value[field.param]
    if (!Array.isArray(current) || current.length === 0) return null
    return current.join(', ')
  }

  if (field.kind === 'number-range') {
    const min = localState.value[field.minParam]
    const max = localState.value[field.maxParam]
    if (min == null && max == null) return null
    return `${min ?? '—'} - ${max ?? '—'}`
  }

  if (field.kind === 'date-range') {
    const from = localState.value[field.fromParam]
    const to = localState.value[field.toParam]
    if (from == null && to == null) return null
    return `${String(from ?? '—')} - ${String(to ?? '—')}`
  }

  return null
}

const activeChips = computed<ActiveFilterChip[]>(() => {
  return props.schema
    .map(field => {
      const value = toLabelValue(field)
      if (!value) return null
      return { id: field.id, label: field.label, value }
    })
    .filter((chip): chip is ActiveFilterChip => chip !== null)
})

function clearByField(field: FilterDefinition, state: FilterState) {
  if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async') {
    state[field.param] = []
    if (field.includeNull) state[field.includeNull.param] = false
  }
  if (field.kind === 'number-range') {
    state[field.minParam] = undefined
    state[field.maxParam] = undefined
  }
  if (field.kind === 'date-range') {
    state[field.fromParam] = undefined
    state[field.toParam] = undefined
    if (field.includeNull) state[field.includeNull.param] = false
  }
}

function clearAllFilters() {
  const next = { ...localState.value }
  for (const field of props.schema) clearByField(field, next)
  localState.value = next
  emit('update:modelValue', next)
}

function validateState(): boolean {
  const errors: Record<string, string> = {}

  for (const field of props.schema) {
    if (field.kind === 'multi-enum') {
      const values = localState.value[field.param]
      const max = field.max ?? 50
      if (Array.isArray(values) && values.length > max) errors[field.id] = `Máximo ${max} valores permitidos`
    }

    if (field.kind === 'multi-uuid' || field.kind === 'multi-async') {
      const values = localState.value[field.param]
      const max = field.max ?? 200
      if (Array.isArray(values) && values.length > max) errors[field.id] = `Máximo ${max} valores permitidos`
    }

    if (field.kind === 'number-range') {
      const min = Number(localState.value[field.minParam])
      const max = Number(localState.value[field.maxParam])
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) errors[field.id] = 'El rango está invertido'
    }

    if (field.kind === 'date-range') {
      const from = localState.value[field.fromParam]
      const to = localState.value[field.toParam]
      if (typeof from === 'string' && typeof to === 'string' && from > to) errors[field.id] = 'El rango está invertido'
    }
  }

  validationErrors.value = errors
  return Object.keys(errors).length === 0
}

function applyFilters() {
  if (!validateState()) return
  emit('update:modelValue', { ...localState.value })
  emit('apply')
  open.value = false
}

function removeChip(filterId: string) {
  const field = props.schema.find(item => item.id === filterId)
  if (!field) return
  const next = { ...localState.value }
  clearByField(field, next)
  localState.value = next
  emit('update:modelValue', next)
}

function componentForField(field: FilterDefinition) {
  if (field.kind === 'multi-enum') return MultiSelectEnumFilter
  if (field.kind === 'number-range') return NumericRangeFilter
  if (field.kind === 'date-range') return DateRangeFilter
  return MultiSelectAsyncFilter
}
</script>

<template>
  <div class="space-y-3" data-testid="data-table-filters">
    <div class="flex items-center gap-2">
      <UButton data-testid="open-filters" @click="open = true">
        Filtros
      </UButton>
      <UButton data-testid="clear-filters" variant="ghost" @click="clearAllFilters">Limpiar filtros</UButton>
    </div>

    <slot name="chips" :chips="activeChips" :remove="removeChip" :clear="clearAllFilters">
      <DataTableFiltersChips :chips="activeChips" @remove="removeChip" @clear="clearAllFilters" />
    </slot>

    <USlideover :open="open" :side="slideoverSide" :inset="isDesktop" @update:open="open = $event">
      <template #content>
        <div class="space-y-4 p-4">
          <template v-for="field in props.schema" :key="field.id">
            <component
              :is="componentForField(field)"
              v-if="field.kind === 'multi-enum'"
              :label="field.label"
              :model-value="(localState[field.param] as string[]) ?? []"
              :options="field.options"
              :placeholder="field.placeholder ?? 'Seleccioná opciones'"
              :error="validationErrors[field.id] ?? props.errors[field.id]"
              @update:model-value="(value: string[]) => localState[field.param] = value"
            />

            <component
              :is="componentForField(field)"
              v-else-if="field.kind === 'number-range'"
              :label="field.label"
              :model-value="{ min: localState[field.minParam] as number | undefined, max: localState[field.maxParam] as number | undefined }"
              :error="validationErrors[field.id] ?? props.errors[field.id]"
              @update:model-value="(value: { min?: number; max?: number }) => { localState[field.minParam] = value.min; localState[field.maxParam] = value.max }"
            />

            <component
              :is="componentForField(field)"
              v-else-if="field.kind === 'date-range'"
              :label="field.label"
              :model-value="{ from: localState[field.fromParam] as string | undefined, to: localState[field.toParam] as string | undefined }"
              :error="validationErrors[field.id] ?? props.errors[field.id]"
              @update:model-value="(value: { from?: string; to?: string }) => { localState[field.fromParam] = value.from; localState[field.toParam] = value.to }"
            />

            <component
              :is="componentForField(field)"
              v-else
              :label="field.label"
              :model-value="(localState[field.param] as string[]) ?? []"
              :options="field.options"
              :placeholder="field.placeholder ?? 'Seleccioná opciones'"
              :error="validationErrors[field.id] ?? props.errors[field.id]"
              @update:model-value="(value: string[]) => localState[field.param] = value"
            />

            <p
              v-if="validationErrors[field.id]"
              :data-testid="`validation-error-${field.id}`"
              class="text-sm text-error"
            >
              {{ validationErrors[field.id] }}
            </p>
          </template>

          <UButton data-testid="apply-filters" @click="applyFilters">Aplicar filtros</UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
