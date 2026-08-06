# Tasks: Quotations UI Redesign

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Work Units (per-phase review slices)

| Phase | Focused test | Runtime harness | Rollback |
|---|---|---|---|
| 1 | `pnpm test:unit src/features/POS/quotations` | dev-server at lg | revert Phase 1 |
| 2 | `pnpm test:unit quotation.utils` + new stepper test | dev-server 3 statuses | revert Phase 2 |
| 3 | `pnpm test:unit` (full) | dev-server + manual IVA | revert Phase 3 |
| 4 | `pnpm test:unit && pnpm build` | prod build + smoke | revert Phase 4 |

## Phase 1 — Tokens & Layout (REQ-UI-001, 002)

- [ ] T-UI-01 (RED): tokens resolve on `.quotation-detail-view`, don't leak.
- [ ] T-UI-02 (GREEN): create `coco-tokens.css` with `@layer coco-quotations`.
- [ ] T-UI-03: import after `@theme static` in `main.css`.
- [ ] T-UI-04 (RED): view test for `lg:grid-cols-3` + sticky right.
- [ ] T-UI-05 (GREEN): restructure `QuotationDetailView.vue` to grid + sticky.
- [ ] T-UI-06: `pnpm test:unit` — existing tests green.

## Phase 2 — Stepper (REQ-UI-003)

- [ ] T-UI-07 (RED): `stepperIndexFromStatus` — DRAFT→0, SENT→1, EXPIRED/CANCELLED→2.
- [ ] T-UI-08 (GREEN): implement helper in `quotation.utils.ts`.
- [ ] T-UI-09 (RED): new stepper test — 3 nodes, DRAFT first, CANCELLED last.
- [ ] T-UI-10 (GREEN): create `QuotationProgressStepper.vue`, testid `quotation-stepper`.
- [ ] T-UI-11: render in detail header; tests green.

## Phase 3 — Sections (REQ-UI-005, 006, 007, 008, 009, 010)

- [ ] T-UI-12 (RED): `computeIva16(33500) === 5360`.
- [ ] T-UI-13 (GREEN): `computeIva16` in `quotation.utils.ts` with `// TODO` comment.
- [ ] T-UI-14 (RED): customer card test — w/wo phone, null, emit.
- [ ] T-UI-15 (GREEN): create `QuotationCustomerCard.vue`.
- [ ] T-UI-16 (RED): promo card test — title, blue disc., badge, vetar, `border-l-4`.
- [ ] T-UI-17 (GREEN): create `QuotationPromotionCard.vue`.
- [ ] T-UI-18 (RED): extend expiry test — chips, active, ISO emit.
- [ ] T-UI-19 (GREEN): add `7|15|30 días|Sin expiración` chips + testids.
- [ ] T-UI-20: `QuotationItemRow` — `p-4 rounded-xl`, `--coco-warning`; green.
- [ ] T-UI-21 (RED): notes counter clamps 280, updates on input.
- [ ] T-UI-22 (GREEN): textarea + `localStorage` cache + hint.
- [ ] T-UI-23 (RED): totals test — RESUMEN, context, IVA, CTAs, validity.
- [ ] T-UI-24 (GREEN): refactor `QuotationTotalsFooter.vue` — context, IVA, CTAs, validity.
- [ ] T-UI-25: replace inline customer/promo blocks in view; green.

## Phase 4 — List Polish & Testids (REQ-UI-004, 011, 012)

- [ ] T-UI-26 (RED): list view test — `rounded-2xl shadow-sm` + `--coco-primary` CTA.
- [ ] T-UI-27 (GREEN): refactor `QuotationsListView.vue` wrapper + CTA color.
- [ ] T-UI-28: header — back, ID chip, mustard badge, metadata; NO `Copiar`.
- [ ] T-UI-29: apply design §testid Migration in view (`customer-section` → `quotation-customer-card`; `promotions-section` → card instances; `quotation-actions` → header + sidebar actions; new `quotation-stepper`, `customer-notes-textarea`, `notes-char-counter`, `summary-iva-row`, `summary-send-btn`, `summary-save-draft-btn`, `expiry-chips`).
- [ ] T-UI-30: update selectors in detail/expiry/totals tests; preserve assertions.
- [ ] T-UI-31: gates — `pnpm test:unit` (all green) + `pnpm build` clean.
