import { describe, it, expect } from 'vitest'
import {
  paymentStatusBadgeMap,
  deliveryStatusBadgeMap,
  getPaymentStatusBadge,
  getDeliveryStatusBadge,
} from '../saleStatus.utils'

describe('saleStatus.utils', () => {
  it('maps payment statuses to expected badge label and color', () => {
    expect(paymentStatusBadgeMap.PAID).toEqual({ label: 'Pagada', color: 'success' })
    expect(paymentStatusBadgeMap.PARTIAL).toEqual({ label: 'Impaga', color: 'warning' })
    expect(paymentStatusBadgeMap.CREDIT).toEqual({ label: 'Deuda', color: 'error' })
  })

  it('maps delivery statuses to expected badge label and color', () => {
    expect(deliveryStatusBadgeMap.DELIVERED).toEqual({ label: 'Entregados', color: 'success' })
    expect(deliveryStatusBadgeMap.PENDING).toEqual({ label: 'No Entregados', color: 'error' })
  })

  it('provides safe fallback for unknown payment status', () => {
    expect(getPaymentStatusBadge('SOMETHING_ELSE')).toEqual({ label: 'Desconocido', color: 'neutral' })
  })

  it('provides safe fallback for unknown delivery status', () => {
    expect(getDeliveryStatusBadge('WHATEVER')).toEqual({ label: 'Desconocido', color: 'neutral' })
  })
})
