# Design: Sale Detail Redesign — flat two-column layout

## Technical Approach

Lean extraction, zero API/data/token changes. Rewrite `SaleDetailView.vue`'s body: delete `UTabs` + `tabItems` + the inline DATOS block; extract DATOS into `SaleDetailSalesDataCard.vue` (owns the `productApi.getGlobalPriceLists()` fetch + `priceListName`/`uniquePaymentMethods` computeds; emits `assign-seller`) and HISTORIAL into `SaleDetailHistoryCard.vue` (thin `UCard`: `SaleDetailTimeline` body, `SaleCommentInput` footer); mount both in the spec-mandated grid `grid gap-6 lg:grid-cols-[1fr_360px]` with `data-testid="sale-detail-layout-body"`; relabel the PDF trigger "Comprobante"; drop the `sm:hidden` header total. Eight untouched components stay verbatim. HST-REQ-001..007 class strings are copied byte-for-byte; HST-REQ-008's `UTabs` clause is released by the MODIFIED delta.

## Architecture Decisions

| # | Decision | Options | Tradeoff | Choice |
|---|---|---|---|---|
| D1 | DATOS extraction | (a) new card owns fetch+computeds (b) view passes them as props | (b) keeps view bloated; (a) shrinks view ~104 net lines with one owner | (a). No new composable — one call site, verbatim move (pos-price-list-tiers precedent) |
| D2 | HistoryCard shape | (a) `UCard` wrapper: Timeline body, composer footer (b) siblings in column | (b) violates REQ-LAYOUT-002/007; (a) nests Timeline's own "Historial" UCard (cosmetic, Timeline internals are no-touch) | (a) |
| D3 | Comprobante label | (a) put label in existing `v-else` UButton branch (b) new computed gate | `triggerTooltipText` v-else ≡ non-DRAFT, and the dropdown only renders when `hasAnyAction` → (a) satisfies REQ-LAYOUT-003 with zero new logic | (a): label + `aria-label="Comprobante"` in v-else; DRAFT branch stays icon-only + tooltip, aria-label also "Comprobante" |
| D4 | View-test strategy | (a) real SalesDataCard + stub HistoryCard (b) stub both (c) mount both | (b) loses HST-REQ-002 reflow-class assertions at view level; (c) forces slot-complete `UCard` stub churn in ~10 mounts; (a) preserves the two narrative tests nearly verbatim, needs one `productApi` module mock | (a). SalesDataCard is plain-div markup; HistoryCard stub carries `timeline`/`comment-input` testids |
| D5 | Grid/order | `order-2 lg:order-1` / `order-1 lg:order-2` on column roots | Spec-mandated (REQ-LAYOUT-001/004) | Fixed |

## Data Flow

```
useSaleDetail(saleId) ──► sale: SaleDetail ──► SaleDetailView.vue
   │                                              ├─ SaleDetailItemsList :items
   │                                              ├─ SaleDetailSalesDataCard :sale ── emit assign-seller ──► AssignSellerSlideover
   │                                              ├─ SaleDetailHistoryCard :timeline/:currentUserId/:commentsPending/:on-* ──► Timeline + CommentInput
   │                                              ├─ SaleDetailTotalsCard :totals* @register-payment ──► DebtPaymentModal
   │                                              └─ PaymentsListSection :payments @submit ──► handleReferenceSubmit (unchanged)
useSaleComments / useDebtPayment / useUpdatePaymentReference ──► query invalidation ──► refetch detail (unchanged)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/SaleDetailSalesDataCard.vue` | Create | DATOS card: owns fetch + computeds; root `sidebar-data-reflow`; 5 `reflow-*` cards; emits `assign-seller` |
| `components/SaleDetailHistoryCard.vue` | Create | `UCard` "Historial": Timeline body, CommentInput footer |
| `views/SaleDetailView.vue` | Modify | Drop UTabs/tabItems/inline datos/`sm:hidden` total; add grid; relabel trigger (~−136/+32) |
| `views/__tests__/SaleDetailView.test.ts` | Modify | Retitle 2 narrative tests; add layout/order/no-tabs/Comprobante assertions; `productApi` mock |
| `components/__tests__/SaleDetailSalesDataCard.test.ts` | Create | 5 testids, fetch-once, priceListName states, dedupe, emit, HST-REQ-002 classes |
| `components/__tests__/SaleDetailHistoryCard.test.ts` | Create | Title, Timeline body, CommentInput footer, empty-timeline case |

