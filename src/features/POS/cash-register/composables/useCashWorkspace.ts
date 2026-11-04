/**
 * Presentation-only navigation model for the Caja workspace.
 *
 * It owns the fixed task catalog and the *selected task* only. It never selects
 * a register/session, never runs a query and never triggers a command: moving
 * between tabs is navigation, not a business transition. Availability is
 * supplied by the view (abilities + selected shift), and the model keeps a valid
 * selection when the offered tasks change.
 */
import { computed, shallowRef, watch } from 'vue'

export type CashWorkspaceTaskId =
  | 'apertura'
  | 'historial'
  | 'movimientos'
  | 'conteo'
  | 'notas'
  | 'verificacion'
  | 'custodia'
  | 'recepcion'

export interface CashWorkspaceTask {
  id: CashWorkspaceTaskId
  label: string
  /** Neutral es-MX page heading shown for the focused task (never a lifecycle step). */
  heading: string
  icon: string
  /** The task only makes sense with an explicitly selected session. */
  needsSession: boolean
}

export interface CashWorkspaceTaskOption extends CashWorkspaceTask {
  available: boolean
}

/**
 * Fixed catalog. The order groups by concern, it is NOT a required lifecycle:
 * every task is independent and none waits on a previous one.
 */
export const CASH_WORKSPACE_TASKS: readonly CashWorkspaceTask[] = [
  {
    id: 'apertura',
    label: 'Apertura',
    heading: 'Abrir un turno',
    icon: 'i-lucide-door-open',
    needsSession: false,
  },
  {
    id: 'historial',
    label: 'Sesiones',
    heading: 'Historial de turnos',
    icon: 'i-lucide-history',
    needsSession: false,
  },
  {
    id: 'movimientos',
    label: 'Movimientos',
    heading: 'Movimientos de efectivo',
    icon: 'i-lucide-arrow-left-right',
    needsSession: true,
  },
  {
    id: 'conteo',
    label: 'Conteo',
    heading: 'Cuenta el dinero de tu cajón',
    icon: 'i-lucide-calculator',
    needsSession: true,
  },
  {
    id: 'notas',
    label: 'Notas',
    heading: 'Notas de la declaración',
    icon: 'i-lucide-notebook-pen',
    needsSession: true,
  },
  {
    id: 'verificacion',
    label: 'Verificación',
    heading: 'Verifica el conteo',
    icon: 'i-lucide-shield-check',
    needsSession: true,
  },
  {
    id: 'custodia',
    label: 'Custodia',
    heading: 'Entrega el dinero',
    icon: 'i-lucide-hand-coins',
    needsSession: true,
  },
  {
    id: 'recepcion',
    label: 'Recepciones',
    heading: 'Recepciones de caja',
    icon: 'i-lucide-inbox',
    needsSession: false,
  },
]

export interface UseCashWorkspaceOptions {
  /** Availability predicate, re-evaluated reactively. Defaults to all offered. */
  isAvailable?: (taskId: CashWorkspaceTaskId) => boolean
  /** Optional scope-honest label override (for example the session list scope). */
  labelFor?: (task: CashWorkspaceTask) => string
  /** Preferred task on first render; falls back to the first offered task. */
  defaultTaskId?: CashWorkspaceTaskId
}

export function useCashWorkspace(options: UseCashWorkspaceOptions = {}) {
  const tasks = computed<CashWorkspaceTaskOption[]>(() =>
    CASH_WORKSPACE_TASKS.map((task) => ({
      ...task,
      label: options.labelFor ? options.labelFor(task) : task.label,
      available: options.isAvailable ? options.isAvailable(task.id) : true,
    })),
  )

  const visibleTasks = computed(() => tasks.value.filter((task) => task.available))

  const activeTaskId = shallowRef<CashWorkspaceTaskId | null>(null)

  /** Select a task that is currently offered; anything else is ignored. */
  function selectTask(taskId: CashWorkspaceTaskId): void {
    if (!visibleTasks.value.some((task) => task.id === taskId)) return
    activeTaskId.value = taskId
  }

  watch(
    visibleTasks,
    () => {
      const current = activeTaskId.value
      if (current && visibleTasks.value.some((task) => task.id === current)) return
      const preferred = options.defaultTaskId
      const next =
        preferred && visibleTasks.value.some((task) => task.id === preferred)
          ? preferred
          : (visibleTasks.value[0]?.id ?? null)
      activeTaskId.value = next
    },
    { immediate: true },
  )

  return {
    tasks,
    visibleTasks,
    activeTaskId,
    selectTask,
  }
}
