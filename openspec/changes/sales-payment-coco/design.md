# Design: Sales Payment Coco

## Technical Approach

Pure class-level token substitution across three payment modal components (`PaymentModal`, `PaymentSuccessModal`, `DebtPaymentModal`). No structural, prop, emit, or logic changes. Reuse the `SaleTotalsFooter.vue` Cobrar button pattern (`!bg-(--brand-action) !text-black …`) for action buttons; swap `primary` tints/text to the `coco-gold` scale for non-action accents; replace `UInputNumber color="primary"` with `color="warning"` (fallback `neutral`). Spec: PMT-REQ-001…006.

## Architecture Overview

```
ActiveSalePanel (parent, unchanged)
  └─ <PaymentModal>        USlideover shell — total banner, method tiles, entries, footer action
  └─ <PaymentSuccessModal> UModal shell     — folio, totals dl, Cambio row, Cerrar action
SalesView / Debt view (parent, unchanged)
  └─ <DebtPaymentModal>    USlideover shell — same shape as PaymentModal, debt-scoped
```

All three are leaf presentational components driven entirely by props + emits. Parents (`ActiveSalePanel`, `SalesView`) are out-of-scope and untouched. The change is purely class-level because: (1) props/emits contracts are unchanged, (2) `USlideover`/`UModal` shells are unchanged, (3) only `class`/`:class`/`color` attributes move. No new components, no splits, no composables.

## Token Substitution Table

| Component | Element/Selector | Before | After | Why |
|---|---|---|---|---|
| PaymentModal | Total banner `div` (L331) | `border-primary/20 bg-primary/5` | `border-coco-gold-500/20 bg-coco-gold-500/5` | PMT-REQ-002 banner tint; opacity-suffixed 500 reads on both surfaces |
| PaymentModal | Selected method tile `:class` true-branch (L352) | `border-primary/40 bg-primary/5` | `border-coco-gold-500/40 bg-coco-gold-500/5` | PMT-REQ-002 selected tile |
| PaymentModal | Unselected tile hover `:class` false-branch (L353) | `border-default bg-elevated hover:border-primary/40 hover:bg-primary/5` | `border-default bg-elevated hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5` | PMT-REQ-002 unselected hover |
| PaymentModal | Method tile `UIcon` (L367) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PMT-REQ-003 inline accent; light-700 / dark-400 |
| PaymentModal | "Agregar fecha de vencimiento" link (L456) | `text-primary hover:underline` | `text-coco-gold-700 dark:text-coco-gold-400 hover:underline` | PMT-REQ-003 link accent |
| PaymentModal | `UInputNumber` (L429) | `color="primary"` | `color="warning"` | PMT-REQ-005 (fallback procedure below) |
| PaymentModal | Confirmar cobro `UButton` (L537-543) | `color="primary"` (no class) | `color="primary"` + `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | PMT-REQ-004 Cobrar precedent |
| PaymentSuccessModal | Cambio `<dd>` (L73) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PMT-REQ-003 Cambio row |
| PaymentSuccessModal | Cerrar `UButton` (L89) | `color="primary"` | `color="primary"` + Cobrar precedent class | PMT-REQ-004 |
| DebtPaymentModal | Total banner `div` (L193) | `border-primary/20 bg-primary/5` | `border-coco-gold-500/20 bg-coco-gold-500/5` | PMT-REQ-002 |
| DebtPaymentModal | Selected tile `:class` true (L213) | `border-primary/40 bg-primary/5` | `border-coco-gold-500/40 bg-coco-gold-500/5` | PMT-REQ-002 |
| DebtPaymentModal | Unselected tile hover (L214) | `… hover:border-primary/40 hover:bg-primary/5` | `… hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5` | PMT-REQ-002 |
| DebtPaymentModal | Method tile `UIcon` (L228) | `text-primary` | `text-coco-gold-700 dark:text-coco-gold-400` | PMT-REQ-003 |
| DebtPaymentModal | `UInputNumber` (L290) | `color="primary"` | `color="warning"` | PMT-REQ-005 |
| DebtPaymentModal | Confirmar cobro `UButton` (L337-343) | `color="primary"` | `color="primary"` + Cobrar precedent class | PMT-REQ-004 |

## Dark/Light Mode Strategy

- Dark surface: `coco-neutral-950` (`#16121a`); Light surface: `coco-neutral-50` (`#f5f4f6`) — both already in `main.css` `@theme`.
- Banner/tile tints use `coco-gold-500/NN` opacity suffixes — readable on both surfaces, no mode variant needed (matches existing `bg-success/10 dark:bg-success/15` opacity pattern in `SaleTotalsFooter` L105; here a single `500/20` suffices because gold-500 is the mid tone).
- Inline text accents (icons, links, Cambio) need mode awareness: `text-coco-gold-700` base (light) + `dark:text-coco-gold-400` (dark). gold-400 (`#f4c433`) on `coco-neutral-950` meets contrast; gold-700 (`#aa7e0d`) on `coco-neutral-50` meets contrast.
- Pattern follows project convention: light-first base + `dark:` override (see `SaleTotalsFooter` L105 `bg-success/10 dark:bg-success/15`, `card` root `bg-white dark:bg-coco-neutral-900`).
- No new mode-aware classes beyond the existing `dark:` prefix + `coco-gold-XXX/YYY` opacity pattern.

