/**
 * Live countdown of a pending validation (handoff §3.1): the server level is
 * a snapshot, so the client counts down from `urgency.deadlineAt` with the
 * same thresholds (< 12 h WARNING, < 4 h CRITICAL, 0 EXPIRED).
 */
import type { UrgencyLevel, ValidationUrgency } from '../interfaces/delivery-zone.types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function liveUrgencyLevel(urgency: ValidationUrgency | null, now: number): UrgencyLevel | null {
  if (!urgency) return null
  const deadline = Date.parse(urgency.deadlineAt)
  if (Number.isNaN(deadline)) return urgency.level
  const left = deadline - now
  if (left <= 0) return 'EXPIRED'
  if (left < 4 * HOUR) return 'CRITICAL'
  if (left < 12 * HOUR) return 'WARNING'
  return 'OK'
}

export function formatCountdown(deadlineAt: string, now: number): string {
  const left = Date.parse(deadlineAt) - now
  if (Number.isNaN(left) || left <= 0) return 'Plazo vencido'
  if (left < MINUTE) return 'Queda menos de 1 min'
  const hours = Math.floor(left / HOUR)
  const minutes = Math.floor((left % HOUR) / MINUTE)
  if (hours === 0) return `Quedan ${minutes} min`
  return minutes === 0 ? `Quedan ${hours} h` : `Quedan ${hours} h ${minutes} min`
}

export interface UrgencyBadge {
  label: string
  tone: 'neutral' | 'warning' | 'danger'
  urgent: boolean
}

const BADGES: Record<UrgencyLevel, UrgencyBadge> = {
  OK: { label: 'A tiempo', tone: 'neutral', urgent: false },
  WARNING: { label: 'Vence pronto', tone: 'warning', urgent: false },
  CRITICAL: { label: 'Urgente', tone: 'danger', urgent: true },
  EXPIRED: { label: 'Plazo vencido', tone: 'neutral', urgent: false },
}

export function urgencyBadge(level: UrgencyLevel): UrgencyBadge {
  return BADGES[level]
}
