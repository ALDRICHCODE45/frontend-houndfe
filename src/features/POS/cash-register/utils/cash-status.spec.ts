import { describe, expect, it } from 'vitest'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from './cash-status'

describe('cash session status presentation', () => {
  it('names every status in Spanish, never the backend enum', () => {
    expect(CASH_SESSION_STATUS_LABELS).toEqual({
      OPEN: 'Abierta',
      COUNTING: 'Congelada',
      SUBMITTED: 'Declarada',
      CLOSED: 'Cerrada',
    })
  })

  it('maps each status to one StatusBadge tone', () => {
    expect(cashSessionStatusTone('OPEN')).toBe('success')
    expect(cashSessionStatusTone('COUNTING')).toBe('warning')
    expect(cashSessionStatusTone('SUBMITTED')).toBe('info')
    expect(cashSessionStatusTone('CLOSED')).toBe('neutral')
  })
})
