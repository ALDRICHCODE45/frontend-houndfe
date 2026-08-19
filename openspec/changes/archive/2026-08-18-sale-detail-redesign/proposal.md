# Proposal: Sale Detail Redesign — flat two-column layout replaces tab workbench

## 1. Intent

`SaleDetailView.vue` currently gates the confirmed-sale detail behind a `UTabs` workbench (productos / pagos / datos / comentarios). The data density on this screen does not justify tab friction — every datum (items, sale metadata, totals, payments, history) should be glanceable in one scroll. The user asked to drop the 4 tabs and render a flat single-screen two-column grid (left: PRODUCTOS, DATOS DE LA VENTA, HISTORIAL; right: TOTALES, PAGOS REGISTRADOS). This is a **presentation re-composition**, not a data-model change: `sale.timeline` already interleaves COMMENT events as a discriminated union, so "unify timeline + comments into HISTORIAL" is pure template surgery.

The unifying constraint is **data-testid + Coco-token parity**: the screen is heavily covered by `SaleDetailView.test.ts` and the in-flight `sales-history-coco` delta (HST-REQ-001..008), which pins the sticky header surface, the five reflow-card surfaces, the Cobrar CTA, and the comment composer's non-primary color. Those MUST NOT regress.

## 2. What Changes

| File | Action | Notes |
|------|--------|-------|
| `src/features/POS/sales/views/SaleDetailView.vue` | Rewrite body | Drop `UTabs` + `tabItems` computed + inline `#datos` block + `priceLists` fetch/`priceListName`/`uniquePaymentMethods` computeds. Add responsive 2-col grid (`data-testid="sale-detail-layout-body"`). Keep sticky header + modals. Drop `productApi` import. |
| `src/features/POS/sales/components/SaleDetailSalesDataCard.vue` | NEW | Extracted "DATOS DE LA VENTA" card: owns price-list fetch + `priceListName`/`uniquePaymentMethods` computeds. Emits `assign-seller`. Root carries `sidebar-data-reflow`; cards carry `reflow-*`. |
| `src/features/POS/sales/components/SaleDetailHistoryCard.vue` | NEW | `UCard` wrapper: header "HISTORIAL", body `SaleDetailTimeline`, footer `SaleCommentInput`. |
| `src/features/POS/sales/views/__tests__/SaleDetailView.test.ts` | Modified | Retitle tab-layout tests → flat-layout; drop `sale-detail-tabs`; add `sale-detail-layout-body` + 2-column assertions; stub the two new cards. |
| `openspec/changes/sale-detail-redesign/specs/sales/spec.md` | NEW (downstream) | Delta spec — written by `sdd-spec`, not this phase. |

**Untouched** (presentational, already correct): `SaleDetailItemsList`, `SaleDetailTotalsCard`, `PaymentsListSection`, `SaleDetailTimeline`, `SaleCommentInput`, `SaleCommentSlideover`, `DebtPaymentModal`, `AssignSellerSlideover`.

**testid disposition:**

- **Survive verbatim (header):** `sale-detail-layout`, `sale-detail-skeleton`, `sale-detail-header`, `header-folio`, `header-date`, `badge` ×2, `register-payment-header`.
- **Survive verbatim (migrate into `SaleDetailSalesDataCard.vue`):** `sidebar-data-reflow` (card root), `reflow-cajero`, `reflow-vendedor`, `reflow-cliente`, `reflow-price-list`, `reflow-payment-methods`.
- **Survive verbatim (untouched components):** `items-table` + `item-*`, `totals-*`, `register-debt-payment`, `payments-list-*`, `sale-detail-payments-list` (attr on `PaymentsListSection`), `timeline-*`, `comment-*`, `sale-comment-input`.
- **Dies:** `sale-detail-tabs` (tab strip gone; no test/e2e references it — verified by repo grep).
- **New:** `sale-detail-layout-body` (flat grid container). Optional `sale-detail-sales-data-card` / `sale-detail-history-card` wrapper identities for the two new cards' own tests.

