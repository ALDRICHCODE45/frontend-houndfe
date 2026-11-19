/**
 * Caja shift timeline (direction A): the session lifecycle as ordered steps,
 * who does each one, its state, and ONE suggested next action per role.
 *
 * Pure presentation model. It never dispatches a command and never forces an
 * order: every reachable step can still be opened. The backend states only
 * advance `OPEN → COUNTING → SUBMITTED → CLOSED`; verification, handovers and
 * the drawer release are facts layered on SUBMITTED, so they are inputs here.
 *
 * Owner decisions encoded:
 *   - S8: the handover is offered right after the declaration (SUBMITTED),
 *     before the verification. The release needs every handover received, not
 *     the verification; the close needs both.
 *   - Verification is always done by another person.
 */
import type { CashSession, CashSessionStatus } from '../interfaces/cash.types'

export const CASH_TIMELINE_STEP_IDS = [
  'apertura',
  'movimientos',
  'conteo',
  'declaracion',
  'entrega',
  'verificacion',
  'liberar',
  'cierre',
  'corte',
] as const

export type CashStepId = (typeof CASH_TIMELINE_STEP_IDS)[number]
export type CashStepState = 'done' | 'current' | 'next' | 'blocked' | 'upcoming'
export type CashStepActor = 'cashier' | 'cashier-recipients' | 'other' | 'supervisor' | 'anyone'

/** `cashier`: the viewer's own shift. `observer`: someone else's shift (audit/supervisor). */
export type CashTimelinePerspective = 'cashier' | 'observer'

export interface CashTimelineInput {
  /** `null`: there is no shift yet. */
  status: CashSessionStatus | null
  perspective: CashTimelinePerspective
  verified: boolean
  drawerReleased: boolean
  handoversDeclared: number
  handoversPending: number
  /** Declared CASH channel; `null` when unknown. */
  countedCashCents: number | null
  cashierName?: string | null
  /** The viewer may verify (another person's shift). */
  canVerify?: boolean
}

export interface CashTimelineStep {
  id: CashStepId
  label: string
  actor: CashStepActor
  actorLabel: string
  state: CashStepState
  stateLabel: string
  detail: string
  /** The step of the primary next action. */
  highlighted: boolean
  /** A step that is not `upcoming` can be opened in place. */
  reachable: boolean
}

export interface CashNextAction {
  kind: 'primary' | 'wait'
  label: string
  why: string
  stepId: CashStepId | null
  alt?: { label: string; stepId: CashStepId }
}

const STEP_LABELS: Record<CashStepId, string> = {
  apertura: 'Abrir caja',
  movimientos: 'Vender y registrar entradas o salidas',
  conteo: 'Iniciar conteo',
  declaracion: 'Declarar a ciegas',
  entrega: 'Entregar el efectivo y recibirlo',
  verificacion: 'Verificar el conteo',
  liberar: 'Liberar el cajón',
  cierre: 'Cerrar caja',
  corte: 'Corte de caja',
}

const STEP_ACTORS: Record<CashStepId, CashStepActor> = {
  apertura: 'cashier',
  movimientos: 'cashier',
  conteo: 'cashier',
  declaracion: 'cashier',
  entrega: 'cashier-recipients',
  verificacion: 'other',
  liberar: 'cashier',
  cierre: 'supervisor',
  corte: 'anyone',
}

export const CASH_STEP_ACTOR_LABELS: Record<CashStepActor, string> = {
  cashier: 'Cajera/o',
  'cashier-recipients': 'Cajera/o y quien recibe',
  other: 'Otra persona',
  supervisor: 'Supervisor',
  anyone: 'Consulta',
}

export const CASH_STEP_STATE_LABELS: Record<CashStepState, string> = {
  done: 'Hecho',
  current: 'En curso',
  next: 'Siguiente',
  blocked: 'Bloqueado',
  upcoming: 'Después',
}

/**
 * «Tu turno»: the latest own session whose drawer is not released yet. The
 * projection's `openedAt` orders it when present; otherwise the list order
 * (newest first from the backend) is kept.
 */
export function pickOwnShift(
  sessions: readonly CashSession[],
  currentUserId: string | null | undefined,
): CashSession | null {
  if (!currentUserId) return null
  const own = sessions.filter(
    (item) => item.cashierUserId === currentUserId && item.drawerReleasedAt === null,
  )
  if (own.length === 0) return null
  return own.reduce((latest, item) => {
    if (!latest.openedAt || !item.openedAt) return latest
    return Date.parse(item.openedAt) > Date.parse(latest.openedAt) ? item : latest
  })
}

