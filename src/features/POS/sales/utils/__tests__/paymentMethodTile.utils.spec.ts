import { describe, it, expect } from 'vitest'
import type {
  ActivePaymentMethodProjection,
  PaymentEntry,
} from '../../interfaces/sale.types'
import {
  FIXED_METHOD_OPTIONS,
  buildMergedMethodOptions,
  paymentMethodTileKey,
  paymentEntryKey,
  entryMatchesTile,
  findEntryIndex,
  getMethodCount,
  findTileForEntry,
  isUuidString,
  resolveEntryDisplay,
  toCustomTile,
} from '../paymentMethodTile.utils'

function makeProjection(overrides: Partial<ActivePaymentMethodProjection> = {}): ActivePaymentMethodProjection {
  return {
    id: 'a4f1c2d3-1111-4111-8111-111111111111',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link',
    ...overrides,
  }
}

describe('paymentMethodTile.utils (sdd custom-payment-methods S4A, design §1)', () => {
  describe('isUuidString (REO-PT-003 UUID guard)', () => {
    it('accepts a canonical UUID v4', () => {
      expect(isUuidString('a4f1c2d3-1111-4111-8111-111111111111')).toBe(true)
    })

    it('accepts an uppercase UUID', () => {
      expect(isUuidString('A4F1C2D3-1111-4111-8111-111111111111')).toBe(true)
    })

    it('rejects an empty string', () => {
      expect(isUuidString('')).toBe(false)
    })

    it('rejects "not-a-uuid"', () => {
      expect(isUuidString('not-a-uuid')).toBe(false)
    })

    it('rejects UUIDs with the wrong version digit (e.g. v1)', () => {
      // 8-4-4-4-12 with version "1" in third group is not v4.
      expect(isUuidString('a4f1c2d3-1111-1111-8111-111111111111')).toBe(false)
    })
  })

  describe('paymentMethodTileKey', () => {
    it('returns the base category for a fixed tile (no paymentMethodId)', () => {
      const tile = FIXED_METHOD_OPTIONS[0]
      expect(paymentMethodTileKey(tile)).toBe('cash')
    })

    it('returns the UUID for a custom tile', () => {
      const tile = toCustomTile(makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', category: 'transfer' }))
      expect(paymentMethodTileKey(tile)).toBe('a4f1c2d3-1111-4111-8111-111111111111')
    })
  })

  describe('paymentEntryKey', () => {
    it('returns the base method for a fixed entry (no paymentMethodId)', () => {
      const entry: PaymentEntry = { method: 'cash', amountCents: 1000 }
      expect(paymentEntryKey(entry)).toBe('cash')
    })

    it('returns the paymentMethodId for a custom entry', () => {
      const entry: PaymentEntry = { method: 'transfer', amountCents: 1000, paymentMethodId: 'a4f1c2d3-1111-4111-8111-111111111111' }
      expect(paymentEntryKey(entry)).toBe('a4f1c2d3-1111-4111-8111-111111111111')
    })
  })

  describe('entryMatchesTile (REO-PT-001 fixed-matcher guard)', () => {
    const fixedTile = FIXED_METHOD_OPTIONS.find((t) => t.value === 'transfer')!

    it('returns TRUE for a fixed entry matching the fixed tile base category (no paymentMethodId)', () => {
      const entry: PaymentEntry = { method: 'transfer', amountCents: 1000 }
      expect(entryMatchesTile(entry, fixedTile)).toBe(true)
    })

    it('returns FALSE for a custom entry whose paymentMethodId !== undefined (the fixed-matcher guard, design §11 / REO-PT-001)', () => {
      const entry: PaymentEntry = {
        method: 'transfer',
        amountCents: 1000,
        paymentMethodId: 'a4f1c2d3-1111-4111-8111-111111111111',
      }
      expect(entryMatchesTile(entry, fixedTile)).toBe(false)
    })

    it('returns TRUE for a custom entry matching its UUID', () => {
      const customTile = toCustomTile(makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', category: 'transfer' }))
      const entry: PaymentEntry = {
        method: 'transfer',
        amountCents: 1000,
        paymentMethodId: 'a4f1c2d3-1111-4111-8111-111111111111',
      }
      expect(entryMatchesTile(entry, customTile)).toBe(true)
    })

    it('returns FALSE for a custom entry whose UUID does not match', () => {
      const customTile = toCustomTile(makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', category: 'transfer' }))
      const entry: PaymentEntry = {
        method: 'transfer',
        amountCents: 1000,
        paymentMethodId: 'b4f1c2d3-2222-4222-8222-222222222222',
      }
      expect(entryMatchesTile(entry, customTile)).toBe(false)
    })
  })

  describe('findEntryIndex / getMethodCount / findTileForEntry', () => {
    it('returns -1 when the entry set is empty', () => {
      const tile = FIXED_METHOD_OPTIONS[0]
      expect(findEntryIndex([], tile)).toBe(-1)
      expect(getMethodCount([], tile)).toBe(0)
    })

    it('finds the index of the matching fixed entry', () => {
      const tile = FIXED_METHOD_OPTIONS.find((t) => t.value === 'transfer')!
      const entries: PaymentEntry[] = [
        { method: 'cash', amountCents: 100 },
        { method: 'transfer', amountCents: 200 },
      ]
      expect(findEntryIndex(entries, tile)).toBe(1)
      expect(getMethodCount(entries, tile)).toBe(1)
    })

    it('treats two customs of the same category as distinct (REO-PT-001)', () => {
      const tiles: ReturnType<typeof buildMergedMethodOptions> = buildMergedMethodOptions([
        makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', name: 'MP1', category: 'transfer' }),
        makeProjection({ id: 'b4f1c2d3-2222-4222-8222-222222222222', name: 'MP2', category: 'transfer' }),
      ])
      const customTile1 = tiles.find((t) => t.kind === 'custom' && t.paymentMethodId === 'a4f1c2d3-1111-4111-8111-111111111111')!
      const customTile2 = tiles.find((t) => t.kind === 'custom' && t.paymentMethodId === 'b4f1c2d3-2222-4222-8222-222222222222')!
      const entries: PaymentEntry[] = [
        { method: 'transfer', amountCents: 100, paymentMethodId: 'a4f1c2d3-1111-4111-8111-111111111111' },
      ]
      expect(findEntryIndex(entries, customTile1)).toBe(0)
      expect(findEntryIndex(entries, customTile2)).toBe(-1)
      expect(getMethodCount(entries, customTile1)).toBe(1)
      expect(getMethodCount(entries, customTile2)).toBe(0)
    })

    it('findTileForEntry returns the custom tile when paymentMethodId matches', () => {
      const tiles: ReturnType<typeof buildMergedMethodOptions> = buildMergedMethodOptions([
        makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', category: 'cash' }),
      ])
      const entry: PaymentEntry = { method: 'cash', amountCents: 100, paymentMethodId: 'a4f1c2d3-1111-4111-8111-111111111111' }
      const found = findTileForEntry(tiles, entry)
      expect(found?.paymentMethodId).toBe('a4f1c2d3-1111-4111-8111-111111111111')
    })

    it('findTileForEntry returns the fixed tile when no paymentMethodId', () => {
      const tiles = buildMergedMethodOptions([])
      const entry: PaymentEntry = { method: 'cash', amountCents: 100 }
      const found = findTileForEntry(tiles, entry)
      expect(found?.value).toBe('cash')
      expect(found?.paymentMethodId).toBeUndefined()
    })
  })

  describe('buildMergedMethodOptions (REO-PT-004 + REO-PT-003 UUID drop)', () => {
    it('returns 4 fixed tiles when projection is empty', () => {
      const tiles = buildMergedMethodOptions([])
      expect(tiles).toHaveLength(4)
      expect(tiles.every((t) => t.kind === 'fixed')).toBe(true)
    })

    it('appends custom tiles after the 4 fixed tiles (REO-PT-004)', () => {
      const tiles = buildMergedMethodOptions([
        makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', name: 'MP' }),
      ])
      expect(tiles.length).toBe(5)
      // First 4 are fixed.
      expect(tiles[0]?.kind).toBe('fixed')
      expect(tiles[3]?.kind).toBe('fixed')
      // Last is custom.
      expect(tiles[4]?.kind).toBe('custom')
      expect((tiles[4] as { paymentMethodId?: string }).paymentMethodId).toBe(
        'a4f1c2d3-1111-4111-8111-111111111111',
      )
    })

    it('drops custom tiles with non-UUID ids (REO-PT-003 UUID guard)', () => {
      const tiles = buildMergedMethodOptions([
        makeProjection({ id: 'not-a-uuid', name: 'should-be-dropped' }),
        makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', name: 'MP' }),
      ])
      expect(tiles.length).toBe(5) // 4 fixed + 1 valid custom
      const customs = tiles.filter((t) => t.kind === 'custom')
      expect(customs).toHaveLength(1)
      expect((customs[0] as { paymentMethodId?: string }).paymentMethodId).toBe(
        'a4f1c2d3-1111-4111-8111-111111111111',
      )
    })
  })

  describe('resolveEntryDisplay (REQ-CAT-005/006 parity)', () => {
    it('prefers paymentMethodName over the base label', () => {
      const tiles = buildMergedMethodOptions([
        makeProjection({ id: 'a4f1c2d3-1111-4111-8111-111111111111', name: 'Mercado Pago', subtitle: 'Link' }),
      ])
      const entry: PaymentEntry = {
        method: 'transfer',
        amountCents: 100,
        paymentMethodId: 'a4f1c2d3-1111-4111-8111-111111111111',
      }
      const display = resolveEntryDisplay(entry, tiles)
      expect(display.label).toBe('Mercado Pago')
      expect(display.subtitle).toBe('Link')
    })

    it('falls back to base label when paymentMethodName is absent (legacy row)', () => {
      const tiles = buildMergedMethodOptions([])
      const entry: PaymentEntry = { method: 'cash', amountCents: 100 }
      const display = resolveEntryDisplay(entry, tiles)
      expect(display.label).toBe('Efectivo')
      expect(display.subtitle).toBeNull()
    })

    it('trims whitespace-only subtitle and returns null', () => {
      const tiles = buildMergedMethodOptions([])
      const entry: PaymentEntry = { method: 'cash', amountCents: 100 }
      const display = resolveEntryDisplay(entry, tiles, '   ')
      expect(display.subtitle).toBeNull()
    })

    it('returns trimmed subtitle when present', () => {
      const tiles = buildMergedMethodOptions([])
      const entry: PaymentEntry = { method: 'cash', amountCents: 100 }
      const display = resolveEntryDisplay(entry, tiles, '  Link  ')
      expect(display.subtitle).toBe('Link')
    })
  })
})