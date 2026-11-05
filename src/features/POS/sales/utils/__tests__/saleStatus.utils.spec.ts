// sdd delivery-routes S1a — REQ-SALES-DR-002: SHIPPED badge contract.
//
// The existing `saleStatus.utils.test.ts` covers the PENDING/DELIVERED/UNKNOWN
// cases. This co-located spec file (`.spec.ts`) is the S1a carrier for the
// SHIPPED row. A badge describes one sale, so every delivery label is
// singular-feminine ("Entregada", "Enviada", "No entregada") and sentence case.
//
// S7 verify remediation — REQ-SALES-005: NOT_APPLICABLE parity. The spec
// mandates an explicit badge entry for every key in `SALE_DELIVERY_STATUS`
// so no key falls through to the "Desconocido" default.
//
// All assertions live next to the SHIPPED change so a future drift (e.g.
// renaming the badge to "Enviada" or "En tránsito") fails the build with a
// clear, scoped error message.

import { describe, it, expect } from 'vitest'
import {
  paymentStatusBadgeMap,
  deliveryStatusBadgeMap,
  getPaymentStatusBadge,
  getDeliveryStatusBadge,
  saleBadgeTone,
  isCanceledSale,
  salePaymentBadge,
  saleDeliveryBadge,
  saleOpenDebtCents,
} from '../saleStatus.utils'
import { SALE_DELIVERY_STATUS } from '../../constants/sale.constants'

describe('saleStatus.utils — delivery badge map', () => {
  it('exposes the SHIPPED row with the singular-feminine label and warning tone', () => {
    // Tone is `warning` because the sale is in transit but not yet delivered.
    expect(deliveryStatusBadgeMap.SHIPPED).toEqual({ label: 'Enviada', color: 'warning' })
  })

  it('preserves the DELIVERED + PENDING badge entries unchanged (lock-step invariant)', () => {
    expect(deliveryStatusBadgeMap.DELIVERED).toEqual({ label: 'Entregada', color: 'success' })
    expect(deliveryStatusBadgeMap.PENDING).toEqual({ label: 'No entregada', color: 'error' })
  })

  it('exposes the NOT_APPLICABLE row with label "N/A" and neutral tone (REQ-SALES-005 parity)', () => {
    // S7 verify remediation — the spec mandates an explicit mapping for every
    // key in SALE_DELIVERY_STATUS; before this addition NOT_APPLICABLE fell
    // through to the "Desconocido" default.
    expect(deliveryStatusBadgeMap.NOT_APPLICABLE).toEqual({ label: 'N/A', color: 'neutral' })
  })

  it('getDeliveryStatusBadge("NOT_APPLICABLE") returns the N/A badge (not "Desconocido")', () => {
    // Regression pin: instant-delivery / take-away sales (NOT_APPLICABLE)
    // must render the explicit badge; the unknownBadge fallback is reserved
    // for truly unknown runtime strings.
    expect(getDeliveryStatusBadge(SALE_DELIVERY_STATUS.NOT_APPLICABLE)).toEqual({
      label: 'N/A',
      color: 'neutral',
    })
  })

  it('covers every SALE_DELIVERY_STATUS key without falling through to "Desconocido"', () => {
    // REQ-SALES-005: "no key falls through". Iterate every member of the
    // union and assert each resolves to a curated badge (NOT the
    // "Desconocido" default).
    const allKeys = Object.values(SALE_DELIVERY_STATUS)
    for (const key of allKeys) {
      const badge = getDeliveryStatusBadge(key)
      expect(badge.label).not.toBe('Desconocido')
      expect(badge.label.length).toBeGreaterThan(0)
    }
  })

  it('getDeliveryStatusBadge("SHIPPED") returns the SHIPPED badge (not the "Desconocido" fallback)', () => {
    // Regression guard: before S1a, this used to return the unknownBadge
    // ({ label: 'Desconocido', color: 'neutral' }) because SHIPPED was
    // missing from the map.
    expect(getDeliveryStatusBadge(SALE_DELIVERY_STATUS.SHIPPED)).toEqual({
      label: 'Enviada',
      color: 'warning',
    })
  })

  it('getDeliveryStatusBadge returns the "Desconocido" fallback only for truly unknown statuses', () => {
    // The fallback is reserved for unknown runtime strings the backend may
    // add in the future. Known statuses (including the newly-added SHIPPED)
    // MUST resolve to a curated badge.
    expect(getDeliveryStatusBadge('SHIPPED').label).not.toBe('Desconocido')
    expect(getDeliveryStatusBadge('SHIPPED').color).not.toBe('neutral')

    expect(getDeliveryStatusBadge('WHATEVER_NEW_STATUS')).toEqual({
      label: 'Desconocido',
      color: 'neutral',
    })
  })

  it('every delivery label agrees with "venta" (singular-feminine, sentence case)', () => {
    expect(Object.values(deliveryStatusBadgeMap).map((badge) => badge.label)).toEqual([
      'Entregada',
      'Enviada',
      'No entregada',
      'N/A',
    ])
  })

  it('preserves the paymentStatusBadgeMap (no cross-contamination between badge maps)', () => {
    // Adding a row to deliveryStatusBadgeMap MUST NOT alter the
    // paymentStatusBadgeMap. The two maps have independent keys (PAID/
    // PARTIAL/CREDIT vs PENDING/SHIPPED/DELIVERED) and live behind separate
    // getters.
    expect(paymentStatusBadgeMap.PAID).toEqual({ label: 'Pagada', color: 'success' })
    expect(paymentStatusBadgeMap.PARTIAL).toEqual({ label: 'Impaga', color: 'warning' })
    expect(paymentStatusBadgeMap.CREDIT).toEqual({ label: 'Deuda', color: 'error' })
    expect(getPaymentStatusBadge('SOMETHING_ELSE')).toEqual({
      label: 'Desconocido',
      color: 'neutral',
    })
  })
})
describe('saleStatus.utils — saleBadgeTone', () => {
  it.each([
    ['success', 'success'],
    ['warning', 'warning'],
    ['error', 'danger'],
    ['neutral', 'neutral'],
  ] as const)('maps the %s badge color to the %s StatusBadge tone', (color, tone) => {
    expect(saleBadgeTone(color)).toBe(tone)
  })

  it('resolves every payment and delivery badge to a StatusBadge tone', () => {
    const tones = ['neutral', 'info', 'success', 'warning', 'danger']
    for (const badge of [...Object.values(paymentStatusBadgeMap), ...Object.values(deliveryStatusBadgeMap)]) {
      expect(tones).toContain(saleBadgeTone(badge.color))
    }
  })
})

