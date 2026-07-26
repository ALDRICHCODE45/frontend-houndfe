# Proposal: Sales Payment Coco

## Why

The new-sale workspace is fully Coco-ized: cart card, item rows, totals, and the Cobrar button (gold via `--brand-action`) all speak Coco. But the moment money changes hands, `PaymentModal`, `PaymentSuccessModal`, and `DebtPaymentModal` still render default Nuxt UI blue (`color="primary"`, `border-primary/20 bg-primary/5`, `text-primary`, `border-primary/40 bg-primary/5`). The payment step is the highest-attention moment of every POS sale, so the brand discontinuity is louder there than anywhere else. A hotfix already recolored the Cobrar button in `SaleTotalsFooter.vue`; this change closes the loop on the rest of the payment surfaces so the whole "charge → confirm → close" arc reads Coco.

## What Changes

Coco-ize the three payment modal components in `src/features/POS/sales/components/`:

1. **`PaymentModal.vue`** — Replace `border-primary/20 bg-primary/5` (total banner), `border-primary/40 bg-primary/5` (selected method tile), `text-primary` (icons + "Agregar fecha de vencimiento" link), `color="primary"` (Confirmar cobro button), and `UInputNumber color="primary"`. Apply Coco gold accents + `--brand-action`.
2. **`PaymentSuccessModal.vue`** — Replace `text-primary` (Cambio row) and `color="primary"` (Cerrar button). Apply Coco gold per Cobrar precedent.
3. **`DebtPaymentModal.vue`** — Same substitution as `PaymentModal.vue` (total banner, selected tile, icons, Confirmar cobro deuda button, UInputNumber).

Adjacent surface:
- `SaleTotalsFooter.vue` (Cobrar already gold via `--brand-action`) — verify alignment only; no change expected.

Out-of-file scope (each gets its own brand-redesign SDD):
- `ProductDetailModal.vue`, `VariantPickerModal.vue`, `GlobalDiscountModal.vue`, `SaleCard.vue`, `SaleDetailTimeline.vue`, `AssignCustomerSlideover.vue`, `ProductSearchPanel.vue`, `ProductSearchResultItem.vue`, `SalesTabsStrip.vue`.

## Non-Goals

No new design tokens, no `main.css` changes, no `vite.config.ts` changes. No business-logic, prop, emit, validation, or API contract changes. No new components, no component splits, no layout restructuring. No `primary` removal in non-payment surfaces.

## Approach

Reuse the existing `SaleTotalsFooter.vue` Cobrar button pattern as the canonical Coco action: keep `color="primary"` as the semantic prop and override the class with `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"`. For non-action accents (total banners, selected tiles, icons, links), use the `coco-gold` scale: `border-coco-gold-500/20 bg-coco-gold-500/5` for tints, `text-coco-gold-400` (dark) / `text-coco-gold-700` (light) for icons/links. For `UInputNumber`, try `color="warning"` first; if the focused ring reads orange rather than gold, fall back to `color="neutral"`. Preserve all `data-testid`, `aria-label`, focus order, and `USlideover`/`UModal` shell semantics. Dark-first: confirm gold accents stay readable on `coco-neutral-950`; light-mode verify on `coco-neutral-50`. Strict TDD: update any test pinning a class name containing `primary` to expect the new gold class names; no new test files.

## Affected Specs

None. No requirement in `openspec/specs/sales/spec.md` (REQ-1–11) covers payment-modal color tokens. New: None. Modified: None.

## Risks

- **Visual regression on the critical payment step (Low)** — high-attention moment; iterate visually after first commit (as in SDD-3/4).
- **Light-mode readability of gold accents (Med)** — `coco-gold-500` is low-contrast on light surfaces; verify both modes.
- **`UInputNumber color="warning"` may render orange, not gold (Low)** — fall back to `color="neutral"` if needed.
- **Test selectors break on class name changes (Med)** — update selectors; keep behavior assertions intact.
- **Cerrar button on success modal reads too "final" with gold (Low)** — see open questions.

## Rollback Plan

`git revert` the merge commit. Visual-only token substitution; undoing restores default Nuxt UI primary with no API or data-shape changes.

## Dependencies

None. Nuxt UI 4 + Tailwind v4 + Coco token foundation from SDD-1.

## Success Criteria

- [ ] No `text-primary`, `bg-primary`, `border-primary/*`, or unoverridden `color="primary"` anywhere in the three target components.
- [ ] Total banners, selected method tiles, and icons in payment modals use `coco-gold` / `--brand-action` tokens.
- [ ] Confirmar cobro / Confirmar cobro deuda / Cerrar buttons follow the `SaleTotalsFooter` Cobrar precedent (`!bg-(--brand-action) !text-black`).
- [ ] Dark-first treatment: gold accents readable on `coco-neutral-950`; light-mode readable on `coco-neutral-50`.
- [ ] `pnpm build` clean; existing tests pass after selector updates; no new Coco tokens introduced; `SaleTotalsFooter` unchanged.

## Open Questions

1. **PaymentSuccessModal "Cambio" amount color** — gold accent (brand moment), success (positive feedback), or highlighted (neutral)?
2. **Cerrar button on PaymentSuccessModal** — gold (matches Cobrar precedent) or neutral (de-emphasize close on a celebration)?
3. **DebtPaymentModal aggregate warning banner** (`bg-warning/10`, `border-warning/20`) — keep warning or re-tint to gold-adjacent for visual consistency?