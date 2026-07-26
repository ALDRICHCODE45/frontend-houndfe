# Design: Sales History Coco

## Technical Approach

Pure class-level token substitution across six sales-history components. No structural, prop, emit, computed, or routing changes. Reuse the `SaleTotalsFooter.vue` Cobrar button class for the three "next action" CTAs; swap `primary` tints/text to the `coco-gold` scale for inline accents; replace raw `bg-white`/`bg-zinc-*` surfaces with `coco-neutral-50`/`coco-neutral-950`. Spec: HST-REQ-001…008.

## Architecture Overview

```
/pos/ventas          → SalesListView   (SalesListView.test.ts)
  └─ <SaleCard>                          (SaleCard.test.ts)
/pos/ventas/:id      → SaleDetailView  (SaleDetailView.test.ts — stubs UButton, no class pinning)
  ├─ sticky header [data-testid="sale-detail-header"]
  │     └─ "Registrar pago" header button [register-payment-header]
  ├─ <UTabs> Productos / Pagos y deuda / Datos / Comentarios  (unmount-on-hide=false → all panels live)
  │     ├─ Pagos   → <SaleDetailTotalsCard>  (SaleDetailTotalsCard.test.ts)
  │     │              └─ "Registrar Pago" [register-debt-payment]
  │     ├─ Datos   → 5 reflow-* cards (cajero/vendedor/cliente/price-list/payment-methods)
  │     └─ Comentarios → <SaleDetailTimeline> (SaleDetailTimeline.test.ts — pins SALE_REGISTERED classes)
  │                       <SaleCommentInput>   (SaleCommentInput.test.ts — pins data-color="primary")
```

All six are presentational, driven by props/emits. Parents and shell (`UTabs`/`DebtPaymentModal`/`AssignSellerSlideover`) are untouched (HST-REQ-006). The change is purely class-level: props/emits/`data-testid`/`aria-label`/focus order are identical. SDD-6 is independent of SDD-3/4/5 — different feature surface (history vs new-sale/payment); the 6 target files have no overlap with those change sets.

## Token Substitution Table

