import { describe, it, expect } from 'vitest'
import {
  findOverlappingTargets,
  computeOverlappingTargets,
} from '../advancedTargets.utils'
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

// ── computeOverlappingTargets ─────────────────────────────────────────────────
//
// Thin wrapper that bundles the ADVANCED-only guard + the empty-string coercion
// for buyTargetType / getTargetType. Exists so the form (PromotionForm.vue) and
// the composable (usePromotionForm) can share ONE source of truth for the
// non-blocking overlap warning, and so the rendered path is the tested path.
//
// findOverlappingTargets stays pure and unchanged — it expects already-cast
// non-empty strings (or whatever the type system has enforced upstream).

describe('computeOverlappingTargets', () => {
  it('returns [] for non-ADVANCED promotion types (warning must never surface)', () => {
    const overlaps = computeOverlappingTargets(
      'PRODUCT_DISCOUNT',
      'CATEGORIES',
      [item('cat-A')],
      'CATEGORIES',
      [item('cat-A')],
    )
    expect(overlaps).toEqual([])
  })

  it('returns [] for ORDER_DISCOUNT and BUY_X_GET_Y types even when BUY/GET sides share ids', () => {
    // Belt-and-braces — non-ADVANCED types should NEVER trigger the overlap
    // warning surface, regardless of what the form's BUY/GET state happens to
    // hold.
    for (const t of ['ORDER_DISCOUNT', 'BUY_X_GET_Y'] as const) {
      expect(
        computeOverlappingTargets(t, 'CATEGORIES', [item('x')], 'CATEGORIES', [
          item('x'),
        ]),
      ).toEqual([])
    }
  })

  it('coerces empty buyTargetType to "" and returns [] (form-not-fully-populated guard)', () => {
    // Mirrors the form's runtime state where buyTargetType is still '' while
    // the user hasn't picked anything yet. The wrapper must NOT crash and
    // must NOT report a false-positive overlap.
    const overlaps = computeOverlappingTargets(
      'ADVANCED',
      '', // buyTargetType unset
      [item('cat-A')],
      'CATEGORIES',
      [item('cat-A')],
    )
    expect(overlaps).toEqual([])
  })

  it('coerces empty getTargetType to "" and returns []', () => {
    const overlaps = computeOverlappingTargets(
      'ADVANCED',
      'CATEGORIES',
      [item('cat-A')],
      '', // getTargetType unset
      [item('cat-A')],
    )
    expect(overlaps).toEqual([])
  })

  it('delegates to findOverlappingTargets and surfaces the overlap on ADVANCED', () => {
    const overlaps = computeOverlappingTargets(
      'ADVANCED',
      'CATEGORIES',
      [item('cat-A')],
      'CATEGORIES',
      [item('cat-A')],
    )
    expect(overlaps).toEqual([
      { targetType: 'CATEGORIES', targetId: 'cat-A', buyCount: 1, getCount: 1 },
    ])
  })

  it('returns [] when BUY/GET are disjoint on ADVANCED', () => {
    const overlaps = computeOverlappingTargets(
      'ADVANCED',
      'CATEGORIES',
      [item('cat-A')],
      'CATEGORIES',
      [item('cat-B')],
    )
    expect(overlaps).toEqual([])
  })
})