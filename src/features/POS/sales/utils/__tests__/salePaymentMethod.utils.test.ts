import { describe, it, expect } from 'vitest'
import { formatPaymentMethod } from '../salePaymentMethod.utils'

describe('salePaymentMethod.utils', () => {
  it('formats CASH as Efectivo', () => {
    expect(formatPaymentMethod('CASH')).toBe('Efectivo')
  })

  it('formats card methods into spanish labels', () => {
    expect(formatPaymentMethod('CARD_CREDIT')).toBe('Tarjeta de Crédito')
    expect(formatPaymentMethod('CARD_DEBIT')).toBe('Tarjeta de Débito')
  })

  it('formats transfer and credit methods', () => {
    expect(formatPaymentMethod('TRANSFER')).toBe('Transferencia')
    expect(formatPaymentMethod('CREDIT')).toBe('Crédito')
  })

  it('returns original value for unknown methods', () => {
    expect(formatPaymentMethod('OTHER')).toBe('OTHER')
  })
})