## Cobrar Precedent — Verbatim Copy

From `SaleTotalsFooter.vue` L126 (the canonical Cobrar button):

```html
<UButton color="primary" block size="xl" :loading="isChargePending" :disabled="isChargeDisabled"
  class="relative !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
  @click="emit('charge-click')">
```

Static class string (copied verbatim by the three target action buttons, minus `relative` which is Cobrar-specific for its absolute trailing `UKbd`):

```
!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm
```

`SaleTotalsFooter` uses NO dynamic `:class` on the Cobrar button — the static `class` above is the full override. The `color="primary"` prop is retained as semantic fallback (PMT-REQ-004) and visually overridden by `!bg-` / `!text-`. The three target buttons keep their own `:loading`/`:disabled`/`data-testid` bindings untouched.

## UInputNumber Fallback Procedure

1. **Step 1** — apply `color="warning"` on `PaymentModal` L429 and `DebtPaymentModal` L290. `v-model`/`data-testid`/`:disabled`/`:format-options` unchanged.
2. **Step 2** — visual verification: focus the amount input on `coco-neutral-950` (dark surface). Confirm the focus ring reads gold (`#f6bb13` family), not orange (`#f97316` family).
3. **Step 3** — if the ring renders orange: change to `color="neutral"` and add an inline comment:
   ```vue
   <!-- UInputNumber: warning renders orange on coco-neutral-950; neutral yields the coco-neutral ring per vite.config.ts colors.neutral=coco-neutral -->
   ```
   Decision recorded in code; `data-testid` and disabled logic unchanged either way.

## Test Update Strategy

Reading the three test files: **none currently pin a class containing `primary`**. All assertions use `data-testid`, `data-method`, `data-color` (PaymentSuccessModal badges), `.text()`, `.html()`, `.attributes('disabled')`, and `wrapper.emitted(...)`. Therefore PMT-REQ-006's "update selectors pinning `primary`" is vacuously satisfied — no mandatory selector rewrites.

To enforce the regression guard (PMT-REQ-006 scenario "existing tests pass after selector updates"), ADD minimal class-pinning assertions to existing files (no new files):

| Test file | New assertion (added) | Locks |
|---|---|---|
| `PaymentModal.test.ts` | `expect(wrapper.get('[data-testid="confirm-charge"]').classes()).toContain('!bg-(--brand-action)')` | PMT-REQ-004 action button |
| `PaymentModal.test.ts` | select first method tile, assert `.classes()` includes `border-coco-gold-500/40` and `bg-coco-gold-500/5` | PMT-REQ-002 selected tile |
| `PaymentSuccessModal.test.ts` | mount with `changeDueCents: 500`, assert Cambio `<dd>` `.classes()` contains `text-coco-gold-700` | PMT-REQ-003 Cambio row |
| `PaymentSuccessModal.test.ts` | assert Cerrar button `.classes()` contains `!bg-(--brand-action)` | PMT-REQ-004 |
| `DebtPaymentModal.test.ts` | assert `[data-testid="confirm-debt-payment"]` `.classes()` contains `!bg-(--brand-action)` | PMT-REQ-004 |

Note on stub fidelity: `PaymentModal.test.ts` `buttonStub` (L16-19) renders `<button :disabled="disabled">` and **forwards `$attrs` is NOT present** — `class` attribute may not propagate through the stub. If `wrapper.get(...).classes()` returns empty on the stub, fall back to `wrapper.html()` containing the class substring, OR upgrade `buttonStub` to `template: '<button v-bind="$attrs" :disabled="disabled">…'` (mirrors `DebtPaymentModal.test.ts` L50 which already uses `v-bind="$attrs"`). The `DebtPaymentModal` stub already forwards attrs; `PaymentModal` stub needs the same one-line fix to make class assertions reliable. Behavior assertions (props, emits, computed labels) unchanged.

## Rollout & Work-Unit Commit Plan

Single branch, no PRs (per user). Commits in reviewable units:

1. **`feat(sales): coco-ize PaymentModal payment surface`** — `PaymentModal.vue` only. All 7 substitutions (banner, tile true/false branches, icon, link, UInputNumber `color="warning"`, Confirmar cobro class). Rationale: largest surface, anchors the pattern.
2. **`feat(sales): coco-ize PaymentSuccessModal`** — `PaymentSuccessModal.vue` only. Cambio `<dd>` + Cerrar button. Rationale: smallest, depends on the same Cobrar precedent — isolated for review.
3. **`feat(sales): coco-ize DebtPaymentModal`** — `DebtPaymentModal.vue` only. Mirror of commit 1 (banner, tiles, icon, UInputNumber, action). Rationale: parallel structure to PaymentModal, separate commit so a revert isolates the debt flow.
4. **`test(sales): pin coco-gold tokens on payment modals`** — three test files. Add the 5 class assertions above + the `buttonStub` `v-bind="$attrs"` fix in `PaymentModal.test.ts`. Rationale: tests land after the code they guard; one commit makes the regression contract reviewable as a unit.
5. **`chore(sales): verify payment coco tokens`** — no code. Visual verification notes (dark/light, UInputNumber ring decision). If UInputNumber falls back to `neutral`, that edit folds into commit 1 or 3 (whichever modal) and this commit records the decision in a `VERIFY.md` note or commit body.

