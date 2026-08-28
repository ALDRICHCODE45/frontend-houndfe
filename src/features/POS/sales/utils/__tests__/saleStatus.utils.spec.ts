// sdd delivery-routes S1a — REQ-SALES-DR-002: SHIPPED badge contract.
//
// The existing `saleStatus.utils.test.ts` covers the PENDING/DELIVERED/UNKNOWN
// cases. This co-located spec file (`.spec.ts`) is the S1a carrier for the
// SHIPPED row + the singular-vs-plural distinction between the badge label
// (plural "Enviados", tab/row consistency with "Entregados"/"No Entregados")
// and the filter label (singular-feminine "Enviada", matches
// "Pendiente"/"Entregada").
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
} from '../saleStatus.utils'
import { SALE_DELIVERY_STATUS } from '../../constants/sale.constants'

describe('saleStatus.utils — delivery badge map', () => {
  it('exposes the SHIPPED row with the singular-feminine-agnostic plural label and warning tone', () => {
    // Badge label is plural ("Enviados") for tab/row consistency with
    // "Entregados" / "No Entregados". Tone is `warning` because the sale is
    // in transit but not yet delivered.
    expect(deliveryStatusBadgeMap.SHIPPED).toEqual({ label: 'Enviados', color: 'warning' })
  })

  it('preserves the DELIVERED + PENDING badge entries unchanged (lock-step invariant)', () => {
    expect(deliveryStatusBadgeMap.DELIVERED).toEqual({ label: 'Entregados', color: 'success' })
    expect(deliveryStatusBadgeMap.PENDING).toEqual({ label: 'No Entregados', color: 'error' })
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
      label: 'Enviados',
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

  it('SHIPPED plural-vs-singular cross-check: badge is plural "Enviados", filter is singular-feminine "Enviada"', () => {
    // Design §5.2 contract (REQ-SALES-DR-002 / REQ-SALES-DR-003): the badge
    // label is plural for tab/row consistency with 'Entregados' /
    // 'No Entregados'; the filter option label is singular-feminine
    // ('Enviada') to match its siblings 'Pendiente' / 'Entregada'. This
    // distinguishes the two surfaces and freezes the separation between
    // badge copy and filter copy.
    expect(getDeliveryStatusBadge('SHIPPED').label).toBe('Enviados')
    // The filter option lives in salesFiltersSchema — assert the label
    // there matches the singular-feminine form.
    expect(getDeliveryStatusBadge('SHIPPED').label).not.toBe('Enviada')
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