| Component | Element/Selector | Before | After | Why |
|---|---|---|---|---|
| SalesListView | "Nueva Venta" `UButton` (L177) | `color="primary" class="w-full sm:w-auto"` | `color="primary" class="w-full sm:w-auto !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | HST-REQ-003 Cobrar precedent |
| SalesListView | Folio `UButton` link (L187-194) | `variant="link" color="primary"` | `variant="link" color="primary" class="text-coco-gold-800 dark:text-coco-gold-400 font-medium hover:underline"` | HST-REQ-004 inline accent; gold-800 for AA (see §3) |
| SalesListView | `<UCard>` wrapper (L116) | `:ui="{ body: 'p-0 sm:p-0' }"` | `:ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"` | HST-REQ-002 surface |
| SaleDetailView | Sticky header (L278) | `bg-white/90 backdrop-blur-sm dark:bg-zinc-950/90` | `bg-coco-neutral-50/90 backdrop-blur-sm dark:bg-coco-neutral-950/90` | HST-REQ-002 header; keep `/90` translucency for sticky blur |
| SaleDetailView | 5 Datos cards `bg-white dark:bg-zinc-900` (L415,422,433,437,441) | `bg-white dark:bg-zinc-900` | `bg-coco-neutral-50 dark:bg-coco-neutral-950` | HST-REQ-002 cards |
| SaleDetailView | "Registrar pago" header `UButton` (L357-366) | (no `color`, no class) | `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | HST-REQ-003 Cobrar precedent |
| SaleCard | `<UCard>` wrapper (L27) | `class="rounded-xl border border-default bg-default" :ui="{ body: 'p-4' }"` | `class="rounded-xl border border-default" :ui="{ body: 'p-4 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"` | HST-REQ-002; drop `bg-default` (overridden by ui.body) |
| SaleCard | Folio `<p>` (L30) | `text-sm font-semibold text-primary` | `text-sm font-semibold text-coco-gold-800 dark:text-coco-gold-400` | HST-REQ-004; gold-800 for AA on light |
| SaleDetailTimeline | `EVENT_COLORS.SALE_REGISTERED` (L37) | `{ text: 'text-primary', bg: 'bg-primary/10' }` | `{ text: 'text-coco-gold-700 dark:text-coco-gold-400', bg: 'bg-coco-gold-500/10' }` | HST-REQ-004 icon tint (icon, not text — AA less critical) |
| SaleDetailTimeline | Connector `div.w-px` (L134) | `bg-gray-200` | `bg-coco-neutral-200 dark:bg-coco-neutral-800` | HST-REQ-004 connector |
| SaleDetailTotalsCard | "Registrar Pago" `UButton` (L84-92) | (no `color`, no class) | `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` | HST-REQ-003 Cobrar precedent; `debtClass` stays semantic |
| SaleCommentInput | "Agregar comentario" `UButton` (L37-46) | `variant="soft" color="primary"` | `variant="soft" color="primary" class="!bg-coco-gold-500/15 !text-coco-gold-800 dark:!text-coco-gold-300 hover:!bg-coco-gold-500/25"` | HST-REQ-004 soft tint; drops `data-color="primary"` visual (prop kept for semantic fallback, overridden by `!` classes) |

Note on SaleCommentInput: the `color="primary"` prop is retained (maps to `coco` per `vite.config.ts` `colors.primary='coco'`), but the test stub reads `data-color` from the prop. HST-REQ-007 requires `data-color` to NOT be `"primary"`. Resolution: drop `color="primary"` prop entirely and rely on the `!`-prefixed class override (soft variant default). The trigger becomes `variant="soft"` (no color) + class override → `data-color` is `undefined`, satisfying HST-REQ-004/007.

## Dark/Light Mode Strategy

- Dark surface: `coco-neutral-950` (`#16121a`); Light surface: `coco-neutral-50` (`#f5f4f6`) — both in `main.css` `@theme` (L21,31).
- Light-first base + `dark:` override (project convention, matches `SaleTotalsFooter` L105).
- **SDD-5 finding addressed**: `coco-gold-700` (`#aa7e0d`) on `coco-neutral-50` = **3.40:1** — BELOW WCAG AA (4.5:1) for normal text.
  - **Recommendation: Option A — `coco-gold-800` (`#745609`) for the 14px folio link and SaleCard folio.** Verified contrast: `coco-gold-800` on `coco-neutral-50` ≈ **6.3:1** (passes AA). Rationale: the folio is small inline text (14px, the highest-frequency read in the daily-use list); AA must hold. Dark side stays `coco-gold-400` (`#f4c433`), already proven on `coco-neutral-950`.
  - Rejected Option B (bump weight): font-weight does not change WCAG luminance; it only helps perceived legibility, not the measurable ratio. The 3.4:1 gap is too large to close with weight alone.
  - Rejected Option C (accept): the folio is read dozens of times per shift on the light surface; shipping a known AA failure on the daily-use loop is unacceptable.
  - **Exception: timeline SALE_REGISTERED icon** keeps `text-coco-gold-700` base + `dark:text-coco-gold-400`. Rationale: it is a colored 20px icon on a `/10` tinted circle, not body text — WCAG AA text contrast does not apply to graphical objects (1.4.11 non-text contrast = 3:1, which 3.4:1 satisfies). Matches spec HST-REQ-004 verbatim.
- Cobrar action buttons use `!text-black` on `--brand-action` (`#f6bb13`): contrast ≈ 9.6:1 — passes in both modes.

## Cobrar Precedent — Verbatim Copy

From `SaleTotalsFooter.vue` L126 (canonical):

```html
<UButton color="primary" block size="xl" :loading="isChargePending" :disabled="isChargeDisabled"
  class="relative !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
  @click="emit('charge-click')">
```

Static class string (copied verbatim by the three target action buttons, minus `relative` which is Cobrar-specific for its absolute trailing `UKbd`):

```
!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm
```

`SaleTotalsFooter` uses NO dynamic `:class` on the Cobrar button — the static `class` above is the full override. `color="primary"` is retained as semantic fallback (HST-REQ-003) and visually overridden by `!bg-`/`!text-`. The three target buttons keep their own `:disabled`/`data-testid`/`@click` bindings untouched. The header "Registrar pago" (size `sm`) and totals-card "Registrar Pago" (block, default size) both receive the IDENTICAL class string — `size`/`block`/`icon` props are independent of the class override.

## UCard Wrapper Treatment

- **SaleCard.vue L27**: `:ui="{ body: 'p-4 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"`. Drop the `bg-default` from the outer `class` (it is overridden by `ui.body`'s explicit coco tokens; keeping both is redundant and risks the spec's "not rely solely on bg-default" scenario).
- **SalesListView.vue L116**: `:ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"`.
- **Nuxt UI 4 verification**: `ui.body` is the correct UCard slot name — already proven in this codebase (`SalesListView` L116 `:ui="{ body: 'p-0 sm:p-0' }"`, `SaleCard` L27 `:ui="{ body: 'p-4' }"`). No docs fetch required; the codebase is the precedent.
- **SaleDetailTimeline `<UCard>` (L119)**: no change — it has no `bg-default`/`bg-white`; it inherits the Nuxt UI `card.root` default (`bg-white dark:bg-coco-neutral-900` per `vite.config.ts` L49), which is already Coco. Out of scope.

