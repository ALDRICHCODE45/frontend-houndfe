# Exploration: bxgy-promotion-followups

Two frontend-only follow-ups to the merged `buy-x-get-y-promotion` change. Backend
contracts already shipped. Scope is fixed to the two slices below — no scope beyond them.

## Current State

The BXGY promo work is merged. The applicable-promotions accordion and the
confirmed-sale detail list already exist and are fully tested. Both slices are small
type + template deltas that light up backend fields the UI does not yet consume.

Data flow for the accordion (Slice 1):
`SalesView.vue` → `ActiveSalePanel.vue` → `PromocionesDisponiblesAccordion.vue`,
fed by `useApplicablePromotions` → `saleApi.listApplicablePromotions`. The API method
is a **pure passthrough** (`sale.api.ts:229-234`, `return data`) — no field mapping —
so any new `ApplicablePromotion` fields flow to the component automatically once the
type is extended. No composable/API change required.

Data flow for the confirmed line (Slice 2):
`SaleDetailView` → `SaleDetailItemsList.vue` → `SaleItemBadges.vue`.

## Claim-by-Claim Verification (live code)

| Claim in scope | Verdict | Evidence |
|---|---|---|
| `ApplicablePromotion` at ~line 374 | ❌ DRIFT — it's at **line 390** | `sale.types.ts:390`. Line 374 is a comment inside the `Sale` interface. |
| `ApplicablePromotion` shape today | ✅ `{ id, title, type }` only | `sale.types.ts:390-394`; type union already includes `'BUY_X_GET_Y'`. |
| `SaleDetailItem` at ~line 56 | ✅ EXACT — line **56** | `sale.types.ts:56-80`. |
| `SaleDetailItem` lacks `promotionId` today | ✅ confirmed, needs adding | `sale.types.ts:56-80` — has `discountTitle`, `rewardKind`, but no `promotionId`. |
| Accordion renders rows + wires Aplicar | ✅ confirmed | `PromocionesDisponiblesAccordion.vue:143-174`; Aplicar `UButton` at 155-163 emits `apply`. No `disabled` binding today. |
| `SaleDetailItemsList` passes props to `SaleItemBadges` | ✅ but **does NOT pass `promotion-id`** | `SaleDetailItemsList.vue:86-96` passes discountTitle/rewardKind/etc., NOT `promotion-id`. So confirmed-line promo chip never renders today — Slice 2 is correctly scoped. |
| `SaleItemBadges` already supports promo chip gated on `promotionId != null` + `removable` | ✅ CONFIRMED — no change needed | Component: `hasPromotion` (`SaleItemBadges.vue:82`), chip block gated `v-if="hasPromotion"` (114), remove button gated `v-if="removable"` (132). Tests already prove both paths: `SaleItemBadges.test.ts:110-128` (chip renders, remove button absent when `removable` omitted). |
| Test files exist | ✅ all present | `interfaces/__tests__/sale.types.test.ts`, `components/__tests__/PromocionesDisponiblesAccordion.test.ts`, `components/__tests__/SaleDetailItemsList.test.ts`, `components/__tests__/SaleItemBadges.test.ts`. |

## Drift & Gotchas (flagged for spec/design)

1. **Line-number drift**: `ApplicablePromotion` is at **390**, not 374. `SaleDetailItem`
   at 56 is exact. Update task line refs before apply.
2. **New `ApplicablePromotion` fields must be OPTIONAL (`?`), not required.** Every
   existing fixture that constructs an `ApplicablePromotion` omits these fields:
   `PromocionesDisponiblesAccordion.test.ts:24-29` (`makePromotions`), `sale.types.test.ts`
   (3 builders at 1143/1154/1166 + response at 1228-1256), `useApplicablePromotions.test.ts`,
   `sale.api.test.ts`. Making the fields required would break all of them and violate the
   repo's established backward-compat convention (all promo fields are optional+nullable,
   see `SaleDetailItem.rewardKind` comment at `sale.types.ts:75-79`). Non-BXGY promos
   (PRODUCT_DISCOUNT/ORDER_DISCOUNT) will not carry meaningful eligibility values.
   **Design decision for the spec**: `eligible?: boolean`, `buyQuantity?: number | null`,
   `getQuantity?: number | null`, `unitsNeeded?: number`, `method?: 'MANUAL'`.