## 3. Scope Boundaries

**In scope:**

- Remove the 4 `UTabs` panels + `tabItems` + `sale-detail-tabs`; render the flat two-column grid.
- Extract `SaleDetailSalesDataCard.vue` (datos cards + price-list fetch/computeds) and `SaleDetailHistoryCard.vue` (unified HISTORIAL: timeline + composer in card footer).
- Relabel the PDF dropdown trigger to "Comprobante" when items exist (preserve `hasAnyAction` gate + DRAFT tooltip).
- Drop the `sm:hidden` header total duplicate (right column owns TOTAL at all sizes).
- Mobile stacking: right column first, left column second.
- Update `SaleDetailView.test.ts`; add the delta spec.

**Non-Goals:**

- NO new design tokens; NO `main.css` / `vite.config.ts` changes (HST-REQ-006).
- NO backend/API changes — 100% frontend; `sale.timeline` already carries COMMENT events.
- NO edits to the eight untouched components' internals, props, or emits.
- NO new data-testids beyond the grid container (and optional wrapper identities); existing testids are preserved, not renamed.
- NO "Comprobante" body section — the dropdown stays in the header (relabel only).
- NO infinite-scroll / pagination of the timeline.
- NO read-only → editable conversion of items/payments/discounts.

**Out of scope (defer):**

- Timeline virtualization or "ver más".
- Re-ordering columns beyond the locked mockup.
- Any change to `SalesListView` / other screens.

## 4. Approach

Lean extraction, single work unit. Rewrite `SaleDetailView.vue`'s body: delete the `UTabs` + `#slot` templates (~102 lines incl. `tabItems`), wrap the remaining content in `grid gap-6 lg:grid-cols-[1fr_360px]` with `data-testid="sale-detail-layout-body"`; left column stacks PRODUCTOS → `SaleDetailSalesDataCard` → `SaleDetailHistoryCard`, right column stacks `SaleDetailTotalsCard` → `PaymentsListSection`. The right column carries `order-1 lg:order-2` for mobile-first stacking. The DATOS extraction moves the `onMounted` `productApi.getGlobalPriceLists()` fetch + `priceListName`/`uniquePaymentMethods` computeds into the child (props in: `sale`, emits out: `assign-seller`), so the view stops importing `productApi`. The HISTORIAL wrapper is a thin `UCard` mounting the existing `SaleDetailTimeline` + `SaleCommentInput` (footer). Comprobante relabel keeps the `UDropdownMenu` + `hasAnyAction` v-if + DRAFT tooltip, only adding a visible `"Comprobante"` label + chevron; when `hasAnyAction` is false (CANCELED) nothing renders — as today. We inherit HST-REQ-001..008 for the Coco-token constraints (header + reflow cards stay `bg-coco-neutral-50 dark:bg-coco-neutral-950`; Cobrar CTA stays `!bg-(--brand-action) !text-black`; comment composer stays non-`primary`) — we do NOT redefine them.

**Budget:** forecast ~300–340 authored lines (additions+deletions). Fits the 400-line `single-pr` budget; no `size:exception` expected.

## 5. Affected Specs (delta plan)

