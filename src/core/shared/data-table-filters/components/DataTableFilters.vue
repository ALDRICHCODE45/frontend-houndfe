<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref } from 'vue'
import DateRangeFilter from '@/core/shared/components/data-table-filters/primitives/DateRangeFilter.vue'
import MultiSelectAsyncFilter from '@/core/shared/components/data-table-filters/primitives/MultiSelectAsyncFilter.vue'
import MultiSelectEnumFilter from '@/core/shared/components/data-table-filters/primitives/MultiSelectEnumFilter.vue'
import MultiTextInputFilter from '@/core/shared/components/data-table-filters/primitives/MultiTextInputFilter.vue'
import NumericRangeFilter from '@/core/shared/components/data-table-filters/primitives/NumericRangeFilter.vue'
import type { FilterDefinition, FilterState, FiltersSchema, NumericRangeFilterDefinition } from '../schema/types'
import DataTableFiltersChips from './DataTableFiltersChips.vue'

const props = withDefaults(defineProps<{
  schema: FiltersSchema
  errors?: Record<string, string>
}>(), {
  errors: () => ({}),
})

const state = defineModel<FilterState>('state', { default: () => ({}) })

const isOpen = ref(false)
const isDesktop = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
const slideoverSide = computed(() => (isDesktop.value ? 'right' : 'bottom'))
const slideoverUi = computed(() => (isDesktop.value ? {} : { content: 'h-[85vh] max-h-[85vh] rounded-t-2xl' }))

const activeChips = computed(() => props.schema.activeChips(state.value))
const activeCount = computed(() => activeChips.value.length)

const groupedFields = computed(() => {
  const groups: Array<{ key: string, section?: string, fields: FilterDefinition[] }> = []
  const byKey = new Map<string, { key: string, section?: string, fields: FilterDefinition[] }>()

  for (const field of props.schema.fields) {
    const section = typeof field.section === 'string' ? field.section : undefined
    const key = section?.trim() || '__no_section__'
    const existing = byKey.get(key)
    if (existing) {
      existing.fields.push(field)
      continue
    }
    const created = { key, section, fields: [field] }
    byKey.set(key, created)
    groups.push(created)
  }

  return groups.sort((a, b) => (!a.section && b.section ? -1 : a.section && !b.section ? 1 : 0))
})

const groupsWithActivity = computed(() => groupedFields.value.map(group => ({
  ...group,
  hasActive: group.fields.some(field => props.schema.isActive(field.id, state.value)),
})))

function getDisplayDivisor(field: NumericRangeFilterDefinition): number {
  return field.formatAs === 'currency' ? 100 : 1
}

function clearField(filterId: string) {
  const field = props.schema.byId[filterId]
  if (!field) return

  if (field.kind === 'multi-enum' || field.kind === 'multi-async' || field.kind === 'multi-text') {
    state.value[field.id] = []
    if ('includeNull' in field && field.includeNull) state.value[field.includeNull.param] = false
    return
  }

  if (field.kind === 'numeric-range') {
    state.value[field.id] = { min: undefined, max: undefined }
    return
  }

  state.value[field.id] = { from: undefined, to: undefined }
  if (field.includeNull) state.value[field.includeNull.param] = false
}

function clearAll() {
  state.value = props.schema.defaults()
}

function getIncludeNullValue(field: { includeNull?: { param: string } }): boolean {
  if (!field.includeNull) return false
  return state.value[field.includeNull.param] === true
}

function setIncludeNullValue(field: { includeNull?: { param: string } }, value: boolean) {
  if (!field.includeNull) return
  state.value[field.includeNull.param] = value
}

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

defineExpose({ open, close })
</script>

