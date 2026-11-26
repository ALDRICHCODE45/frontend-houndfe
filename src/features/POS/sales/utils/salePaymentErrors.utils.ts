import type { ChargeDomainErrorCode } from '../interfaces/sale.types'
import { reservedForBackorderChargeMessage } from './stockReservation.utils'

type SalePaymentUxActionType = 'inline' | 'retry' | 'refetch' | 'new-key' | 'generic'

export interface SalePaymentUxAction {
  type: SalePaymentUxActionType
  message: string
}

/** charge-change-cap S2: shared by the PaymentModal pre-send block and the 422 mapping. */
/** Card, transfer or another method above the total with no cash (backend 422 PAYMENT_AMOUNT_INVALID). */
export const NON_CASH_EXCEEDS_TOTAL_MESSAGE =
  'Lo pagado con tarjeta, transferencia u otro método no puede superar el total. Ajusta los montos.'

export const CHANGE_EXCEEDS_CASH_MESSAGE =
  'El cambio no puede ser mayor que el efectivo entregado. Ajusta los montos.'

const ERROR_ACTIONS: Record<ChargeDomainErrorCode, SalePaymentUxAction> = {
  AMBIGUOUS_PAYMENT_SHAPE: {
    type: 'inline',
    message: 'Formato de pago inválido. Reintenta cargar el cobro.',
  },
  TOO_MANY_PAYMENTS: {
    type: 'inline',
    message: 'Solo puedes registrar hasta 5 métodos de pago.',
  },
  CREDIT_METHOD_NOT_VALID_IN_MULTI: {
    type: 'inline',
    message: 'Crédito no está permitido en pagos múltiples.',
  },
  PAYMENT_AMOUNT_INSUFFICIENT: {
    type: 'inline',
    message: 'Agrega un pago en efectivo o ajusta los montos para cubrir el total',
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
    message: 'Monto inválido. Revisa los importes ingresados.',
  },
  CUSTOMER_REQUIRED_FOR_CREDIT: {
    type: 'inline',
    message: 'Asigna un cliente para registrar una venta con deuda',
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
  // Restock backorders: units held for «pedidos por reposición». Own message (never «sin stock»); the
  // figures are added by the caller from the 409 body. The sale stays DRAFT.
  STOCK_RESERVED_FOR_BACKORDER: {
    type: 'refetch',
    message: reservedForBackorderChargeMessage(undefined, undefined),
  },
  IDEMPOTENCY_KEY_CONFLICT: {
    type: 'new-key',
    message: 'Ese intento ya fue usado con otros datos. Genera una nueva clave y reintenta.',
  },
  IDEMPOTENCY_KEY_IN_FLIGHT: {
    type: 'retry',
    message: 'Ya hay un cobro en proceso con esta clave. Espera y reintenta.',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    type: 'new-key',
    message: 'Falta clave de idempotencia. Genera una nueva e intenta otra vez.',
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
    message: 'El monto supera la deuda actual. Revisa el saldo y reintenta.',
  },
  // pos-sale-delivery S1 (CAP-DLV-2): 422 when `delivery:true` is sent
  // without a shipping address. Inline copy is locked by the spec — do
  // not reword without a spec change.
  SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY: {
    type: 'inline',
    message: 'Para entrega a domicilio asigna una dirección de envío.',
  },
  // O1 S7: an unexpected server fault. 'generic' = show the error, change
  // nothing (no inline error, no reload, no retry).
  SALE_STOCK_UNAVAILABLE: {
    type: 'generic',
    message: 'No se pudo cobrar la venta. Avisa a soporte: reintentar no lo resuelve.',
  },
  CHANGE_EXCEEDS_CASH_TENDERED: {
    type: 'inline',
    message: CHANGE_EXCEEDS_CASH_MESSAGE,
  },
}

export function getSalePaymentErrorAction(code: ChargeDomainErrorCode): SalePaymentUxAction {
  return ERROR_ACTIONS[code]
}
