import { describe, it, expect } from 'vitest'
import {
  PAYMENT_METHOD_CATEGORY,
  PAYMENT_METHOD_CATEGORY_VALUES,
  PAYMENT_METHOD_CATEGORY_LABELS,
  PAYMENT_METHOD_CATEGORY_ICONS,
  type PaymentMethodCategory,
} from '../payment-method-category'

describe('payment-method-category (sdd custom-payment-methods S1, shared category primitive)', () => {
  describe('PAYMENT_METHOD_CATEGORY', () => {
    it('exposes exactly the four lowercase enum values (REQ-PM-008)', () => {
      expect(PAYMENT_METHOD_CATEGORY).toEqual({
        CASH: 'cash',
        CARD_CREDIT: 'card_credit',
        CARD_DEBIT: 'card_debit',
        TRANSFER: 'transfer',
      })
    })

    it('does NOT include "credit" (REQ-PM-008 / design §2.1)', () => {
      expect(Object.values(PAYMENT_METHOD_CATEGORY)).not.toContain('credit')
    })
  })

  describe('PAYMENT_METHOD_CATEGORY_VALUES', () => {
    it('is exactly ["cash", "card_credit", "card_debit", "transfer"] in order (REQ-PM-008)', () => {
      expect(PAYMENT_METHOD_CATEGORY_VALUES).toEqual([
        'cash',
        'card_credit',
        'card_debit',
        'transfer',
      ])
    })

    it('has length 4', () => {
      expect(PAYMENT_METHOD_CATEGORY_VALUES).toHaveLength(4)
    })
  })

  describe('PaymentMethodCategory type', () => {
    it('accepts each enum value at compile time', () => {
      const a: PaymentMethodCategory = 'cash'
      const b: PaymentMethodCategory = 'card_credit'
      const c: PaymentMethodCategory = 'card_debit'
      const d: PaymentMethodCategory = 'transfer'

      expect(a).toBe('cash')
      expect(b).toBe('card_credit')
      expect(c).toBe('card_debit')
      expect(d).toBe('transfer')
    })
  })

  describe('PAYMENT_METHOD_CATEGORY_LABELS', () => {
    it('maps every category to a Spanish label', () => {
      expect(PAYMENT_METHOD_CATEGORY_LABELS.cash).toBe('Efectivo')
      expect(PAYMENT_METHOD_CATEGORY_LABELS.card_credit).toBe('Tarjeta de crédito')
      expect(PAYMENT_METHOD_CATEGORY_LABELS.card_debit).toBe('Tarjeta de débito')
      expect(PAYMENT_METHOD_CATEGORY_LABELS.transfer).toBe('Transferencia')
    })

    it('has exactly the 4 keys (no extras)', () => {
      expect(Object.keys(PAYMENT_METHOD_CATEGORY_LABELS).sort()).toEqual([
        'card_credit',
        'card_debit',
        'cash',
        'transfer',
      ])
    })
  })

  describe('PAYMENT_METHOD_CATEGORY_ICONS', () => {
    it('maps every category to a non-empty icon name', () => {
      for (const value of PAYMENT_METHOD_CATEGORY_VALUES) {
        expect(PAYMENT_METHOD_CATEGORY_ICONS[value]).toMatch(/^i-lucide-/)
      }
    })

    it('has exactly the 4 keys', () => {
      expect(Object.keys(PAYMENT_METHOD_CATEGORY_ICONS).sort()).toEqual([
        'card_credit',
        'card_debit',
        'cash',
        'transfer',
      ])
    })
  })
})