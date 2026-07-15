import { describe, it, expect } from 'vitest'
import { findOverlappingTargets } from '../advancedTargets.utils'
import type { PromotionTargetItemFormEntry } from '../../interfaces/promotion.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(targetId: string): PromotionTargetItemFormEntry {
  return { targetId, name: '' }
}

// ── findOverlappingTargets ────────────────────────────────────────────────────

describe('findOverlappingTargets', () => {
  it('detects overlap when the same {targetType, targetId} appears on both BUY and GET', () => {
    const buy = [item('cat-A')]
    const get = [item('cat-A')]
    const overlaps = findOverlappingTargets('CATEGORIES', buy, 'CATEGORIES', get)
    expect(overlaps).toEqual([
      { targetType: 'CATEGORIES', targetId: 'cat-A', buyCount: 1, getCount: 1 },
    ])
  })

  it('returns empty array when BUY and GET are disjoint on the same targetType', () => {
    const buy = [item('cat-A'), item('cat-B')]
    const get = [item('cat-C')]
    const overlaps = findOverlappingTargets('CATEGORIES', buy, 'CATEGORIES', get)
    expect(overlaps).toEqual([])
  })

  it('returns empty array when BUY and GET are disjoint on different targetTypes', () => {
    // Same id but different targetType → not the same "target", no overlap.
    const buy = [item('p1')]
    const get = [item('p1')]
    const overlaps = findOverlappingTargets('PRODUCTS', buy, 'VARIANTS', get)
    expect(overlaps).toEqual([])
  })

  it('returns empty array when BUY is empty', () => {
    const get = [item('cat-A')]
    const overlaps = findOverlappingTargets('CATEGORIES', [], 'CATEGORIES', get)
    expect(overlaps).toEqual([])
  })

  it('returns empty array when GET is empty', () => {
    const buy = [item('cat-A')]
    const overlaps = findOverlappingTargets('CATEGORIES', buy, 'CATEGORIES', [])
    expect(overlaps).toEqual([])
  })

  it('returns empty array when both sides are empty', () => {
    const overlaps = findOverlappingTargets('CATEGORIES', [], 'CATEGORIES', [])
    expect(overlaps).toEqual([])
  })

  it('detects overlap on VARIANTS (targetId alone is the join key per targetType)', () => {
    const buy = [item('v-1', )]
    const get = [item('v-1')]
    const overlaps = findOverlappingTargets('VARIANTS', buy, 'VARIANTS', get)
    expect(overlaps).toEqual([
      { targetType: 'VARIANTS', targetId: 'v-1', buyCount: 1, getCount: 1 },
    ])
  })

  it('detects overlap on BRANDS', () => {
    const buy = [item('brand-X')]
    const get = [item('brand-X')]
    const overlaps = findOverlappingTargets('BRANDS', buy, 'BRANDS', get)
    expect(overlaps).toEqual([
      { targetType: 'BRANDS', targetId: 'brand-X', buyCount: 1, getCount: 1 },
    ])
  })

  it('counts duplicates: two BUY copies + one GET copy of the same id', () => {
    const buy = [item('p1'), item('p1')]
    const get = [item('p1')]
    const overlaps = findOverlappingTargets('PRODUCTS', buy, 'PRODUCTS', get)
    expect(overlaps).toEqual([
      { targetType: 'PRODUCTS', targetId: 'p1', buyCount: 2, getCount: 1 },
    ])
  })

  it('returns multiple overlap entries when disjoint pairs exist', () => {
    const buy = [item('cat-A'), item('cat-B')]
    const get = [item('cat-A'), item('cat-C'), item('cat-B')]
    const overlaps = findOverlappingTargets('CATEGORIES', buy, 'CATEGORIES', get)
    expect(overlaps).toEqual([
      { targetType: 'CATEGORIES', targetId: 'cat-A', buyCount: 1, getCount: 1 },
      { targetType: 'CATEGORIES', targetId: 'cat-B', buyCount: 1, getCount: 1 },
    ])
  })

  it('is purely deterministic — same inputs → same output, no mutation', () => {
    const buy = [item('cat-A')]
    const get = [item('cat-A')]
    const a = findOverlappingTargets('CATEGORIES', buy, 'CATEGORIES', get)
    const b = findOverlappingTargets('CATEGORIES', buy, 'CATEGORIES', get)
    expect(a).toEqual(b)
    // No mutation of inputs
    expect(buy).toEqual([item('cat-A')])
    expect(get).toEqual([item('cat-A')])
  })
})