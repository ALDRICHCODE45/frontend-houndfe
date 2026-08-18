import { describe, it, expect } from 'vitest'
import { getSalePaymentErrorAction } from '../salePaymentErrors.utils'

describe('getSalePaymentErrorAction', () => {
  it('maps inline validation errors', () => {
    const amount = getSalePaymentErrorAction('PAYMENT_AMOUNT_INVALID')
    const insufficient = getSalePaymentErrorAction('PAYMENT_AMOUNT_INSUFFICIENT')

    expect(amount.type).toBe('inline')
    expect(insufficient.type).toBe('inline')
    expect(insufficient.message).toBe('Agregá un pago en efectivo o ajustá los montos para cubrir el total')
  })

  it('maps idempotency errors to retry/new-key actions', () => {
    const conflict = getSalePaymentErrorAction('IDEMPOTENCY_KEY_CONFLICT')
    const inFlight = getSalePaymentErrorAction('IDEMPOTENCY_KEY_IN_FLIGHT')

    expect(conflict.type).toBe('new-key')
    expect(inFlight.type).toBe('retry')
  })

  it('maps stale or sync debt errors to refetch action', () => {
    const stale = getSalePaymentErrorAction('PRICE_OUT_OF_DATE')
    const alreadyPaid = getSalePaymentErrorAction('NO_OUTSTANDING_DEBT')

    expect(stale.type).toBe('refetch')
    expect(alreadyPaid.type).toBe('refetch')
  })

  it('maps CUSTOMER_REQUIRED_FOR_CREDIT with updated actionable copy', () => {
    const customerRequired = getSalePaymentErrorAction('CUSTOMER_REQUIRED_FOR_CREDIT')

    expect(customerRequired.type).toBe('inline')
    expect(customerRequired.message).toBe('Asigna un cliente para registrar una venta con deuda')
    expect(customerRequired.message).not.toContain('próximamente')
  })
})
