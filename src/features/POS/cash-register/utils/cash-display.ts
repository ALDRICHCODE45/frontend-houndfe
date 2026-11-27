/**
 * Display copy for the cash display fields (handoff 09-cash-display-fields.md).
 * A missing name or time yields an empty string, so callers render nothing:
 * never a placeholder, never an id.
 */
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type {
  CashCustodyItem,
  CashRegister,
  CashRegisterHeldBy,
  CashSession,
  CashSessionStatus,
} from '../interfaces/cash.types'

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

// ─── Held drawer from GET /cash-registers (handoff 31) ──────────────────────

/**
 * What GET /cash-registers says about a register's drawer: `free`, or `held`
 * with the state, since when and — only when the caller may see it — who. A
 * register without `drawerHeld` is free here; the server's refusal on open
 * (`CASH_REGISTER_UNRELEASED_SESSION`) remains the safety net.
 */
export type CashRegisterHold =
  | { state: 'free' }
  | {
      state: 'held'
      status: CashSessionStatus | null
      since: string | null
      heldBy: CashRegisterHeldBy | null
    }

export function cashRegisterHold(register: CashRegister): CashRegisterHold {
  if (register.drawerHeld !== true) return { state: 'free' }
  return {
    state: 'held',
    status: register.drawerHeldStatus ?? null,
    since: register.drawerHeldSince ?? null,
    heldBy: register.heldBy ?? null,
  }
}

/** The holding session's state, as the picker says it («Ocupada · en conteo»). */
const HELD_STATE: Record<CashSessionStatus, string> = {
  OPEN: 'abierta',
  COUNTING: 'en conteo',
  SUBMITTED: 'conteo por verificar',
  CLOSED: 'cerrada sin liberar',
}

/** "09:12" when it is from today, otherwise "5 nov, 09:12". */
function heldSince(value: string | null, now: Date): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return ''
  const shown = formatShortDateTime(value, { now })
  const [day, time] = shown.split(', ')
  const [today] = formatShortDateTime(now, { now }).split(', ')
  return day === today && time ? time : shown
}

/**
 * Why a held register cannot be opened (handoff 31): «Ocupada · en conteo desde
 * 09:12» for everyone; «Ocupada por Ana desde 09:12» when `heldBy` names the
 * cashier; «Tu sesión · en conteo desde 09:12» for the caller's own session.
 * What is unknown is dropped, never replaced by an id.
 */
export function cashRegisterHeldLabel(
  hold: Extract<CashRegisterHold, { state: 'held' }>,
  now: Date = new Date(),
): string {
  const by = hold.heldBy
  const status = hold.status ?? by?.status ?? null
  const state = status ? HELD_STATE[status] : ''
  const since = heldSince(by?.openedAt ?? hold.since, now)
  const tail = since ? ` desde ${since}` : ''
  const name = by?.cashierDisplayName?.trim()
  if (by?.byMe) return `Tu sesión${state ? ` · ${state}` : ''}${tail}`
  if (name) return `Ocupada por ${name}${tail}`
  return `Ocupada${state ? ` · ${state}` : ''}${tail}`
}
