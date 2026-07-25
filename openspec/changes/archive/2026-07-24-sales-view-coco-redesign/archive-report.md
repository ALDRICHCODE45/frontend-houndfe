# Archive Report: sales-view-coco-redesign

## Change Metadata

- **Change**: sales-view-coco-redesign
- **Version**: MVP
- **Artifact store**: openspec
- **Project**: frontend-houndfe
- **Archived on**: 2026-07-24
- **Verdict**: PASS WITH WARNINGS (0 blockers)

## Lineage (Observation IDs for Traceability)

- `obs-68d1e737f00eb927` — SDD-1 foundation
- `obs-073d9b06e4121e0f` — SDD-2 branding rename
- `obs-25f5d8a6208839bf` — SDD-3 main implementation
- `obs-c258eae2e66e0eea` — Cobrar gold + dark mode default discovery
- `obs-27a7b9cf8f920893` — Light/dark mode toggle restored
- `obs-49bc43d9977780b3` — Dark mode bg correction (coco-neutral-950 not --surface-page)

## Implementation Summary

13 commits on main, all in series:
- a7fab02: foundation (Coco tokens + Nuxt UI config)
- 48abc13: HoundFe → Coco rename
- d946706: initial token application to SalesView
- 9369dd4: Cobrar gold fix + dark mode default
- 448088d: restore light/dark toggle + adapt SalesView to both modes
- ec4fdbe: remove card wrapper
- 9695064: remove catalog section divider
- 52bf15d: restore container with subtle border
- c83313d: unify SalesView bg with page bg
- c945c2c: remove elevated bg colors from cart
- a7b58ad: experimental — REVERTED
- f5f61b5: revert to working state
- 5226c8e: final dark mode bg correction

## Files Affected

| File | Change |
|---|---|
| src/assets/main.css | +Coco shade scales (coco, coco-neutral, coco-navy, coco-gold) + semantic tokens + radius + Inter font |
| vite.config.ts | Nuxt UI colors: primary=coco, secondary=coco-navy, neutral=coco-neutral, action=coco-gold; card + dashboardPanel slot classes updated |
| src/main.ts | Dark mode default on first load |
| src/features/POS/sales/views/SalesView.vue | bg unified with dashboardPanel body, container with subtle border |
| src/features/POS/sales/components/ProductSearchPanel.vue | sticky header with backdrop-blur, no internal bg |
| src/features/POS/sales/components/ProductSearchResults.vue | transparent |
| src/features/POS/sales/components/ProductSearchResultItem.vue | hero image, red danger, cyan price, blue variants |
| src/features/POS/sales/components/ActiveSalePanel.vue | no bg, no internal dividers |
| src/features/POS/sales/components/SaleItemRow.vue | border adapted |
| src/features/POS/sales/components/SaleTotalsFooter.vue | Cobrar button gold |
| src/features/POS/sales/components/SalesTabsStrip.vue | no internal bg |

## Verification Results

- `pnpm build`: PASS (zero type errors)
- `pnpm test:unit`: 2907/2907 PASS

See `verify-report.md` for full details.

## Known Deferrals

- Hex values in CatalogLayout.vue (`#FFF8F0`, `#18181b`) and ProductDetailView.vue (`#f7f7f5`, `#0a0a0b`, `#111316`, etc.) — these are catalog-specific colors that will be addressed in SDD-5 (system-wide-coco-sweep).

## Next Steps

- SDD-4: sales-detail-coco-align (align SaleDetailView to Coco tokens)
- SDD-5: system-wide-coco-sweep (login, sidebar, catalog, settings)