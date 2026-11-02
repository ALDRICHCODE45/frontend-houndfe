# Product action presentation verification

## Scope

Bounded A4 contribution: PriceListSection add-list/create-list/tier-save actions and ProductUpsertSlideover's full-editor link. Only presentation bindings changed; handlers, models, saves and permissions are unchanged.

## Evidence

- Link DOM regression first failed on the legacy gold class (10 existing cases passed); after migration, all 11 cases passed, including `update:open(false)` and navigation to `/pos/products/new`.
- Real pricing modal RED: create action rendered gold `rgb(242, 196, 86)` with black text instead of the dark HF action role.
- Job 28: focused slideover/product-detail suites, full build and whitespace check passed. Existing generated CSS and large-chunk warnings remain.
- `.editorial-field-preview/check-product-actions.js` passed against the authenticated development application at 390 and 1440 pixels, in light and dark modes. It opens/cancels without saving data.
- Create-list action: 44px high; light blue `rgb(36, 66, 246)`/white, dark blue `rgb(145, 176, 255)`/ink `rgb(19, 35, 68)`.
- Full-editor link: 44px high, computed focused outline 3px, correct destination in all four cases.
- Separate actual-browser check opened the existing first price list's quantity modal, verified the same foreground/background pairs and 44px Save action in all four cases, then canceled without submitting.
- Four create-list screenshots: `odd/evidence/hf-ui-complete-audit/pricing-action-{390|1440}-{light|dark}.png`; mobile-light screenshot inspected and contained.

## Limits

These checks do not establish every product form state, all contrast ratios, complete route coverage, or native review approval. Quantity-trigger accessible naming remains a separate audit concern: the existing icon-only trigger has no accessible label. No quantity values, prices or product records were changed during browser checks.
