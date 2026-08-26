import { describe, expect, it } from 'vitest'

import type { PaymentEntry } from '../../interfaces/sale.types'
import {
  MAX_PAYMENT_ENTRIES,
  addEntry,
  createEntry,
  normalizeReferenceInput,
  paidSum,
  remaining,
  removeEntry,
  updateEntry,
  validateAggregate,
  validateEntry,
} from '../paymentEntries.utils'

describe('paymentEntries.utils', () => {
  describe('createEntry', () => {
    it('defaults cash amount to remaining debt', () => {
      const entry = createEntry('cash', 12_500)

      expect(entry).toEqual({ method: 'cash', amountCents: 12_500 })
    })

    it('defaults non-cash amount to zero', () => {
      const entry = createEntry('card_credit', 12_500)

      expect(entry).toEqual({ method: 'card_credit', amountCents: 0 })
    })

    // sdd custom-payment-methods S4B (REQ-CAT-001 / design §1.3): the
    // optional third arg threads the catalog UUID for CUSTOM tiles only.
    // The key must be ABSENT for fixed tiles (legacy byte-identical).
    it('threads an optional paymentMethodId onto the entry when provided (custom tiles)', () => {
      const entry = createEntry('transfer', 12_500, '11111111-1111-4111-8111-111111111111')

      expect(entry).toEqual({
        method: 'transfer',
        amountCents: 0,
        paymentMethodId: '11111111-1111-4111-8111-111111111111',
      })
    })

    it('omits paymentMethodId when not provided (fixed tiles stay byte-identical)', () => {
      const entry = createEntry('cash', 12_500)

      expect(Object.keys(entry).sort()).toEqual(['amountCents', 'method'])
      expect(entry).not.toHaveProperty('paymentMethodId')
    })
  })

  describe('addEntry', () => {
    it('adds a new entry immutably', () => {
      const entries: PaymentEntry[] = [{ method: 'cash', amountCents: 5000 }]

      const next = addEntry(entries, 'transfer', 10_000)

      expect(next).toHaveLength(2)
      expect(next[1]).toEqual({ method: 'transfer', amountCents: 0 })
      expect(entries).toHaveLength(1)
    })

    it('returns unchanged array when max entries reached', () => {
      const entries: PaymentEntry[] = Array.from({ length: MAX_PAYMENT_ENTRIES }, (_, index) => ({
        method: index % 2 === 0 ? 'cash' : 'card_debit',
        amountCents: 100,
        reference: index % 2 === 0 ? undefined : `R-${index}`,
      }))

      const next = addEntry(entries, 'cash', 10_000)

      expect(next).toBe(entries)
      expect(next).toHaveLength(MAX_PAYMENT_ENTRIES)
    })

    // sdd custom-payment-methods S4B (REQ-CAT-001): addEntry forwards the
    // optional paymentMethodId to the appended entry (custom tiles).
    it('threads paymentMethodId to the appended entry when provided', () => {
      const next = addEntry([], 'transfer', 10_000, '22222222-2222-4222-8222-222222222222')

      expect(next).toHaveLength(1)
      expect(next[0]).toEqual({
        method: 'transfer',
        amountCents: 0,
        paymentMethodId: '22222222-2222-4222-8222-222222222222',
      })
    })

    it('omits paymentMethodId from the appended entry when not provided', () => {
      const next = addEntry([], 'cash', 10_000)

      expect(next[0]).toEqual({ method: 'cash', amountCents: 10_000 })
      expect(next[0]).not.toHaveProperty('paymentMethodId')
    })

    it('respects the max-entries guard before threading paymentMethodId', () => {
      const entries: PaymentEntry[] = Array.from({ length: MAX_PAYMENT_ENTRIES }, (_, index) => ({
        method: index % 2 === 0 ? 'cash' : 'transfer',
        amountCents: 100,
      }))

      const next = addEntry(entries, 'transfer', 10_000, '44444444-4444-4444-8444-444444444444')

      expect(next).toBe(entries)
    })
  })

  describe('removeEntry', () => {
    it('removes entry by index immutably', () => {
      const entries: PaymentEntry[] = [
        { method: 'cash', amountCents: 1000 },
        { method: 'transfer', amountCents: 2000, reference: 'TRX-2' },
      ]

      const next = removeEntry(entries, 0)

      expect(next).toEqual([{ method: 'transfer', amountCents: 2000, reference: 'TRX-2' }])
      expect(entries).toHaveLength(2)
    })
  })

  describe('updateEntry', () => {
    it('updates entry by index immutably', () => {
      const entries: PaymentEntry[] = [{ method: 'transfer', amountCents: 1000, reference: 'A' }]

      const next = updateEntry(entries, 0, { amountCents: 3000, reference: 'B' })

      expect(next).toEqual([{ method: 'transfer', amountCents: 3000, reference: 'B' }])
      expect(entries[0]?.amountCents).toBe(1000)
    })

    it('returns original array when index is out of range', () => {
      const entries: PaymentEntry[] = [{ method: 'cash', amountCents: 1000 }]

      const next = updateEntry(entries, 4, { amountCents: 2000 })

      expect(next).toBe(entries)
    })

    // sdd custom-payment-methods S4B: the patch accepts paymentMethodId so
    // custom entries keep their UUID through updateEntry round-trips.
    it('accepts paymentMethodId in the patch (custom entry threading)', () => {
      const entries: PaymentEntry[] = [{ method: 'transfer', amountCents: 1000 }]

      const next = updateEntry(entries, 0, { paymentMethodId: '33333333-3333-4333-8333-333333333333' })

      expect(next[0]).toEqual({
        method: 'transfer',
        amountCents: 1000,
        paymentMethodId: '33333333-3333-4333-8333-333333333333',
      })
    })
  })

  describe('validateEntry', () => {
    it('rejects amount below one cent', () => {
      const errors = validateEntry({ method: 'cash', amountCents: 0 })

      expect(errors.amountCents).toBe('El monto debe ser mayor a 0')
    })

    // sales-pos-charge WU-C.1 (REQ-NEW-9): reference is OPTIONAL for non-cash
    // methods. The cashier can submit a card/transfer entry without typing a
    // reference; the backend defaults it to null on save.
    it('passes a non-cash entry without a reference (WU-C)', () => {
      const errors = validateEntry({ method: 'card_debit', amountCents: 100 })

      expect(errors.reference).toBeUndefined()
      expect(errors.amountCents).toBeUndefined()
    })

    it('passes a non-cash entry with an empty-string reference (WU-C)', () => {
      const errors = validateEntry({ method: 'card_debit', amountCents: 100, reference: '' })

      expect(errors.reference).toBeUndefined()
    })

    it('passes a non-cash entry with a whitespace-only reference (WU-C)', () => {
      const errors = validateEntry({ method: 'transfer', amountCents: 100, reference: '   ' })

      expect(errors.reference).toBeUndefined()
    })

    it('does not require reference for cash method', () => {
      const errors = validateEntry({ method: 'cash', amountCents: 100 })

      expect(errors.reference).toBeUndefined()
    })
  })

  describe('validateAggregate', () => {
    it('requires at least one entry', () => {
      const result = validateAggregate([], 10_000)

      expect(result).toBe('Debes agregar al menos un pago')
    })

    it('returns error when entries exceed debt', () => {
      const result = validateAggregate(
        [
          { method: 'cash', amountCents: 8000 },
          { method: 'transfer', amountCents: 3000, reference: 'TRX-3' },
        ],
        10_000,
      )

      expect(result).toBe('El total supera la deuda')
    })

    it('returns undefined when total is valid', () => {
      const result = validateAggregate([{ method: 'cash', amountCents: 10_000 }], 10_000)

      expect(result).toBeUndefined()
    })
  })

  describe('paidSum and remaining', () => {
    it('calculates paid sum from all entries', () => {
      const result = paidSum([
        { method: 'cash', amountCents: 1000 },
        { method: 'transfer', amountCents: 2000, reference: 'TRX-2' },
      ])

      expect(result).toBe(3000)
    })

    it('calculates remaining debt', () => {
      const result = remaining(
        [
          { method: 'cash', amountCents: 1000 },
          { method: 'transfer', amountCents: 2000, reference: 'TRX-2' },
        ],
        10_000,
      )

      expect(result).toBe(7000)
    })
  })

  // sales-pos-charge WU-B.6 / WU-C.1 — reference is OPTIONAL for non-CASH
  // methods going forward (REQ-NEW-9, REQ-NEW-10); the util normalizes the
  // raw field input into the wire contract.
  describe('normalizeReferenceInput', () => {
    it('maps an empty string to undefined (omit the key)', () => {
      expect(normalizeReferenceInput('')).toBeUndefined()
    })

    it('maps a whitespace-only string to undefined', () => {
      expect(normalizeReferenceInput('   ')).toBeUndefined()
    })

    it('trims surrounding whitespace from a real reference', () => {
      expect(normalizeReferenceInput('  TRF-001  ')).toBe('TRF-001')
    })

    it('passes through null unchanged (slideover clear signal)', () => {
      expect(normalizeReferenceInput(null)).toBeNull()
    })

    it('passes through undefined unchanged', () => {
      expect(normalizeReferenceInput(undefined)).toBeUndefined()
    })
  })
})
