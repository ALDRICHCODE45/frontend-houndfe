<script setup lang="ts">
import type { BulkAction } from '../../types/table.types'

defineProps<{
  selectedCount: number
  totalCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: BulkAction<any>[]
}>()

const emit = defineEmits<{
  clearSelection: []
}>()
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
        <UBadge color="primary" variant="subtle" :label="String(selectedCount)" />
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
          :color="action.variant === 'destructive' ? 'error' : 'neutral'"
          variant="outline"
          size="sm"
          @click="action.onClick([])"
        />
      </div>
    </div>
  </Transition>
</template>