## Test Update Strategy

| Test file | Current `primary` pin | Update | New class-pinning assertions (HST-REQ-003/004) |
|---|---|---|---|
| `SaleDetailTimeline.test.ts` | L29-31 `['text-primary','bg-primary/10']` for SALE_REGISTERED | → `['text-coco-gold-700','dark:text-coco-gold-400','bg-coco-gold-500/10']` (HST-REQ-007) | connector `.classes()` contains `bg-coco-neutral-200` |
| `SaleCommentInput.test.ts` | L45 `data-color` === `'primary'` | → assert `data-color` is NOT `'primary'` (HST-REQ-007); drop `color` prop makes it `undefined` | `[comment-open].classes()` contains `!bg-coco-gold-500/15` |
| `SaleCard.test.ts` | none (text/tone only) | none | folio `<p>.classes()` contains `text-coco-gold-800`; UCard body class via `wrapper.findComponent` |
| `SaleDetailTotalsCard.test.ts` | none (disabled/emitted only) | none | `[register-debt-payment].classes()` contains `!bg-(--brand-action)` |
| `SalesListView.test.ts` | none | none | "Nueva Venta" button `.classes()` contains `!bg-(--brand-action)`; folio link `.classes()` contains `text-coco-gold-800` |
| `SaleDetailView.test.ts` | none | none | header `[sale-detail-header].classes()` contains `bg-coco-neutral-50`; one `reflow-*` card `.classes()` contains `bg-coco-neutral-50` |

**Stub-fidelity caveat (SaleDetailView)**: most `SaleDetailView.test.ts` mounts stub `UButton` as `<button><slot /></button>` (L172, etc.) — does NOT forward `$attrs`, so `class` assertions on header buttons fail. For the new `register-payment-header` class assertion, either (a) upgrade that mount's UButton stub to `v-bind="$attrs"` (one-line, mirrors `DebtPaymentModal.test.ts` L50 pattern from SDD-5), or (b) assert via `wrapper.html()` substring contains `!bg-(--brand-action)`. The header/background assertions (L191 `[sale-detail-header]`, L216 `sidebar-data-reflow`) are on plain `<header>`/`<div>` elements — class assertions work without stub changes. All behavior assertions (props, emits, computed, PDF toasts, tab panels) unchanged.

## Rollout & Work-Unit Commit Plan

Single branch, no PRs (per user). 7 commits, each independently buildable and revertible:

1. **`feat(sales): coco-ize SalesListView action + folio link`** — `SalesListView.vue` only. Nueva Venta Cobrar class, folio `text-coco-gold-800`, UCard `ui.body` surface. Smallest, anchors the pattern.
2. **`feat(sales): coco-ize SaleCard folio + UCard surface`** — `SaleCard.vue` only. Depends on commit 1's folio style for visual consistency. UCard `ui.body` + folio gold-800.
3. **`feat(sales): coco-ize SaleDetailTimeline event + connector`** — `SaleDetailTimeline.vue` only. SALE_REGISTERED coco-gold tint, connector coco-neutral. **Visual review checkpoint here** (SDD-5 precedent — review the visible pattern before the larger blast-radius commits).
4. **`feat(sales): coco-ize SaleDetailTotalsCard Registrar Pago CTA`** — `SaleDetailTotalsCard.vue` only. Cobrar class on register-debt-payment; `debtClass` untouched.
5. **`feat(sales): coco-ize SaleCommentInput trigger tint`** — `SaleCommentInput.vue` only. Drop `color="primary"` prop, add soft gold tint class.
6. **`feat(sales): coco-ize SaleDetailView header + Datos cards + header CTA`** — `SaleDetailView.vue` only (largest, last). Sticky header bg, 5 reflow cards, header "Registrar pago" Cobrar class. Blast radius isolated to one commit so a revert restores the entire detail view at once.
7. **`test(sales): pin coco tokens on sales-history components`** — 6 test files. Update the 2 mandatory selector rewrites (HST-REQ-007) + add the new class-pinning assertions + the SaleDetailView UButton `v-bind="$attrs"` stub fix. Tests land after the code they guard; one commit makes the regression contract reviewable as a unit.

Order rationale: smallest→largest, visual-review checkpoint after the timeline (commit 3) before the detail-view blast radius (commit 6); test contract last so RED→GREEN is observable per the work-unit-commits convention. `pnpm build` + `pnpm test` run after each commit.

## Risk Mitigation

