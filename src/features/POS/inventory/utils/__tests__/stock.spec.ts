import { describe, expect, it } from 'vitest'
import type { StockSnapshot } from '../../interfaces/inventory.types'
import { adjustmentTargetFor, bucketKind, bucketRows, formatExpirationDate, kardexFilters, untrackedLabel } from '../stock'

const withLots: StockSnapshot = {
  product: { id: 'p1', name: 'Croquetas Adulto 15 kg', useStock: true, quantity: 72, untracked: { quantity: 12, version: 1 }, sellable: 64 },
  lots: [
    { id: 'l1', lotNumber: 'L-2026-08', expirationDate: '2026-10-15', quantity: 8, expired: true, version: 1 },
    { id: 'l2', lotNumber: 'L-2027-01', expirationDate: '2027-01-15', quantity: 22, expired: false, version: 2 },
  ],
  variants: [],
}
const withVariants: StockSnapshot = {
  product: { id: 'p2', name: 'Collar ajustable', useStock: true, quantity: 24, untracked: { quantity: 0, version: 0 }, sellable: 24 },
  lots: [],
  variants: [{ id: 'v1', label: 'Chico · Azul', quantity: 15, version: 1 }, { id: 'v2', label: 'Mediano · Rojo', quantity: 9, version: 1 }],
}

describe('formatExpirationDate', () => {
  it('formats the calendar date without shifting the day across time zones', () => {
    expect(formatExpirationDate('2026-10-15')).toBe('15 oct 2026')
    expect(formatExpirationDate('2027-01-01')).toBe('1 ene 2027')
  })
  it('reads «—» when there is no date or it is not a calendar date', () => {
    expect(formatExpirationDate(null)).toBe('—')
    expect(formatExpirationDate('')).toBe('—')
    expect(formatExpirationDate('pronto')).toBe('—')
  })
})

describe('bucketRows', () => {
  it('lists the untracked bucket first, then the lots in the server (FEFO) order', () => {
    expect(bucketRows(withLots).map(row => [row.kind, row.label, row.quantity, row.version, row.expired])).toEqual([
      ['untracked', 'Sin lote', 12, 1, false],
      ['lot', 'Lote L-2026-08', 8, 1, true],
      ['lot', 'Lote L-2027-01', 22, 2, false],
    ])
    expect(bucketRows(withLots)[1]).toMatchObject({ id: 'l1', expiration: '15 oct 2026' })
  })
  it('lists only the variants for a product with variants', () => {
    expect(bucketRows(withVariants).map(row => [row.kind, row.label, row.quantity])).toEqual([
      ['variant', 'Chico · Azul', 15], ['variant', 'Mediano · Rojo', 9],
    ])
  })
  // A product with neither lots nor variants has one bucket, its whole stock: «Sin lote» only
  // means something next to lots.
  it('names the one bucket of a plain product «Existencias»', () => {
    const plain = { ...withLots, lots: [] }
    expect(bucketRows(plain).map(row => [row.kind, row.label, row.quantity])).toEqual([['untracked', 'Existencias', 12]])
    expect(adjustmentTargetFor(plain, bucketRows(plain)[0]!)).toMatchObject({ bucketLabel: 'Existencias' })
  })
  it('tells what the buckets are and how the untracked one is named', () => {
    expect([bucketKind(withLots), untrackedLabel(withLots)]).toEqual(['lot', 'Sin lote'])
    expect(bucketKind(withVariants)).toBe('variant')
    expect([bucketKind({ ...withLots, lots: [] }), untrackedLabel({ ...withLots, lots: [] })]).toEqual(['product', 'Existencias'])
  })
  it('lists nothing for a product that does not track stock', () => {
    expect(bucketRows({ ...withLots, product: { ...withLots.product, useStock: false, sellable: null } })).toEqual([])
  })
})

describe('adjustmentTargetFor', () => {
  it('builds the dialog target for each bucket kind from the current stock', () => {
    const [untracked, lot] = bucketRows(withLots)
    expect(adjustmentTargetFor(withLots, untracked!)).toEqual({
      productId: 'p1', productName: 'Croquetas Adulto 15 kg', bucketLabel: 'Sin lote', quantity: 12, version: 1,
    })
    expect(adjustmentTargetFor(withLots, lot!)).toEqual({
      productId: 'p1', productName: 'Croquetas Adulto 15 kg', lotId: 'l1', bucketLabel: 'Lote L-2026-08', quantity: 8, version: 1,
    })
    expect(adjustmentTargetFor(withVariants, bucketRows(withVariants)[0]!)).toEqual({
      productId: 'p2', productName: 'Collar ajustable', variantId: 'v1', bucketLabel: 'Chico · Azul', quantity: 15, version: 1,
    })
  })
  it('follows a reload: the same bucket carries the new quantity and version', () => {
    const [, lot] = bucketRows(withLots)
    const reloaded = { ...withLots, lots: [{ ...withLots.lots[0]!, quantity: 5, version: 4 }, withLots.lots[1]!] }
    expect(adjustmentTargetFor(reloaded, lot!)).toMatchObject({ lotId: 'l1', quantity: 5, version: 4 })
  })
  it('is null when the bucket no longer exists', () => {
    const [, lot] = bucketRows(withLots)
    expect(adjustmentTargetFor({ ...withLots, lots: [] }, lot!)).toBeNull()
  })
})

describe('kardexFilters', () => {
  it('offers one chip per lot, or per variant, and none for untracked stock', () => {
    expect(kardexFilters(withLots)).toEqual([
      { kind: 'lot', id: 'l1', label: 'Lote L-2026-08' }, { kind: 'lot', id: 'l2', label: 'Lote L-2027-01' },
    ])
    expect(kardexFilters(withVariants)).toEqual([
      { kind: 'variant', id: 'v1', label: 'Chico · Azul' }, { kind: 'variant', id: 'v2', label: 'Mediano · Rojo' },
    ])
    expect(kardexFilters({ ...withLots, lots: [] })).toEqual([])
  })
})
