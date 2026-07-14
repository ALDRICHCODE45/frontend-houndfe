# Delta for Promotions

## MODIFIED Requirements

### REQ-1 Target Type Union Includes VARIANTS

The `PromotionTargetType` union SHALL include `'VARIANTS'`. `TARGET_TYPE_OPTIONS` MUST expose `VARIANTS` for `PRODUCT_DISCOUNT` and `BUY_X_GET_Y`; it MUST NOT render under `ADVANCED`.
(Previously: `VARIANTS` was exposed for `PRODUCT_DISCOUNT` only and removed for `BUY_X_GET_Y`.)

#### Scenario: VARIANTS visible for supported promotion types
- GIVEN the form is in `PRODUCT_DISCOUNT` mode
- WHEN the target-type radio renders
- THEN it lists `CATEGORIES`, `BRANDS`, `PRODUCTS`, `VARIANTS`
- AND switching to `BUY_X_GET_Y` keeps `VARIANTS` available
- AND switching to `ADVANCED` removes `VARIANTS`

## ADDED Requirements

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
