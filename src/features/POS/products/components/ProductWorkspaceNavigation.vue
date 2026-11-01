<script setup lang="ts">
export type ProductWorkspaceTask = 'identity' | 'presentations' | 'content' | 'review'

defineProps<{ activeTask: ProductWorkspaceTask }>()
const emit = defineEmits<{ select: [task: ProductWorkspaceTask] }>()
const tasks: { id: ProductWorkspaceTask; label: string }[] = [
  { id: 'identity', label: 'Identidad' },
  { id: 'presentations', label: 'Presentaciones' },
  { id: 'content', label: 'Contenido' },
  { id: 'review', label: 'Revisar' },
]
</script>

<template>
  <nav class="product-task-navigation" aria-label="Tareas del producto, sin orden obligatorio">
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--hf-border);
}
.product-task-button {
  min-height: var(--hf-control-height);
  padding: 12px 4px;
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
