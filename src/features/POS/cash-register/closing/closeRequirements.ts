/**
 * Close requirement checklist (T4, S5), derived only from GET /cash-sessions/:id.
 *
 * The order follows the backend close checks (handoff 25 §5 rows 11–17):
 *   11 declared (status SUBMITTED) → 12 another person → 13 drawer released →
 *   14 verification → 15 difference explained → 16 handovers received →
 *   17 handovers add up to the declared cash.
 *
 * Pure and side-effect free. It only explains a disabled «Cerrar caja» and who
 * must act; the backend still decides (every 422 is shown as it comes). A fact
 * the detail cannot prove (blind or hidden expected values) is `unknown`, which
 * never blocks the action.
 */
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { CashSessionDetail } from '../interfaces/cash.types'

export type CloseRequirementId =
  | 'submitted'
  | 'otherPerson'
  | 'drawerReleased'
  | 'verified'
  | 'discrepancyNotes'
  | 'handoversReceived'
  | 'handoversAllocated'

export type CloseRequirementState = 'met' | 'pending' | 'unknown'

export interface CloseRequirement {
  id: CloseRequirementId
  label: string
  state: CloseRequirementState
  /** Met: the fact. Pending: what is missing and who does it (one sentence). */
  detail: string
}

type CashCount = CashSessionDetail['counts'][number]
type CountLine = CashCount['lines'][number]

const CASH = 'CASH'

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function latest(counts: CashCount[], kind: CashCount['kind']): CashCount | null {
  return counts
    .filter((count) => count.kind === kind)
    .reduce<CashCount | null>((best, count) => (!best || count.revision > best.revision ? count : best), null)
}

function lineMap(lines: CountLine[]): Map<string, number> {
  return new Map(lines.map((line) => [line.channelKey, line.amountCents]))
}

function time(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    date,
  )
}

