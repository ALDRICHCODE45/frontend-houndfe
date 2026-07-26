# Proposal: Sales History Coco

## Why

The new-sale workspace, payment moment, and cart are Coco — Cobrar/Confirmar/Cerrar gold, cart card, item rows, totals, three payment modals all speak the brand. The moment a sale closes and the cashier opens "Mis ventas" → `SalesListView.vue`, the brand breaks: "Nueva Venta" button and every row's folio link default to Nuxt UI primary blue, and `SaleCard.vue` folio is `text-primary`. Opening a sale in `SaleDetailView.vue` is worse — the sticky header uses raw `bg-white/90 dark:bg-zinc-950/90`, the five Datos-tab cards are raw `bg-white dark:bg-zinc-900`, the implicit "Registrar pago" CTA defaults to primary, the timeline's SALE_REGISTERED event uses `text-primary bg-primary/10`, and the comment trigger is `color="primary"`. Sales history is the loop-closing moment of every POS sale and the surface the cashier reopens many times per shift — the discontinuity is louder here than at the new-sale screen.

## What Changes

Coco-ize the sales-history surface in `src/features/POS/sales/`:

| # | File | Swap |
|---|------|------|
| 1 | `views/SalesListView.vue` | `color="primary"` on "Nueva Venta" + row folio link → Coco gold; `<UCard>` body → Coco surface. |
| 2 | `views/SaleDetailView.vue` | Raw `bg-white/90 dark:bg-zinc-950/90` sticky header + 5 raw `bg-white dark:bg-zinc-900` Datos cards → `bg-coco-neutral-50 dark:bg-coco-neutral-950`; implicit-primary "Registrar pago" header CTA → Cobrar gold. |
| 3 | `components/SaleCard.vue` | `text-primary` folio → Coco gold; upgrade `<UCard>` wrapper. |
| 4 | `components/SaleDetailTimeline.vue` | `text-primary bg-primary/10` on SALE_REGISTERED → Coco gold tint; `bg-gray-200` connector → Coco-neutral token. |
| 5 | `components/SaleDetailTotalsCard.vue` | No-color "Registrar Pago" CTA (defaults to primary) → Cobrar gold; `debtClass` stays semantic. |
| 6 | `components/SaleCommentInput.vue` | `color="primary"` "Agregar comentario" → Coco gold tint. |

Adjacent (touch only if needed): `<UCard>` around the data table in `SalesListView` and the detail-view breadcrumb.

## Non-Goals

Each gets its own brand-redesign SDD: catalog (`ProductsView`, `ProductCard`, `ProductCardGrid`, `ProductDetailView`); catalog modals (`ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal`); customers (`CustomersView`, `CustomerUpsertSlideover`, `AddressModal`); `OrdersView` (placeholder); promotions (`PromotionsView`, `PromotionDetailView`, `PromotionForm`, all `Promotion*`); dashboard shell (`DashboardLayout`, `DashboardHomeView`, sidebar, navbar); `AssignCustomerSlideover`, `AssignSellerSlideover`; `AppDataTable` (in `core/shared`). Hard constraints: no new tokens, no `main.css`/`vite.config.ts` changes, no business-logic / prop / emit / validation / API changes, no new components or splits, no new routes. `PaymentModal`, `PaymentSuccessModal`, `DebtPaymentModal`, `SaleTotalsFooter` are already Coco — diffs MUST stay empty.

## Approach

Reuse the Cobrar precedent (`color="primary"` + `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"`) for every "next action" button: "Nueva Venta", "Registrar pago" header, "Registrar Pago" totals card. Use `text-coco-gold-700 dark:text-coco-gold-400` + `bg-coco-gold-500/10` for the timeline SALE_REGISTERED event, the row folio link, the SaleCard folio, and the comment trigger (gold tint = brand link). Use `bg-coco-neutral-50 dark:bg-coco-neutral-950` for the sticky header and data cards; `border-coco-neutral-200 dark:border-coco-neutral-800` if borders need Coco tokens. Add explicit `ui="{ body: 'bg-coco-neutral-50 dark:bg-coco-neutral-950' }"` to wrapping `<UCard>`s. Strict TDD: pin `data-testid`, prop/emits, and the new class tokens (`bg-coco-gold-*`, `bg-(--brand-action)`, `text-coco-gold-*`, `bg-coco-neutral-*`); update selectors that currently assert `text-primary` / `bg-primary` to the new tokens. Dark-first; **visual review checkpoint after T2** (after `SaleCard` + `SaleDetailTimeline`) — same pattern as SDD-5.

## Affected Specs

None. New: None. Modified: None.

## Risks

- **Visual regression on a daily-use area (Med)** — iterate visually after T1, like SDD-3/4/5.
- **Larger blast radius than SDD-5 (Med)** — `SaleDetailView` has 4 tabs + ~6 sub-components; one missed swap in Datos tab will feel like a brand leak.
- **Status-badge semantics on the timeline (Low)** — Coco gold on SALE_REGISTERED could read as "CTA" rather than "sale-moment event"; see open questions.
- **Test selector breakage (Med)** — `SaleCommentInput.test.ts` pins `data-color="primary"`, `SaleDetailTimeline.test.ts` pins `text-primary bg-primary/10`; update to coco-gold tokens.
- **`PaymentMethodPills` still emits `color="primary"` for CARD_DEBIT (Low)** — out of scope; documented carry-over.

## Rollback Plan

`git revert` the merge commit. Visual-only token substitution; undoing restores default Nuxt UI primary with no API or data-shape changes.

## Dependencies

None. Nuxt UI 4 + Tailwind v4 + Coco tokens from SDD-1 + payment modals from SDD-5.

## Success Criteria

- [ ] No `text-primary`, `bg-primary`, `border-primary/*`, or unoverridden `color="primary"` / no-color CTA in the six target files.
- [ ] Sticky header + five Datos-tab cards use `coco-neutral-50`/`coco-neutral-950`, not raw `bg-white`/`dark:bg-zinc-*`.
- [ ] "Nueva Venta", "Registrar pago" (header + totals card) follow the Cobrar precedent.
- [ ] Timeline SALE_REGISTERED + folio link + SaleCard folio + comment trigger use `coco-gold` tokens.
- [ ] Dark-first treatment readable on `coco-neutral-950`; light-mode readable on `coco-neutral-50`.
- [ ] `pnpm build` clean; existing tests pass after selector updates; no new Coco tokens; `PaymentModal` / `PaymentSuccessModal` / `DebtPaymentModal` / `SaleTotalsFooter` / `ActiveSalePanel` unchanged.

## Open Questions

1. **Timeline SALE_REGISTERED color** — Coco gold (brand moment) or `success` (sale-confirmed semantic)?
2. **Sale-row folio link** — `text-coco-gold-*` (high attention, matches Cobrar) or `text-coco-neutral-*` with hover-gold (subtle, then brightens)?
3. **Mobile SaleCard folio** — Coco gold (matches desktop link) or `text-highlighted` neutral (so it doesn't compete with the status pill row)?
4. **"Registrar Pago" totals-card CTA prominence** — full Cobrar gold or `variant="soft" color="warning"` (subtle warning that debt is still outstanding)?