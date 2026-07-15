// bxgy-promotion-followups REQ-6 — pure singular/plural BXGY hint builder.
//
// Extracted into a pure function (Extract-Before-Mock) so the singular/plural
// branch is unit-testable WITHOUT mounting the accordion. The accordion
// template just renders the returned string under the row title.
//
// The "2x1 ·" prefix is a STATIC literal per spec REQ-6. Deriving it from
// buy/getQuantity risks a label mismatch with the spec ("2x1 · ..." is fixed
// copy for the BXGY family of promotions).

import type { SaleRewardKind } from '../interfaces/sale.types'

export function buildBxgyHint(unitsNeeded: number): string {
  const noun = unitsNeeded === 1 ? 'unidad' : 'unidades'
  return `2x1 · requiere ${unitsNeeded} ${noun} más`
}

// advanced-promotion-type WU-B — single source of truth for the reward-badge
// label rule. Pure (Extract-Before-Mock) so the rule is unit-testable without
// mounting `SaleItemBadges`.
//
// Percent matrix (spec WU-B REQ-2):
//   null / undefined    -> null                  (no badge)
//   'buy_x_get_y'       -> BXGY rule (preserved)
//   'advanced'          -> 100 -> 'GRATIS'; 0<pct<100 -> `-${pct}%`; else null
//   any other non-null  -> 'Recompensa'           (MANDATORY generic fallback)
//
// The generic fallback is MANDATORY in the helper (not in the component) so
// future reward families the backend may add never break the surrounding
// line rendering. The helper MUST never throw.
export function getRewardBadgeLabel(
  rewardKind: SaleRewardKind | undefined,
  rewardDiscountPercent: number | null | undefined,
): string | null {
  if (rewardKind == null) return null

  if (rewardKind === 'buy_x_get_y' || rewardKind === 'advanced') {
    if (rewardDiscountPercent === 100) return 'GRATIS'
    if (rewardDiscountPercent != null && rewardDiscountPercent > 0) {
      return `-${rewardDiscountPercent}%`
    }
    return null
  }

  // Mandatory generic fallback for any unknown non-null rewardKind.
  // Stable Spanish label per spec WU-B.
  return 'Recompensa'
}