Untouched: `SaleDetailItemsList`, `SaleDetailTotalsCard`, `PaymentsListSection`, `SaleDetailTimeline`, `SaleCommentInput`, `SaleCommentSlideover`, `DebtPaymentModal`, `AssignSellerSlideover`, `api/`, `composables/`, `interfaces/`.

## Interfaces / Contracts

```ts
// SaleDetailSalesDataCard.vue — prop is the CONFIRMED-sale model, not draft Sale
const props = defineProps<{ sale: SaleDetail }>()
const emit = defineEmits<{ 'assign-seller': [] }>()
// internal: priceLists = ref<GlobalPriceList[]>([]); priceListsLoading = ref(true)
// onMounted: await productApi.getGlobalPriceLists() (silent catch; finally loading=false)
// priceListName: no id → 'PUBLICO'; loading → '...'; found → name; else raw id
// uniquePaymentMethods: dedupe sale.payments by method → formatPaymentMethod()

// SaleDetailHistoryCard.vue — no emits; callback props mirror children contracts.
// NOTE: actual type is SaleTimelineEvent ('SaleTimelineEntry' does not exist).
const props = defineProps<{
  timeline: SaleTimelineEvent[]
  currentUserId?: string | null
  commentsPending?: boolean
  onUpdateComment?: (commentId: string, payload: { body: string }) => Promise<unknown>
  onDeleteComment?: (commentId: string) => Promise<unknown>
  onSubmitComment: (payload: { body: string }) => Promise<unknown>
}>()
```

View template (replaces the UTabs block):

```html
<div class="p-6">
  <div class="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="sale-detail-layout-body">
    <div class="space-y-6 order-2 lg:order-1">
      <SaleDetailItemsList :items="sale.items" />
      <SaleDetailSalesDataCard :sale="sale" @assign-seller="sellerSlideoverOpen = true" />
      <SaleDetailHistoryCard :timeline="sale.timeline" :current-user-id="authStore.user?.id ?? null"
        :comments-pending="commentsPending" :on-update-comment="updateComment"
        :on-delete-comment="deleteComment" :on-submit-comment="addComment" />
    </div>
    <div class="space-y-6 order-1 lg:order-2">
      <SaleDetailTotalsCard :subtotal-cents="sale.subtotalCents" :discount-cents="sale.discountCents"
        :total-cents="sale.totalCents" :paid-cents="sale.paidCents" :debt-cents="sale.debtCents"
        :change-due-cents="sale.changeDueCents" :can-register-payment="canRegisterPayment"
        :is-payment-submitting="isSubmitting" @register-payment="debtModalOpen = true" />
      <PaymentsListSection :payments="sale.payments" :loading="referencePending"
        data-testid="sale-detail-payments-list" @submit="handleReferenceSubmit" />
    </div>
  </div>
</div>
```

## Requirement → Design Mapping

| REQ | Implementation |
|---|---|
| REQ-LAYOUT-001 | Grid + `sale-detail-layout-body`; UTabs/tabItems/4 slots/`sale-detail-tabs` deleted. S1: left = items + `sidebar-data-reflow` + HISTORIAL, right = totals + payments; S2: four stubs coexist, no tabs |
| REQ-LAYOUT-002 | `SaleDetailHistoryCard` UCard: Timeline body, composer footer. S1: real-children mount test; S2: empty-timeline renders card shell + composer |
| REQ-LAYOUT-003 | Label + aria-label in the `v-else` trigger branch (CONFIRMED); DRAFT icon-only + tooltip; CANCELED no dropdown. S1–S3: new tests |
| REQ-LAYOUT-004 | `order-1 lg:order-2` / `order-2 lg:order-1`. S1/S2: DOM-order + class assertions |
| REQ-LAYOUT-005 | Header testids untouched; `sidebar-data-reflow` + `reflow-*` migrate verbatim into the card; `sale-detail-tabs` removed; `sale-detail-layout-body` added. S1/S2 covered in view test |
| REQ-LAYOUT-006 | Card owns fetch + computeds; view drops `productApi` import. S1 fetch-once + name; S2 no-import (grep, `pnpm type-check`); S3 emit → slideover |
| REQ-LAYOUT-007 | Thin wrapper, no new contracts. S1 title + children; S2 focus order body→footer |
| REQ-LAYOUT-008 | `sm:hidden` total deleted. S1: no mobile total; S2: `totals-total-value` remains |
| MODIFIED HST-REQ-008 | UTabs clause released; trigger aria-label MAY change; all other anchors/aria/focus/Modal-shell semantics identical |