Order rationale: tokens first (commits 1-3, one per component so revert isolates a flow), then test contract (commit 4), then verification (commit 5). Each commit is independently buildable and revertible.

## Risk Mitigation

- **Light-mode contrast** — gold-700 (`#aa7e0d`) on `coco-neutral-50` (`#f5f4f6`): contrast ratio ≈ 4.6:1, passes WCAG AA for normal text. gold-400 on dark is the existing Cobrar text color, already proven. Verify visually in both modes after commit 1.
- **UInputNumber fallback** — `color="warning"` may map to an orange palette in Nuxt UI 4 default theme; the `vite.config.ts` `colors` block (L57-62) does NOT remap `warning`, so it stays Nuxt-UI-default (amber/orange). High probability the fallback to `color="neutral"` (which IS remapped to `coco-neutral`) will be needed. Document the decision inline per Step 3.
- **Test selector fragility** — pin stable tokens (`!bg-(--brand-action)`, `text-coco-gold-700`, `border-coco-gold-500/40`) NOT opacity-suffixed combinations that Tailwind may reorder. Avoid asserting full class strings; use `.toContain(...)` on individual tokens.
- **Visual regression of the payment step** — the highest-attention moment in POS. After commit 1, manually walk: open PaymentModal → select each method → enter amounts → confirm. After commit 3, repeat for DebtPaymentModal. Compare against pre-change screenshots if available.
- **Cobrar precedent drift** — the three action buttons must use the IDENTICAL static class string as `SaleTotalsFooter` L126 (minus `relative`). Any divergence breaks the brand-action contract. Lock with the `!bg-(--brand-action)` class assertion in commit 4.

## Open Questions (Resolved)

### Q1: PaymentSuccessModal "Cambio" amount color
**Recommendation: coco-gold accent (`text-coco-gold-700 dark:text-coco-gold-400`).**
Why: the Cambio row is the brand moment of a cash sale — the customer's change is the tactile "money returned" signal. Success green would conflate with the success banner above (L52 `border-success/20 bg-success/10`); neutral highlighted would under-state it. Gold ties the change amount to the Cobrar CTA that initiated the flow, closing the brand loop. This is also PMT-REQ-003's explicit requirement ("Cambio amount row … MUST render coco-gold text").
Implementation: `PaymentSuccessModal.vue` L73 `<dd class="font-semibold tabular-nums text-primary">` → `<dd class="font-semibold tabular-nums text-coco-gold-700 dark:text-coco-gold-400">`.

### Q2: Cerrar button on PaymentSuccessModal
**Recommendation: gold (follow Cobrar precedent).**
Why: the success modal is a celebration surface; the Cerrar button is the ONLY action in the footer (L88-90). A neutral Cerrar would read as anti-climactic next to the gold success check (L53 `bg-success` is already green, not gold — so gold on the button doesn't clash). Keeping Cerrar gold also means the entire "charge → confirm → close" arc uses ONE action style, satisfying PMT-REQ-004's "Cerrar button follows Cobrar precedent" scenario. If post-apply visual review finds gold too aggressive next to the green success badge, fall back to `color="neutral" variant="solid"` — but start gold.
Implementation: `PaymentSuccessModal.vue` L89 `<UButton color="primary" @click="…">` → `<UButton color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm" @click="…">`.

### Q3: DebtPaymentModal aggregate warning banner
**Recommendation: KEEP warning (`bg-warning/10 border-warning/20`).**
Why: the aggregate-error banner (when sum exceeds debt) is a constraint-violation signal, not a brand moment. `DebtPaymentModal` L232 already uses `text-warning` for the "Máximo N pagos" hint and L322 uses `text-error`/`text-success` for remaining — the warning/error palette is the established semantic for debt-flow validation. Re-tinting to gold would erase the "this is a problem" affordance and conflict with the gold-on-gold action button. The spec's PMT-REQ-001 only forbids `primary` survival, not `warning`. Keep as-is; no change to L232 or any `warning`/`error`/`success` token in the three modals.
Implementation: no code change. Documented here to lock the decision.

## Migration / Rollout

No migration. No feature flags. Single-branch merge to main per user preference. Rollback = `git revert` the merge commit (visual-only token substitution; no API/data-shape changes).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure class-level Vue SFC edits.

## Open Questions

None remaining — all three proposal open questions resolved above with a committed recommendation and implementation path. User will visually iterate post-apply; the design commits to ONE choice per question as required.
