import { describe, expect, it } from 'vitest'
import { refundAgeLabel, refundMethodLabel, refundReasonLabel, SETTLEMENT_METHOD_ITEMS } from '../refundLabels'

describe('refund labels (contract copy hints, es-MX)', () => {
  it.each([
    ['cash', 'Efectivo'],
    ['card_credit', 'Tarjeta de crédito'],
    ['card_debit', 'Tarjeta de débito'],
    ['transfer', 'Transferencia'],
    ['credit', 'Saldo a favor / crédito'],
  ] as const)('method %s → %s', (method, label) => {
    expect(refundMethodLabel(method)).toBe(label)
  })

  it.each([
    ['CUSTOMER_REQUEST', 'Solicitud del cliente'],
    ['ORDER_ERROR', 'Error en el pedido'],
    ['OUT_OF_STOCK', 'Sin existencias'],
    ['DUPLICATE_SALE', 'Venta duplicada'],
    ['OTHER', 'Otro'],
  ] as const)('reason %s → %s', (reason, label) => {
    expect(refundReasonLabel(reason)).toBe(label)
  })

  it('offers every contract method in the method picker', () => {
    expect(SETTLEMENT_METHOD_ITEMS.map((item) => item.value)).toEqual([
      'cash',
      'card_credit',
      'card_debit',
      'transfer',
      'credit',
    ])
  })

  it('says how old a debt is in days', () => {
    const now = new Date('2026-11-05T17:05:00.000Z')
    expect(refundAgeLabel('2026-11-05T10:00:00.000Z', now)).toBe('Hoy')
    expect(refundAgeLabel('2026-11-04T10:00:00.000Z', now)).toBe('1 día')
    expect(refundAgeLabel('2026-10-21T20:42:00.000Z', now)).toBe('14 días')
  })
})
