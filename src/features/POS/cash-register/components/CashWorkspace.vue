<script setup lang="ts">
/**
 * Task-focused shell for the Caja workspace.
 *
 * Presentational only: it lays out the central selected-shift region, the
 * operation area and a quiet context column with the task cards. It owns no
 * query, command or business selection — clicking a task only announces the
 * requested task so the view can reveal that task's existing panel.
 *
 * The page heading is the FOCUSED task's heading (a presentation label, never a
 * lifecycle step) and the only text of the page header. When no task is focused
 * the page falls back to the plain workspace title.
 */
import { computed } from 'vue'
import type { CashWorkspaceTaskId, CashWorkspaceTaskOption } from '../composables/useCashWorkspace'

const props = withDefaults(
  defineProps<{
    title: string
    tasks?: CashWorkspaceTaskOption[]
    activeTaskId?: CashWorkspaceTaskId | null
  }>(),
  {
    tasks: () => [],
    activeTaskId: null,
  },
)

const emit = defineEmits<{
  selectTask: [taskId: CashWorkspaceTaskId]
}>()

const activeTask = computed(
  () => props.tasks.find((task) => task.id === props.activeTaskId) ?? null,
)

const heading = computed(() => activeTask.value?.heading || props.title)
</script>

<template>
  <section class="cash-workspace cash-visual flex flex-col gap-6" data-testid="cash-workspace">
    <header class="cash-workspace-header">
      <h1 class="cash-page-title" data-testid="cash-workspace-heading">{{ heading }}</h1>
    </header>

    <div class="cash-workspace-grid">
      <div class="cash-workspace-main">
        <!-- Central selected-shift context, supplied by the view. -->
        <div class="cash-workspace-shift" data-testid="cash-workspace-shift">
          <slot name="shift" />
        </div>

        <!-- Operation area: the active task's existing panel. -->
        <div class="cash-workspace-operation" data-testid="cash-workspace-operation">
          <slot />
        </div>
      </div>

      <aside
        v-if="tasks.length > 0 || $slots.context"
        class="cash-workspace-context"
        data-testid="cash-workspace-context"
      >
        <nav
          v-if="tasks.length > 0"
          class="cash-task-nav"
          aria-label="Tareas de Caja"
          data-testid="cash-workspace-nav"
        >
          <ul class="cash-task-nav-list">
            <li v-for="task in tasks" :key="task.id">
              <button
                type="button"
                class="cash-task"
                :class="{ 'cash-task-active': task.id === activeTaskId }"
                :aria-current="task.id === activeTaskId ? 'true' : undefined"
                :data-testid="`cash-workspace-task-${task.id}`"
                @click="emit('selectTask', task.id)"
              >
                <UIcon
                  :name="task.icon"
                  class="cash-task-icon"
                  :data-testid="`cash-task-icon-${task.id}`"
                  aria-hidden="true"
                />
                <span class="cash-task-label">{{ task.label }}</span>
              </button>
            </li>
          </ul>
        </nav>
        <slot name="context" />
      </aside>
    </div>
  </section>
</template>
