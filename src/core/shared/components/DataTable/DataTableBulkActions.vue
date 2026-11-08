<script setup lang="ts">
import { computed } from 'vue'
import type { BulkAction } from '../../types/table.types'

const props = withDefaults(
  defineProps<{
    selectedCount: number
    totalCount: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: BulkAction<any>[]
    /** Rows handed to `action.onClick`; without them the actions keep receiving `[]`. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedRows?: any[]
    /** Noun after the count («3 seleccionadas»). */
    selectedLabel?: { one: string; other: string }
    /** Name of the bar's region for assistive tech. */
    label?: string
    /** Box of the table surface (viewport px); the fixed bar centres over it. Unset → the viewport. */
    anchor?: { left: number; width: number }
  }>(),
  {
    selectedRows: undefined,
    selectedLabel: () => ({ one: 'seleccionado', other: 'seleccionados' }),
    label: 'Acciones para las filas seleccionadas',
    anchor: undefined,
  },
)

const emit = defineEmits<{
  clearSelection: []
}>()

defineSlots<{
  /** Summary of the selection beside the count (e.g. the total of the selected sales). */
  summary?: () => unknown
}>()

const noun = computed(() => (props.selectedCount === 1 ? props.selectedLabel.one : props.selectedLabel.other))
const status = computed(() =>
  props.totalCount > 0 ? `${props.selectedCount} ${noun.value} de ${props.totalCount}` : `${props.selectedCount} ${noun.value}`,
)
// 16px of breathing room on each side of the surface.
const anchorStyle = computed(() =>
  props.anchor
    ? {
        '--hf-bulk-center': `${props.anchor.left + props.anchor.width / 2}px`,
        '--hf-bulk-max': `${Math.max(0, props.anchor.width - 32)}px`,
      }
    : undefined,
)
// The destructive action goes last, right before ✕, like every danger action in the system.
const orderedActions = computed(() => [
  ...props.actions.filter(action => action.variant !== 'destructive'),
  ...props.actions.filter(action => action.variant === 'destructive'),
])

/**
 * Map BulkAction.variant to a Nuxt UI `color`.
 *
 * - 'destructive' → 'error' (red, e.g. batch-delete)
 * - 'warning'     → 'warning' (amber, e.g. batch-terminate)
 * - 'primary'     → 'primary' (success-tone, e.g. batch-reactivate)
 * - 'default'/undefined → 'neutral' (gray, generic)
 */
function resolveActionColor(variant: BulkAction<unknown>['variant']) {
  switch (variant) {
    case 'destructive':
      return 'error'
    case 'warning':
      return 'warning'
    case 'primary':
      return 'primary'
    case 'default':
    default:
      return 'neutral'
  }
}
</script>

<template>
  <Transition name="hf-bulk-bar">
    <div v-if="selectedCount > 0" class="hf-bulk-bar" role="region" :aria-label="props.label" :style="anchorStyle">
      <span class="hf-bulk-bar__count"
        ><span class="hf-bulk-count" data-testid="bulk-selected-count">{{ selectedCount }}</span> {{ noun }}</span
      >
      <span class="sr-only" role="status">{{ status }}</span>
      <span v-if="$slots.summary" class="hf-bulk-bar__summary"><slot name="summary" /></span>

      <template v-if="orderedActions.length > 0">
        <span class="hf-bulk-bar__sep" aria-hidden="true" />
        <UButton
          v-for="action in orderedActions"
          :key="action.id"
          :label="action.label"
          :icon="action.icon"
          :color="resolveActionColor(action.variant)"
          :disabled="action.disabled"
          :class="action.variant === 'destructive' ? 'hf-bulk-bar__danger' : undefined"
          variant="ghost"
          data-bulk-action
          @click="action.onClick(props.selectedRows ?? [])"
        />
      </template>

      <span class="hf-bulk-bar__sep" aria-hidden="true" />
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Quitar selección"
        title="Quitar selección"
        @click="emit('clearSelection')"
      />
    </div>
  </Transition>
</template>

<style scoped>
.hf-bulk-count {
  font-variant-numeric: tabular-nums;
  color: var(--hf-active);
}
</style>