- **Light-mode coco-gold-700 (3.4:1)** — resolved by using `coco-gold-800` (6.3:1) for the folio link + SaleCard folio (the only 14px text accents). SALE_REGISTERED icon keeps gold-700 (graphical object, 1.4.11 = 3:1 satisfied). Documented in §3.
- **SaleDetailView blast radius (4 tabs + ~6 sub-components)** — isolated to commit 6; one missed swap = brand leak. Mitigation: the test contract (commit 7) pins `bg-coco-neutral-50` on header + one reflow card; visual review after commit 6 walks all 4 tabs.
- **Status-badge semantics on timeline** — SALE_REGISTERED as coco-gold "brand moment" (not `success`). See Open Question 1; gold reads as "origin event", not "CTA". The icon is a `plus-circle`, not a dollar — semantic distance from payment-CTA gold is maintained.
- **Test selector fragility** — pin stable tokens (`!bg-(--brand-action)`, `text-coco-gold-800`, `bg-coco-neutral-50`) via `.toContain(...)`, never full class strings or opacity-suffixed combinations that Tailwind may reorder. Exception: the SALE_REGISTERED array assertion uses `arrayContaining` with the 3 exact tokens (spec-mandated).
- **Visual regression of daily-use area** — SalesListView is the loop-closing surface reopened many times/shift. Visual review after commit 1 (light + dark) before proceeding. Rollback = `git revert` (visual-only, no API/data-shape changes).
- **PaymentMethodPills CARD_DEBIT carry-over** — out of scope (HST-REQ-006/non-goals). Documented risk only; no change to `PaymentMethodPills.vue`.

## Migration / Rollout

No migration. No feature flags. Single-branch merge to main per user preference. Rollback = `git revert` the merge commit.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure class-level Vue SFC edits.

## Open Questions (Resolved)

### Q1: Timeline SALE_REGISTERED color
**Recommendation: Coco gold (brand moment), not `success`.**
Why: SALE_REGISTERED is the origin event — the moment the sale entered the system. `success` green is already the semantic for `PAYMENT_RECEIVED` (L38 `text-success`); reusing it for SALE_REGISTERED would collapse two distinct timeline events into one color, erasing the visual sequence. Gold marks it as the brand "genesis" moment and ties it to the Cobrar CTA that the sale will eventually receive. The `plus-circle` icon (not a dollar sign) keeps semantic distance from a CTA.
Implementation: `SaleDetailTimeline.vue` L37 `EVENT_COLORS[SALE_REGISTERED]` → `{ text: 'text-coco-gold-700 dark:text-coco-gold-400', bg: 'bg-coco-gold-500/10' }` (per token table §2, §3).

### Q2: Sale-row folio link
**Recommendation: `text-coco-gold-800 dark:text-coco-gold-400` (high attention, matches Cobrar), NOT neutral-with-hover.**
Why: the folio link IS the navigation affordance to the detail view — the primary action on each row. A neutral-with-hover-gold would hide the only interactive element in the row until hover, bad on touch/mobile. Gold-800 (not 700) satisfies AA at 14px. This matches the Cobrar action emphasis: gold = "this is the thing you click to advance the sale".
Implementation: `SalesListView.vue` L187-194 folio `UButton` → `variant="link" color="primary" class="text-coco-gold-800 dark:text-coco-gold-400 font-medium hover:underline"`.

### Q3: Mobile SaleCard folio
**Recommendation: Coco gold (matches desktop link), NOT `text-highlighted` neutral.**
Why: the SaleCard is the mobile-card render of the same row (AppDataTable `mobile-render="cards"`). Diverging folio color between desktop (gold) and mobile (neutral) would be a brand inconsistency within the same list view. The status pill row uses semantic tones (success/warning/error) via `StatusDotBadge` — gold folio does not compete because it sits in a separate flex row (L29 `justify-between`), not the status row. Gold-800 for AA.
Implementation: `SaleCard.vue` L30 folio `<p>` → `text-coco-gold-800 dark:text-coco-gold-400`.

### Q4: "Registrar Pago" totals-card CTA prominence
**Recommendation: full Cobrar gold (matches the header "Registrar pago"), NOT `variant="soft" color="warning"`.**
Why: the header "Registrar pago" and the totals-card "Registrar Pago" are the SAME action (open `DebtPaymentModal`) rendered in two places for scroll-context. Diverging their prominence (gold header / soft-warning totals) would signal two different actions. The debt is already semantically marked by `debtClass` (`text-error-600`, L29) — the CTA's job is "advance the payment", which is the Cobrar action. `variant="soft" color="warning"` would also introduce a `warning` token the spec's HST-REQ-001 does not require and would compete with the `text-error` debt row.
Implementation: `SaleDetailTotalsCard.vue` L84-92 `UButton` → `color="primary" class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"` (identical to header CTA, per Cobrar precedent §4).

## Open Questions

None remaining — all four proposal open questions resolved above with a committed recommendation and implementation path. User will visually iterate post-apply; the design commits to ONE choice per question as required.
