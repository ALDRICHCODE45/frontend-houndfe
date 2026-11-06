import { describe, expect, it } from 'vitest'
import { formatCountdown, liveUrgencyLevel, urgencyBadge } from '../urgency'

const HOUR = 3_600_000
const now = Date.parse('2026-11-06T00:00:00.000Z')
const urgency = (hoursLeft: number, level: 'OK' | 'WARNING' | 'CRITICAL' | 'EXPIRED' = 'OK') => ({
  deadlineAt: new Date(now + hoursLeft * HOUR).toISOString(),
  hoursLeft,
  level,
})

describe('live urgency (handoff §3.1)', () => {
  it('counts down from deadlineAt on the client, with the server thresholds', () => {
    expect(liveUrgencyLevel(urgency(12), now)).toBe('OK')
    expect(liveUrgencyLevel(urgency(11.9, 'OK'), now)).toBe('WARNING')
    expect(liveUrgencyLevel(urgency(3.9, 'WARNING'), now)).toBe('CRITICAL')
    expect(liveUrgencyLevel(urgency(0, 'CRITICAL'), now)).toBe('EXPIRED')
    expect(liveUrgencyLevel(urgency(-1, 'CRITICAL'), now)).toBe('EXPIRED')
  })

  it('has no level without an urgency block (resolved) and falls back to the server level on a bad date', () => {
    expect(liveUrgencyLevel(null, now)).toBeNull()
    expect(liveUrgencyLevel({ deadlineAt: 'nope', hoursLeft: 3, level: 'CRITICAL' }, now)).toBe('CRITICAL')
  })

  it('formats the time left in hours and minutes, never below zero', () => {
    expect(formatCountdown(urgency(2.5).deadlineAt, now)).toBe('Quedan 2 h 30 min')
    expect(formatCountdown(urgency(0.25).deadlineAt, now)).toBe('Quedan 15 min')
    expect(formatCountdown(new Date(now + 30_000).toISOString(), now)).toBe('Queda menos de 1 min')
    expect(formatCountdown(urgency(-2).deadlineAt, now)).toBe('Plazo vencido')
  })

  it('colours OK neutral, WARNING amber, CRITICAL red and EXPIRED grey «Plazo vencido»', () => {
    expect(urgencyBadge('OK')).toEqual({ label: 'A tiempo', tone: 'neutral', urgent: false })
    expect(urgencyBadge('WARNING')).toEqual({ label: 'Vence pronto', tone: 'warning', urgent: false })
    expect(urgencyBadge('CRITICAL')).toEqual({ label: 'Urgente', tone: 'danger', urgent: true })
    expect(urgencyBadge('EXPIRED')).toEqual({ label: 'Plazo vencido', tone: 'neutral', urgent: false })
  })
})
