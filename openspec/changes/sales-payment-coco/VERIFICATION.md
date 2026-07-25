# Verification — Sales Payment Coco (SDD-5)

Status: **code-reviewed only**. The visual walkthrough requires a running
dev server with the user's display; it is pending the user's post-merge
review per design §Risk Mitigation and tasks.md T5.

## Acceptance checklist (code review)

| Check | Status | Evidence |
|---|---|---|
| No `text-primary`, `bg-primary`, `border-primary/*` classes in 3 modals | Pass | `grep -n primary` on the three components returns 1 hit per file — all three are the documented `color="primary"` semantic fallback on the action buttons (PaymentModal L539, PaymentSuccessModal L89, DebtPaymentModal L339), each visually overridden by the `!bg-(--brand-action) !text-black` class. |
| Total banners + selected tiles use `coco-gold-500/NN` | Pass | PaymentModal L331, L352; DebtPaymentModal L193, L213 |
| Unselected tile hover uses `hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5` | Pass | PaymentModal L353; DebtPaymentModal L214 |
| Method icons use `text-coco-gold-700 dark:text-coco-gold-400` | Pass | PaymentModal L367; DebtPaymentModal L228 |
| "Agregar fecha de vencimiento" link gold | Pass | PaymentModal L456 |
| Cambio `<dd>` gold | Pass | PaymentSuccessModal L73 |
| Confirmar cobro / Confirmar cobro deuda / Cerrar follow Cobrar precedent | Pass | All three carry identical static class: `!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm` |
| `UInputNumber color="warning"` (PaymentModal + DebtPaymentModal) | Pass | PaymentModal L429; DebtPaymentModal L290 — see UInputNumber Ring Decision below |
| Props, emits, computed logic, `data-testid`, `aria-label`, focus order, `USlideover`/`UModal` shell semantics unchanged | Pass | Diff is class-level only; all binding sites untouched. Existing behavioral tests still green. |
| `SaleTotalsFooter.vue` diff empty | Pass | `git diff main HEAD -- src/features/POS/sales/components/SaleTotalsFooter.vue` returns 0 lines |
| No `main.css` / `vite.config.ts` changes | Pass | Files outside the listed scope are untouched; `git diff main HEAD --stat` shows changes confined to the 3 components + 3 test files + this VERIFICATION.md |
| `pnpm build` clean | Pass | `vue-tsc --build` + `vite build` both succeed; bundle warning unchanged (pre-existing 500kB chunk size warning) |
| Focused test command | Pass | `npx vitest run src/features/POS/sales/components/__tests__/PaymentModal.test.ts src/features/POS/sales/components/__tests__/PaymentSuccessModal.test.ts src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts` → 3 files, 37 tests, all green |
| `buttonStub` in PaymentModal forwards `$attrs` | Pass | PaymentModal.test.ts L17 now uses `v-bind="$attrs"` (mirrors DebtPaymentModal stub which already did) |
| Class-pinning regression assertions added | Pass | 5 new assertions: 2 in PaymentModal, 2 in PaymentSuccessModal, 1 in DebtPaymentModal — counts 32 → 37 |

## UInputNumber Ring Decision (PMT-REQ-005)

**Decision: keep `color="warning"`** (no fallback to `neutral` in code).

Rationale:
- `vite.config.ts` colors block remaps `neutral` → `coco-neutral` but does
  NOT remap `warning` — Nuxt UI 4 default warning palette is amber/orange.
- We have no dev-server access in this agent context to confirm the actual
  focus-ring color rendered on `coco-neutral-950`.
- Per design §UInputNumber Fallback Procedure Step 3, the fallback to
  `color="neutral"` requires a positive visual confirmation that the
  `warning` ring renders orange.
- This is the **optimistic case** per the orchestrator's instructions:
  apply `warning`, defer to user-side visual walkthrough. If the user
  reports orange rings post-merge, the fallback is a one-line change in
  two components (PaymentModal L429, DebtPaymentModal L290) plus this
  VERIFICATION.md note update.

If the user later flags orange rings, the fix in a follow-up commit:
```vue
<!-- UInputNumber: warning renders orange on coco-neutral-950; neutral
     yields the coco-neutral ring per vite.config.ts colors.neutral=coco-neutral -->
<UInputNumber ... color="neutral" ... />
```

## Dark/light verification (pending user-side walkthrough)

What was code-reviewed:
- `text-coco-gold-700` for light-mode inline accents — `coco-gold-700`
  (`#aa7e0d`) on `coco-neutral-50` (`#f5f4f6`) computes to a contrast
  ratio of ≈ 4.6:1, passes WCAG AA for normal text per design §Risk
  Mitigation.
- `dark:text-coco-gold-400` for dark-mode inline accents — `coco-gold-400`
  (`#f4c433`) on `coco-neutral-950` (`#16121a`) meets contrast. This is
  the same pattern already proven by the Cobrar text color.
- Banner / tile tints use single-mode `coco-gold-500/NN` opacity suffixes
  — `coco-gold-500` is the mid tone, readable on both surfaces per
  design §Dark/Light Mode Strategy.

What requires user-side walkthrough (cannot run dev server here):
- Walkthrough of PaymentModal flow: open with each method selected,
  enter amounts, confirm.
- Walkthrough of PaymentSuccessModal: complete a cash payment with
  changeDue > 0 and inspect Cambio row + Cerrar button in both themes.
- Walkthrough of DebtPaymentModal flow: open, select methods, enter
  amounts, confirm — verify gold accents against the existing
  warning-toned aggregate-error banner for visual hierarchy.
- UInputNumber focus-ring color verification on `coco-neutral-950` and
  `coco-neutral-50`. **This is the decision gate for the `warning` vs
  `neutral` fallback above.**

## Summary

| Metric | Value |
|---|---|
| Commits | 5 (one per task T1–T5) |
| Files changed | 6 (3 components + 3 test files) + this VERIFICATION.md |
| Source components | 3 (PaymentModal.vue, PaymentSuccessModal.vue, DebtPaymentModal.vue) |
| Test files | 3 (PaymentModal.test.ts, PaymentSuccessModal.test.ts, DebtPaymentModal.test.ts) |
| Test count delta | 32 → 37 (+5 class-pinning assertions) |
| Source diff lines | ~20 (7 + 2 + 5 substitutions + 3 button-stub updates) |
| `SaleTotalsFooter.vue` diff | empty (0 lines) |
| `main.css` / `vite.config.ts` diff | empty |
| `pnpm build` | clean |
| Focused vitest | 3 files, 37/37 passing |

## Next steps for the user

1. **Visual walkthrough of all three modals in dark + light** — top
   priority. Especially the UInputNumber focus ring on the amount field.
2. If UInputNumber ring reads orange, approve the one-line fallback to
   `color="neutral"` in PaymentModal L429 and DebtPaymentModal L290.
3. If Cerrar button reads too "final" next to the green success badge,
   the design §Q2 fallback is `color="neutral" variant="solid"` — also
   a small change.
4. Otherwise: merge the branch to main per project convention (manual
   merge, no PR).