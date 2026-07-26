# Archive Report: sales-history-coco

## Change Metadata

- **Change**: sales-history-coco (SDD-6)
- **Artifact store**: hybrid (OpenSpec + Engram archive report)
- **Project**: frontend-houndfe
- **Archived on**: 2026-07-25
- **Final verdict**: **PASS**
- **Branch**: `sdd-6-sales-history-coco` — intentionally left unmerged for the user's manual merge
- **Specification sync**: None. The proposal declares `Affected Specs: None`; no delta was merged into the canonical sales spec.

## Summary

SDD-6 Coco-ized the sales-history surface across `SalesListView`, `SaleDetailView`, `SaleCard`, `SaleDetailTimeline`, `SaleDetailTotalsCard`, and `SaleCommentInput`: the primary-blue "Nueva Venta" / "Registrar pago" / "Registrar Pago" CTAs were re-skinned with the canonical `--brand-action` Cobrar treatment; the raw `bg-white/90` sticky header, five Datos-tab cards, and `SaleCard` `<UCard>` wrappers were replaced with `bg-coco-neutral-50/950` Coco surfaces; timeline `SALE_REGISTERED`, the connector line, the row folio link, the `SaleCard` folio, and the comment trigger were re-tinted with `coco-gold` and `coco-neutral` tokens (no primary blue survives in the six target files). Component contracts (`data-testid`, props, emits, computed logic, `aria-label`, focus order) were preserved, six focused regression suites were updated with class-pinning assertions, the full 2,913-test suite and production build passed, and `PaymentModal` / `PaymentSuccessModal` / `DebtPaymentModal` / `SaleTotalsFooter` / `ActiveSalePanel` plus all declared out-of-scope surfaces remained unchanged.

## Branch and Commit Summary

- **Branch**: `sdd-6-sales-history-coco`
- **Implementation commits**: 7 (work-unit-commits convention, smallest → largest, visual-review checkpoint between T3 and T4)
  1. `c87614c` — `feat(sales): coco-ize SalesListView action + folio link` (T1)
  2. `5cbddcc` — `feat(sales): coco-ize SaleCard folio + UCard surface` (T2)
  3. `80db311` — `feat(sales): coco-ize SaleDetailTimeline event + connector` (T3 — visual review checkpoint, approved)
  4. `1974e62` — `feat(sales): coco-ize SaleDetailTotalsCard Registrar Pago CTA` (T4)
  5. `9f91b7a` — `feat(sales): coco-ize SaleCommentInput trigger tint` (T5)
  6. `7d93283` — `feat(sales): coco-ize SaleDetailView header + Datos cards + header CTA` (T6)
  7. `8fc9433` — `test(sales): pin coco tokens on sales-history components` (T7)
- **Archive docs commit**: `docs(pos): archive sales-history-coco SDD` (this commit — adds `archive-report.md` and `verify-report.md`)
- **Implementation files changed**: 12 (6 components + 6 test files)
- **Implementation line count** (`main..sdd-6-sales-history-coco`): +157 / -24 = 181 changed lines
- **Merge state**: Not merged. `git merge-tree main sdd-6-sales-history-coco` returns a single SHA with no conflict markers — the branch is ready for the user's manual merge to `main`.

## HST-REQ Coverage

| Requirement | Result | Evidence summary |
|---|---|---|
| HST-REQ-001 — No Primary-Blue Survival | PASS | Zero `text-primary` / `bg-primary` / `border-primary/` tokens in 6 target files. Zero `data-color="primary"` on `SaleCommentInput`. The 4 remaining `color="primary"` props all carry `!bg-(--brand-action)` or `text-coco-gold-*` overrides. |
| HST-REQ-002 — Coco Surface Treatment | PASS | Sticky header uses `bg-coco-neutral-50/90 dark:bg-coco-neutral-950/90` (translucency preserved). All 5 Datos-tab cards use `bg-coco-neutral-50 dark:bg-coco-neutral-950`. `SaleCard` and `SalesListView` `<UCard>` wrappers expose `ui.body` with coco-neutral surface; the redundant `bg-default` was dropped from `SaleCard`. |
| HST-REQ-003 — Cobrar Action Button Pattern | PASS | "Nueva Venta" (L177), "Registrar pago" header (`register-payment-header`), and "Registrar Pago" totals card (`register-debt-payment`) all share the canonical class string `!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm` with `color="primary"` semantic fallback. Verbatim copy from `SaleTotalsFooter.vue` L126. |
| HST-REQ-004 — Coco Gold Inline Accents | PASS | Timeline `SALE_REGISTERED` → `text-coco-gold-700 dark:text-coco-gold-400 bg-coco-gold-500/10`. Connector → `bg-coco-neutral-200 dark:bg-coco-neutral-800`. Folio link + `SaleCard` folio → `text-coco-gold-800 dark:text-coco-gold-400` (gold-800 for AA at 14px). Comment trigger → `!bg-coco-gold-500/15 !text-coco-gold-800 dark:!text-coco-gold-300`, `color="primary"` prop dropped. |
| HST-REQ-005 — Dark-First and Light-Mode Readability | PASS | Gold-800 on neutral-50 = 6.22:1 (AA normal text). Gold-400 on neutral-950 = 11.26:1 (AA dark). Gold-700 on neutral-50 = 3.36:1 (WCAG 1.4.11 graphical-object exception for 20px timeline icon only — see carve-out below). Cobrar buttons: `!text-black` on `--brand-action` ≈ 9.6:1 in both modes. |
| HST-REQ-006 — No-Token / No-Logic / No-Coco-Regression | PASS | `main.css` and `vite.config.ts`: 0 lines diff. 5 already-Coco files (`PaymentModal`, `PaymentSuccessModal`, `DebtPaymentModal`, `SaleTotalsFooter`, `ActiveSalePanel`): 0 lines diff. Full suite 2,913/2,913 pass. |
| HST-REQ-007 — Test Selector Updates | PASS | `SaleDetailTimeline.test.ts` SALE_REGISTERED classes → `expect.arrayContaining(['text-coco-gold-700', 'dark:text-coco-gold-400', 'bg-coco-gold-500/10'])`. `SaleCommentInput.test.ts` `data-color` assertion → NOT `'primary'`, class-pinning `!bg-coco-gold-500/15`. All 6 test files gained design-table class assertions. |
| HST-REQ-008 — Accessibility Preservation | PASS | All `data-testid` anchors preserved (`sale-detail-header`, `register-payment-header`, `register-debt-payment`, `comment-open`, 5× `reflow-*`, `sale-link-*`, `timeline-event-icon-*`). All `aria-label` preserved. Focus order unchanged. Cobrar action buttons remain focusable and keyboard-operable. Color is never the sole state indicator. |