## Testing Strategy

| Layer | What | How |
|---|---|---|
| View (modified) | Flat grid, column order, tabs removed, Comprobante label, HST-REQ-002/003 header classes | `SaleDetailView.test.ts`: keep ~23 cases; retitle 2; add ~4 (layout-body + order, no-tabs, Comprobante CONFIRMED, DRAFT icon-only); real SalesDataCard + `productApi` mock |
| Component (new) | SalesDataCard contract | `SaleDetailSalesDataCard.test.ts`: 5 testids, fetch once on mount, priceListName states ('...' / name / raw id / PUBLICO), payment-method dedupe, `assign-seller` emit (click + Enter + Space), reflow coco classes |
| Component (new) | HistoryCard composition | `SaleDetailHistoryCard.test.ts`: "Historial" title, `timeline-event` in body, `sale-comment-input` in footer, empty-timeline case |
| Regression | 8 untouched components | Their suites unchanged |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration, no feature flags. **Rollback**: single `git revert` of the merge commit — pure structural + class change, no API/data-shape/schema/permission impact; reverting restores the UTabs workbench, inline datos block, and icon-only "Más acciones" trigger with all original testids.

## Work-Unit Breakdown (preview for sdd-tasks)

- **WU-A** `feat(sales): extract DATOS card from sale detail view` — SalesDataCard.vue + its test + view script removals (fetch, computeds, imports). ~220 authored.
- **WU-B** `feat(sales): add HISTORIAL card wrapper for sale detail` — HistoryCard.vue + test + view wiring. ~135 authored.
- **WU-C** `refactor(sales): flatten sale detail layout, drop tabs, label Comprobante trigger` — grid, trigger relabel, `sm:hidden` removal. ~170 authored.
- **WU-D** `test(sales): update sale detail view tests for flat layout` — retitles, new assertions, Comprobante tests. ~85 authored.

Forecast: **net diff ≈ 280–340**; authored (incl. new test files) ≈ 400–540. Guard lines (preview; sdd-tasks formalizes): `Decision needed before apply: No` | `Chained PRs recommended: No` | `400-line budget risk: Medium` — if the tasks-phase authored forecast crosses 400, the orchestrator records an accepted `size:exception` under the `single-pr` strategy.

## Open Questions

- [ ] Nested "Historial" `UCard` (outer wrapper + Timeline's own inner card) — accepted cosmetic duplication; Timeline chrome is out of scope. Confirm no follow-up change desired.
- [ ] REQ-LAYOUT-002 S2 "empty-state affordance": Timeline has no explicit empty-state markup today; scenario interpreted as card shell + footer composer rendering. If verify demands empty-state copy, that requires a separate Timeline-internal change.
- [ ] Items table renders bare (no card wrapper) in the left column — spec does not mandate a wrapper; apply must not add one without approval.
- [ ] HST-REQ-002 class strings must remain byte-identical (`bg-coco-neutral-50 dark:bg-coco-neutral-950` on the 5 cards; `bg-coco-neutral-50/90 dark:bg-coco-neutral-950/90` on the header) — verify with a grep during apply.
- [ ] View test keeps the now-redundant `SaleDetailTimeline`/`SaleCommentInput` leaf stubs (HistoryCard stub owns their testids) — cleanup optional, zero behavior impact.

## Risks and Mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Authored-line budget at top end (400–540 incl. new tests) | Med | Keep new test files lean; orchestrator records `size:exception` if tasks-phase forecast >400 |
| HST-REQ-002/007 class regression | Med | Class strings listed verbatim in tasks; assertions preserved in view test + new card test |
| `productApi` now mocked in view test | Low | Module mock with `importOriginal` spread; resolved `[]` keeps `priceListName` at PUBLICO |
| `sales-history-coco` archive ordering for HST-REQ-008 | Low | Delta already carries the MODIFIED block; no merge conflict on `sales/spec.md` |
| Nested Historial card cosmetics | Low | Accepted; surfaced in Open Questions |
