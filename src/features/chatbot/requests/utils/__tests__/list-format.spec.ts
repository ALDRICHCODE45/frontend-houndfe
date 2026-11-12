import { describe, expect, it } from 'vitest'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import { closedLine, formatAge } from '../list-format'

const NOW = new Date('2026-11-11T17:05:00.000Z') // 11:05 in Mexico City
const TZ = 'America/Mexico_City'

describe('formatAge', () => {
  it.each([
    ['2026-11-11T17:00:00.000Z', '5 min'],
    ['2026-11-11T17:05:00.000Z', '1 min'],
    ['2026-11-11T14:55:00.000Z', '2 h 10 min'],
    ['2026-11-11T15:05:00.000Z', '2 h'],
    ['2026-11-08T13:05:00.000Z', '3 d 4 h'],
    ['2026-11-08T17:05:00.000Z', '3 d'],
  ])('%s → %s', (iso, label) => {
    expect(formatAge(iso, NOW)).toBe(label)
  })

  it('a future or invalid date is a dash, never NaN', () => {
    expect(formatAge('2026-11-12T17:05:00.000Z', NOW)).toBe('1 min')
    expect(formatAge('nope', NOW)).toBe('—')
  })
})

describe('closedLine — the Cierre cell of the closed tabs', () => {
  const when = { now: NOW, timeZone: TZ }

  it('resolved: when and who («ti» for the signed-in user)', () => {
    const row = makeRow({
      status: 'RESOLVED',
      displayStatus: 'RESOLVED',
      closedAt: '2026-11-11T15:00:00.000Z',
      resolvedBy: { id: 'u-1', displayName: 'Ana López' },
    })
    expect(closedLine(row, null, when)).toEqual({ tone: 'resolved', title: 'Resuelta hoy 9:00', detail: 'por Ana López' })
    expect(closedLine(row, 'u-1', when).detail).toBe('por ti')
  })

  it('cancelled with the customer cause', () => {
    const row = makeRow({
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      closedAt: '2026-11-10T15:00:00.000Z',
      cancelReason: 'CUSTOMER_WITHDREW',
    })
    expect(closedLine(row, null, when)).toEqual({
      tone: 'cancelled',
      title: 'Cancelada ayer 9:00',
      detail: 'El cliente la retiró',
    })
  })

  it('cancelled by staff names the staff reason', () => {
    const row = makeRow({
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      closedAt: '2026-11-11T15:00:00.000Z',
      cancelReason: 'STAFF',
      staffCancelReason: 'DUPLICATE',
    })
    expect(closedLine(row, null, when).detail).toBe('Cancelada por el personal · Duplicada')
  })

  it('merged away reads «Fusionada en S-…» from mergedInto', () => {
    const row = makeRow({
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      closedAt: '2026-11-11T15:00:00.000Z',
      cancelReason: 'SUPERSEDED',
      mergedInto: { id: 'req-9', folio: 'S-000009' },
    })
    expect(closedLine(row, null, when).detail).toBe('Fusionada en S-000009')
  })

  it('a cancelled row with no cause and a resolved one with no person have no detail', () => {
    expect(closedLine(makeRow({ status: 'CANCELLED', displayStatus: 'CANCELLED', closedAt: '2026-11-11T15:00:00.000Z' }), null, when).detail).toBeNull()
    expect(closedLine(makeRow({ status: 'RESOLVED', displayStatus: 'RESOLVED', closedAt: '2026-11-11T15:00:00.000Z' }), null, when).detail).toBeNull()
  })
})
