import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../interfaces/promotion.types'

/**
 * Build the display label for a promotion target chip.
 *
 * Invariants (REQ-3 + INV-1, INV-3):
 *   - When the entry carries both `productName` and `name` (variant entries
 *     created in this session), render `"{productName} · {name}"` so chips
 *     across multiple products stay distinguishable.
 *   - Otherwise fall back to `name || targetId` so other target types render
 *     unchanged and unresolvable entries never show a stray `· ` separator.
 *   - This util is read-only; it MUST NOT mutate the entry and MUST NOT leak
 *     `productId` / `productName` into the serialized payload (those stay
 *     session-only and are stripped by `toCreatePayload` / `toUpdatePayload`).
 *
 * The `type` argument is reserved for future type-specific formatting (e.g.
 * per-type icons or suffixes). Today it does not affect the output and is
 * optional to keep existing call sites cheap.
 */
export function chipLabel(
  item: PromotionTargetItemFormEntry,
  _type?: PromotionTargetType,
): string {
  if (item.productName && item.name) return `${item.productName} · ${item.name}`
  return item.name || item.targetId
}