3. **Accordion "disable when ineligible" needs a data-testid for the hint.** Current rows
   have `promo-title-${id}` and `promo-apply-${id}` but no hint element. RED test will need
   a new stable testid (e.g. `promo-hint-${id}`) and the Aplicar `UButton` will need a
   `:disabled="!eligible"` binding (currently unconditional).
4. **Hint copy is Spanish** (matches existing POS UI language: "Promociones disponibles",
   "Aplicar", "Quitar"). Hint format: `2x1 · requiere N unidad(es) más`. The "2x1" label
   derives from `buyQuantity`/`getQuantity` — decide in design whether to compute `NxM`
   from those fields or reuse `title`.
5. **Slice 2 has zero change in `SaleItemBadges.vue`** — verified against both code and
   the already-passing tests. Only two edits: add `promotionId?` to `SaleDetailItem` type
   and add `:promotion-id="item.promotionId"` in `SaleDetailItemsList.vue:86-96`.

## RED-First Test Surfaces

### Slice 1 — F-1 eligibility UX
- `interfaces/__tests__/sale.types.test.ts` → extend the `ApplicablePromotion type` describe
  (~line 1141): assert the 5 new fields accept values, accept null (buy/getQuantity), and
  are omittable for backward compat.
- `components/__tests__/PromocionesDisponiblesAccordion.test.ts`:
  - ineligible BXGY promo (`eligible:false`, `unitsNeeded:N`) → Aplicar button `disabled`
    AND hint `requiere N unidad(es) más` rendered (new `promo-hint-${id}` testid).
  - eligible promo → Aplicar enabled, no hint.
  - Update `makePromotions()` fixture to carry eligibility fields.

### Slice 2 — F-2 promo name/id on confirmed line
- `interfaces/__tests__/sale.types.test.ts` → new describe for `SaleDetailItem.promotionId`:
  accepts string, accepts null, omittable for backward compat (mirror the existing
  `SaleItem.promotionId` cases at 968-1015).
- `components/__tests__/SaleDetailItemsList.test.ts` → item with `promotionId` + `discountTitle`
  renders `sale-item-promo-badge` (with title) and NO `sale-item-remove-promo` (confirmed-sale
  has no removable). This is the integration proof the prop is now forwarded.
- `SaleItemBadges.test.ts` → **no new test** (chip + gating already covered). Verify only.

## Affected Files

- `src/features/POS/sales/interfaces/sale.types.ts` — extend `ApplicablePromotion` (L390),
  add `promotionId?` to `SaleDetailItem` (L56).
- `src/features/POS/sales/components/PromocionesDisponiblesAccordion.vue` — hint + disable Aplicar.
- `src/features/POS/sales/components/SaleDetailItemsList.vue` — forward `:promotion-id` (L86-96).
- Tests: `sale.types.test.ts`, `PromocionesDisponiblesAccordion.test.ts`, `SaleDetailItemsList.test.ts`.
- NO change: `SaleItemBadges.vue`, `sale.api.ts`, `useApplicablePromotions.ts`, `ActiveSalePanel.vue`
  (props passthrough only).

## Recommendation

Proceed. Both slices are low-risk, TDD-friendly type+template deltas. Make the 5 new
`ApplicablePromotion` fields optional to preserve backward compat. Two independent work
units (one per slice); Slice 2 is nearly trivial (2 edits, 2 test additions).

## Ready for Proposal

Yes. Recommend the orchestrator advance to `sdd-propose` with the 5-optional-fields
decision and the `promo-hint-${id}` testid noted as design inputs.
