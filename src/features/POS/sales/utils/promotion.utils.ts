// bxgy-promotion-followups REQ-6 — pure singular/plural BXGY hint builder.
//
// Extracted into a pure function (Extract-Before-Mock) so the singular/plural
// branch is unit-testable WITHOUT mounting the accordion. The accordion
// template just renders the returned string under the row title.
//
// The "2x1 ·" prefix is a STATIC literal per spec REQ-6. Deriving it from
// buy/getQuantity risks a label mismatch with the spec ("2x1 · ..." is fixed
// copy for the BXGY family of promotions).
export function buildBxgyHint(unitsNeeded: number): string {
  const noun = unitsNeeded === 1 ? 'unidad' : 'unidades'
  return `2x1 · requiere ${unitsNeeded} ${noun} más`
}

export function getRewardBadgeLabel(
  rewardKind: 'buy_x_get_y' | null | undefined,
  rewardDiscountPercent: number | null | undefined,
): string | null {
  if (rewardKind !== 'buy_x_get_y') return null
  if (rewardDiscountPercent === 100) return 'GRATIS'
  if (rewardDiscountPercent != null && rewardDiscountPercent > 0) {
    return `-${rewardDiscountPercent}%`
  }
  return null
}
