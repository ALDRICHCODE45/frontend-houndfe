import { describe, expect, it } from 'vitest'
import {
  collectExcludedPromotionLabels,
  parsePromotionCapacityChargeError,
  readDraftServerTotals,
} from '../promotionCapacityChargeErrors.utils'
import type { ApplicablePromotion, Sale } from '../../interfaces/sale.types'

function axiosError(data: Record<string, unknown>): unknown {
  return { response: { data } }
}

const VALID_MESSAGE = 'Promotion capacity changed during charge — re-quote required'
const VALID_TIMESTAMP = '2024-06-01T12:00:00.000Z'

function reQuoteEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    statusCode: 409,
    error: 'PROMO_CAPACITY_RE_QUOTE',
    message: VALID_MESSAGE,
    timestamp: VALID_TIMESTAMP,
    appliedPromotionIds: ['promo-line-1', 'promo-order-1'],
    excludedPromotionIds: ['promo-line-1'],
    ...overrides,
  }
}

function raceEnvelope(code: string, overrides: Record<string, unknown> = {}) {
  return {
    statusCode: 409,
    error: code,
    message: 'Promotion capacity changed during charge',
    timestamp: VALID_TIMESTAMP,
    saleId: 'sale-1',
    promotionId: 'promo-1',
    units: 1,
    ...overrides,
  }
}

describe('parsePromotionCapacityChargeError — PROMO_CAPACITY_RE_QUOTE', () => {
  it('parses the complete flat re-quote envelope (applied + excluded at the top level)', () => {
    const parsed = parsePromotionCapacityChargeError(axiosError(reQuoteEnvelope()))

    expect(parsed).toEqual({
      kind: 're-quote',
      appliedPromotionIds: ['promo-line-1', 'promo-order-1'],
      excludedPromotionIds: ['promo-line-1'],
    })
  })

  it('accepts empty applied/excluded arrays and an empty excluded subset', () => {
    expect(
      parsePromotionCapacityChargeError(
        axiosError(reQuoteEnvelope({ appliedPromotionIds: [], excludedPromotionIds: [] })),
      ),
    ).toEqual({ kind: 're-quote', appliedPromotionIds: [], excludedPromotionIds: [] })

    expect(
      parsePromotionCapacityChargeError(axiosError(reQuoteEnvelope({ excludedPromotionIds: [] }))),
    ).toEqual({
      kind: 're-quote',
      appliedPromotionIds: ['promo-line-1', 'promo-order-1'],
      excludedPromotionIds: [],
    })
  })

  it('rejects malformed id arrays instead of degrading to empty lists', () => {
    const invalidApplied = ['promo-1', [42], ['promo-1', ''], ['promo-1', null], [true]]
    for (const appliedPromotionIds of invalidApplied) {
      expect(
        parsePromotionCapacityChargeError(axiosError(reQuoteEnvelope({ appliedPromotionIds }))),
      ).toBeNull()
    }

    const invalidExcluded = ['promo-1', [42], ['promo-1', '']]
    for (const excludedPromotionIds of invalidExcluded) {
      expect(
        parsePromotionCapacityChargeError(axiosError(reQuoteEnvelope({ excludedPromotionIds }))),
      ).toBeNull()
    }
  })

  it('rejects an excluded id that is not part of the applied ids', () => {
    expect(
      parsePromotionCapacityChargeError(
        axiosError(reQuoteEnvelope({ excludedPromotionIds: ['promo-not-applied'] })),
      ),
    ).toBeNull()
  })

  it('rejects a malformed common domain envelope even when the code matches', () => {
    const malformed = [
      { statusCode: 400 },
      { statusCode: '409' },
      { statusCode: undefined },
      { message: '' },
      { message: 42 },
      { timestamp: '' },
      { timestamp: 42 },
    ]
    for (const overrides of malformed) {
      expect(parsePromotionCapacityChargeError(axiosError(reQuoteEnvelope(overrides)))).toBeNull()
    }
  })

  it('does NOT conflate the pre-existing PROMO_RE_QUOTE bot error', () => {
    const parsed = parsePromotionCapacityChargeError(
      axiosError({
        statusCode: 409,
        error: 'PROMO_RE_QUOTE',
        message: 'Total changed',
        timestamp: VALID_TIMESTAMP,
        recomputedTotalCents: 12000,
        expectedTotalCents: 15000,
        discountCents: 3000,
      }),
    )

    expect(parsed).toBeNull()
  })
})

