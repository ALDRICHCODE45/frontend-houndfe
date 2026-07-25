# Sales View — Coco Redesign Specification

## Purpose

Defines the visual structure and token application for the POS sales view aligned with the Coco brand tokens. Replaces hardcoded hex values with semantic Coco tokens and applies the reference product card design.

## Scope

Applies to all components within `src/features/POS/sales/components/` and `src/features/POS/sales/views/SalesView.vue`.

## Requirements

### REQ-1: Coco tokens applied to SalesView components

All hardcoded hex values must be replaced with semantic Coco tokens:
- Backgrounds: `bg-(--light-surface-page) dark:bg-coco-neutral-950` (matches dashboardPanel body)
- Borders: `border border-default/50` (subtle, 50% opacity)
- Card backgrounds: `bg-elevated` (adapts to color mode)

### REQ-2: Cobrar button in gold

The "Cobrar" button in `SaleTotalsFooter.vue` must use gold (`#f6bb13`) as background:
- `!bg-(--brand-action) !text-black hover:!brightness-110` class override

Note: Nuxt UI 4.6.0 doesn't recognize `color="action"` as a valid color name. Use `color="primary"` with the custom class override.

### REQ-3: Product card redesigned

`ProductSearchResultItem.vue` must match the Coco reference design:
- Hero image: `object-cover`, no padding, gradient background
- Stock badge top-right: red `--brand-danger` for low stock, neutral for normal
- Brand text: small, uppercase, muted
- Product name: bold/semibold, highlighted
- Price: cyan `--brand-accent`, bold, tabular-nums
- Variant count: blue `--brand-primary`

### REQ-4: Container structure

The catalog and cart panels should have:
- Outer wrapper: `rounded-2xl border border-default/50 overflow-hidden`
- No shadow (avoid heavy container feel)
- No tinted backgrounds (transparent, inherits parent)

### REQ-5: Background unification

SalesView must match the dashboardPanel body bg in both light and dark modes:
- Light: `#f5f4f6` (coco-neutral-50 / --light-surface-page)
- Dark: `#16121a` (coco-neutral-950)

DO NOT use `--surface-page` (`#000000`) for the page bg — that's a different shade reserved for hero surfaces.

### REQ-6: Color mode support

The light/dark mode toggle must work:
- UColorModeButton in navbar
- Appearance submenu in user dropdown (Light/Dark checkboxes)
- 't' keyboard shortcut
- Dark mode is default on first load (only when no localStorage preference exists)
- SalesView adapts via semantic tokens

### REQ-7: Build and test integrity

- `pnpm build`: must exit 0 with zero type errors
- `pnpm test:unit`: all tests must pass

## Verification

- Visual check: light and dark modes render with unified bg
- Product card matches reference design
- Cobrar button is gold
- No "doble fondo" effect (SalesView bg = page bg)
- All existing tests pass

## Deferrals

- Hex values in CatalogLayout.vue and ProductDetailView.vue: deferred to SDD-5 (system-wide-coco-sweep)