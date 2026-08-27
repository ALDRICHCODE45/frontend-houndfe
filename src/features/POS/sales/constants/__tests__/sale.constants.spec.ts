// Value-pin contract tests for `sale.constants.ts` (backend-v1 freeze).
// Each row asserts EXACT string equality — a renamed literal
// (e.g. 'CONFIRMED' → 'CONFIRM', 'card_credit' → 'cardCredit',
// 'CARD_CREDIT' → 'CARD_CREDIT_DEBIT', 'CANCELED' → 'CANCELLED' — 2 L's,
// 'NOT_APPLICABLE' → 'NOT_APPLICABLEE') fails the build. Never edit a value.
//
// GUARDRAIL CONTEXT:
//   - sales uses 'CANCELED' (ONE L). admin/employees uses 'CANCELLED' (TWO L's).
//     These are intentionally distinct backend contracts. Keep constants
//     PER-MODULE — a shared global would cause the exact homonym bug this
//     slice exists to prevent.
//   - PaymentMethod (LOWERCASE) and SaleDetailPaymentMethod (UPPERCASE) are
//     TWO DISTINCT backend contracts. The constants module exports them as
//     PAYMENT_METHOD and SALE_DETAIL_PAYMENT_METHOD respectively. Do NOT unify.

import { describe, it, expect } from 'vitest'
import {
  SALE_STATUS,
  SALE_PAYMENT_STATUS,
  SALE_DELIVERY_STATUS,
  PAYMENT_METHOD,
  SALE_DETAIL_PAYMENT_METHOD,
  SALE_TIMELINE_EVENT_TYPE,
  POS_ACTIVE_TAB_STORAGE_KEY,
} from '../sale.constants'

type PinRow = [actual: string, expected: string]

const groups: Array<[group: string, cases: PinRow[]]> = [
  [
    'SALE_STATUS',
    [
      [SALE_STATUS.DRAFT, 'DRAFT'],
      [SALE_STATUS.CONFIRMED, 'CONFIRMED'],
      // 'CANCELED' belongs here because the ListSalesParams.status union
      // widens `SaleStatus | 'CANCELED'`. Sales uses ONE L (the employees
      // module uses TWO L's). Pin tests guard the spelling.
      [SALE_STATUS.CANCELED, 'CANCELED'],
    ],
  ],
  [
    'SALE_PAYMENT_STATUS',
    [
      [SALE_PAYMENT_STATUS.PAID, 'PAID'],
      [SALE_PAYMENT_STATUS.PARTIAL, 'PARTIAL'],
      [SALE_PAYMENT_STATUS.CREDIT, 'CREDIT'],
    ],
  ],
  [
    'SALE_DELIVERY_STATUS',
    [
      [SALE_DELIVERY_STATUS.PENDING, 'PENDING'],
      // sdd delivery-routes S1a — REQ-SALES-DR-001: SHIPPED joins the sales
      // delivery-status union. Was rendering "Desconocido" before this
      // addition; the backend already returns 'SHIPPED' for in-transit
      // confirmed sales that belong to a delivery route.
      [SALE_DELIVERY_STATUS.SHIPPED, 'SHIPPED'],
      [SALE_DELIVERY_STATUS.DELIVERED, 'DELIVERED'],
      [SALE_DELIVERY_STATUS.NOT_APPLICABLE, 'NOT_APPLICABLE'],
    ],
  ],
  [
    // LOWERCASE — PaymentMethod (draft + non-detail filters). Distinct
    // casing from SALE_DETAIL_PAYMENT_METHOD below.
    'PAYMENT_METHOD',
    [
      [PAYMENT_METHOD.CASH, 'cash'],
      [PAYMENT_METHOD.CARD_CREDIT, 'card_credit'],
      [PAYMENT_METHOD.CARD_DEBIT, 'card_debit'],
      [PAYMENT_METHOD.TRANSFER, 'transfer'],
      [PAYMENT_METHOD.CREDIT, 'credit'],
    ],
  ],
  [
    // UPPERCASE — SaleDetailPaymentMethod (confirmed + filter). Distinct
    // casing from PAYMENT_METHOD above. Two different backend contracts.
    'SALE_DETAIL_PAYMENT_METHOD',
    [
      [SALE_DETAIL_PAYMENT_METHOD.CASH, 'CASH'],
      [SALE_DETAIL_PAYMENT_METHOD.CARD_CREDIT, 'CARD_CREDIT'],
      [SALE_DETAIL_PAYMENT_METHOD.CARD_DEBIT, 'CARD_DEBIT'],
      [SALE_DETAIL_PAYMENT_METHOD.TRANSFER, 'TRANSFER'],
      [SALE_DETAIL_PAYMENT_METHOD.CREDIT, 'CREDIT'],
    ],
  ],
  [
    'SALE_TIMELINE_EVENT_TYPE',
    [
      [SALE_TIMELINE_EVENT_TYPE.SALE_REGISTERED, 'SALE_REGISTERED'],
      [SALE_TIMELINE_EVENT_TYPE.PAYMENT_RECEIVED, 'PAYMENT_RECEIVED'],
      [SALE_TIMELINE_EVENT_TYPE.PRODUCTS_DELIVERED, 'PRODUCTS_DELIVERED'],
      [SALE_TIMELINE_EVENT_TYPE.COMMENT, 'COMMENT'],
    ],
  ],
]

