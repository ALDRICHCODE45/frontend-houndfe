import { describe, it, expect } from 'vitest'
import {
  paymentStatusBadgeMap,
  deliveryStatusBadgeMap,
  getPaymentStatusBadge,
  getDeliveryStatusBadge,
} from '../saleStatus.utils'
import { SALE_DELIVERY_STATUS } from '../../constants/sale.constants'

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

  // ─── pos-sale-delivery S3 — CAP-DLV-3 (deliveryStatus badge completeness) ──────
  describe('pos-sale-delivery S3', () => {
    it('SHIPPED resolves to the "En ruta" warning badge', () => {
      // CAP-DLV-3: SHIPPED must use color: 'warning' with the label "En ruta".
      expect(getDeliveryStatusBadge(SALE_DELIVERY_STATUS.SHIPPED)).toEqual({ label: 'En ruta', color: 'warning' })
    })

    it('NOT_APPLICABLE resolves to the "No aplica" neutral badge', () => {
      // CAP-DLV-3: NOT_APPLICABLE must use color: 'neutral' with the label "No aplica".
      expect(getDeliveryStatusBadge(SALE_DELIVERY_STATUS.NOT_APPLICABLE)).toEqual({ label: 'No aplica', color: 'neutral' })
    })

    it('preserves the pre-existing PENDING and DELIVERED badge entries verbatim', () => {
      // design §2/Q2 spec-drift guard: do NOT rename pre-existing entries even though
      // the spec requirement statement mentions different labels (those are filter
      // labels, not badge labels).
      expect(deliveryStatusBadgeMap.DELIVERED).toEqual({ label: 'Entregados', color: 'success' })
      expect(deliveryStatusBadgeMap.PENDING).toEqual({ label: 'No Entregados', color: 'error' })
      expect(getDeliveryStatusBadge(SALE_DELIVERY_STATUS.DELIVERED)).toEqual({ label: 'Entregados', color: 'success' })
      expect(getDeliveryStatusBadge(SALE_DELIVERY_STATUS.PENDING)).toEqual({ label: 'No Entregados', color: 'error' })
    })

    it('every backend value resolves to a non-Desconocido badge config', () => {
      // CAP-DLV-3: no valid value may fall back to "Desconocido".
      const knownLabels = new Set(['Pagada', 'Impaga', 'Deuda', 'Entregados', 'No Entregados', 'En ruta', 'No aplica'])
      for (const value of Object.values(SALE_DELIVERY_STATUS)) {
        const config = getDeliveryStatusBadge(value)
        expect(config.label).not.toBe('Desconocido')
        expect(knownLabels.has(config.label)).toBe(true)
        expect(['success', 'warning', 'error', 'neutral']).toContain(config.color)
      }
    })

    it('unknown strings still return the Desconocido fallback (no crash)', () => {
      // CAP-DLV-3: the unknownBadge path remains available for genuinely unknown
      // strings (typos, legacy/undeleted values).
      expect(getDeliveryStatusBadge('LEGACY_STATUS')).toEqual({ label: 'Desconocido', color: 'neutral' })
      expect(getDeliveryStatusBadge('')).toEqual({ label: 'Desconocido', color: 'neutral' })
    })

    it('the badge map exposes exactly the four backend delivery statuses', () => {
      // TRIANGULATE pin: locks the key set so a future refactor that drops or
      // renames a key fails the build. Order matches the existing declaration
      // (DELIVERED then PENDING) with SHIPPED + NOT_APPLICABLE appended.
      expect(Object.keys(deliveryStatusBadgeMap)).toEqual([
        'DELIVERED',
        'PENDING',
        'SHIPPED',
        'NOT_APPLICABLE',
      ])
    })
  })
})
