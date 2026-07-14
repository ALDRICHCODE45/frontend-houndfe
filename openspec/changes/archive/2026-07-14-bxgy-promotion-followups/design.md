# Design: BXGY Promotion Follow-ups (F-1 + F-2)

## Technical Approach

Surgical, frontend-only alignment. Two type deltas + template bindings light up
backend fields the UI already receives (API is pure passthrough, `sale.api.ts:229-234`).
One pure, unit-testable helper carries the singular/plural hint logic (Extract-Before-Mock).
No composable, API, or `SaleItemBadges.vue` change. Two independent slices, one work-unit
commit each, both far under 400 lines.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| New field cardinality | All 5 `ApplicablePromotion` fields + `promotionId` are OPTIONAL (`?`); numeric pairs nullable | Every existing fixture omits them; matches `SaleDetailItem.rewardKind` precedent (L75-79). Required would break 5+ fixtures. |
| Disable gate | `:disabled="promo.eligible === false"` (strict), NOT `!eligible` | **DRIFT**: spec REQ-5 prints `!eligible`, but `!undefined === true` would disable legacy rows. Its own scenario demands undefined stays ENABLED. Only `false` disables. |
| Gate genericity | Branch on `eligible`, never on `promo.type` | Any future ineligible promo type disables cleanly; BXGY-specific hint is gated separately on `unitsNeeded`. |
| Hint "2x1 ·" prefix | STATIC literal in the helper | Spec REQ-6 hardcodes `"2x1 · ..."`. Deriving from buy/getQuantity risks mismatching the spec string. Keep simple. |
| Plural logic location | Pure helper `buildBxgyHint()` in `utils/promotion.utils.ts`, called inline in the row `v-for` | Per vue skill + Extract-Before-Mock: pure fn is unit-testable without mounting; template stays declarative. |

## File Changes

| File | Action | Description |
|---|---|---|
| `interfaces/sale.types.ts` | Modify | `ApplicablePromotion` (L390) +5 fields; `SaleDetailItem` (L56) +`promotionId?` |
| `components/PromocionesDisponiblesAccordion.vue` | Modify | Import helper; wrap title+hint in a column; `:disabled` on Aplicar; `promo-hint-${id}` |
| `components/SaleDetailItemsList.vue` | Modify | Add `:promotion-id="item.promotionId"` after L95 |
| `utils/promotion.utils.ts` | Create | Pure `buildBxgyHint(unitsNeeded)` helper |
| `components/SaleItemBadges.vue` | None | No change — verified below |

## Interfaces / Contracts

`ApplicablePromotion` (L390-394) gains, after `type`:

```ts
  eligible?: boolean
  buyQuantity?: number | null
  getQuantity?: number | null
  unitsNeeded?: number
  method?: 'MANUAL'
```

`SaleDetailItem` (after L79 `rewardKind?`):

```ts
  promotionId?: string | null
```

Pure helper (`utils/promotion.utils.ts`):

```ts
export function buildBxgyHint(unitsNeeded: number): string {
  const noun = unitsNeeded === 1 ? 'unidad' : 'unidades'
  return `2x1 · requiere ${unitsNeeded} ${noun} más`
}
```

Accordion row (replace title span L150-153 with a column; add hint + `:disabled`):

```vue
<div class="flex-1 min-w-0 flex flex-col">
  <span :data-testid="`promo-title-${promo.id}`" class="text-sm truncate">{{ promo.title }}</span>
  <span
    v-if="promo.unitsNeeded != null"
    :data-testid="`promo-hint-${promo.id}`"
    class="text-xs text-muted"
  >{{ buildBxgyHint(promo.unitsNeeded) }}</span>
</div>
<UButton
  v-if="!isApplied(promo.id)"
  :data-testid="`promo-apply-${promo.id}`"
  :disabled="promo.eligible === false"
  ... @click="handleApply(promo.id)" />
```

`SaleDetailItemsList.vue` — after L95 `:reward-kind="item.rewardKind"`:

```vue
  :promotion-id="item.promotionId"
```

(`item` is spread from `itemsView`, so `item.promotionId` is present.)

## SaleItemBadges.vue — No Change (Evidence)

Prop `promotionId?: string | null` already declared (L35). Chip gate
`hasPromotion = props.promotionId != null` (L82); chip block `v-if="hasPromotion"`
(L114); title uses `discountTitle` else "Promoción" (L118-130); remove button gated
`v-if="removable"` (L132, default `false`, L40). Confirmed-sale forwards no `removable`,
so chip renders and remove button does not — exactly REQ-8. No edit needed.

## Testing Strategy (RED-first, Strict TDD ACTIVE)

Runner `pnpm test:unit` (vitest); authoritative gate `pnpm build`; tests co-located in `__tests__/`.

| File | Cases | Req |
|---|---|---|
| `utils/__tests__/promotion.utils.test.ts` (new) | N=1 → "…1 unidad más"; N=2 → "…2 unidades más" | REQ-6 |
| `interfaces/__tests__/sale.types.test.ts` | 5 fields accept values; buy/getQuantity accept null; all omittable; `promotionId` string/null/omit | REQ-4, REQ-7 |
| `components/__tests__/PromocionesDisponiblesAccordion.test.ts` | `eligible:false` → Aplicar disabled, no `apply` emit; `eligible:true` enabled; omit → enabled; `unitsNeeded:1/2` → hint text; absent → no `promo-hint` | REQ-5, REQ-6 |
| `components/__tests__/SaleDetailItemsList.test.ts` | `promotionId`+`discountTitle` → `promotion-id` forwarded, `sale-item-promo-badge` visible, no `sale-item-remove-promo`; empty `discountTitle` → no chip | REQ-8 |
| `components/__tests__/SaleItemBadges.test.ts` | Verify-only, no new test | REQ-8 |

## Migration / Rollout

No migration required. Every field is additive/optional; existing promotions render
identically (all new fields default `undefined`). Rollback = revert edits.

## Slice Boundaries (2 work-unit commits)

- **F-1 — eligibility UX**: `ApplicablePromotion` +5 fields, `promotion.utils.ts` helper,
  accordion `:disabled` + hint, types + helper + accordion tests. ~180 lines.
- **F-2 — promotion id on confirmed line**: `SaleDetailItem.promotionId`, list `:promotion-id`
  binding, types + list tests. ~60 lines.

Slices are independent (different types/components); either can land first.

## Open Questions

None. Drift (disable gate = `=== false`) resolved in Decisions.
