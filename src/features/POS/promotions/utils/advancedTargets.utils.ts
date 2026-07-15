import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../interfaces/promotion.types'

/**
 * Pure helper — ADVANCED promotion disjoint BUY∩GET target check.
 *
 * Returns the list of `{targetType, targetId}` pairs that appear on BOTH the
 * BUY side and the GET side of an ADVANCED promotion. The overlap counts how
 * many times each pair appears on each side (so a duplicate id is reflected).
 *
 * Design decision (advanced-promotion-type): the form warns the user BEFORE
 * submit (via `computed overlappingTargets` in `usePromotionForm`) but does
 * NOT block submit. Backend `advanced_overlapping_targets` is the
 * authoritative gate.
 *
 * Why a pure helper instead of `zod.superRefine`?
 *   - `superRefine` calls `addIssue` which BLOCKS submit. R-D mandates
 *     non-blocking.
 *   - The helper is also independently testable without mounting the form.
 *
 * The function:
 *   - is deterministic (same inputs → same outputs)
 *   - does NOT mutate its inputs
 *   - returns an empty array when either side is empty (no overlap possible)
 *   - treats different targetTypes on the same id as NOT overlapping
 *     (a PRODUCTS id 'p1' is a different "target" than a VARIANTS id 'p1')
 *   - never throws on null/empty inputs
 */
export interface OverlappingTarget {
  targetType: PromotionTargetType
  targetId: string
  buyCount: number
  getCount: number
}

function countById(items: PromotionTargetItemFormEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const it of items) {
    counts.set(it.targetId, (counts.get(it.targetId) ?? 0) + 1)
  }
  return counts
}

export function findOverlappingTargets(
  buyType: PromotionTargetType,
  buyItems: PromotionTargetItemFormEntry[],
  getType: PromotionTargetType,
  getItems: PromotionTargetItemFormEntry[],
): OverlappingTarget[] {
  if (buyType !== getType) return []
  if (buyItems.length === 0 || getItems.length === 0) return []

  const buyCounts = countById(buyItems)
  const getCounts = countById(getItems)
  const overlaps: OverlappingTarget[] = []

  for (const [targetId, buyCount] of buyCounts.entries()) {
    const getCount = getCounts.get(targetId)
    if (getCount != null) {
      overlaps.push({ targetType: buyType, targetId, buyCount, getCount })
    }
  }

  return overlaps
}