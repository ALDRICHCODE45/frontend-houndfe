<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints, useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import DataTableFiltersChips, { type ActiveFilterChip } from './DataTableFiltersChips.vue'
import type { FilterDefinition, FilterState } from './types'
import MultiSelectEnumFilter from './primitives/MultiSelectEnumFilter.vue'
import NumericRangeFilter from './primitives/NumericRangeFilter.vue'
import DateRangeFilter from './primitives/DateRangeFilter.vue'
import MultiSelectAsyncFilter from './primitives/MultiSelectAsyncFilter.vue'
import MultiTextInputFilter from './primitives/MultiTextInputFilter.vue'
import { useTableFiltersUrlSync } from '@/core/shared/composables/useTableFiltersUrlSync'

const props = withDefaults(defineProps<{ schema: FilterDefinition[]; modelValue: FilterState; errors?: Record<string, string>; namespace?: string }>(), {
  errors: () => ({}),
  namespace: undefined,
})

const emit = defineEmits<{ (event: 'update:modelValue', value: FilterState): void }>()
const open = ref(false)
const localState = ref<FilterState>({ ...props.modelValue })
const validationErrors = ref<Record<string, string>>({})

watch(() => props.modelValue, value => {
  localState.value = { ...value }
}, { deep: true })

useTableFiltersUrlSync(localState, { schema: props.schema, namespace: props.namespace })

const isDesktop = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
const slideoverSide = computed(() => (isDesktop.value ? 'right' : 'bottom'))

function hasActiveField(field: FilterDefinition): boolean {
  if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async' || field.kind === 'multi-text') {
    const list = localState.value[field.param]
    return Array.isArray(list) && list.length > 0
  }
  if (field.kind === 'number-range') return localState.value[field.minParam] != null || localState.value[field.maxParam] != null
  if (field.kind === 'date-range') return localState.value[field.fromParam] != null || localState.value[field.toParam] != null
  return false
}

function toLabelValue(field: FilterDefinition): string | null {
  if (!hasActiveField(field)) return null
  if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async' || field.kind === 'multi-text') return (localState.value[field.param] as string[]).join(', ')
  if (field.kind === 'number-range') return `${localState.value[field.minParam] ?? '—'} - ${localState.value[field.maxParam] ?? '—'}`
  if (field.kind === 'date-range') return `${String(localState.value[field.fromParam] ?? '—')} - ${String(localState.value[field.toParam] ?? '—')}`
  return null
}

const activeChips = computed<ActiveFilterChip[]>(() => props.schema.map(field => {
  const value = toLabelValue(field)
  return value ? { id: field.id, label: field.label, value } : null
}).filter((chip): chip is ActiveFilterChip => chip !== null))

const activeFiltersCount = computed(() => activeChips.value.length)

const groupedSchema = computed(() => {
  const groups: Array<{ key: string; section?: string; fields: FilterDefinition[] }> = []
  const byKey = new Map<string, { key: string; section?: string; fields: FilterDefinition[] }>()
  for (const field of props.schema) {
    const section = typeof field.section === 'string' ? field.section : undefined
    const key = section?.trim() || '__no_section__'
    const existing = byKey.get(key)
    if (existing) existing.fields.push(field)
    else {
      const created = { key, section, fields: [field] }
      byKey.set(key, created)
      groups.push(created)
    }
  }
  return groups.sort((a, b) => (!a.section && b.section ? -1 : a.section && !b.section ? 1 : 0))
})

const groupsWithActivity = computed(() => groupedSchema.value.map(group => ({ ...group, hasActive: group.fields.some(hasActiveField) })))

function clearByField(field: FilterDefinition, state: FilterState) {
  if (field.kind === 'multi-enum' || field.kind === 'multi-uuid' || field.kind === 'multi-async') {
    state[field.param] = []
    if (field.includeNull) state[field.includeNull.param] = false
  }
  if (field.kind === 'multi-text') state[field.param] = []
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
}

