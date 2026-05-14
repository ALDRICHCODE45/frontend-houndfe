import type { ChargeDomainErrorCode } from '../interfaces/sale.types'

export type SalePaymentUxActionType = 'inline' | 'retry' | 'refetch' | 'new-key'

export interface SalePaymentUxAction {
  type: SalePaymentUxActionType
  message: string
}

const ERROR_ACTIONS: Record<ChargeDomainErrorCode, SalePaymentUxAction> = {
  AMBIGUOUS_PAYMENT_SHAPE: {
    type: 'inline',
    message: 'Formato de pago inválido. Reintentá cargar el cobro.',
  },
  TOO_MANY_PAYMENTS: {
    type: 'inline',
    message: 'Solo podés registrar hasta 5 métodos de pago.',
  },
  CREDIT_METHOD_NOT_VALID_IN_MULTI: {
    type: 'inline',
    message: 'Crédito no está permitido en pagos múltiples.',
  },
  REFERENCE_REQUIRED: {
    type: 'inline',
    message: 'Ingresá la referencia para tarjeta o transferencia.',
  },
  PAYMENT_METHOD_NOT_SUPPORTED: {
    type: 'inline',
    message: 'El método de pago no está soportado por el sistema.',
  },
  INVALID_CREDIT_CHARGE: {
    type: 'inline',
    message: 'El cobro con crédito es inválido para ese monto.',
  },
  PAYMENT_AMOUNT_INVALID: {
    type: 'inline',
    message: 'Monto inválido. Revisá los importes ingresados.',
  },
  CUSTOMER_REQUIRED_FOR_CREDIT: {
    type: 'inline',
    message: 'Para pago parcial asigná un cliente (próximamente).',
  },
  SALE_NOT_FOUND: {
    type: 'refetch',
    message: 'La venta no existe o ya no está disponible. Actualizamos la vista.',
  },
  SALE_ALREADY_CONFIRMED: {
    type: 'refetch',
    message: 'La venta ya fue confirmada. Refrescamos para mostrar su estado actual.',
  },
  PRICE_OUT_OF_DATE: {
    type: 'refetch',
    message: 'Los precios cambiaron. Actualizamos la venta para continuar.',
  },
  STOCK_INSUFFICIENT_AT_CONFIRM: {
    type: 'refetch',
    message: 'No hay stock suficiente para confirmar. Recalculamos la venta.',
  },
  IDEMPOTENCY_KEY_CONFLICT: {
    type: 'new-key',
    message: 'Ese intento ya fue usado con otros datos. Generá una nueva clave y reintentá.',
  },
  IDEMPOTENCY_KEY_IN_FLIGHT: {
    type: 'retry',
    message: 'Ya hay un cobro en proceso con esta clave. Esperá y reintentá.',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    type: 'new-key',
    message: 'Falta clave de idempotencia. Generá una nueva e intentá otra vez.',
  },
  SALE_NOT_CONFIRMABLE_FOR_PAYMENT: {
    type: 'refetch',
    message: 'La venta no admite registrar pagos en su estado actual. Refrescamos detalle.',
  },
  NO_OUTSTANDING_DEBT: {
    type: 'refetch',
    message: 'La venta ya no tiene deuda pendiente. Actualizamos el detalle.',
  },
  PAYMENT_EXCEEDS_DEBT: {
    type: 'inline',
    message: 'El monto supera la deuda actual. Revisá el saldo y reintentá.',
  },
}

export function getSalePaymentErrorAction(code: ChargeDomainErrorCode): SalePaymentUxAction {
  return ERROR_ACTIONS[code]
}
