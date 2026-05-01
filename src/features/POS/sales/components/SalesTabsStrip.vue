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
  <div class="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-default bg-default no-scrollbar">
    <!-- Tab buttons -->
    <div
      v-for="(draft, index) in drafts"
      :key="draft.id"
      :data-testid="`tab-${draft.id}`"
      :class="[
        'group flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
        isActive(draft.id)
          ? 'bg-elevated text-highlighted font-medium shadow-sm border border-default'
          : 'bg-transparent text-muted hover:bg-elevated/40 hover:text-highlighted',
      ]"
      @click="emit('switch', draft.id)"
    >
      <span class="text-sm">{{ getTabLabel(index) }}</span>

      <!-- Item count badge -->
      <span
        v-if="draft.items.length > 0"
        :class="[
          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[11px] font-semibold tabular-nums',
          isActive(draft.id)
            ? 'bg-primary/15 text-primary'
            : 'bg-elevated text-muted group-hover:bg-elevated/80',
        ]"
      >
        {{ draft.items.length }}
      </span>

      <!-- Close button -->
      <button
        :data-testid="`close-tab-${draft.id}`"
        :class="[
          'transition-colors duration-150 rounded-sm p-0.5',
          isActive(draft.id)
            ? 'text-dimmed hover:text-highlighted hover:bg-default'
            : 'text-dimmed/50 hover:text-highlighted hover:bg-elevated/60',
        ]"
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
