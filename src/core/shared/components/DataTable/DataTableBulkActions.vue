<script setup lang="ts">
import type { BulkAction } from '../../types/table.types'
import AppBadge from '../AppBadge.vue'

defineProps<{
  selectedCount: number
  totalCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: BulkAction<any>[]
}>()

const emit = defineEmits<{
  clearSelection: []
}>()

/**
 * Map BulkAction.variant to a Nuxt UI `color`.
 *
 * - 'destructive' → 'error' (red, e.g. batch-delete)
 * - 'warning'     → 'warning' (amber, e.g. batch-terminate)
 * - 'primary'     → 'primary' (success-tone, e.g. batch-reactivate)
 * - 'default'/undefined → 'neutral' (gray, generic)
 */
function resolveActionColor(variant: BulkAction<unknown>['variant']): string {
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
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="selectedCount > 0"
      class="bg-elevated border-default sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-lg border p-3 shadow-lg"
    >
      <div class="flex items-center gap-2 text-sm">
        <AppBadge tone="info" :label="String(selectedCount)" />
        <span class="text-muted"> de {{ totalCount }} seleccionados </span>
        <UButton
          color="neutral"
          variant="link"
          label="Deseleccionar"
          size="xs"
          @click="emit('clearSelection')"
        />
      </div>

      <div class="flex items-center gap-2">
        <UButton
          v-for="action in actions"
          :key="action.id"
          :label="action.label"
          :icon="action.icon"
          :color="resolveActionColor(action.variant)"
          variant="outline"
          size="sm"
          @click="action.onClick([])"
        />
      </div>
    </div>
  </Transition>
</template>
