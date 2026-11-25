/**
 * Sales history backend data T4 (S1, handoff 29 §1): the statement period is half-open
 * `[from, to)` in Mexico City, 1 to 366 days. Presets cover whole calendar months; the label shows
 * the LAST INCLUDED day while `to` stays the exclusive end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CUSTOMER_STATEMENT_PRESETS,
  customerStatementPresetRange,
  customerStatementRangeFromDays,
  formatCustomerStatementPeriod,
  validateCustomerStatementRange,
} from '../customerStatementPeriod'

describe('customer statement presets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T18:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists «Este mes» (default), «Mes anterior» and «Últimos 3 meses» in that order', () => {
    expect(CUSTOMER_STATEMENT_PRESETS.map((preset) => preset.label)).toEqual([
      'Este mes',
      'Mes anterior',
      'Últimos 3 meses',
    ])
    expect(CUSTOMER_STATEMENT_PRESETS[0]!.id).toBe('thisMonth')
  })

  it('«Este mes» is the whole current month, `to` exclusive', () => {
    expect(customerStatementPresetRange('thisMonth')).toEqual({
      from: '2026-11-01',
      to: '2026-12-01',
    })
  })

  it('«Mes anterior» is the whole previous month', () => {
    expect(customerStatementPresetRange('previousMonth')).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
    })
  })

  it('«Últimos 3 meses» is the current month and the two before it', () => {
    expect(customerStatementPresetRange('last3Months')).toEqual({
      from: '2026-09-01',
      to: '2026-12-01',
    })
  })

  it('uses the Mexico City day, not the UTC one (Dec 1 03:00 UTC is still Nov 30)', () => {
    vi.setSystemTime(new Date('2026-12-01T03:00:00.000Z'))
    expect(customerStatementPresetRange('thisMonth')).toEqual({
      from: '2026-11-01',
      to: '2026-12-01',
    })
  })

  it('crosses the year boundary', () => {
    vi.setSystemTime(new Date('2027-01-10T18:00:00.000Z'))
    expect(customerStatementPresetRange('previousMonth')).toEqual({
      from: '2026-12-01',
      to: '2027-01-01',
    })
    expect(customerStatementPresetRange('last3Months')).toEqual({
      from: '2026-11-01',
      to: '2027-02-01',
    })
  })
})

describe('customer statement period label', () => {
  it('shows the last included day', () => {
    expect(formatCustomerStatementPeriod('2026-11-01', '2026-12-01')).toBe('1 – 30 nov 2026')
    expect(formatCustomerStatementPeriod('2026-09-01', '2026-12-01')).toBe('1 sep – 30 nov 2026')
    expect(formatCustomerStatementPeriod('2026-12-15', '2027-01-16')).toBe(
      '15 dic 2026 – 15 ene 2027',
    )
    expect(formatCustomerStatementPeriod('2026-11-25', '2026-11-26')).toBe('25 nov 2026')
  })

  it('returns null for an empty, reversed or malformed range', () => {
    expect(formatCustomerStatementPeriod('2026-11-01', '2026-11-01')).toBeNull()
    expect(formatCustomerStatementPeriod('2026-11-02', '2026-11-01')).toBeNull()
    expect(formatCustomerStatementPeriod('', '2026-11-01')).toBeNull()
  })
})

describe('customer statement range from picked days', () => {
  it('turns the inclusive last day into the exclusive `to`', () => {
    expect(customerStatementRangeFromDays('2026-11-03', '2026-11-20')).toEqual({
      from: '2026-11-03',
      to: '2026-11-21',
    })
    expect(customerStatementRangeFromDays('2026-12-31', '2026-12-31')).toEqual({
      from: '2026-12-31',
      to: '2027-01-01',
    })
  })

  it('keeps `to` empty while the last day is missing', () => {
    expect(customerStatementRangeFromDays('2026-11-03', null)).toEqual({
      from: '2026-11-03',
      to: '',
    })
  })
})

describe('customer statement range validation', () => {
  it('accepts 1 to 366 days', () => {
    expect(validateCustomerStatementRange({ from: '2026-11-25', to: '2026-11-26' })).toBeNull()
    expect(validateCustomerStatementRange({ from: '2026-01-01', to: '2027-01-02' })).toBeNull()
  })

  it('rejects an empty or incomplete range', () => {
    expect(validateCustomerStatementRange({ from: '2026-11-01', to: '' })).toBe(
      'Elige el primer y el último día del periodo.',
    )
    expect(validateCustomerStatementRange({ from: '', to: '' })).toBe(
      'Elige el primer y el último día del periodo.',
    )
    expect(validateCustomerStatementRange({ from: '2026-11-01', to: '2026-11-01' })).toBe(
      'Elige el primer y el último día del periodo.',
    )
    expect(validateCustomerStatementRange({ from: '2026-02-30', to: '2026-03-02' })).toBe(
      'Elige el primer y el último día del periodo.',
    )
  })

  it('rejects a reversed range', () => {
    expect(validateCustomerStatementRange({ from: '2026-11-10', to: '2026-11-01' })).toBe(
      'El último día no puede ser anterior al primero.',
    )
  })

  it('rejects more than 366 days', () => {
    expect(validateCustomerStatementRange({ from: '2026-01-01', to: '2027-01-03' })).toBe(
      'El periodo puede ser de hasta 366 días.',
    )
  })
})
