# Proposal: Quotations UI Redesign

## Intent

The current `QuotationDetailView` is a single-column, scroll-heavy screen. Sellers cannot see totals without scrolling past products, and the screen lacks visual cues (progress, stock contrast, promo hierarchy) that the Coco reference design resolves. This change is a **view-layer-only visual redesign** that adopts the Coco 2-column layout, adds a progress stepper, and unifies the quotations list with system table patterns.

## Scope

### In Scope

- 2-column grid layout (`lg:grid-cols-3`, left `col-span-2`, right `col-span-1 sticky top-4`) for `QuotationDetailView.vue`.
- New `QuotationProgressStepper.vue` showing **3 states only**: `BORRADOR → ENVIADA → EXPIRADA/CANCELADA` (per user decision — `ACEPTADA`/`PEDIDO` deferred; reference spec's 4-state stepper is reduced to 3 because the backend has no such states yet).
- New `QuotationPromotionCard.vue` with `border-l-4` accent for applied promotions.
- New `QuotationCustomerCard.vue` (avatar + email + phone + "Cambiar cliente" outlined button), reusing `EntityAvatar`.
- Refactor `QuotationItemRow.vue`, `QuotationTotalsFooter.vue`, `QuotationExpiryPicker.vue` (add shortcut chips: `7 | 15 | 30 días | Sin expiración`).
- IVA 16% row computed **client-side as `totalCents * 0.16`** (no backend field; per user decision).
- Customer-notes textarea with `0 / 280` counter — **UI-only, not persisted** (per user decision).
- Minor alignment of `QuotationsListView.vue` to system patterns (`rounded-2xl` card wrapper, primary button color), confirming existing `AppDataTable` + `StatusDotBadge` usage.
- Coco design tokens defined in a CSS layer (`--coco-primary`, `--coco-accent`, etc.) and consumed via Tailwind arbitrary values — **scoped to this change**, not promoted project-wide.

### Out of Scope

- `Copiar` (duplicate) button — no backend endpoint; intentionally omitted (per user decision).
- Backend changes (DTO, endpoints, status enum).
- `ACEPTADA` / `PEDIDO` stepper states until backend supports them.
- Promotion persistence, customer-notes persistence.
- Changes to `useQuotationDetail`, `useQuotationDraft`, or any other composable.

## Capabilities

### New Capabilities
- `quotations-ui`: Defines the visual structure, layout, Coco tokens, and required components for `QuotationDetailView` and `QuotationsListView`. Pure presentation spec — no behavior requirements.

### Modified Capabilities
- `quotations-management`: None — the in-flight CRUD spec's behavior requirements are untouched. Visual layer is delegated to `quotations-ui`.

## Approach

**Incremental, four-phase refactor** (matches exploration recommendation):

1. **Phase 1 — Tokens & layout skeleton**: add Coco CSS variables to a single scoped layer; restructure `QuotationDetailView` to a 2-column grid; move totals/notes to the sticky right sidebar.
2. **Phase 2 — Stepper**: build `QuotationProgressStepper.vue` with 3 states; wire into the view header.
3. **Phase 3 — Section refactors**: `QuotationCustomerCard`, `QuotationPromotionCard`, expiry chips, item-row polish, IVA row.
4. **Phase 4 — List view polish + tests**: minor `QuotationsListView` alignment; update all `data-testid` selectors; rerun `pnpm test:unit` and `pnpm build`.

Strict TDD per phase: failing test → RED → minimal impl → GREEN → refactor. Existing tests stay green; new components ship with their own `.test.ts`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/features/POS/quotations/views/QuotationDetailView.vue` | Major | New grid layout, stepper, sidebar totals/notes |
| `src/features/POS/quotations/views/QuotationsListView.vue` | Minor | Card wrapper + primary color alignment |
| `src/features/POS/quotations/components/QuotationTotalsFooter.vue` | Refactor | Becomes sidebar summary; adds IVA row, CTAs |
| `src/features/POS/quotations/components/QuotationItemRow.vue` | Refactor | More padding, stock badge contrast |
| `src/features/POS/quotations/components/QuotationExpiryPicker.vue` | Refactor | Adds shortcut chips |
| `src/features/POS/quotations/components/QuotationProgressStepper.vue` | **New** | 3-state stepper |
| `src/features/POS/quotations/components/QuotationPromotionCard.vue` | **New** | `border-l-4` promo card |
| `src/features/POS/quotations/components/QuotationCustomerCard.vue` | **New** | Avatar + contact + change button |
| `src/app/styles/coco-tokens.css` (or similar) | **New** | Coco CSS variable definitions |
| `__tests__/*.test.ts` (quotations) | Modified | Updated selectors / new component tests |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stepper designed for 3 states must be reworked when backend adds `ACEPTADA`/`PEDIDO` | High | Document the 3-state limitation; isolate stepper mapping in a single helper for easy extension |
| Client-side IVA (16%) drifts from backend authoritative totals if tax rules change | Med | Add a `// TODO: replace when backend exposes taxCents` comment + centralize the formula in one util |
| Customer-notes textarea pretends to persist; users may type and lose data on reload | Med | Add a visible `localStorage` draft cache as an interim safety net OR a clear "(no implementado aún)" hint — decide during phase 3 |
| Existing test selectors break across all 4 phases | High | Phase 4 is dedicated test-update work; data-testids stay semantic (`[data-testid="quotation-stepper"]`) not positional |
| Scope creep into composable layer | Med | Hard rule: composables untouched; if a need appears, file a follow-up change |
| Color tokens conflict with future project-wide Coco rollout | Low | Scope tokens to a single CSS layer named `coco-quotations`; no global `:root` mutation |

## Rollback Plan

Revert commits per phase (each phase is a reviewable unit). The composable layer and backend contract stay unchanged, so rollback is purely a view-layer revert — no data migration concerns.

## Success Criteria

- [ ] `QuotationDetailView` renders the 2-column grid with sticky right sidebar at `lg` breakpoint.
- [ ] Stepper shows exactly 3 states (`BORRADOR`, `ENVIADA`, `EXPIRADA/CANCELADA`) with correct active/completed styling per reference.
- [ ] Totals sidebar includes `Subtotal`, `Descuentos`, `IVA 16%` (client-side), and bold `TOTAL`.
- [ ] Customer notes textarea renders with `0 / 280` counter; no persistence claim is made.
- [ ] Expiry picker offers `7 | 15 | 30 días | Sin expiración` chips; selecting one updates `expiresAt`.
- [ ] No `Copiar` button present in header.
- [ ] `QuotationsListView` matches system table patterns (`rounded-2xl` wrapper, primary CTA color).
- [ ] `pnpm test:unit` passes; all existing quotations tests still green.
- [ ] `pnpm build` passes (vue-tsc + vite build).
- [ ] All new components ship with `.test.ts` coverage.
