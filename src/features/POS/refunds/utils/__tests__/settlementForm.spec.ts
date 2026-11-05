import { describe, expect, it } from 'vitest'
import {
  buildSettlementRequest,
  centsToAmountInput,
  formSignature,
  parseAmountInput,
  toZonedIso,
  validateSettlementForm,
  type SettlementFormValues,
} from '../settlementForm'

const NOW = new Date('2026-11-05T17:05:00.000Z')

function values(patch: Partial<SettlementFormValues> = {}): SettlementFormValues {
  return {
    amount: '45.55',
    method: 'cash',
    reference: '',
    settledAt: null,
    useCashSession: false,
    ...patch,
  }
}

describe('parseAmountInput', () => {
  it.each([
    ['45.55', 4555],
    ['$1,234.5', 123450],
    [' 20 ', 2000],
    ['0.01', 1],
  ])('reads %s as %i cents', (text, cents) => {
    expect(parseAmountInput(text)).toEqual({ cents })
  })

  it.each([
    ['', 'Escribe el monto que devolviste.'],
    ['abc', 'Escribe un monto válido, por ejemplo 250.00.'],
    ['10.555', 'Escribe un monto válido, por ejemplo 250.00.'],
    ['-5', 'Escribe un monto válido, por ejemplo 250.00.'],
    ['0', 'El monto debe ser mayor que $0.00.'],
  ])('rejects %j', (text, error) => {
    expect(parseAmountInput(text)).toEqual({ error })
  })
})

describe('centsToAmountInput', () => {
  it('prints cents as a plain decimal', () => {
    expect(centsToAmountInput(4555)).toBe('45.55')
    expect(centsToAmountInput(1661170)).toBe('16611.70')
  })
})

describe('validateSettlementForm', () => {
  it('accepts an amount up to the outstanding balance', () => {
    expect(validateSettlementForm(values({ amount: '45.55' }), { outstandingCents: 4555, now: NOW })).toEqual({})
  })

  it('rejects an amount above the outstanding balance', () => {
    expect(
      validateSettlementForm(values({ amount: '45.56' }), { outstandingCents: 4555, now: NOW }).amount,
    ).toBe('No puede ser mayor que lo pendiente ($45.55).')
  })

  it('rejects an empty or zero amount', () => {
    expect(validateSettlementForm(values({ amount: '' }), { outstandingCents: 4555, now: NOW }).amount).toBe(
      'Escribe el monto que devolviste.',
    )
    expect(validateSettlementForm(values({ amount: '0' }), { outstandingCents: 4555, now: NOW }).amount).toBe(
      'El monto debe ser mayor que $0.00.',
    )
  })

  it('rejects a chosen date in the future or left empty', () => {
    const later = new Date(NOW.getTime() + 60 * 60 * 1000)
    const local = (d: Date) => toZonedIso(d).slice(0, 16)
    expect(
      validateSettlementForm(values({ settledAt: local(later) }), { outstandingCents: 4555, now: NOW }).settledAt,
    ).toBe('La fecha no puede ser posterior a este momento.')
    expect(
      validateSettlementForm(values({ settledAt: '' }), { outstandingCents: 4555, now: NOW }).settledAt,
    ).toBe('Elige la fecha y hora de la devolución.')
  })
})

describe('toZonedIso', () => {
  it('writes the instant with the local offset, never a zone-less string', () => {
    const iso = toZonedIso(NOW)
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/)
    expect(new Date(iso).getTime()).toBe(NOW.getTime())
  })
})

describe('buildSettlementRequest', () => {
  it('uses now for «Ahora» and omits an empty reference and the cash session', () => {
    expect(buildSettlementRequest(values(), { now: NOW, cashSessionId: null })).toEqual({
      amountCents: 4555,
      method: 'cash',
      settledAt: toZonedIso(NOW),
    })
  })

  it('binds the open cash session only when asked and never for credit', () => {
    const session = '7f1c2a90-3b4d-4e5f-8a6b-1c2d3e4f5a6b'
    expect(
      buildSettlementRequest(values({ useCashSession: true, reference: ' SPEI 1 ' }), {
        now: NOW,
        cashSessionId: session,
      }),
    ).toMatchObject({ cashSessionId: session, reference: 'SPEI 1' })
    expect(
      buildSettlementRequest(values({ useCashSession: true, method: 'credit' }), { now: NOW, cashSessionId: session }),
    ).not.toHaveProperty('cashSessionId')
    expect(
      buildSettlementRequest(values({ useCashSession: false }), { now: NOW, cashSessionId: session }),
    ).not.toHaveProperty('cashSessionId')
  })

  it('sends a chosen date with its offset', () => {
    const chosen = toZonedIso(new Date('2026-11-04T18:00:00.000Z')).slice(0, 16)
    const request = buildSettlementRequest(values({ settledAt: chosen }), { now: NOW, cashSessionId: null })
    expect(request.settledAt).toMatch(/(Z|[+-]\d{2}:\d{2})$/)
    expect(new Date(request.settledAt).getTime()).toBe(new Date('2026-11-04T18:00:00.000Z').getTime())
  })
})

describe('formSignature', () => {
  it('is stable for the same answers and changes with any of them', () => {
    expect(formSignature('r1', values())).toBe(formSignature('r1', values()))
    expect(formSignature('r1', values())).not.toBe(formSignature('r1', values({ amount: '45.50' })))
    expect(formSignature('r1', values())).not.toBe(formSignature('r1', values({ reference: 'x' })))
    expect(formSignature('r1', values())).not.toBe(formSignature('r2', values()))
  })
})
