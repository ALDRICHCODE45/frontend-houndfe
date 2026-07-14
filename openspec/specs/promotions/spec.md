# Promotions Specification

Domain: `promotions` · POS admin promotion CRUD UI — form composition for the four `PromotionType`s, target-type selection (categories / brands / products / **variants**), catalog lookups, payload mapping, edit-mode name hydration, server error mapping. This slice adds the `VARIANTS` branch.

## Purpose

Let a merchant author a `PRODUCT_DISCOUNT` that targets specific product variants (not "all variants of a product"). Backend accepts `targetType: 'VARIANTS'` and resolves variant-vs-product precedence server-side; the frontend must let merchants pick variants and surface backend rejections. Endpoints: `GET /products?hasVariants=true`, `GET /products/:id/variants`, `POST/PATCH /promotions`, plus `400 { code: 'INVALID_TARGET' }`.

## Requirements

### REQ-1 Target Type Union Includes VARIANTS
The `PromotionTargetType` union SHALL include `'VARIANTS'`. `TARGET_TYPE_OPTIONS` MUST expose `VARIANTS` for `PRODUCT_DISCOUNT` and `BUY_X_GET_Y`; it MUST NOT render under `ADVANCED`.

#### Scenario: VARIANTS visible for supported promotion types
- GIVEN the form is in `PRODUCT_DISCOUNT` mode
- WHEN the target-type radio renders
- THEN it lists `CATEGORIES`, `BRANDS`, `PRODUCTS`, `VARIANTS`
- AND switching to `BUY_X_GET_Y` keeps `VARIANTS` available
- AND switching to `ADVANCED` removes `VARIANTS`

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

### REQ-8 BXGY getDiscountPercent Semantics
For `BUY_X_GET_Y`, `getDiscountPercent` MUST accept integer values from 0 through 100 inclusive. `0` means no discount, `100` means the get unit is free, and the form MUST express and submit `100`; the `Gratis` option MUST map to `100`.

#### Scenario: BXGY accepts zero
- GIVEN a valid `BUY_X_GET_Y` form
- WHEN `getDiscountPercent` is `0`
- THEN client validation succeeds and the submitted value is `0`

#### Scenario: BXGY submits Gratis as 100
- GIVEN a valid `BUY_X_GET_Y` form
- WHEN the user selects `Gratis`
- THEN the form validates and submits `getDiscountPercent: 100`

#### Scenario: BXGY rejects values above 100
- GIVEN a `BUY_X_GET_Y` form with `getDiscountPercent` set to `101`
- WHEN the form is validated
- THEN client validation fails

### REQ-9 ADVANCED Discount Regression
`ADVANCED` MUST retain its existing `getDiscountPercent` range of 0 through 99 inclusive; `100` MUST remain invalid for `ADVANCED`.

#### Scenario: ADVANCED rejects 100
- GIVEN an `ADVANCED` form with `getDiscountPercent` set to `100`
- WHEN the form is validated
- THEN client validation fails

### REQ-10 BXGY Presets
The BXGY presets MUST produce exactly: `2x1` → `buyQuantity: 1`, `getQuantity: 1`, `getDiscountPercent: 100`; `3x2` → `buyQuantity: 2`, `getQuantity: 1`, `getDiscountPercent: 100`; `Segundo al 50%` → `buyQuantity: 1`, `getQuantity: 1`, `getDiscountPercent: 50`.

#### Scenario: locked presets populate the BXGY form
- GIVEN the user selects each named BXGY preset
- WHEN the preset is applied
- THEN its buy quantity, get quantity, and discount percent exactly match the locked values

### REQ-11 BXGY Target Requirements
A `BUY_X_GET_Y` submission MUST include `appliesTo` and at least one `targetItem` whose `targetType` equals `appliesTo`. `appliesTo` MUST be one of `PRODUCTS`, `VARIANTS`, `CATEGORIES`, or `BRANDS`; otherwise client-side validation MUST prevent submission.

#### Scenario: matching BXGY target submits
- GIVEN `appliesTo` is `VARIANTS` and a target item has `targetType: 'VARIANTS'`
- WHEN the form is submitted
- THEN client validation succeeds

#### Scenario: missing or mismatched target blocks submission
- GIVEN `appliesTo` is missing, no target item exists, or every target has a different `targetType`
- WHEN the form is submitted
- THEN a client-side validation error is shown and no request is sent

### REQ-12 Promotion Error Mapping
The promotion form MUST map `FORBIDDEN_FIELD` and `INVALID_FIELD_CHANGE` to user-visible messages. Error-code matching MUST be case-insensitive, so `duplicate_target` and `DUPLICATE_TARGET` produce the same mapping.

#### Scenario: domain error codes show messages regardless of casing
- GIVEN the API returns any supported code in upper-, lower-, or mixed-case
- WHEN the form maps the error
- THEN the corresponding user-visible error is shown

## UI Copy (neutral Spanish, examples)

- `VARIANTS` radio label: "Variantes"
- Variant selector empty state: "Elegí un producto para ver sus variantes"
- INVALID_TARGET message: "La variante seleccionada no existe o no pertenece a tu comercio"
- BXGY `getDiscountPercent: 100` label: "Gratis"
- BXGY missing `appliesTo` field error: "Debe seleccionar a qué se aplica la promoción"
- BXGY empty `targetItems` field error: "Debe seleccionar al menos un producto"
- FORBIDDEN_FIELD toast: "No se permite modificar ese campo para este tipo de promoción."
- INVALID_FIELD_CHANGE toast: "No se puede cambiar el tipo de una promoción existente."
