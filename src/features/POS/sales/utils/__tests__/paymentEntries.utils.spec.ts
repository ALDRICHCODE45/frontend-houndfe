import { describe, expect, it } from 'vitest'

import type { PaymentEntry } from '../../interfaces/sale.types'
import {
  MAX_PAYMENT_ENTRIES,
  addEntry,
  createEntry,
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
  })

  describe('validateEntry', () => {
    it('rejects amount below one cent', () => {
      const errors = validateEntry({ method: 'cash', amountCents: 0 })

      expect(errors.amountCents).toBe('El monto debe ser mayor a 0')
    })

    it('requires non-empty reference for non-cash methods', () => {
      const errors = validateEntry({ method: 'card_debit', amountCents: 100, reference: '   ' })

      expect(errors.reference).toBe('La referencia es obligatoria')
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
})
