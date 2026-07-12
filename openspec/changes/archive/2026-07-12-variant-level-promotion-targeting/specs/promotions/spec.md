# Promotions Specification

Domain: `promotions` · POS admin promotion CRUD UI — form composition for the four `PromotionType`s, target-type selection (categories / brands / products / **variants**), catalog lookups, payload mapping, edit-mode name hydration, server error mapping. This slice adds the `VARIANTS` branch.

## Purpose

Let a merchant author a `PRODUCT_DISCOUNT` that targets specific product variants (not "all variants of a product"). Backend accepts `targetType: 'VARIANTS'` and resolves variant-vs-product precedence server-side; the frontend must let merchants pick variants and surface backend rejections. Endpoints: `GET /products?hasVariants=true`, `GET /products/:id/variants`, `POST/PATCH /promotions`, plus `400 { code: 'INVALID_TARGET' }`.

## Requirements

### REQ-1 Target Type Union Includes VARIANTS
The `PromotionTargetType` union SHALL include `'VARIANTS'`. `TARGET_TYPE_OPTIONS` MUST expose `VARIANTS` for `PRODUCT_DISCOUNT` only; it MUST NOT render under `BUY_X_GET_Y` or `ADVANCED`.

#### Scenario: VARIANTS visible only for PRODUCT_DISCOUNT
- GIVEN the form is in `PRODUCT_DISCOUNT` mode
- WHEN the target-type radio renders
- THEN it lists `CATEGORIES`, `BRANDS`, `PRODUCTS`, `VARIANTS`
- AND switching to `BUY_X_GET_Y` or `ADVANCED` removes the `VARIANTS` option

### REQ-2 Selecting VARIANTS Resets Items
When the user picks `VARIANTS`, `state.appliesTo` MUST become `'VARIANTS'` and `state.targetItems` MUST be cleared.

#### Scenario: switching to VARIANTS clears selection
- GIVEN `appliesTo='BRANDS'` and `targetItems=[{...}]`
- WHEN the user selects `VARIANTS`
- THEN `appliesTo === 'VARIANTS'` and `targetItems === []`

### REQ-3 Two-Step Product → Variant Selector
In `VARIANTS` mode the selector MUST be a two-step interaction: (1) **product step** — list products filtered to `hasVariants === true`; (2) **variant step** — once a product is chosen, list its variants via `productApi.getVariants(productId)` and let the user pick one or more. Multiple products MAY contribute variants to a single promo.

#### Scenario: add one variant
- GIVEN `appliesTo='VARIANTS'` and the user picks product "Camisa" (has variants)
- WHEN the variant list loads and the user adds "Talle M"
- THEN `targetItems` contains `{ targetId: <variantId>, name: 'Talle M' }`
- AND only products with `hasVariants === true` were searchable

#### Scenario: multi-variant across products
- GIVEN "Talle M" from "Camisa" is already added
- WHEN the user picks "Rojo" from "Remera"
- THEN `targetItems` contains both variants and the first chip is preserved

### REQ-4 Payload Mapping
`toCreatePayload` / `toUpdatePayload` MUST emit `targetItems: [{ targetType: 'VARIANTS', targetId: <variantId> }]`. The payload MUST NOT use `side` or `id` keys.

#### Scenario: VARIANTS payload shape
- GIVEN `appliesTo='VARIANTS'` and `targetItems=[{ targetId:'v1', name:'Talle M' }]`
- WHEN `toCreatePayload(state)` runs
- THEN payload has `targetItems: [{ targetType: 'VARIANTS', targetId: 'v1' }]` and no `side` / `id` keys

### REQ-5 Edit-Mode Variant Name Hydration
`usePromotionTargetNames.resolveTargetNames('VARIANTS', items)` MUST return entries with `name` populated when resolvable; when unresolvable, the entry MUST be returned unchanged (chip falls back to the identifier). The resolver MUST NOT throw on any failure path. The hydration mechanism is a design concern, not a spec concern.

#### Scenario: resolvable name shows; unresolvable falls back without throwing
- GIVEN an existing promo with `appliesTo='VARIANTS'` and two `targetId`s — one resolvable, one not
- WHEN `resolveTargetNames` runs
- THEN the resolvable entry has `name` populated and the unresolvable entry is returned unchanged
- AND the resolver does not throw

### REQ-6 INVALID_TARGET Error Mapping
When POST or PATCH `/promotions` returns HTTP `400 { code: 'INVALID_TARGET' }`, the UI MUST show the Spanish message `"La variante seleccionada no existe o no pertenece a tu comercio"` and the form MUST remain editable.

#### Scenario: 400 INVALID_TARGET shows Spanish and keeps form editable
- GIVEN the user submits a `VARIANTS` promo whose variant id is no longer valid
- WHEN the backend returns `400 { code: 'INVALID_TARGET' }`
- THEN the Spanish message appears and the form fields stay editable so the user can fix and resubmit

### REQ-7 No Frontend Promo Calculation (Invariant)
The frontend MUST NOT replicate backend precedence logic (variant > product). The POS draft view MUST only render backend-resolved fields (`promotionId`, `discountType`, `discountValue`, `discountTitle`); no new POS-side discount math SHALL be added.

#### Scenario: POS renders backend-resolved fields only
- GIVEN `GET /sales/drafts/:id/applicable-promotions` returns `promotionId`, `discountType`, `discountValue`, `discountTitle`
- WHEN the POS renders the draft line
- THEN those four fields are displayed verbatim and no local discount calculation is performed

## UI Copy (neutral Spanish, examples)

- `VARIANTS` radio label: "Variantes"
- Variant selector empty state: "Elegí un producto para ver sus variantes"
- INVALID_TARGET message: "La variante seleccionada no existe o no pertenece a tu comercio"
