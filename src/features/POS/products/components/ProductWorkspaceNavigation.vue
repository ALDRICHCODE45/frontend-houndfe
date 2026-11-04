<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'

export type ProductWorkspaceTask = 'identity' | 'presentations' | 'content' | 'review' | 'inventory'

const props = defineProps<{ activeTask: ProductWorkspaceTask; showInventory?: boolean }>()
const emit = defineEmits<{ select: [task: ProductWorkspaceTask] }>()
const tasks = computed<{ id: ProductWorkspaceTask; label: string }[]>(() => [
  { id: 'identity', label: 'Identidad' },
  { id: 'presentations', label: 'Presentaciones' },
  { id: 'content', label: 'Contenido' },
  { id: 'review', label: 'Revisar' },
  ...(props.showInventory ? [{ id: 'inventory' as const, label: 'Inventario' }] : []),
])

// A fade at the end while more tasks wait off-screen, and at the start once the
// strip has scrolled (the same cue as the employee detail tabs).
const strip = ref<HTMLElement | null>(null)
const hasMore = ref(false)
const hasLess = ref(false)

function measure(): void {
  const el = strip.value
  hasMore.value = !!el && el.scrollWidth - el.clientWidth - el.scrollLeft > 1
  hasLess.value = !!el && el.scrollLeft > 1
}

useResizeObserver(strip, measure)
onMounted(measure)
watch(() => props.showInventory, () => void nextTick(measure))

// A task picked from elsewhere (a field error switches it) scrolls into view.
watch(
  () => props.activeTask,
  async () => {
    await nextTick()
    strip.value?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({
      inline: 'nearest',
      block: 'nearest',
    })
    measure()
  },
)
</script>

<template>
  <nav
    ref="strip"
    class="product-task-navigation"
    :data-more="hasMore"
    :data-less="hasLess"
    aria-label="Tareas del producto, sin orden obligatorio"
    @scroll.passive="measure"
  >
    <button
      v-for="task in tasks"
      :key="task.id"
      type="button"
      class="product-task-button"
      :data-task="task.id"
      :aria-current="activeTask === task.id ? 'page' : undefined"
      @click="emit('select', task.id)"
    >
      {{ task.label }}
    </button>
  </nav>
</template>

<style scoped>
.product-task-navigation {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: auto;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--hf-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.product-task-navigation::-webkit-scrollbar { display: none; }
.product-task-navigation[data-more='true'] {
  mask-image: linear-gradient(to right, black calc(100% - 40px), transparent);
}
.product-task-navigation[data-less='true'] {
  mask-image: linear-gradient(to right, transparent, black 40px);
}
.product-task-navigation[data-less='true'][data-more='true'] {
  mask-image: linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent);
}
.product-task-button {
  white-space: nowrap;
  min-height: var(--hf-control-height);
  padding: 12px 8px;
  border-radius: var(--hf-radius-control) var(--hf-radius-control) 0 0;
  color: var(--hf-muted);
  background: transparent;
  font-size: 0.875rem;
  cursor: pointer;
}
.product-task-button[aria-current='page'] {
  color: var(--hf-active);
  background: var(--hf-active-soft);
  box-shadow: inset 0 -2px var(--hf-active);
  font-weight: 600;
}
.product-task-button:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}
@media (max-width: 420px) {
  .product-task-button { font-size: 0.8125rem; }
}
</style>