// T21 [S18]: a canceled sale is neither paid nor pending delivery any more. Every list that shows
// a sale row reads its badges from these helpers, so the rule lives in one place.
describe('saleStatus.utils — canceled sale row badges', () => {
  const confirmed = { status: 'CONFIRMED', paymentStatus: 'PAID', deliveryStatus: 'PENDING', debtCents: 5000 } as const
  const canceled = { ...confirmed, status: 'CANCELED' } as const

  it('recognises only CANCELED as canceled', () => {
    expect(isCanceledSale(canceled)).toBe(true)
    expect(isCanceledSale(confirmed)).toBe(false)
  })

  it('replaces the payment badge with one neutral «Cancelada»', () => {
    expect(salePaymentBadge(canceled)).toEqual({ label: 'Cancelada', tone: 'neutral', ariaPrefix: 'Estado:' })
  })

  it('drops the delivery badge and the debt of a canceled sale', () => {
    expect(saleDeliveryBadge(canceled)).toBeNull()
    expect(saleOpenDebtCents(canceled)).toBe(0)
  })

  it('keeps the payment and delivery badges and the debt of a confirmed sale', () => {
    expect(salePaymentBadge(confirmed)).toEqual({ label: 'Pagada', tone: 'success', ariaPrefix: 'Pago:' })
    expect(saleDeliveryBadge(confirmed)).toEqual({ label: 'No entregada', tone: 'danger', ariaPrefix: 'Productos:' })
    expect(saleOpenDebtCents(confirmed)).toBe(5000)
  })

  it('keeps the «Sin estado» fallback for a confirmed sale without a payment status', () => {
    expect(salePaymentBadge({ status: 'CONFIRMED', paymentStatus: null })).toEqual({
      label: 'Sin estado',
      tone: 'neutral',
      ariaPrefix: 'Pago:',
    })
  })
})
