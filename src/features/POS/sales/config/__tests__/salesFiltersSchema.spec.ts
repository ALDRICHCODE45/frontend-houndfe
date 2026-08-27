// sdd delivery-routes S1a — REQ-SALES-DR-003: SHIPPED filter option contract.
//
// The existing `salesFiltersSchema.test.ts` covers the filter ids + sections +
// async options + includeNull behavior. This co-located spec file (`.spec.ts`)
// is the S1a carrier for the SHIPPED row + the singular-feminine label
// ('Enviada', to match its siblings 'Pendiente' / 'Entregada').
//
// The badge label is plural ('Enviados') but the FILTER option is
// singular-feminine — distinct surfaces, distinct copy. Pinning both
// invariants here keeps the contract visible at review time.

import { describe, expect, it } from 'vitest'
import { createSalesFiltersSchema } from '../salesFiltersSchema'
import { SALE_DELIVERY_STATUS } from '../../constants/sale.constants'

const baseSources = {
  customerOptions: [],
  customerLoading: false,
  cashierOptions: [],
  cashierLoading: false,
}

describe('salesFiltersSchema — deliveryStatus filter options', () => {
  it('deliveryStatus filter contains a SHIPPED row with the singular-feminine label "Enviada"', () => {
    const schema = createSalesFiltersSchema(baseSources)
    const deliveryStatus = schema.fields.find(field => field.id === 'deliveryStatus')

    expect(deliveryStatus?.kind).toBe('multi-enum')
    if (deliveryStatus?.kind !== 'multi-enum') return

    const shippedOption = deliveryStatus.options.find(
      (opt) => opt.value === SALE_DELIVERY_STATUS.SHIPPED,
    )
    expect(shippedOption).toBeDefined()
    expect(shippedOption?.value).toBe(SALE_DELIVERY_STATUS.SHIPPED)
    // Singular-feminine to match its siblings ('Pendiente', 'Entregada') in
    // the multi-enum options list.
    expect(shippedOption?.label).toBe('Enviada')
  })

  it('preserves the existing PENDING + DELIVERED filter options (lock-step invariant)', () => {
    const schema = createSalesFiltersSchema(baseSources)
    const deliveryStatus = schema.fields.find(field => field.id === 'deliveryStatus')

    expect(deliveryStatus?.kind).toBe('multi-enum')
    if (deliveryStatus?.kind !== 'multi-enum') return

    const pendingOption = deliveryStatus.options.find(
      (opt) => opt.value === SALE_DELIVERY_STATUS.PENDING,
    )
    const deliveredOption = deliveryStatus.options.find(
      (opt) => opt.value === SALE_DELIVERY_STATUS.DELIVERED,
    )

    expect(pendingOption?.label).toBe('Pendiente')
    expect(deliveredOption?.label).toBe('Entregada')
  })

  it('SHIPPED filter option uses the wire-literal value (uppercase), NOT a Spanish label', () => {
    const schema = createSalesFiltersSchema(baseSources)
    const deliveryStatus = schema.fields.find(field => field.id === 'deliveryStatus')

    expect(deliveryStatus?.kind).toBe('multi-enum')
    if (deliveryStatus?.kind !== 'multi-enum') return

    const shippedOption = deliveryStatus.options.find(
      (opt) => opt.value === SALE_DELIVERY_STATUS.SHIPPED,
    )

    // `value` is the literal wire string; `label` is the UI copy. They MUST
    // remain distinct — the value drives the query param and the API filter.
    expect(shippedOption?.value).toBe('SHIPPED')
    expect(shippedOption?.value).not.toBe('Enviada')
    expect(shippedOption?.value).not.toBe('Enviado')
  })

  it('does NOT add a SHIPPED row to the paymentStatus or paymentMethod filters', () => {
    // The SHIPPED value is delivery-status specific. Pinning it ONLY in
    // deliveryStatus protects a future refactor from accidentally leaking
    // it into the wrong filter family.
    const schema = createSalesFiltersSchema(baseSources)
    const paymentStatus = schema.fields.find(field => field.id === 'paymentStatus')
    const paymentMethod = schema.fields.find(field => field.id === 'paymentMethod')

    if (paymentStatus?.kind === 'multi-enum') {
      const values = paymentStatus.options.map((opt) => opt.value)
      expect(values).not.toContain('SHIPPED')
    }

    if (paymentMethod?.kind === 'multi-enum') {
      const values = paymentMethod.options.map((opt) => opt.value)
      expect(values).not.toContain('SHIPPED')
    }
  })

  it('deliveryStatus filter still has exactly three options: PENDING, SHIPPED, DELIVERED', () => {
    // Order is preserved: PENDING, SHIPPED, DELIVERED (the new row lands
    // between PENDING and DELIVERED — same place as in the value-pin table
    // of sale.constants.spec.ts). NOT_APPLICABLE is intentionally excluded
    // (it is the "instant-delivery / take-away" status that has nothing to
    // do with route logistics and the table filter excludes it).
    const schema = createSalesFiltersSchema(baseSources)
    const deliveryStatus = schema.fields.find(field => field.id === 'deliveryStatus')

    expect(deliveryStatus?.kind).toBe('multi-enum')
    if (deliveryStatus?.kind !== 'multi-enum') return

    const values = deliveryStatus.options.map((opt) => opt.value)
    expect(values).toEqual([
      SALE_DELIVERY_STATUS.PENDING,
      SALE_DELIVERY_STATUS.SHIPPED,
      SALE_DELIVERY_STATUS.DELIVERED,
    ])
  })
})