function validateState(): boolean {
  const errors: Record<string, string> = {}
  for (const field of props.schema) {
    if (field.kind === 'multi-enum') {
      const list = localState.value[field.param]
      if (Array.isArray(list) && list.length > (field.max ?? 50)) errors[field.id] = `Máximo ${field.max ?? 50} valores permitidos`
    }
    if (field.kind === 'multi-uuid' || field.kind === 'multi-async') {
      const list = localState.value[field.param]
      if (Array.isArray(list) && list.length > (field.max ?? 200)) errors[field.id] = `Máximo ${field.max ?? 200} valores permitidos`
    }
    if (field.kind === 'multi-text') {
      const list = localState.value[field.param]
      if (Array.isArray(list) && list.length > (field.max ?? 200)) errors[field.id] = `Máximo ${field.max ?? 200} valores permitidos`
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

const debouncedApply = useDebounceFn(() => {
  if (!validateState()) return
  emit('update:modelValue', { ...localState.value })
}, 300)

watch(localState, () => debouncedApply(), { deep: true })

function removeChip(filterId: string) {
  const field = props.schema.find(item => item.id === filterId)
  if (!field) return
  const next = { ...localState.value }
  clearByField(field, next)
  localState.value = next
}

function componentForField(field: FilterDefinition) {
  if (field.kind === 'multi-enum') return MultiSelectEnumFilter
  if (field.kind === 'multi-text') return MultiTextInputFilter
  if (field.kind === 'number-range') return NumericRangeFilter
  if (field.kind === 'date-range') return DateRangeFilter
  return MultiSelectAsyncFilter
}

function getIncludeNullValue(field: { includeNull?: { param: string } }): boolean {
  return field.includeNull ? Boolean(localState.value[field.includeNull.param]) : false
}

function setIncludeNullValue(field: { includeNull?: { param: string } }, value: boolean) {
  if (field.includeNull) localState.value[field.includeNull.param] = value
}
</script>

<template>
  <div class="space-y-3" data-testid="data-table-filters">
    <div class="flex items-center gap-2">
      <UButton data-testid="open-filters" @click="open = true">Filtros</UButton>
      <UButton data-testid="clear-filters" variant="ghost" @click="clearAllFilters">Limpiar filtros</UButton>
    </div>

    <slot name="chips" :chips="activeChips" :remove="removeChip" :clear="clearAllFilters">
      <DataTableFiltersChips :chips="activeChips" @remove="removeChip" @clear="clearAllFilters" />
    </slot>

    <USlideover :open="open" :side="slideoverSide" :inset="isDesktop" :content="{ class: 'w-full md:max-w-md max-h-[90vh]' }" @update:open="open = $event">
      <template #content>
        <div class="flex h-full flex-col" data-testid="filters-slideover-layout">
          <div class="sticky top-0 z-10 space-y-3 border-b border-default bg-default px-6 py-5" data-testid="filters-header">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-lg font-semibold">Filtros</h2>
              <div v-if="activeFiltersCount > 0" class="flex items-center gap-2">
                <UBadge color="neutral" variant="subtle" data-testid="active-filters-badge">{{ activeFiltersCount }}</UBadge>
                <UButton variant="ghost" size="sm" data-testid="clear-all-inside" @click="clearAllFilters">Limpiar todo</UButton>
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" data-testid="filters-body">
            <section v-for="group in groupsWithActivity" :key="group.key" :class="group.section ? 'space-y-4' : 'space-y-4 pb-2'">
              <p v-if="group.section" class="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {{ group.section }}
                <span v-if="group.hasActive" class="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" :data-testid="`section-dot-${group.key}`" />
              </p>
              <div class="space-y-4">
                <template v-for="field in group.fields" :key="field.id">
                  <component :is="componentForField(field)" v-if="field.kind === 'multi-enum'" :label="field.label" :model-value="(localState[field.param] as string[]) ?? []" :options="field.options" :placeholder="field.placeholder ?? 'Seleccioná opciones'" :include-null-option="field.includeNull?.label" :include-null-value="getIncludeNullValue(field)" :error="validationErrors[field.id] ?? props.errors[field.id]" @update:model-value="(value: string[]) => localState[field.param] = value" @update:include-null-value="(value: boolean) => setIncludeNullValue(field, value)" />
                  <component :is="componentForField(field)" v-else-if="field.kind === 'number-range'" :label="field.label" :model-value="{ min: localState[field.minParam] as number | undefined, max: localState[field.maxParam] as number | undefined }" :error="validationErrors[field.id] ?? props.errors[field.id]" @update:model-value="(value: { min?: number; max?: number }) => { localState[field.minParam] = value.min; localState[field.maxParam] = value.max }" />
                  <component :is="componentForField(field)" v-else-if="field.kind === 'date-range'" :label="field.label" :model-value="{ from: localState[field.fromParam] as string | undefined, to: localState[field.toParam] as string | undefined }" :include-null-option="field.includeNull?.label" :include-null-value="getIncludeNullValue(field)" :presets="field.presets" :error="validationErrors[field.id] ?? props.errors[field.id]" @update:model-value="(value: { from?: string; to?: string }) => { localState[field.fromParam] = value.from; localState[field.toParam] = value.to }" @update:include-null-value="(value: boolean) => setIncludeNullValue(field, value)" />
                  <component :is="componentForField(field)" v-else-if="field.kind === 'multi-text'" :label="field.label" :model-value="(localState[field.param] as string[]) ?? []" :placeholder="field.placeholder ?? 'Ingresá valores separados por coma'" :strip-prefix="field.parse?.stripPrefix" :max="field.max ?? 200" :error="validationErrors[field.id] ?? props.errors[field.id]" @update:model-value="(value: string[]) => localState[field.param] = value" />
                  <component :is="componentForField(field)" v-else :label="field.label" :model-value="(localState[field.param] as string[]) ?? []" :options="field.options" :placeholder="field.placeholder ?? 'Seleccioná opciones'" :loading="field.loading" :loading-label="field.loadingLabel ?? 'Cargando opciones...'" :include-null-option="field.includeNull?.label" :include-null-value="getIncludeNullValue(field)" :error="validationErrors[field.id] ?? props.errors[field.id]" @update:model-value="(value: string[]) => localState[field.param] = value" @update:include-null-value="(value: boolean) => setIncludeNullValue(field, value)" />
                  <p v-if="validationErrors[field.id]" :data-testid="`validation-error-${field.id}`" class="text-sm text-error">{{ validationErrors[field.id] }}</p>
                </template>
              </div>
              <USeparator v-if="group.key !== groupsWithActivity[groupsWithActivity.length - 1]?.key && group.section" />
            </section>
          </div>

          <div class="sticky bottom-0 z-10 border-t border-default bg-default px-6 py-5" data-testid="filters-footer">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-muted">Cambios aplicados automáticamente</p>
              <UButton variant="ghost" color="neutral" data-testid="close-filters" @click="open = false">Cerrar</UButton>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
