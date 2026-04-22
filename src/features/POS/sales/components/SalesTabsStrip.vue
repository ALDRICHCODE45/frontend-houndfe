<script setup lang="ts">
import type { Sale } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  drafts: Sale[]
  activeTabId: string | null
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  switch: [saleId: string]
  close: [saleId: string]
  create: []
}>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTabLabel(index: number): string {
  return `Venta ${index + 1}`
}

function isActive(saleId: string): boolean {
  return props.activeTabId === saleId
}
</script>

<template>
  <div class="flex items-center gap-1 overflow-x-auto px-3 py-2 border-b border-default bg-elevated/30 no-scrollbar">
    <!-- Tab buttons -->
    <div
      v-for="(draft, index) in drafts"
      :key="draft.id"
      :data-testid="`tab-${draft.id}`"
      :class="[
        'flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
        isActive(draft.id)
          ? 'bg-default text-highlighted font-medium shadow-sm border border-default'
          : 'bg-transparent text-toned hover:bg-elevated/60 hover:text-highlighted',
      ]"
      @click="emit('switch', draft.id)"
    >
      <span class="text-sm">{{ getTabLabel(index) }}</span>

      <!-- Close button -->
      <button
        :data-testid="`close-tab-${draft.id}`"
        class="text-dimmed hover:text-highlighted transition-colors duration-150 rounded-sm hover:bg-elevated/60 p-0.5"
        @click.stop="emit('close', draft.id)"
      >
        <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Create tab button -->
    <UButton
      data-testid="create-tab"
      variant="ghost"
      color="neutral"
      size="sm"
      icon="i-lucide-plus"
      class="ml-1"
      @click="emit('create')"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
