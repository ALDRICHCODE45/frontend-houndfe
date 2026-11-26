/**
 * Display copy for the cash display fields (handoff 09-cash-display-fields.md).
 * A missing name or time yields an empty string, so callers render nothing:
 * never a placeholder, never an id.
 */
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { CashCustodyItem, CashSession } from '../interfaces/cash.types'

/**
 * "Desde 5 nov, 09:02" while the session runs; "5 nov, 09:02 – 16:45" once it
 * closed the same day; the closing day repeats only when it differs.
 */
export function cashSessionPeriod(session: Pick<CashSession, 'openedAt' | 'closedAt'>): string {
  if (!session.openedAt) return ''
  const opened = formatShortDateTime(session.openedAt)
  if (!session.closedAt) return `Desde ${opened}`
  const closed = formatShortDateTime(session.closedAt)
  const [openedDay] = opened.split(', ')
  const [closedDay, closedTime] = closed.split(', ')
  return `${opened} – ${closedDay === openedDay ? closedTime : closed}`
}

/** "de Ana Cajera · Caja Mostrador 2", keeping whichever name is known. */
export function custodyOrigin(
  item: Pick<CashCustodyItem, 'senderDisplayName' | 'sourceRegisterName'>,
): string {
  const sender = item.senderDisplayName?.trim()
  const register = item.sourceRegisterName?.trim()
  return [sender ? `de ${sender}` : '', register ?? ''].filter(Boolean).join(' · ')
}

/** What holds the drawer, by lifecycle state («Ocupada: … desde …»). */
const BUSY_STATE: Record<CashSession['status'], string> = {
  OPEN: 'sesión abierta',
  COUNTING: 'conteo en curso',
  SUBMITTED: 'conteo por verificar',
  CLOSED: 'cajón sin liberar',
}

/**
 * Why a register cannot be opened: a session of it still holds the drawer
 * (`drawerReleasedAt: null`). "Ocupada: sesión abierta de Cajero Centro desde
 * 5 nov, 09:02"; «tu» for the current user; a missing name or time is dropped,
 * never replaced by an id.
 */
export function cashRegisterBusyLabel(
  session: Pick<CashSession, 'status' | 'cashierUserId' | 'cashierDisplayName' | 'openedAt'>,
  currentUserId: string | null,
): string {
  const state = BUSY_STATE[session.status]
  const mine = Boolean(currentUserId) && session.cashierUserId === currentUserId
  const name = session.cashierDisplayName?.trim()
  const who = mine ? `tu ${state}` : name ? `${state} de ${name}` : state
  const since = session.openedAt ? formatShortDateTime(session.openedAt) : ''
  return `Ocupada: ${who}${since ? ` desde ${since}` : ''}`
}
