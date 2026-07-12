# Proposal: Variant-Level Promotion Targeting

## Intent

Backend now accepts `VARIANTS` in `targetType` / `appliesTo`: a `PRODUCT_DISCOUNT` can target one or more product variants directly. The frontend radio stops at `PRODUCTS` and sends `targetType: 'PRODUCTS'`, which the backend re-interprets as "all variants of that product". We add the UI branch so a merchant can create / edit a variant-scoped `PRODUCT_DISCOUNT`, see resolved variant names on chips, and get a clear Spanish error when the backend rejects a variant id (`INVALID_TARGET`). Precedence (variant > product) stays **backend-owned**; the frontend only reflects what the draft returns.

## Scope

### In Scope
- Widen `PromotionTargetType` to include `'VARIANTS'`.
- Add `VARIANTS` to `TARGET_TYPE_OPTIONS` for `PRODUCT_DISCOUNT` only.
- Two-step product → variant selector; product search filtered to `hasVariants === true`.
- Multi-variant selection across products.
- `VARIANTS` case in `usePromotionTargetNames.resolveTargetNames` (edit-mode chip hydration).
- Map backend `INVALID_TARGET` (HTTP 400) → Spanish: "La variante seleccionada no existe o no pertenece a tu comercio".
- Extend existing tests; `pnpm test:unit` + `pnpm build` green.

### Out of Scope
- Variant targeting for `BUY_X_GET_Y` / `ADVANCED` (backend only documented for `PRODUCT_DISCOUNT`).
- `CATEGORIES` / `BRANDS` in POS engine — enum-only today.
- POS-side discount math; backend precedence logic; any backend change.

## Capabilities

### New Capabilities
- `promotions`: the POS admin promotion CRUD UI — form composition for `PRODUCT_DISCOUNT` / `ORDER_DISCOUNT` / `BUY_X_GET_Y` / `ADVANCED`, target-type selection (categories / brands / products / variants), target-item catalog lookups, create/update payload mapping, edit-mode name hydration, server error mapping. This slice adds the `VARIANTS` branch.

### Modified Capabilities
None. No prior `promotions` spec in `openspec/specs/` to amend; the branch is folded into the new spec at the spec phase.

## Approach

Composition API + `<script setup lang="ts">`; reuse existing form / composable / API architecture. Widening the `PromotionTargetType` union is the single source-of-truth change — `CreateProductDiscountPayload` is already generic over the enum, and `toCreatePayload` already maps `state.targetItems` to `{ targetType, targetId }`. Visible change is concentrated in `PromotionTargetItemsSection.vue` (new selector UX) and `usePromotionTargetNames.ts` (new branch). Extend existing test files in the same slice. Gate: `pnpm build`; runner: `pnpm test:unit`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/features/POS/promotions/interfaces/promotion.types.ts` | Modified | Add `'VARIANTS'` to `PromotionTargetType`. |
| `src/features/POS/promotions/composables/usePromotionForm.ts` | Modified | Add `VARIANTS` to `TARGET_TYPE_OPTIONS`. |
| `src/features/POS/promotions/components/PromotionTargetItemsSection.vue` | Modified | New `VARIANTS` branch: product search filtered to `hasVariants`, variant picker per product. |
| `src/features/POS/promotions/composables/usePromotionTargetNames.ts` | Modified | New `VARIANTS` case in `resolveTargetNames`. |
| `src/features/POS/promotions/api/promotion.api.ts` (error map) | Modified | `INVALID_TARGET` → Spanish message. |
| `src/features/POS/promotions/components/PromotionForm.vue` | Modified | Reset `targetItems` when switching INTO `VARIANTS`. |
| `…/composables/__tests__/usePromotionForm.test.ts` | Modified | `VARIANTS` options + payload cases. |
| `…/components/__tests__/PromotionTargetItemsSection.test.ts` | Modified | `VARIANTS` mount + add/remove. |
| `…/composables/__tests__/usePromotionTargetNames.test.ts` | Modified | `VARIANTS` resolve + no-throw. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| No global "get variant by id" endpoint → edit-mode hydration harder than PRODUCTS | High | Flagged as Open Q (b); chip falls back to UUID if product gone. |
| `PromotionTargetItemFormEntry` is flat `{ targetId, name }`; multi-product promos may want product context | Med | Flagged as Open Q (a); default to keeping the entry flat. |
| `@nuxt/ui` auto-import shadows `vi.stubGlobal('useToast')` — toast-assertion testing gotcha | Med | Use the project's `mountWithUApp` pattern; do NOT rely on `stubGlobal`. |
| Existing test files have no `VARIANTS` coverage → easy to ship a partial branch | Med | Extend existing files in the same slice; `pnpm test:unit` gate. |
| `PromotionTargetItemsSection.vue` could grow past the 400-line budget | Low | Extract a `ProductVariantSelector.vue` child if needed. |

## Open Design Questions (defer to sdd-design)

1. **Variant entry shape**: does `PromotionTargetItemFormEntry` need an optional `productId` / `productName` so chips show "Camisa Azul · Talle M" across products? Keep flat vs extend?
2. **Edit-mode hydration strategy**: no `productApi.getVariantById`. Options — (a) chip falls back to UUID when parent product is gone; (b) iterate product list once to build in-memory `variantId → { name, productName }` map; (c) require re-pick on every edit.
3. **Selector interaction model**: two-step within one section vs. a nested sub-component. One component or two?

## Rollback Plan

Single PR, no DB / infra. Revert restores the enum, the radio options, the section, the hydration branch, the error map entry, and the test additions. No other code references `VARIANTS`; reverting removes every trace.

## Dependencies

- Backend: `targetType` / `appliesTo` accept `VARIANTS` (documented for `PRODUCT_DISCOUNT` only).
- `productApi.getVariants(productId)` and `Product.hasVariants` already exist.
- `GET /sales/drafts/:id/applicable-promotions` already carries `promotionId` per line — no POS change.

## Success Criteria

- [ ] `PromotionTargetType` union includes `'VARIANTS'`; `tsc` clean.
- [ ] `TARGET_TYPE_OPTIONS` exposes `VARIANTS`; selecting sets `appliesTo = 'VARIANTS'`.
- [ ] Product search in `VARIANTS` mode filters to `hasVariants === true`.
- [ ] Multi-variant: a single promo carries N variants from one or more products.
- [ ] Payload sends `{ targetType: 'VARIANTS', targetId }` — never `side` or `id`.
- [ ] `INVALID_TARGET` surfaces the Spanish message; form stays editable.
- [ ] `resolveTargetNames('VARIANTS', items)` patches names in edit mode without throwing.
- [ ] `pnpm test:unit` + `pnpm build` green; under the 400-line review budget.