- **Spec home:** extend `openspec/specs/sales/spec.md` (precedent: `sales-pos-charge`). **No new capability home**, **no spec split**.
- **Capabilities:** Modified → `sales` (existing). New → None.
- **New requirements:** `REQ-LAYOUT-001..005` — (1) flat two-column layout replaces `UTabs`; (2) unified HISTORIAL card (timeline + composer in footer); (3) preserved Coco tokens (header + reflow cards + Cobrar CTA + non-primary composer); (4) mobile stacking order (right column first); (5) testid migration (`sale-detail-tabs` removed, `sale-detail-layout-body` added, `reflow-*`/`sidebar-data-reflow` relocated).
- **Scenarios:** ~10–15 Given/When/Then across the 5 REQs.
- **No REQ removals.** One coordination note: HST-REQ-008 pins "UTabs shell semantics MUST remain identical" — this change removes `UTabs`, so the delta must include a MODIFIED carve-out for HST-REQ-008's UTabs clause once `sales-history-coco` archives (see Risks).

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HST-REQ-002 / HST-REQ-007 regression (Coco class assertions on header + reflow cards + non-primary composer) | Med | Keep `bg-coco-neutral-50/90 dark:bg-coco-neutral-950/90` + `!bg-(--brand-action)` strings verbatim in the new markup; run `SaleDetailView.test.ts` class assertions unchanged. |
| HST-REQ-008 merge-order conflict — `sales-history-coco` delta is in-flight (not archived) and pins `UTabs` shell semantics | Med | Spec phase confirms archive ordering; redesign delta carries a MODIFIED block for HST-REQ-008's UTabs clause. |
| 400-line budget pressure if the HistoryCard wrapper bloats | Med | Keep `SaleDetailHistoryCard` a thin `UCard` shell; if scope creeps, fall back to mounting `SaleDetailTimeline` + `SaleCommentInput` as siblings in the left column. |
| `SaleDetailView.test.ts` narrative reconciliation (2 tab-layout tests + `sale-detail-tabs` comments) | Low | Retitle + add grid-container selector; behavior assertions (4 body stubs, reflow cards, header CTA) survive unchanged. |
| Comprobante relabel vs. HST-REQ-008 `aria-label`-identical clause | Low | Add visible "Comprobante" text; update trigger `aria-label` from "Más acciones" → "Comprobante" and fold the carve-out into the HST-REQ-008 MODIFIED block. |

## 7. Rollback Plan

Single `git revert` of the merge commit. Pure structural + class change; no API or data-shape impact. Reverting restores the `UTabs` workbench, inline datos block, and icon-only "Más acciones" trigger with all original testids.

## 8. Dependencies

None. Stack unchanged (Vue 3.5 + TS + Vite + Nuxt UI 4 + TanStack Query + Pinia).

## 9. Success Criteria

- [ ] `UTabs` removed from `SaleDetailView.vue`; 2-col grid renders PRODUCTOS + DATOS DE LA VENTA + HISTORIAL (left), TOTALES + PAGOS REGISTRADOS (right).
- [ ] HISTORIAL unifies timeline events + cashier comments in one card; composer in footer.
- [ ] Comprobante trigger labeled when items exist; icon-only fallback preserved when empty (CANCELED → no trigger).
- [ ] Preserved `data-testid`s render verbatim: `sale-detail-header`, `header-folio`, `badge`, `register-payment-header`, `sidebar-data-reflow`, `reflow-*`, `sale-detail-payments-list`.
- [ ] HST-REQ-002 / HST-REQ-007 class assertions still pass (`bg-coco-neutral-50` on header + reflow cards; non-`primary` comment composer).
- [ ] Mobile (<lg) stacks right column first, left column second.
- [ ] `pnpm test:unit --run` green; `pnpm build` clean.
- [ ] Net diff fits the 400-line `single-pr` budget without `size:exception`.

## 10. Open Questions

All six explore questions resolved by applying the recommended answers (Q1 relabel, Q2 HistoryCard wrapper + footer composer, Q3 extract SalesDataCard, Q4 right-column-first mobile, Q5 remove `sale-detail-tabs`, Q6 drop `sm:hidden` header total). **No question requires user decision** — each is derivable from the mockup or code.

## 11. Visual Reference Note

The user's mockup is a single image (Image 5). The four current-state screenshots were PNG placeholders (failed to attach), so visual analysis came from source code. The proposal follows the mockup structure faithfully (sticky header unchanged; left/right column split; HISTORIAL card). Flagged mockup/element mismatches: the mockup's "Comprobante" is mapped to the existing PDF dropdown trigger (relabel), not a new body section; the mockup's header TOTAL is duplicated today at `sm:hidden` — dropped per Q6 so the right column owns TOTAL at all sizes.
