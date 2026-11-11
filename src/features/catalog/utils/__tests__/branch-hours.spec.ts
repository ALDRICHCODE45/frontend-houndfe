import { describe, expect, it } from 'vitest'
import { todayHoursLine } from '../branch-hours'
import type { PublicCatalogBranchHours } from '../../interfaces/public-catalog-branch.types'

const days = (overrides: Record<string, Partial<PublicCatalogBranchHours['days'][number]>> = {}) =>
  [
    ['MONDAY', 'Lunes'],
    ['TUESDAY', 'Martes'],
    ['WEDNESDAY', 'Miércoles'],
    ['THURSDAY', 'Jueves'],
    ['FRIDAY', 'Viernes'],
    ['SATURDAY', 'Sábado'],
    ['SUNDAY', 'Domingo'],
  ].map(([day, label]) => ({
    day: day!,
    label: label!,
    closed: false,
    ranges: [{ open: '09:00', close: '18:00' }],
    ...overrides[day!],
  }))

const hours = (
  overrides: Record<string, Partial<PublicCatalogBranchHours['days'][number]>> = {},
  timeZone = 'America/Mexico_City',
): PublicCatalogBranchHours => ({ timeZone, days: days(overrides), summary: 'Resumen de horario' })

describe('todayHoursLine', () => {
  it('reads today from the branch time zone, not from the visitor clock', () => {
    // 2026-11-11T03:30Z is still Tuesday night in Mexico City (UTC-6) and already Wednesday in Auckland.
    const now = new Date('2026-11-11T03:30:00Z')
    const mexico = hours({ TUESDAY: { ranges: [{ open: '10:00', close: '14:00' }] } })
    expect(todayHoursLine(mexico, now)).toEqual({ kind: 'today', text: 'Abierto hoy 10:00–14:00' })
    const auckland = hours({ WEDNESDAY: { ranges: [{ open: '11:00', close: '15:00' }] } }, 'Pacific/Auckland')
    expect(todayHoursLine(auckland, now)).toEqual({ kind: 'today', text: 'Abierto hoy 11:00–15:00' })
  })

  it('joins several ranges of the same day', () => {
    const split = hours({
      WEDNESDAY: {
        ranges: [
          { open: '09:00', close: '14:00' },
          { open: '16:00', close: '19:00' },
        ],
      },
    })
    expect(todayHoursLine(split, new Date('2026-11-11T18:00:00Z'))).toEqual({
      kind: 'today',
      text: 'Abierto hoy 09:00–14:00 y 16:00–19:00',
    })
  })

  it('falls back to the summary when the branch is closed today', () => {
    const closed = hours({ WEDNESDAY: { closed: true, ranges: [] } })
    expect(todayHoursLine(closed, new Date('2026-11-11T18:00:00Z'))).toEqual({
      kind: 'summary',
      text: 'Resumen de horario',
    })
  })

  it('falls back to the summary when the time zone is not valid', () => {
    expect(todayHoursLine(hours({}, 'Not/AZone'), new Date('2026-11-11T18:00:00Z'))).toEqual({
      kind: 'summary',
      text: 'Resumen de horario',
    })
  })

  it('returns null without hours or when there is nothing to say', () => {
    expect(todayHoursLine(null, new Date())).toBeNull()
    expect(todayHoursLine({ ...hours(), days: [], summary: '' }, new Date())).toBeNull()
  })
})
