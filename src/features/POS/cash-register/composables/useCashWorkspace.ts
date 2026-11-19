/**
 * Presentation-only model for the Caja shift timeline (direction A).
 *
 * It owns which task is open IN PLACE (one at a time, or none). It never
 * selects a register/session, never runs a query and never triggers a command:
 * opening a task is navigation, not a business transition. Reachability is
 * supplied by the view (timeline state + abilities) and nothing forces an
 * order: any reachable task opens. When the open task stops being reachable
 * (a new shift, a lost grant) it closes.
 */
import { shallowRef, watch } from 'vue'
import { CASH_TIMELINE_STEP_IDS, type CashStepId } from '../utils/cash-timeline'

/** Every timeline step plus «Por recibir», which opens from the summary column. */
export const CASH_PANEL_IDS = [...CASH_TIMELINE_STEP_IDS, 'recepcion'] as const

export type CashPanelId = CashStepId | 'recepcion'

/** In-place heading of each panel (read by screen readers when it opens). */
export const CASH_PANEL_TITLES: Record<CashPanelId, string> = {
  apertura: 'Abrir caja',
  movimientos: 'Entradas y salidas',
  conteo: 'Iniciar conteo',
  declaracion: 'Conteo y declaración',
  entrega: 'Entrega de efectivo',
  verificacion: 'Verificación',
  liberar: 'Liberar cajón',
  cierre: 'Cerrar caja',
  corte: 'Corte de caja',
  recepcion: 'Por recibir',
}

export interface UseCashWorkspaceOptions {
  /** Reachability predicate, re-evaluated reactively. Defaults to every panel. */
  isReachable?: (panelId: CashPanelId) => boolean
  /** Panel open on first render. */
  initialPanelId?: CashPanelId | null
}

export function useCashWorkspace(options: UseCashWorkspaceOptions = {}) {
  const reachable = (id: CashPanelId) => (options.isReachable ? options.isReachable(id) : true)
  const openPanelId = shallowRef<CashPanelId | null>(options.initialPanelId ?? null)

  function openPanel(panelId: CashPanelId): void {
    if (!reachable(panelId)) return
    openPanelId.value = panelId
  }

  function closePanel(): void {
    openPanelId.value = null
  }

  function togglePanel(panelId: CashPanelId): void {
    if (openPanelId.value === panelId) closePanel()
    else openPanel(panelId)
  }

  watch(
    () => (openPanelId.value ? reachable(openPanelId.value) : true),
    (stillReachable) => {
      if (!stillReachable) closePanel()
    },
  )

  return { openPanelId, openPanel, closePanel, togglePanel }
}
