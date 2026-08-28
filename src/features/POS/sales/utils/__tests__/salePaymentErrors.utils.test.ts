import { describe, it, expect } from 'vitest'
import type { ChargeDomainErrorCode } from '../../interfaces/sale.types'
import { getSalePaymentErrorAction } from '../salePaymentErrors.utils'

// TRIANGULATE (pos-sale-delivery S1): the union of valid charge error codes
// is closed via TS exhaustiveness on `Record<ChargeDomainErrorCode, ...>`,
// but this runtime loop is the safety net that catches a stale record if
// anyone adds a union member and forgets the inline entry. Every code must
// resolve to a defined action object.
const ALL_CHARGE_DOMAIN_ERROR_CODES: ChargeDomainErrorCode[] = [
  'AMBIGUOUS_PAYMENT_SHAPE',
  'TOO_MANY_PAYMENTS',
  'CREDIT_METHOD_NOT_VALID_IN_MULTI',
  'PAYMENT_AMOUNT_INSUFFICIENT',
  'PAYMENT_METHOD_NOT_SUPPORTED',
  'INVALID_CREDIT_CHARGE',
  'PAYMENT_AMOUNT_INVALID',
  'CUSTOMER_REQUIRED_FOR_CREDIT',
  'SALE_NOT_FOUND',
  'SALE_ALREADY_CONFIRMED',
  'PRICE_OUT_OF_DATE',
  'STOCK_INSUFFICIENT_AT_CONFIRM',
  'IDEMPOTENCY_KEY_CONFLICT',
  'IDEMPOTENCY_KEY_IN_FLIGHT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'SALE_NOT_CONFIRMABLE_FOR_PAYMENT',
  'NO_OUTSTANDING_DEBT',
  'PAYMENT_EXCEEDS_DEBT',
  'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY',
]

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

  // pos-sale-delivery S1 (CAP-DLV-2): the backend returns
  // `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` when the cashier toggles
  // "Entrega a domicilio" without an assigned shipping address. The toggle
  // gating (CAP-DLV-1) makes this a safety-net path; when it surfaces it
  // MUST map to a friendly inline action so the cashier is told what to
  // fix instead of seeing a raw error toast.
  it('maps SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY to a friendly inline action', () => {
    const action = getSalePaymentErrorAction('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY')

    expect(action).toEqual({
      type: 'inline',
      message: 'Para entrega a domicilio asigna una dirección de envío.',
    })
  })

  it('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY message names the actual fix (dirección de envío)', () => {
    const action = getSalePaymentErrorAction('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY')

    expect(action.message).toContain('Para entrega a domicilio')
    expect(action.message).toContain('dirección de envío')
  })

  // TRIANGULATE: every member of `ChargeDomainErrorCode` MUST resolve to a
  // defined action via `getSalePaymentErrorAction`. Catches a future
  // union-add that forgot the corresponding ERROR_ACTIONS entry.
  it.each(ALL_CHARGE_DOMAIN_ERROR_CODES)(
    'resolves a defined action for charge error code "%s"',
    (code) => {
      const action = getSalePaymentErrorAction(code)

      expect(action).toBeDefined()
      expect(typeof action.type).toBe('string')
      expect(action.type.length).toBeGreaterThan(0)
      expect(typeof action.message).toBe('string')
      expect(action.message.length).toBeGreaterThan(0)
    },
  )
})