## WCAG AA Contrast Verification

| Combination | Ratio | Threshold | Verdict |
|---|---|---|---|
| `coco-gold-800` (#745609) on `coco-neutral-50` (#f5f4f6) | **6.22:1** | 4.5:1 (AA normal text) | PASS — used for 14px folio link, `SaleCard` folio, and comment-trigger text |
| `coco-gold-400` (#f4c433) on `coco-neutral-950` (#16121a) | **11.26:1** | 4.5:1 (AA normal text) | PASS — dark-mode folio link, `SaleCard` folio, and comment-trigger text |
| `coco-gold-700` (#aa7e0d) on `coco-neutral-50` (#f5f4f6) | **3.36:1** | 3.0:1 (WCAG 1.4.11 non-text contrast) | **CARVE-OUT** — graphical-object exception for the 20px timeline `SALE_REGISTERED` icon only. Spec HST-REQ-004 and design §3 explicitly reserve `coco-gold-700` for this icon; body text in the surface uses `coco-gold-800` to satisfy AA normal-text contrast. |

## User-Action Items (Post-Merge)

These are non-blocking visual / accessibility confirmations captured by the verify phase. None block archive; they are decisions for the user to make after the branch is merged to `main`.

1. **Visual review of T3 timeline checkpoint** — the timeline `SALE_REGISTERED` coco-gold tint (`text-coco-gold-700 dark:text-coco-gold-400 bg-coco-gold-500/10`) and the connector line (`bg-coco-neutral-200 dark:bg-coco-neutral-800`) were visually approved during apply after T3 per the SDD-5 precedent (T3 stop-point). The user should re-validate the timeline appearance during a live walkthrough of `/pos/ventas/:id` once the branch is merged and exercise several sales with multi-event timelines (≥ 2 events) in both light and dark modes.

2. **WCAG AA carve-out for the timeline icon** — `coco-gold-700` at 3.36:1 on the 20px `SALE_REGISTERED` icon. Passes WCAG 1.4.11 (non-text contrast ≥ 3:1 for graphical objects). The user should confirm this intent matches their accessibility policy: if a stricter rule (≥ 4.5:1 for all UI elements) is preferred, the icon should be re-tinted to `coco-gold-800` (which would push the AA ratio to ~4.6:1 on the light surface) and the dark side re-checked for the inverse tradeoff.

3. **`PaymentMethodPills` CARD_DEBIT still emits `color="primary"`** — out-of-scope carry-over from SDD-5. Documented in proposal §Risks and design §Risk Mitigation. The pill sits in the Datos tab of `SaleDetailView` and inherits the Nuxt UI `primary` color (which `vite.config.ts` maps to `coco` per the project token strategy), so visually it is already Coco. The carry-over is a test-pin concern (any future assertion that pins `data-color="primary"` on this pill will fail), not a visual brand leak. Tracked as SDD-7+ scope.

## OpenSpec Artifacts Policy

The prior SDD archive precedent (`de423ab`, `docs(pos): archive sales-payment-coco SDD`, on `sdd-5-sales-payment-coco`) committed only closure evidence (`archive-report.md`, `verify-report.md`) while leaving planning artifacts out of Git. SDD-6 follows the same policy:

- **Committed in this SDD archive documentation commit**:
  - `openspec/changes/sales-history-coco/archive-report.md` (this file)
  - `openspec/changes/sales-history-coco/verify-report.md` (created by the verify phase)
- **Left untracked as working OpenSpec artifacts**:
  - `openspec/changes/sales-history-coco/proposal.md`
  - `openspec/changes/sales-history-coco/specs/sales/spec.md`
  - `openspec/changes/sales-history-coco/design.md`
  - `openspec/changes/sales-history-coco/tasks.md` (checkboxes mechanically reconciled from `[ ]` to `[x]` — see *Mechanical Reconciliation Note* below)
- **Canonical spec update**: None, because this change declared no affected source-of-truth specs (`Affected Specs: None`).

### Mechanical Reconciliation Note

Per the orchestrator's "match prior SDD convention" instruction and the SDD-5 archive precedent, the persisted `tasks.md` checkboxes were reconciled from `[ ]` to `[x]` for T1–T7 during archive. Completion is proven by the seven matching implementation commits (T1 = `c87614c`, T2 = `5cbddcc`, T3 = `80db311`, T4 = `1974e62`, T5 = `9f91b7a`, T6 = `7d93283`, T7 = `8fc9433`) and by the PASS verify-report (`verify-report.md` §Test Results: focused tests 6/6 pass, full suite 2,913/2,913 pass, `pnpm build` clean). The visual-review checkpoint between T3 and T4 was approved during apply (verify-report §Risks). This reconciliation prevents a stale unchecked audit trail for completed work; `sdd-apply` is normally responsible for checkbox completion, and this is the documented exceptional repair where the verify-report and on-disk commit log prove completion but the persisted tasks artifact was not updated during apply.

## Suggested Follow-Up SDDs

The sales surface still has out-of-scope Coco-ization targets captured in the proposal §Non-Goals and `verify-report.md` §Out-of-Scope Confirmation. Recommended ordering:

- **SDD-7**: Products catalog + `ProductCard` Coco-ization (`ProductsView`, `ProductCard`, `ProductCardGrid`, `ProductDetailView`) and catalog modals (`ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal`). Highest remaining brand-leak surface for the catalog browsing path.
- **SDD-8**: Customers + orders + promotions Coco-ization (`CustomersView`, `CustomerUpsertSlideover`, `AddressModal`, `OrdersView`, `PromotionsView`, `PromotionDetailView`, `PromotionForm`, all `Promotion*` components, `AssignCustomerSlideover`, `AssignSellerSlideover`). Larger feature surface; can be split if needed.
- **SDD-9**: Dashboard shell Coco-ization (`DashboardLayout`, `DashboardHomeView`, sidebar, navbar, `AppDataTable` in `core/shared`). Lowest daily-use urgency, but completes the brand sweep across the post-login shell.

If any of the three User-Action Items above resolve into a code change (e.g. timeline-icon tint), they can be folded into SDD-7 or stand alone.

## Unmerged Branches Status

By the close of SDD-6 the user has **three unmerged feature branches** waiting for manual merge to `main`. All three merge cleanly per `git merge-tree main <branch>` (single SHA, no conflict markers).

| Branch | SDD | Implementation commits ahead of main | Diff stat |
|---|---|---|---|
| `sdd-4-sales-layout-redesign` | SDD-4 (cart layout redesign) | 14 commits | 8 files, +631 / -223 |
| `sdd-5-sales-payment-coco` | SDD-5 (payment arc Coco) | 6 commits (5 impl + 1 archive docs) | 9 files, +428 / -16 |
| `sdd-6-sales-history-coco` | SDD-6 (sales history Coco, this SDD) | 8 commits (7 impl + 1 archive docs) | 12 files, +157 / -24 |

Merge strategies when the user is ready:

```bash
# Sequential merge (safest, easy to bisect):
git checkout main
git merge --no-ff sdd-4-sales-layout-redesign  -m "Merge SDD-4 sales layout redesign"
git merge --no-ff sdd-5-sales-payment-coco     -m "Merge SDD-5 sales payment coco"
git merge --no-ff sdd-6-sales-history-coco    -m "Merge SDD-6 sales history coco"

# Octopus-style (single merge commit, fastest):
git checkout main
git merge --no-ff sdd-4-sales-layout-redesign sdd-5-sales-payment-coco sdd-6-sales-history-coco \
  -m "Merge SDD-4, SDD-5, SDD-6 sales redesign + coco batch"

# Linear history (only if each branch tip is a strict descendant of main — they are not, so this fails):
git merge --ff-only sdd-6-sales-history-coco   # NOT recommended
```

## Merge Instructions

```bash
# On main:
git merge --no-ff sdd-6-sales-history-coco -m "Merge branch 'sdd-6-sales-history-coco' into main"
# or
git merge --ff-only sdd-6-sales-history-coco  # if you want linear history (requires strict descendant — currently NOT applicable)
```

## Closure

SDD-6 passes all 8 HST-REQ verifications, the full 2,913-test suite, and `pnpm build`. The feature branch is unchanged with respect to merge state and ready for the user to merge manually when convenient. Three explicit post-merge visual / accessibility decisions are documented above and remain non-blocking. The three unmerged SDD-4/5/6 branches all merge cleanly to `main` and can be merged individually or in a single octopus-style merge.