<template>
  <div class="space-y-3" data-testid="data-table-filters-v2">
    <slot name="trigger" :open="open" :active-count="activeCount">
      <UButton variant="outline" color="neutral" data-testid="filters-trigger" @click="open">
        <UIcon name="i-lucide-sliders-horizontal" />
        Filtros
        <UBadge v-if="activeCount > 0" :label="String(activeCount)" color="primary" data-testid="filters-trigger-count" />
      </UButton>
    </slot>

    <slot name="chips" :chips="activeChips" :clear="clearField" :clear-all="clearAll">
      <DataTableFiltersChips :schema="props.schema" :state="state" @clear="clearField" @clear-all="clearAll" />
    </slot>

    <USlideover :open="isOpen" :side="slideoverSide" :ui="slideoverUi" @update:open="isOpen = $event">
      <template #content>
        <div class="flex h-full flex-col" data-testid="filters-slideover-layout">
          <div class="sticky top-0 z-10 space-y-3 border-b border-default bg-default px-6 py-5" data-testid="filters-header">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-lg font-semibold">Filtros</h2>
              <div v-if="activeCount > 0" class="flex items-center gap-2">
                <UBadge :label="String(activeCount)" color="neutral" variant="subtle" data-testid="filters-header-count" />
                <UButton variant="ghost" size="sm" data-testid="clear-all-button" @click="clearAll">Limpiar todo</UButton>
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" data-testid="filters-body">
            <section v-for="group in groupsWithActivity" :key="group.key" :data-testid="`section-group-${group.key}`" :class="group.section ? 'space-y-4' : 'space-y-4 pb-2'">
              <p v-if="group.section" class="text-[11px] font-semibold uppercase tracking-wider text-muted" :data-testid="`section-header-${group.key}`">
                {{ group.section }}
                <span v-if="group.hasActive" class="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" :data-testid="`section-dot-${group.key}`" />
              </p>
              <div class="space-y-4">
                <template v-for="field in group.fields" :key="field.id">
                  <MultiSelectEnumFilter
                    v-if="field.kind === 'multi-enum'"
                    v-model="state[field.id] as string[]"
                    :include-null-value="getIncludeNullValue(field)"
                    :label="field.label"
                    :options="field.options"
                    :placeholder="field.placeholder"
                    :include-null-option="field.includeNull?.label"
                    :searchable="field.searchable"
                    :error="props.errors[field.id]"
                    @update:include-null-value="setIncludeNullValue(field, $event)"
                  />

                  <MultiSelectAsyncFilter
                    v-else-if="field.kind === 'multi-async'"
                    v-model="state[field.id] as string[]"
                    :include-null-value="getIncludeNullValue(field)"
                    :label="field.label"
                    :options="field.options"
                    :placeholder="field.placeholder"
                    :loading="field.loading"
                    :loading-label="field.loadingLabel"
                    :include-null-option="field.includeNull?.label"
                    :error="props.errors[field.id]"
                    @update:include-null-value="setIncludeNullValue(field, $event)"
                  />

                  <MultiTextInputFilter
                    v-else-if="field.kind === 'multi-text'"
                    v-model="state[field.id] as string[]"
                    :label="field.label"
                    :placeholder="field.placeholder"
                    :max="field.max"
                    :strip-prefix="field.parse?.stripPrefix"
                    :error="props.errors[field.id]"
                  />

                  <NumericRangeFilter
                    v-else-if="field.kind === 'numeric-range'"
                    v-model="state[field.id] as { min?: number, max?: number }"
                    :label="field.label"
                    :unit="field.unit"
                    :step="field.step"
                    :format-as="field.formatAs"
                    :display-divisor="getDisplayDivisor(field)"
                    :error="props.errors[field.id]"
                  />

                  <DateRangeFilter
                    v-else
                    v-model="state[field.id] as { from?: string, to?: string }"
                    :include-null-value="getIncludeNullValue(field)"
                    :label="field.label"
                    :include-null-option="field.includeNull?.label"
                    :presets="field.presets"
                    :error="props.errors[field.id]"
                    @update:include-null-value="setIncludeNullValue(field, $event)"
                  />
                </template>
              </div>
            </section>
          </div>

          <div class="border-t border-default bg-default px-6 py-5" data-testid="filters-footer">
            <div class="flex justify-end">
              <UButton variant="ghost" color="neutral" data-testid="close-filters" @click="close">Cerrar</UButton>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