describe.each(groups)('%s — value-pin contract', (_group, cases) => {
  it.each(cases)('%s === "%s"', (actual, expected) => expect(actual).toBe(expected))
})

// ── Casing guards: PAYMENT_METHOD (lowercase) is NOT the same as ──────────────
//    SALE_DETAIL_PAYMENT_METHOD (uppercase). This guard catches a future
//    refactor that accidentally "unifies" them.

describe('Payment-method casing guard (two distinct contracts)', () => {
  it('PAYMENT_METHOD is lowercase, SALE_DETAIL_PAYMENT_METHOD is uppercase', () => {
    expect(PAYMENT_METHOD.CASH).not.toBe(SALE_DETAIL_PAYMENT_METHOD.CASH)
    expect(PAYMENT_METHOD.CARD_CREDIT).not.toBe(SALE_DETAIL_PAYMENT_METHOD.CARD_CREDIT)
  })

  it('PAYMENT_METHOD.CASH === "cash" (lowercase)', () => {
    expect(PAYMENT_METHOD.CASH).toBe('cash')
  })

  it('SALE_DETAIL_PAYMENT_METHOD.CASH === "CASH" (uppercase)', () => {
    expect(SALE_DETAIL_PAYMENT_METHOD.CASH).toBe('CASH')
  })
})

// ── CANCELED / CANCELLED homonym guard ───────────────────────────────────────
//    sales 'CANCELED' (ONE L) must NEVER collide with employees
//    'CANCELLED' (TWO L's). The PIN tests cover both spellings; this block
//    makes the contract self-documenting.

describe('SALE_STATUS.CANCELED — one-L spelling (distinct from time-off "CANCELLED")', () => {
  it('exactly one "L" — equals the literal "CANCELED"', () => {
    expect(SALE_STATUS.CANCELED).toBe('CANCELED')
  })

  it('is not the two-L spelling "CANCELLED"', () => {
    expect(SALE_STATUS.CANCELED).not.toBe('CANCELLED')
  })

  it('contains exactly eight C-A-N-C-E-L-E-D characters (no second L)', () => {
    expect(SALE_STATUS.CANCELED.length).toBe(8)
    expect(SALE_STATUS.CANCELED.match(/L/g)?.length ?? 0).toBe(1)
  })
})

// ── POS_ACTIVE_TAB_STORAGE_KEY — the only raw storage key left in the ────────
//    codebase. A get/set typo would silently lose the active tab. Pin tests
//    freeze the exact storage key the localStorage API reads/writes.

describe('POS_ACTIVE_TAB_STORAGE_KEY — storage key freeze', () => {
  it('value-pin: equals "pos:active-tab"', () => {
    expect(POS_ACTIVE_TAB_STORAGE_KEY).toBe('pos:active-tab')
  })

  it('contains the "pos:" namespace prefix (not "sale:" or "sales:")', () => {
    expect(POS_ACTIVE_TAB_STORAGE_KEY.startsWith('pos:')).toBe(true)
  })
})

// ── SALE_DELIVERY_STATUS.SHIPPED — sdd delivery-routes S1a (REQ-SALES-DR-001) ────
//
// The backend started returning 'SHIPPED' for confirmed sales that belong to
// an active delivery route. Before this addition the frontend rendered
// "Desconocido" everywhere — the SHIPPED row in the value-pin table above
// guards against drift in the literal string. These tests pin the contract
// more aggressively (the object exposes a SHIPPED key, the literal is 'SHIPPED',
// and the derived SaleDeliveryStatus type widens automatically).

describe('SALE_DELIVERY_STATUS.SHIPPED — sdd delivery-routes S1a (REQ-SALES-DR-001)', () => {
  it('exposes a SHIPPED key whose value is the literal string "SHIPPED"', () => {
    expect(SALE_DELIVERY_STATUS.SHIPPED).toBe('SHIPPED')
  })

  it('membership: SHIPPED is a member of the SALE_DELIVERY_STATUS object', () => {
    expect('SHIPPED' in SALE_DELIVERY_STATUS).toBe(true)
    expect(Object.keys(SALE_DELIVERY_STATUS)).toContain('SHIPPED')
  })

  it('preserves the singular vs plural distinction: literal "SHIPPED" (uppercase), not "Enviada"', () => {
    // The const is the LITERAL wire value; the label 'Enviada' lives in the
    // filter schema (salesFiltersSchema) and the badge map (saleStatus.utils).
    // Asserting this here freezes the separation between logic (UPPERCASE
    // literal) and UI copy (Spanish label).
    expect(SALE_DELIVERY_STATUS.SHIPPED).not.toBe('Enviada')
    expect(SALE_DELIVERY_STATUS.SHIPPED).not.toBe('Enviado')
  })

  it('preserves the case sensitivity: lowercase "shipped" is NOT a valid value', () => {
    expect(SALE_DELIVERY_STATUS.SHIPPED).not.toBe('shipped')
  })

  it('does NOT alter the existing PENDING / DELIVERED / NOT_APPLICABLE values', () => {
    expect(SALE_DELIVERY_STATUS.PENDING).toBe('PENDING')
    expect(SALE_DELIVERY_STATUS.DELIVERED).toBe('DELIVERED')
    expect(SALE_DELIVERY_STATUS.NOT_APPLICABLE).toBe('NOT_APPLICABLE')
  })
})
