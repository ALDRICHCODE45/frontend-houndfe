import { describe, expect, it } from 'vitest'
import {
  closedWeek,
  mapOpeningHoursError,
  normalizeTimeText,
  openingHoursSummary,
  validateWeek,
  weekFromDays,
  weekToBody,
} from '../openingHours'
import type { OpeningDay } from '../../interfaces/shipping-settings.types'

const seeded: OpeningDay[] = [
  { day: 'MONDAY', ranges: [{ open: '09:00', close: '14:00' }, { open: '16:00', close: '19:30' }] },
  { day: 'TUESDAY', ranges: [{ open: '09:00', close: '14:00' }, { open: '16:00', close: '19:30' }] },
  { day: 'WEDNESDAY', ranges: [{ open: '09:00', close: '14:00' }, { open: '16:00', close: '19:30' }] },
  { day: 'THURSDAY', ranges: [{ open: '09:00', close: '14:00' }, { open: '16:00', close: '19:30' }] },
  { day: 'FRIDAY', ranges: [{ open: '09:00', close: '14:00' }, { open: '16:00', close: '19:30' }] },
  { day: 'SATURDAY', ranges: [{ open: '09:00', close: '14:00' }] },
  { day: 'SUNDAY', ranges: [] },
]

describe('openingHours — summary built on the FE (handoff §7)', () => {
  it('groups consecutive days with the same hours', () => {
    expect(openingHoursSummary(seeded)).toBe('Lun–Vie 09:00–14:00 y 16:00–19:30 · Sáb 09:00–14:00 · Dom cerrado')
  })

  it('keeps non-consecutive equal days apart and says when the week is closed', () => {
    const week = weekFromDays(seeded)
    week.WEDNESDAY = []
    expect(openingHoursSummary(weekToBody(week).days)).toBe(
      'Lun–Mar 09:00–14:00 y 16:00–19:30 · Mié cerrado · Jue–Vie 09:00–14:00 y 16:00–19:30 · Sáb 09:00–14:00 · Dom cerrado',
    )
    expect(openingHoursSummary(weekToBody(closedWeek()).days)).toBe('Cerrado toda la semana')
  })
})

describe('openingHours — body', () => {
  it('sends the seven days Monday first, ranges sorted, with the fixed time zone (S7)', () => {
    const week = weekFromDays(seeded)
    week.MONDAY = [{ open: '16:00', close: '20:00' }, { open: '09:00', close: '14:00' }]
    const body = weekToBody(week)
    expect(body.timeZone).toBe('America/Mexico_City')
    expect(body.days.map((d) => d.day)).toEqual(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
    expect(body.days[0]!.ranges).toEqual([{ open: '09:00', close: '14:00' }, { open: '16:00', close: '20:00' }])
  })

  it('normalizes typed times to HH:mm', () => {
    expect(normalizeTimeText('9:00')).toBe('09:00')
    expect(normalizeTimeText('930')).toBe('09:30')
    expect(normalizeTimeText('1930')).toBe('19:30')
    expect(normalizeTimeText(' 07:05 ')).toBe('07:05')
    expect(normalizeTimeText('25:00')).toBe('25:00')
  })
})

describe('openingHours — client validation mirrors the backend', () => {
  it('a valid week has no errors', () => {
    expect(validateWeek(weekFromDays(seeded))).toEqual({})
  })

  it('flags HH:mm format, open not before close, and overlap or touch on the later range', () => {
    const week = closedWeek()
    week.MONDAY = [{ open: '9', close: '14:00' }]
    week.TUESDAY = [{ open: '18:00', close: '09:00' }]
    week.WEDNESDAY = [{ open: '09:00', close: '14:00' }, { open: '14:00', close: '18:00' }]
    week.THURSDAY = [{ open: '13:00', close: '15:00' }, { open: '09:00', close: '14:00' }]
    week.FRIDAY = [{ open: '10:00', close: '10:00' }]
    expect(validateWeek(week)).toEqual({
      MONDAY: { 0: 'Escribe las horas como 09:00, entre 00:00 y 23:59.' },
      TUESDAY: { 0: 'La apertura debe ser antes del cierre; un horario no puede pasar de medianoche.' },
      WEDNESDAY: { 1: 'Se encima o se toca con otro horario del día; únelos en uno solo.' },
      THURSDAY: { 0: 'Se encima o se toca con otro horario del día; únelos en uno solo.' },
      FRIDAY: { 0: 'La apertura debe ser antes del cierre; un horario no puede pasar de medianoche.' },
    })
  })
})

describe('openingHours — INVALID_OPENING_HOURS next to its day (S6)', () => {
  const domain = (message: string) => ({
    response: { status: 400, data: { statusCode: 400, error: 'INVALID_OPENING_HOURS', message, timestamp: 'x' } },
  })

  it('reads the day from the start of the message and says it in Spanish', () => {
    expect(mapOpeningHoursError(domain('FRIDAY: open must be before close'))).toEqual({
      days: { FRIDAY: 'La apertura debe ser antes del cierre.' },
      message: null,
    })
    expect(mapOpeningHoursError(domain('FRIDAY: ranges must not overlap or touch'))).toEqual({
      days: { FRIDAY: 'Hay horarios que se enciman o se tocan; únelos en uno solo.' },
      message: null,
    })
    expect(mapOpeningHoursError(domain('MONDAY appears more than once')).days).toEqual({ MONDAY: 'Revisa los horarios de este día.' })
  })

  it('a message without a day is a general Spanish sentence', () => {
    expect(mapOpeningHoursError(domain('Every weekday is required; missing SUNDAY'))).toEqual({
      days: {},
      message: 'Revisa el horario: falta algún día de la semana.',
    })
    expect(mapOpeningHoursError({ response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS', message: 'x' } } }).message)
      .toBe('No tienes permiso para cambiar el horario.')
    expect(mapOpeningHoursError(new Error('x')).message).toBe('No se pudo guardar el horario. Intenta de nuevo.')
  })

  it('400 constraints under days.N go to that day', () => {
    const err = {
      response: {
        status: 400,
        data: {
          statusCode: 400,
          error: 'Bad Request',
          message: [{ property: 'days', children: [{ property: '5', children: [{ property: 'ranges', children: [], constraints: { arrayMaxSize: 'x' } }] }] }],
        },
      },
    }
    expect(mapOpeningHoursError(err)).toEqual({ days: { SATURDAY: 'Revisa los horarios de este día.' }, message: null })
  })
})