function handoverSettled(input: CashTimelineInput): boolean {
  if (input.handoversDeclared > 0) return input.handoversPending === 0
  return input.countedCashCents === 0
}

function stateOf(id: CashStepId, input: CashTimelineInput): CashStepState {
  const { status } = input
  if (status === 'CLOSED') return id === 'corte' ? 'current' : 'done'
  if (status === null) return id === 'apertura' ? 'current' : 'upcoming'
  if (id === 'apertura') return 'done'
  if (status === 'OPEN') {
    if (id === 'movimientos') return 'current'
    if (id === 'conteo') return 'next'
    return 'upcoming'
  }
  if (id === 'movimientos' || id === 'conteo') return 'done'
  if (status === 'COUNTING') return id === 'declaracion' ? 'current' : 'upcoming'
  // SUBMITTED: the facts decide.
  switch (id) {
    case 'declaracion':
      return 'done'
    case 'entrega':
      return handoverSettled(input) ? 'done' : 'current'
    case 'verificacion':
      return input.verified ? 'done' : 'current'
    case 'liberar':
      if (input.drawerReleased) return 'done'
      return handoverSettled(input) ? 'current' : 'blocked'
    case 'cierre':
      return input.verified && input.drawerReleased ? 'current' : 'upcoming'
    default:
      return 'upcoming'
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

function detailOf(id: CashStepId, state: CashStepState, input: CashTimelineInput): string {
  const own = input.perspective === 'cashier'
  const received = input.handoversDeclared - input.handoversPending
  switch (id) {
    case 'apertura':
      return state === 'done' ? 'Caja abierta con el fondo confirmado' : 'Elige la caja y confirma el fondo'
    case 'movimientos':
      if (state === 'done') return 'Terminó al iniciar el conteo'
      if (state !== 'current') return 'Mientras la caja esté abierta'
      return own
        ? 'En curso · ventas y totales ocultos hasta declarar'
        : 'En curso · movimientos visibles para auditoría'
    case 'conteo':
      if (state === 'done') return 'Caja congelada'
      return 'Cuando termines de vender: congela la caja'
    case 'declaracion':
      if (state === 'done') return 'Declaración enviada'
      if (state === 'current') return 'Caja congelada · falta declarar sin ver lo esperado'
      return 'Después de iniciar el conteo'
    case 'entrega':
      if (input.handoversDeclared > 0) {
        return `${received} de ${input.handoversDeclared} ${plural(input.handoversDeclared, 'recibida', 'recibidas')}`
      }
      if (state === 'done') return 'Sin efectivo que entregar'
      if (state === 'current') return 'Disponible desde que declaras, sin esperar la verificación'
      return 'Después de declarar'
    case 'verificacion':
      if (state === 'done') return 'Verificada por otra persona'
      if (state === 'current') {
        return own
          ? 'Lo hace otra persona con permiso; no puedes ser tú'
          : 'Recuenta una persona distinta de quien declaró'
      }
      return 'Otra persona, después de la declaración'
    case 'liberar':
      if (state === 'done') return 'Cajón liberado'
      if (state === 'blocked') return 'Se habilita cuando se reciban todas las entregas'
      if (state === 'current') return 'Listo para liberar; no cierra la caja'
      return 'Después de entregar el efectivo'
    case 'cierre':
      if (state === 'done') return 'Caja cerrada'
      if (state === 'current') return 'Lo hace un supervisor distinto de quien abrió'
      return 'Supervisor, después de verificar y liberar el cajón'
    case 'corte':
      return state === 'current' ? 'Disponible' : 'Aparece al cerrar la caja'
  }
}

export function nextCashAction(input: CashTimelineInput): CashNextAction | null {
  const name = input.cashierName?.trim() || 'La persona responsable'
  const { status } = input
  if (input.perspective === 'cashier') {
    if (status === null) {
      return {
        kind: 'primary',
        label: 'Abrir caja',
        stepId: 'apertura',
        why: 'Elige la caja y confirma el fondo en una sola pantalla.',
      }
    }
    if (status === 'OPEN') {
      return {
        kind: 'primary',
        label: 'Iniciar conteo',
        stepId: 'conteo',
        why: 'Cuando termines de vender. Congela la caja: ya no admite cobros en efectivo ni movimientos.',
        alt: { label: 'Registrar entrada o salida', stepId: 'movimientos' },
      }
    }
    if (status === 'COUNTING') {
      return {
        kind: 'primary',
        label: 'Declarar conteo',
        stepId: 'declaracion',
        why: 'Cuenta cada canal sin ver lo esperado. El cero también se declara.',
      }
    }
    if (status === 'CLOSED') {
      return { kind: 'primary', label: 'Ver corte', stepId: 'corte', why: 'La caja está cerrada.' }
    }
    if (input.handoversDeclared === 0 && !handoverSettled(input)) {
      return {
        kind: 'primary',
        label: 'Entregar efectivo',
        stepId: 'entrega',
        why: 'Reparte el efectivo contado entre el fondo del siguiente turno y el retiro. No necesitas esperar la verificación.',
        alt: { label: 'Agregar nota', stepId: 'declaracion' },
      }
    }
    if (input.handoversPending > 0) {
      const n = input.handoversPending
      return {
        kind: 'wait',
        label: n === 1 ? 'Falta 1 recepción' : `Faltan ${n} recepciones`,
        stepId: null,
        why: 'Cada persona recibe lo que le entregaste desde su propia sesión. Después liberas el cajón.',
        alt: { label: 'Ver entregas', stepId: 'entrega' },
      }
    }
    if (!input.drawerReleased) {
      return {
        kind: 'primary',
        label: 'Liberar cajón',
        stepId: 'liberar',
        why: 'Las entregas están completas. Liberar el cajón es un paso aparte: no cierra la caja.',
      }
    }
    if (!input.verified) {
      return {
        kind: 'wait',
        label: 'Esperando verificación',
        stepId: null,
        why: 'La hace otra persona con permiso; no puede ser quien declaró.',
      }
    }
    return {
      kind: 'wait',
      label: 'Esperando cierre',
      stepId: null,
      why: 'Un supervisor cierra la caja y genera el corte.',
    }
  }

  // Observer: someone else's shift.
  if (status === null) return null
  if (status === 'OPEN') {
    return {
      kind: 'wait',
      label: `${name} está vendiendo`,
      stepId: null,
      why: 'Como auditor ves los movimientos en vivo; quien vende no los ve hasta declarar.',
      alt: { label: 'Ver movimientos', stepId: 'movimientos' },
    }
  }
  if (status === 'COUNTING') {
    return {
      kind: 'wait',
      label: `${name} está contando`,
      stepId: null,
      why: 'Puedes verificar cuando envíe la declaración.',
    }
  }
  if (status === 'CLOSED') {
    return { kind: 'primary', label: 'Ver corte', stepId: 'corte', why: 'La caja está cerrada.' }
  }
  if (!input.verified) {
    return input.canVerify
      ? {
          kind: 'primary',
          label: 'Verificar conteo',
          stepId: 'verificacion',
          why: `${name} ya declaró. Recuenta el efectivo sin mirar la diferencia.`,
        }
      : {
          kind: 'wait',
          label: 'Esperando verificación',
          stepId: null,
          why: 'La hace una persona con permiso de verificación, distinta de quien declaró.',
        }
  }
  if (!input.drawerReleased) {
    return {
      kind: 'wait',
      label: `${name} entrega el efectivo y libera el cajón`,
      stepId: null,
      why: 'Si te entregó efectivo, recíbelo en «Por recibir».',
    }
  }
  return {
    kind: 'primary',
    label: 'Cerrar caja',
    stepId: 'cierre',
    why: 'La declaración está verificada y el cajón liberado.',
  }
}

export function buildCashTimeline(input: CashTimelineInput): CashTimelineStep[] {
  const next = nextCashAction(input)
  const highlightedId = next?.kind === 'primary' ? next.stepId : null
  return CASH_TIMELINE_STEP_IDS.map((id) => {
    const state = stateOf(id, input)
    const actor = STEP_ACTORS[id]
    return {
      id,
      label: STEP_LABELS[id],
      actor,
      actorLabel: CASH_STEP_ACTOR_LABELS[actor],
      state,
      stateLabel: CASH_STEP_STATE_LABELS[state],
      detail: detailOf(id, state, input),
      highlighted: id === highlightedId,
      reachable: state !== 'upcoming',
    }
  })
}
