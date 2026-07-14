# Design: bxgy-reward-badge-label

## Technical Approach

Extract the reward-label rule into a pure helper (Extract-Before-Mock), add an
optional `rewardDiscountPercent` field mirroring `rewardKind` on both sale-line
types, and drive `SaleItemBadges` from the helper instead of a hardcoded string.
Both parent surfaces forward the new prop. No new components, composables, tones,
icons, or testids. Implements REQ-2/REQ-3 (MODIFIED) and REQ-9/REQ-10/REQ-11
(ADDED).

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Helper location | `getRewardBadgeLabel` in existing `src/features/POS/sales/utils/promotion.utils.ts` (next to `buildBxgyHint`) | Reuses the established BXGY pure-helper home; no new file; Extract-Before-Mock lets the 4-case rule be unit-tested without mounting. |
| Helper vs composable | Plain pure function, no reactivity | Input is two scalars, output a string/null. A composable would add ceremony with zero benefit (spec REQ-10 mandates in-module pure helper). |
| Percent formatting | Trust backend integer, render `-${pct}%` verbatim | Presets are `{50,100}`; ADVANCED is `0..100` integer. No clamp/round — the backend owns `getDiscountPercent`. Clamping would mask backend bugs. |
| `100` handling | Strict `=== 100 → 'GRATIS'` before the generic branch | Free is the special case; ordering guarantees `100` never falls into `-100%`. |
| Field shape | `rewardDiscountPercent?: number \| null` on BOTH types, adjacent to `rewardKind` | Mirrors `rewardKind` exactly so the two surfaces never drift (REQ-9). |

## Helper Contract

```ts
// promotion.utils.ts
export function getRewardBadgeLabel(
  rewardKind: 'buy_x_get_y' | null | undefined,
  rewardDiscountPercent: number | null | undefined,
): string | null {
  if (rewardKind !== 'buy_x_get_y') return null
  if (rewardDiscountPercent === 100) return 'GRATIS'
  if (rewardDiscountPercent != null) return `-${rewardDiscountPercent}%`
  return null // BXGY but null percent → pre-deploy defensive, never assume free
}
```

## Data Flow

```
sale.api (passthrough) ──→ item.rewardDiscountPercent
      │
   SaleItemRow (:reward-discount-percent)  ─┐
   SaleDetailItemsList (:reward-discount-percent) ─┤
                                                   ▼
                              SaleItemBadges (defineProps)
                                   │  rewardBadgeLabel = computed(
                                   │     getRewardBadgeLabel(rewardKind, pct))
                                   ▼
                 <AppBadge v-if="rewardBadgeLabel != null" :label="rewardBadgeLabel">
```

## File Changes

| File | Action | Change |
|------|--------|--------|
| `utils/promotion.utils.ts` | Modify | Add `getRewardBadgeLabel` |
| `interfaces/sale.types.ts` | Modify | Add `rewardDiscountPercent?: number \| null` after `rewardKind` on `SaleDetailItem` (~L79) and `SaleItem` (~L304) |
| `components/SaleItemBadges.vue` | Modify | Add `rewardDiscountPercent?: number \| null` to defineProps (~L37); replace `isReward` (L84) with `rewardBadgeLabel` computed calling helper; `hasAnyBadge` (L86-92) uses `rewardBadgeLabel != null`; badge (L157-163) `v-if="rewardBadgeLabel != null"` + `:label="rewardBadgeLabel"` (drop literal `label="GRATIS"`); keep tone `success` + `i-lucide-gift` + testid |
| `components/SaleItemRow.vue` | Modify | Add `:reward-discount-percent="item.rewardDiscountPercent"` after L218 |
| `components/SaleDetailItemsList.vue` | Modify | Add `:reward-discount-percent="item.rewardDiscountPercent"` after L95 |

## Testing Strategy (RED-first, `pnpm test:unit`, co-located)

| Test file | Additions/Edits |
|-----------|-----------------|
| `utils/__tests__/promotion.utils.test.ts` | ADD 4-case suite for `getRewardBadgeLabel`: non-BXGY→null, 100→'GRATIS', 50→'-50%', BXGY+null→null; edge: undefined kind→null, 0→'-0%', omitted percent→null |
| `components/__tests__/SaleItemBadges.test.ts` | **BREAKS L154** "renders GRATIS when rewardKind===buy_x_get_y" — must add `rewardDiscountPercent: 100`. ADD: 50→'-50%' visible & not 'GRATIS'; BXGY+null→no badge; tone/icon parity between 100 and 50 |
| `components/__tests__/SaleDetailItemsList.test.ts` | **BREAKS L276** (mounts real badge, asserts GRATIS text) — add `rewardDiscountPercent: 100` to item L288. ADD: 50→'-50%'; null→no badge; forwards `reward-discount-percent` |
| `components/__tests__/SaleItemRow.test.ts` | L468 checks `badges.props('rewardKind')` (shallow, won't break) — EXTEND: add `rewardDiscountPercent: 100` to item L485 and assert `badges.props('rewardDiscountPercent')` on reward/absent cases |
| `interfaces/__tests__/sale.types.test.ts` | ADD parse/backward-compat literals: concrete percent, null, omitted — for BOTH `SaleItem` (~L1017) and `SaleDetailItem` (~L1231) |

## Migration / Rollout

No migration. Field is additive + nullable; pre-deploy payloads (field absent)
resolve to `null → no badge`. Rollback = revert the 5 edits; hardcoded GRATIS
returns.

## Slices

**ONE slice / single work-unit commit** (~120-160 LOC incl. tests). Types +
helper + wiring + tests are tightly coupled around one behavior; splitting types
from wiring would land a red build between commits. `pnpm build` is the gate.

## Open Questions

- None. Contract, helper cases, and breaking tests are all settled.
