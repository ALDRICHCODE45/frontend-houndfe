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
  /** One-line, neutral es-MX description of what the task does right now. */
  description: string
  hint: string
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
    description: 'Elige la caja y registra el fondo con el que empieza el turno.',
    hint: 'Cajas y fondo inicial',
    icon: 'i-lucide-door-open',
    needsSession: false,
  },
  {
    id: 'historial',
    label: 'Sesiones',
    heading: 'Historial de turnos',
    description: 'Consulta los turnos de caja y abre el que necesites.',
    hint: 'Lista de sesiones existente',
    icon: 'i-lucide-history',
    needsSession: false,
  },
  {
    id: 'movimientos',
    label: 'Movimientos',
    heading: 'Movimientos de efectivo',
    description: 'Registra el dinero que entra o sale del cajón durante el turno.',
    hint: 'Ingresos y retiros manuales',
    icon: 'i-lucide-arrow-left-right',
    needsSession: true,
  },
  {
    id: 'conteo',
    label: 'Conteo',
    heading: 'Cuenta el dinero de tu cajón',
    description: 'El conteo es ciego: congela el turno y declara cada canal.',
    hint: 'Congelar y declarar el conteo ciego',
    icon: 'i-lucide-calculator',
    needsSession: true,
  },
  {
    id: 'notas',
    label: 'Notas',
    heading: 'Notas de la declaración',
    description: 'Agrega una explicación a la declaración ya enviada.',
    hint: 'Notas de la declaración enviada',
    icon: 'i-lucide-notebook-pen',
    needsSession: true,
  },
  {
    id: 'verificacion',
    label: 'Verificación',
    heading: 'Verifica el conteo',
    description: 'Otra persona recuenta y compara el efectivo declarado.',
    hint: 'Recuento de otra persona',
    icon: 'i-lucide-shield-check',
    needsSession: true,
  },
  {
    id: 'custodia',
    label: 'Custodia',
    heading: 'Entrega el dinero',
    description: 'Declara la entrega, recibe el FLOAT y libera el cajón.',
    hint: 'Entregas y liberación del cajón',
    icon: 'i-lucide-hand-coins',
    needsSession: true,
  },
  {
    id: 'recepcion',
    label: 'Recepciones',
    heading: 'Recepciones de caja',
    description: 'Consulta y recibe las entregas destinadas a ti.',
    hint: 'Entregas destinadas a ti',
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
