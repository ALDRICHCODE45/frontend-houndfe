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
  <div class="flex items-center gap-2 overflow-x-auto px-4 py-3 border-b border-default bg-default no-scrollbar">
    <!-- Tab buttons -->
    <div
      v-for="(draft, index) in drafts"
      :key="draft.id"
      :data-testid="`tab-${draft.id}`"
      :class="[
        'group flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-150 whitespace-nowrap cursor-pointer border',
        isActive(draft.id)
          ? 'bg-elevated text-highlighted font-semibold shadow-sm border-default'
          : 'bg-default text-muted border-transparent hover:bg-elevated/60 hover:text-highlighted hover:border-default',
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
           'transition-colors duration-150 rounded-md p-0.5',
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
      class="ml-1 rounded-xl"
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
