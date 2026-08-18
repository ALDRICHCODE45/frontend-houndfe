<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref } from 'vue'
import DateRangeFilter from '@/core/shared/components/data-table-filters/primitives/DateRangeFilter.vue'
import MultiSelectAsyncFilter from '@/core/shared/components/data-table-filters/primitives/MultiSelectAsyncFilter.vue'
import MultiSelectEnumFilter from '@/core/shared/components/data-table-filters/primitives/MultiSelectEnumFilter.vue'
import MultiTextInputFilter from '@/core/shared/components/data-table-filters/primitives/MultiTextInputFilter.vue'
import NumericRangeFilter from '@/core/shared/components/data-table-filters/primitives/NumericRangeFilter.vue'
import type { FilterDefinition, FilterState, FiltersSchema, NumericRangeFilterDefinition } from '../schema/types'

const props = withDefaults(defineProps<{
  schema: FiltersSchema
  errors?: Record<string, string>
  /**
   * Render the filter sections + chips WITHOUT the trigger button or own
   * slideover. The parent (e.g. DataTableToolbar's unified bottom-sheet)
   * owns the sheet. Default `false` preserves the original standalone
   * "Filtros" trigger + slideover behaviour.
   */
  embedded?: boolean
}>(), {
  errors: () => ({}),
  embedded: false,
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
  // Embedded mode owns no sheet — exposed open() is intentionally a no-op so
  // a stale caller cannot accidentally toggle a hidden slideover.
  if (props.embedded) return
  isOpen.value = true
}

function close() {
  // Same rationale as open() above.
  if (props.embedded) return
  isOpen.value = false
}

defineExpose({ open, close })
</script>

<template>
  <!--
    Two render paths:
    • Standalone (embedded=false, default): root div renders the trigger
      button + own USlideover. The "Limpiar todo" lives in the slideover
      header (no chips row in the toolbar so the header never piles up).
    • Embedded (embedded=true): the trigger and the own USlideover are
      suppressed. Only the section list renders inside the wrapper's
      unified bottom-sheet — the parent owns the trigger, the header, the
      footer, and the slideover.
    In both paths the active filters are marked on the primitive itself
    (is-active → ring), not as removable chips in the header.
  -->
  <div
    v-if="embedded"
    class="space-y-3"
    data-testid="data-table-filters-embedded"
  >
    <div class="space-y-4">
      <section
        v-for="group in groupsWithActivity"
        :key="group.key"
        :data-testid="`section-group-${group.key}`"
        class="rounded-lg border border-default bg-elevated/30 px-4 py-4"
      >
        <p
          v-if="group.section"
          class="mb-4 text-sm font-semibold text-highlighted"
          :data-testid="`section-header-${group.key}`"
        >
          {{ group.section }}
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
              :is-active="schema.isActive(field.id, state)"
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
              :is-active="schema.isActive(field.id, state)"
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
              :is-active="schema.isActive(field.id, state)"
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
              :is-active="schema.isActive(field.id, state)"
            />

            <DateRangeFilter
              v-else
              v-model="state[field.id] as { from?: string, to?: string }"
              :include-null-value="getIncludeNullValue(field)"
              :label="field.label"
              :include-null-option="field.includeNull?.label"
              :presets="field.presets"
              :error="props.errors[field.id]"
              :is-active="schema.isActive(field.id, state)"
              @update:include-null-value="setIncludeNullValue(field, $event)"
            />
          </template>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="space-y-3" data-testid="data-table-filters-v2">
    <slot name="trigger" :open="open" :active-count="activeCount">
      <UButton variant="outline" color="neutral" data-testid="filters-trigger" @click="open">
        <UIcon name="i-lucide-sliders-horizontal" />
        Filtros
        <UBadge v-if="activeCount > 0" :label="String(activeCount)" color="primary" data-testid="filters-trigger-count" />
      </UButton>
    </slot>

    <USlideover :open="isOpen" :side="slideoverSide" inset :ui="slideoverUi" @update:open="isOpen = $event">
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
                    :is-active="schema.isActive(field.id, state)"
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
                    :is-active="schema.isActive(field.id, state)"
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
                    :is-active="schema.isActive(field.id, state)"
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
                    :is-active="schema.isActive(field.id, state)"
                  />

                  <DateRangeFilter
                    v-else
                    v-model="state[field.id] as { from?: string, to?: string }"
                    :include-null-value="getIncludeNullValue(field)"
                    :label="field.label"
                    :include-null-option="field.includeNull?.label"
                    :presets="field.presets"
                    :error="props.errors[field.id]"
                    :is-active="schema.isActive(field.id, state)"
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
