// Value-pin contract tests for `promotion.constants.ts` (backend-v1 freeze).
// Each row asserts EXACT string equality — a renamed literal
// (e.g. 'BUY_X_GET_Y' → 'BUYXGETY', 'VARIANTS' → 'VARIANT', 'CATEGORIES' →
// 'CATEGORY', 'REGISTERED_ONLY' → 'REGISTERED', 'PRODUCT_DISCOUNT' →
// 'PRODUCT', 'SCHEDULED' → 'SCHEDULED') fails the build. Never edit a value.

import { describe, it, expect } from 'vitest'
import {
  PROMOTION_TYPE,
  DISCOUNT_TYPE,
  PROMOTION_TARGET_TYPE,
  CUSTOMER_SCOPE,
  PROMOTION_METHOD,
  TARGET_SIDE,
  DAY_OF_WEEK,
  PROMOTION_STATUS,
  INVALID_PROMOTION_TYPE,
  BXGY_ALLOWED_APPLIES_TO,
} from '../promotion.constants'

type PinRow = [actual: string, expected: string]

const groups: Array<[group: string, cases: PinRow[]]> = [
  [
    'PROMOTION_TYPE',
    [
      [PROMOTION_TYPE.PRODUCT_DISCOUNT, 'PRODUCT_DISCOUNT'],
      [PROMOTION_TYPE.ORDER_DISCOUNT, 'ORDER_DISCOUNT'],
      [PROMOTION_TYPE.BUY_X_GET_Y, 'BUY_X_GET_Y'],
      [PROMOTION_TYPE.ADVANCED, 'ADVANCED'],
    ],
  ],
  [
    'DISCOUNT_TYPE',
    [
      [DISCOUNT_TYPE.PERCENTAGE, 'PERCENTAGE'],
      [DISCOUNT_TYPE.FIXED, 'FIXED'],
    ],
  ],
  [
    'PROMOTION_TARGET_TYPE',
    [
      [PROMOTION_TARGET_TYPE.CATEGORIES, 'CATEGORIES'],
      [PROMOTION_TARGET_TYPE.BRANDS, 'BRANDS'],
      [PROMOTION_TARGET_TYPE.PRODUCTS, 'PRODUCTS'],
      [PROMOTION_TARGET_TYPE.VARIANTS, 'VARIANTS'],
    ],
  ],
  [
    'CUSTOMER_SCOPE',
    [
      [CUSTOMER_SCOPE.ALL, 'ALL'],
      [CUSTOMER_SCOPE.REGISTERED_ONLY, 'REGISTERED_ONLY'],
      [CUSTOMER_SCOPE.SPECIFIC, 'SPECIFIC'],
    ],
  ],
  [
    'PROMOTION_METHOD',
    [
      [PROMOTION_METHOD.AUTOMATIC, 'AUTOMATIC'],
      [PROMOTION_METHOD.MANUAL, 'MANUAL'],
    ],
  ],
  [
    'TARGET_SIDE',
    [
      [TARGET_SIDE.DEFAULT, 'DEFAULT'],
      [TARGET_SIDE.BUY, 'BUY'],
      [TARGET_SIDE.GET, 'GET'],
    ],
  ],
  [
    'DAY_OF_WEEK',
    [
      [DAY_OF_WEEK.MONDAY, 'MONDAY'],
      [DAY_OF_WEEK.TUESDAY, 'TUESDAY'],
      [DAY_OF_WEEK.WEDNESDAY, 'WEDNESDAY'],
      [DAY_OF_WEEK.THURSDAY, 'THURSDAY'],
      [DAY_OF_WEEK.FRIDAY, 'FRIDAY'],
      [DAY_OF_WEEK.SATURDAY, 'SATURDAY'],
      [DAY_OF_WEEK.SUNDAY, 'SUNDAY'],
    ],
  ],
  [
    'PROMOTION_STATUS',
    [
      [PROMOTION_STATUS.ACTIVE, 'ACTIVE'],
      [PROMOTION_STATUS.SCHEDULED, 'SCHEDULED'],
      [PROMOTION_STATUS.ENDED, 'ENDED'],
    ],
  ],
]

describe.each(groups)('%s — value-pin contract', (_group, cases) => {
  it.each(cases)('%s === "%s"', (actual, expected) => expect(actual).toBe(expected))
})

// ── Sentinel: INVALID_PROMOTION_TYPE (route-guard only, NOT a backend value) ─
//
// The route guard in PromotionDetailView.vue uses `'INVALID' as const` as a
// sentinel for "the route's `:type` param is not a valid PromotionType". It
// MUST stay distinct from the four backend PROMOTION_TYPE values — keep it
// exported from this module so the guard stays in sync if we ever add a 5th
// promotion type.

describe('INVALID_PROMOTION_TYPE — route guard sentinel', () => {
  it('value-pin: equals the literal "INVALID"', () => {
    expect(INVALID_PROMOTION_TYPE).toBe('INVALID')
  })

  it('is distinct from every backend PROMOTION_TYPE value', () => {
    const backendValues = Object.values(PROMOTION_TYPE)
    expect(backendValues).not.toContain(INVALID_PROMOTION_TYPE)
  })
})

// ── BXGY_ALLOWED_APPLIES_TO — REQ-11 schema-side tuple ──────────────────────
//
// The BXGY branch of the schema only accepts the four "catalog" target types
// (PRODUCTS / VARIANTS / CATEGORIES / BRANDS) — never ORDERS (no appliesTo
// semantics). Pinning the tuple here keeps the schema and the form in sync
// even if PROMOTION_TARGET_TYPE grows new entries.

describe('BXGY_ALLOWED_APPLIES_TO — REQ-11 catalog-only tuple', () => {
  it('value-pin: tuple is [PRODUCTS, VARIANTS, CATEGORIES, BRANDS]', () => {
    expect(BXGY_ALLOWED_APPLIES_TO).toEqual([
      'PRODUCTS',
      'VARIANTS',
      'CATEGORIES',
      'BRANDS',
    ])
  })

  it('excludes ORDERS (BXGY cannot target orders)', () => {
    expect(BXGY_ALLOWED_APPLIES_TO as readonly string[]).not.toContain('ORDERS')
  })

  it('contains exactly 4 entries (catalog types only)', () => {
    expect(BXGY_ALLOWED_APPLIES_TO).toHaveLength(4)
  })

  it('every entry is a known PROMOTION_TARGET_TYPE value', () => {
    const known = new Set<string>(Object.values(PROMOTION_TARGET_TYPE))
    for (const v of BXGY_ALLOWED_APPLIES_TO) {
      expect(known.has(v)).toBe(true)
    }
  })
})