/** The cashier by name, or a neutral description (never an id). */
function cashierName(detail: CashSessionDetail): string {
  return detail.session.cashierDisplayName?.trim() || 'la persona que abrió la caja'
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export interface CashSessionDifference {
  /** Physical cash, declared − expected (`null` when not comparable). */
  declarationCents: number | null
  /** Physical cash, verified − declared (`null` without a verification). */
  verificationCents: number | null
  /** Any channel (or the cash totals) differs; `null` when nothing can be compared. */
  hasDifference: boolean | null
}

interface DifferenceFacts extends CashSessionDifference {
  declarationDiffers: boolean | null
  verificationDiffers: boolean | null
}

function differenceFacts(detail: CashSessionDetail): DifferenceFacts {
  const declaration = latest(detail.counts, 'DECLARATION')
  const verification = latest(detail.counts, 'VERIFICATION')
  const snapshot = detail.session.blind ? null : detail.channelSnapshot
  const declared = declaration ? lineMap(declaration.lines) : null

  let declarationDiffers: boolean | null = null
  let declarationCents: number | null = null
  if (declared && snapshot) {
    declarationDiffers = snapshot.some(
      (line) => (declared.get(line.channelKey) ?? 0) !== line.expectedCents,
    )
    const expectedCash = snapshot.find((line) => line.channelKey === CASH)?.expectedCents
    if (expectedCash !== undefined) declarationCents = (declared.get(CASH) ?? 0) - expectedCash
  } else if (!detail.session.blind && typeof detail.session.differenceCents === 'number') {
    declarationCents = detail.session.differenceCents
    declarationDiffers = declarationCents !== 0
  }

  let verificationDiffers: boolean | null = null
  let verificationCents: number | null = null
  if (declared && verification) {
    const verified = lineMap(verification.lines)
    const keys = new Set([...declared.keys(), ...verified.keys()])
    verificationDiffers = [...keys].some((key) => (verified.get(key) ?? 0) !== (declared.get(key) ?? 0))
    verificationCents = (verified.get(CASH) ?? 0) - (declared.get(CASH) ?? 0)
  }

  // Any proven difference counts; «no difference» needs the declaration side known.
  const hasDifference =
    declarationDiffers === true || verificationDiffers === true
      ? true
      : declarationDiffers === null
        ? null
        : false
  return { declarationCents, verificationCents, hasDifference, declarationDiffers, verificationDiffers }
}

/** The two differences, never merged (see «The two differences» in the contract). */
export function sessionDifference(detail: CashSessionDetail): CashSessionDifference {
  const { declarationCents, verificationCents, hasDifference } = differenceFacts(detail)
  return { declarationCents, verificationCents, hasDifference }
}

export function closeRequirements(
  detail: CashSessionDetail,
  currentUserId: string | null | undefined,
): CloseRequirement[] {
  const { session } = detail
  const cashier = cashierName(detail)
  const declaration = latest(detail.counts, 'DECLARATION')
  const firstDeclaration = detail.counts
    .filter((count) => count.kind === 'DECLARATION')
    .reduce<CashCount | null>((first, c) => (!first || c.revision < first.revision ? c : first), null)
  const verification = latest(detail.counts, 'VERIFICATION')
  const submitted = session.status === 'SUBMITTED' || session.status === 'CLOSED'
  const isCashier = Boolean(currentUserId) && session.cashierUserId === currentUserId

  const facts = differenceFacts(detail)
  const declarationNoted = hasText(declaration?.notes)
  const verificationNoted = hasText(verification?.notes)

  let discrepancy: CloseRequirement
  if (facts.declarationDiffers && !declarationNoted) {
    discrepancy = {
      id: 'discrepancyNotes',
      label: 'Diferencia explicada',
      state: 'pending',
      detail: `Falta la nota de la diferencia: ${cashier} debe agregar una nota en «Notas» antes del cierre.`,
    }
  } else if (facts.verificationDiffers && !verificationNoted) {
    discrepancy = {
      id: 'discrepancyNotes',
      label: 'Diferencia explicada',
      state: 'pending',
      detail: 'Falta la nota de la verificación: quien verificó debe explicar la diferencia antes del cierre.',
    }
  } else if (facts.hasDifference === null) {
    discrepancy = {
      id: 'discrepancyNotes',
      label: 'Diferencia explicada',
      state: 'unknown',
      detail: 'Se confirma al cerrar: todavía no se ve lo esperado.',
    }
  } else {
    discrepancy = {
      id: 'discrepancyNotes',
      label: 'Diferencia explicada',
      state: 'met',
      detail: facts.hasDifference ? 'La diferencia tiene nota' : 'Sin diferencia',
    }
  }

  const handovers = detail.handovers
  const received = handovers.filter((handover) => handover.receivedAt !== null).length
  const receivedReq: CloseRequirement =
    received === handovers.length
      ? {
          id: 'handoversReceived',
          label: 'Entregas recibidas',
          state: 'met',
          detail: handovers.length === 0 ? 'Sin entregas' : `${received} de ${handovers.length} recibidas`,
        }
      : {
          id: 'handoversReceived',
          label: 'Entregas recibidas',
          state: 'pending',
          detail: `${received} de ${handovers.length} recibidas: cada persona destinataria debe confirmar su entrega en «Por recibir».`,
        }

  const declaredCash = declaration ? lineMap(declaration.lines).get(CASH) ?? 0 : null
  const allocated = handovers.reduce((sum, handover) => sum + handover.declaredCents, 0)
  let allocatedReq: CloseRequirement
  if (declaredCash === null) {
    allocatedReq = {
      id: 'handoversAllocated',
      label: 'Efectivo asignado en entregas',
      state: submitted ? 'unknown' : 'pending',
      detail: submitted
        ? 'Se confirma al cerrar.'
        : `Después de declarar, ${cashier} reparte el efectivo contado en entregas.`,
    }
  } else if (allocated === declaredCash) {
    allocatedReq = {
      id: 'handoversAllocated',
      label: 'Efectivo asignado en entregas',
      state: 'met',
      detail: `${formatCentsMXN(allocated)} de ${formatCentsMXN(declaredCash)}`,
    }
  } else if (allocated < declaredCash) {
    allocatedReq = {
      id: 'handoversAllocated',
      label: 'Efectivo asignado en entregas',
      state: 'pending',
      detail: `Faltan ${formatCentsMXN(declaredCash - allocated)} por asignar: ${cashier} debe declarar las entregas antes del cierre.`,
    }
  } else {
    allocatedReq = {
      id: 'handoversAllocated',
      label: 'Efectivo asignado en entregas',
      state: 'pending',
      detail: `Sobran ${formatCentsMXN(allocated - declaredCash)} en las entregas: no pueden superar el efectivo declarado.`,
    }
  }

  return [
    submitted
      ? {
          id: 'submitted',
          label: 'Declaración enviada',
          state: 'met',
          detail: [capitalize(cashier), time(firstDeclaration?.createdAt)].filter(Boolean).join(' · '),
        }
      : {
          id: 'submitted',
          label: 'Declaración enviada',
          state: 'pending',
          detail: `Falta la declaración: ${cashier} debe contar y enviar su declaración.`,
        },
    isCashier
      ? {
          id: 'otherPerson',
          label: 'Cierra otra persona',
          state: 'pending',
          detail: 'Abriste esta caja: debe cerrarla otra persona con permiso de cierre.',
        }
      : {
          id: 'otherPerson',
          label: 'Cierra otra persona',
          state: 'met',
          detail: 'Tú no abriste esta caja',
        },
    session.drawerReleasedAt
      ? {
          id: 'drawerReleased',
          label: 'Cajón liberado',
          state: 'met',
          detail: time(session.drawerReleasedAt) || 'Liberado',
        }
      : {
          id: 'drawerReleased',
          label: 'Cajón liberado',
          state: 'pending',
          detail: `Falta liberar el cajón: ${cashier} debe liberarlo antes del cierre.`,
        },
    verification
      ? {
          id: 'verified',
          label: 'Verificación hecha',
          state: 'met',
          detail: time(verification.createdAt) || 'Verificada',
        }
      : {
          id: 'verified',
          label: 'Verificación hecha',
          state: 'pending',
          detail: 'Falta la verificación: otra persona, distinta de quien abrió la caja, debe recontar.',
        },
    discrepancy,
    receivedReq,
    allocatedReq,
  ]
}

export type CloseMode = 'closed' | 'cashier' | 'ready' | 'blocked'

export interface CloseReadiness {
  mode: CloseMode
  requirements: CloseRequirement[]
  /** First pending requirement's sentence (in §5 order), or `null`. */
  blockingReason: string | null
  /**
   * Physical-cash difference (verified when available). Informative only: the
   * closing note is always optional (handoff 25 §5); a difference only needs the
   * declaration/verification notes, checked by `discrepancyNotes`.
   */
  differenceCents: number | null
}

export function closeReadiness(
  detail: CashSessionDetail,
  currentUserId: string | null | undefined,
): CloseReadiness {
  const requirements = closeRequirements(detail, currentUserId)
  const facts = differenceFacts(detail)
  const differenceCents =
    facts.declarationCents === null
      ? null
      : facts.declarationCents + (facts.verificationCents ?? 0)
  const pending = requirements.find((requirement) => requirement.state === 'pending') ?? null
  const isCashier = Boolean(currentUserId) && detail.session.cashierUserId === currentUserId

  let mode: CloseMode
  if (detail.session.status === 'CLOSED' || detail.closing) mode = 'closed'
  else if (isCashier) mode = 'cashier'
  else mode = pending ? 'blocked' : 'ready'

  return {
    mode,
    requirements,
    blockingReason: mode === 'blocked' ? (pending?.detail ?? null) : null,
    differenceCents,
  }
}
