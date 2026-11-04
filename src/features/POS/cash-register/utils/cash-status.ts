import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import type { CashSessionStatus } from '../interfaces/cash.types'

/** Spanish names for the session lifecycle: the raw enum is never shown. */
export const CASH_SESSION_STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: 'Abierta',
  COUNTING: 'Congelada',
  SUBMITTED: 'Declarada',
  CLOSED: 'Cerrada',
}

const TONES: Record<CashSessionStatus, AppBadgeTone> = {
  OPEN: 'success',
  COUNTING: 'warning',
  SUBMITTED: 'info',
  CLOSED: 'neutral',
}

/** The `StatusBadge` tone of a session status. */
export function cashSessionStatusTone(status: CashSessionStatus): AppBadgeTone {
  return TONES[status]
}