describe('parsePromotionCapacityChargeError — race guards', () => {
  it('parses PROMOTION_CAPACITY_EXCEEDED (saleId/promotionId/units)', () => {
    const parsed = parsePromotionCapacityChargeError(
      axiosError(raceEnvelope('PROMOTION_CAPACITY_EXCEEDED', { units: 3 })),
    )

    expect(parsed).toEqual({
      kind: 'race',
      code: 'PROMOTION_CAPACITY_EXCEEDED',
      saleId: 'sale-1',
      promotionId: 'promo-1',
      units: 3,
    })
  })

  it('parses PROMOTION_CAPACITY_CLAIM_MISMATCH as its own distinct code', () => {
    const parsed = parsePromotionCapacityChargeError(
      axiosError(raceEnvelope('PROMOTION_CAPACITY_CLAIM_MISMATCH', { promotionId: 'promo-9' })),
    )

    expect(parsed).toEqual({
      kind: 'race',
      code: 'PROMOTION_CAPACITY_CLAIM_MISMATCH',
      saleId: 'sale-1',
      promotionId: 'promo-9',
      units: 1,
    })
  })

  it('rejects race envelopes lacking non-empty ids or a positive integer units', () => {
    const malformed = [
      { saleId: '' },
      { saleId: 7 },
      { promotionId: '' },
      { promotionId: null },
      { units: 0 },
      { units: -1 },
      { units: 1.5 },
      { units: 'lots' },
      { statusCode: 400 },
      { message: '' },
      { timestamp: '' },
    ]
    for (const code of ['PROMOTION_CAPACITY_EXCEEDED', 'PROMOTION_CAPACITY_CLAIM_MISMATCH']) {
      for (const overrides of malformed) {
        expect(
          parsePromotionCapacityChargeError(axiosError(raceEnvelope(code, overrides))),
        ).toBeNull()
      }
    }
  })
})

describe('parsePromotionCapacityChargeError — negative space', () => {
  it('returns null for unknown domain codes', () => {
    expect(
      parsePromotionCapacityChargeError(axiosError(reQuoteEnvelope({ error: 'SALE_NOT_FOUND' }))),
    ).toBeNull()
  })

  it('returns null when there is no response data or the error is not axios-shaped', () => {
    expect(parsePromotionCapacityChargeError(new Error('network'))).toBeNull()
    expect(parsePromotionCapacityChargeError({})).toBeNull()
    expect(parsePromotionCapacityChargeError(undefined)).toBeNull()
    expect(parsePromotionCapacityChargeError(axiosError({}))).toBeNull()
  })
})

describe('readDraftServerTotals', () => {
  it('returns the authoritative totals when all three are present', () => {
    expect(
      readDraftServerTotals({ subtotalCents: 10000, discountCents: 1500, totalCents: 8500 }),
    ).toEqual({
      subtotalCents: 10000,
      discountCents: 1500,
      totalCents: 8500,
    })
  })

  it('returns null when any authoritative total is missing', () => {
    expect(readDraftServerTotals({ subtotalCents: 10000, discountCents: 0 })).toBeNull()
    expect(readDraftServerTotals({ subtotalCents: 10000, totalCents: 10000 })).toBeNull()
    expect(readDraftServerTotals({})).toBeNull()
    expect(readDraftServerTotals(null)).toBeNull()
    expect(readDraftServerTotals(undefined)).toBeNull()
  })

  it('returns null when a total is not a finite number', () => {
    expect(
      readDraftServerTotals({ subtotalCents: Number.NaN, discountCents: 0, totalCents: 0 }),
    ).toBeNull()
    expect(
      readDraftServerTotals({
        subtotalCents: 1,
        discountCents: 0,
        totalCents: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull()
  })
})

describe('collectExcludedPromotionLabels', () => {
  const draftWithOrderPromo: Sale = {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        variantId: null,
        productName: 'A',
        variantName: null,
        quantity: 1,
        unitPriceCents: 5000,
        unitPriceCurrency: 'MXN',
        promotionId: 'promo-line-1',
        discountTitle: 'Descuento de línea',
      },
    ],
    appliedOrderPromotion: {
      promotionId: 'promo-order-1',
      discountType: 'amount',
      discountValue: 500,
      discountAmountCents: 500,
      discountTitle: 'Promo de orden',
    },
    createdAt: 'x',
    updatedAt: 'x',
  }

  const applicable: ApplicablePromotion[] = [
    { id: 'promo-applicable', title: 'Promo aplicable', type: 'PRODUCT_DISCOUNT' },
  ]

  it('resolves labels from applicable promotions first', () => {
    expect(
      collectExcludedPromotionLabels(['promo-applicable'], draftWithOrderPromo, applicable),
    ).toEqual([{ id: 'promo-applicable', label: 'Promo aplicable' }])
  })

  it('falls back to the draft order-promo and line-discount titles', () => {
    expect(
      collectExcludedPromotionLabels(
        ['promo-order-1', 'promo-line-1', 'promo-unknown'],
        draftWithOrderPromo,
        applicable,
      ),
    ).toEqual([
      { id: 'promo-order-1', label: 'Promo de orden' },
      { id: 'promo-line-1', label: 'Descuento de línea' },
      { id: 'promo-unknown', label: 'promo-unknown' },
    ])
  })

  it('returns an empty list when there are no excluded ids', () => {
    expect(collectExcludedPromotionLabels([], draftWithOrderPromo, applicable)).toEqual([])
  })

  it('handles a missing draft gracefully', () => {
    expect(collectExcludedPromotionLabels(['promo-x'], null, [])).toEqual([
      { id: 'promo-x', label: 'promo-x' },
    ])
  })
})
