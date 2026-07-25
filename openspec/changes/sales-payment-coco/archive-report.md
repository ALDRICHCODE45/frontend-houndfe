# Archive Report: sales-payment-coco

## Change Metadata

- **Change**: sales-payment-coco (SDD-5)
- **Artifact store**: hybrid (OpenSpec + Engram archive report)
- **Project**: frontend-houndfe
- **Archived on**: 2026-07-25
- **Final verdict**: PASS WITH NOTES
- **Branch**: `sdd-5-sales-payment-coco` — intentionally left unmerged for the user's manual merge
- **Specification sync**: None. The proposal declares `Affected Specs: None`; no delta was merged into the canonical sales spec.

## Summary

SDD-5 Coco-ized the complete POS payment arc across `PaymentModal`, `PaymentSuccessModal`, and `DebtPaymentModal`: primary-blue structural and inline accents were replaced with mode-aware Coco gold tokens, all payment actions now follow the canonical `--brand-action` button treatment, and amount inputs use the documented non-primary warning color. Component contracts and behavior were preserved, five focused regression assertions were added, the full 2,912-test suite and production build passed, and `SaleTotalsFooter` plus all declared out-of-scope surfaces remained unchanged.

## Branch and Commit Summary

- **Branch**: `sdd-5-sales-payment-coco`
- **Implementation commits**: 5
  1. `0f7fe77` — `feat(sales): coco-ize PaymentModal payment surface`
  2. `184ec27` — `feat(sales): coco-ize PaymentSuccessModal`
  3. `412081c` — `feat(sales): coco-ize DebtPaymentModal`
  4. `34587cd` — `test(sales): pin coco-gold tokens on payment modals`
  5. `0c27c76` — `chore(sales): verify payment coco tokens`
- **Implementation files changed**: 7 (3 components, 3 test files, 1 verification artifact)
- **Implementation line count**: +177 / -16 = 193 changed lines
- **Merge state**: Not merged. The branch is ready for the user's manual merge to `main`.

## PMT-REQ Coverage

| Requirement | Result | Evidence summary |
|---|---|---|
| PMT-REQ-001 — No Primary-Blue Survival | PASS | No primary text/background/border classes remain; semantic action fallback props are overridden by `--brand-action`; behavior and scope preserved. |
| PMT-REQ-002 — Coco Gold Structural Accents | PASS | Total banners, selected method tiles, and unselected hover states use the specified coco-gold tint tokens. |
| PMT-REQ-003 — Coco Gold Inline Accents | PASS | Method icons, the “Agregar fecha” link, and Cambio amount use light/dark Coco gold classes. |
| PMT-REQ-004 — Coco Action Button Pattern | PASS | Confirmar cobro, Confirmar cobro deuda, and Cerrar share the canonical Coco brand-action class set. |
| PMT-REQ-005 — UInputNumber Color Fallback | PASS WITH NOTE | Both inputs use `color="warning"`; user visual confirmation remains required before deciding whether to fall back to neutral. |
| PMT-REQ-006 — Regression Guard | PASS | Focused tests 37/37, full suite 2912/2912, and `pnpm build` all pass; five class-pinning assertions were added. |

## User-Action Items (Post-Merge)

1. **UInputNumber focus ring on dark** — Confirm whether `color="warning"` reads as Coco gold or orange on `coco-neutral-950`. If orange, change both payment inputs to `color="neutral"`.
2. **Cerrar button intensity** — Inspect the gold Cerrar action next to the green success badge. If it competes visually, use the documented neutral solid fallback.
3. **Light-mode gold contrast decision** — `coco-gold-700` on `coco-neutral-50` is approximately 3.4:1, below WCAG AA for normal text. Decide whether to use gold-800 for all light-mode inline accents, reserve gold-700 for icon-only/large-text use, or bump only the 12px “Agregar fecha” link (and evaluate the 14px Cambio value).
4. **Full dark/light walkthrough** — Exercise PaymentModal, PaymentSuccessModal, and DebtPaymentModal end-to-end in both themes, including method selection, amount entry, success/change display, warning hierarchy, and confirmation actions.

## OpenSpec Artifacts Policy

The prior SDD archive precedent (`c277e98`, `docs(pos): archive sales-view-coco-redesign SDD`) committed only closure evidence (`archive-report.md`, `verify-report.md`, and the canonical spec) while leaving planning artifacts out of Git. SDD-5 therefore follows that policy:

- **Committed in the SDD archive documentation commit**: `openspec/changes/sales-payment-coco/archive-report.md`, `openspec/changes/sales-payment-coco/verify-report.md`
- **Left untracked as working OpenSpec artifacts**: `proposal.md`, `specs/sales/spec.md`, `design.md`, `tasks.md`
- **Already committed by implementation T5**: `VERIFICATION.md`
- **Canonical spec update**: None, because this change declared no affected source-of-truth specs.

The persisted `tasks.md` checkboxes were mechanically reconciled during archive from `[ ]` to `[x]`. The five matching implementation commits and the PASS verification report prove T1–T5 complete; this prevents a stale unchecked audit trail while preserving `sdd-apply`'s demonstrated completion evidence.

## Suggested Follow-Up SDDs

- **SDD-6**: Sales list + detail Coco-ization
- **SDD-7**: Products catalog Coco-ization
- **SDD-8**: Customers + orders + promotions Coco-ization
- **SDD-9**: Dashboard shell Coco-ization

## Merge Instructions

```bash
# On main:
git merge --no-ff sdd-5-sales-payment-coco -m "Merge branch 'sdd-5-sales-payment-coco' into main"
# or
git merge --ff-only sdd-5-sales-payment-coco  # if you want linear history
```

## Closure

SDD-5 is complete at code-review and automated-test level with four explicit post-merge visual decisions outstanding. The feature branch remains unchanged with respect to merge state and is ready for the user to merge manually when those notes are accepted or resolved.
