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
