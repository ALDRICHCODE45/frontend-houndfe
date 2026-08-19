# Exploration: sale-detail-redesign

## 1. Headline reframe

Replace the tabbed workbench (`UTabs`, 4 tabs) with a flat single-screen two-column grid because the sale-detail screen's data density does not justify tab friction — every datum (items, sale metadata, totals, payments, history) should be visible at a glance. The unifying constraint is data-testid parity: the screen is heavily covered by `SaleDetailView.test.ts` and component tests, and every testid must survive the structural change verbatim.

## 2. Current architecture map

```
SaleDetailView.vue (504 lines) — route view at /pos/ventas/:id
├── Sticky header (sticky top-0, z-30, bg-coco-neutral-50/90)
│   ├── Back button · folio (header-folio) · delivery+payment badges (badge) · date (header-date)
│   ├── Mobile-only total (sm:hidden) + desktop total (hidden sm:block)
│   └── Actions: PDF dropdown (Más acciones) · Registrar pago · Asignar vendedor (lg:inline-flex)
├── UTabs (sale-detail-tabs) — default tab "0" = productos, unmount-on-hide=false
│   ├── #productos   → SaleDetailItemsList (items-table + item-*-N testids)
│   ├── #pagos       → SaleDetailTotalsCard (totals-*) + PaymentsListSection (payments-list-*, sale-detail-payments-list)
│   ├── #datos       → INLINE cards (sidebar-data-reflow + reflow-{cajero,vendedor,cliente,price-list,payment-methods})
│   └── #comentarios → SaleDetailTimeline (timeline-*, comment-edit/delete) + SaleCommentInput (comment-open)
└── Modals (outside tabs): DebtPaymentModal, AssignSellerSlideover
```

Components imported by `SaleDetailView.vue` and their current tab slot:

| Component | Role | Current slot |
|---|---|---|
| `SaleDetailItemsList` | Confirmed-sale item table (NET subtotal, strikethrough, badges) | `#productos` |
| `SaleDetailTotalsCard` | Totales panel + debt CTA (`register-debt-payment`) | `#pagos` |
| `PaymentsListSection` | Presentational payments list + reference-edit slideover | `#pagos` |
| `SaleDetailTimeline` | Chronological timeline (events + COMMENT events with edit/delete) | `#comentarios` |
| `SaleCommentInput` | "Agregar comentario" button → opens `SaleCommentSlideover` | `#comentarios` |
| `SaleCommentSlideover` | Comment composer slideover (used inside SaleCommentInput) | (nested) |
| `DebtPaymentModal` | Multi-method debt charge slideover | outside tabs |
| `AssignSellerSlideover` | Seller assignment search slideover | outside tabs |

Key structural fact: the **"datos" tab is NOT a component** — it is ~37 lines of inline template (lines 439–475) with `sidebar-data-reflow` + five `reflow-*` cards, backed by two computed values (`priceListName`, `uniquePaymentMethods`) and an `onMounted` global-price-list fetch (`productApi.getGlobalPriceLists()`), all of which live in the view.

## 3. Domain model facts

Source: `interfaces/sale.types.ts`, `constants/sale.constants.ts`, `utils/*`.

- **`SaleDetail`** (confirmed sale — the model `SaleDetailView` renders): `id, folio, status, channel, register, confirmedAt, dueDate, subtotalCents, discountCents, totalCents, paidCents, debtCents, changeDueCents, paymentStatus, deliveryStatus, customer, cashier, seller, items[], payments[], timeline[], globalPriceListId?`.
  - Note: `Sale` (draft cart) is a DIFFERENT interface — do not confuse them.
- **`SaleDetailItem`**: `productName, variantName, imageUrl, unitPriceCents, quantity, discountCents, subtotalCents` + optional traceability (`originalPriceCents?, priceSource?, appliedPriceListId?, discountType?, discountValue?, discountAmountCents?, discountTitle?, prePriceCentsBeforeDiscount?, rewardKind?, rewardDiscountPercent?, promotionId?`).
- **`SaleDetailPayment`**: `method (SaleDetailPaymentMethod, UPPERCASE), amountCents, tenderedCents, changeCents, reference, paidAt, paymentId (required)`.
- **`SaleTimelineEvent`** — discriminated union of FOUR types: `SALE_REGISTERED`, `PAYMENT_RECEIVED` (has `method, amountCents, reference`), `PRODUCTS_DELIVERED`, `COMMENT` (has `actor, commentId, body`). **Critical:** comments are ALREADY first-class timeline events — `sale.timeline` already interleaves events and comments. `SaleDetailTimeline` already sorts them chronologically (`orderedTimeline` sorts by `at` desc) and renders COMMENT edit/delete affordances. So "unify timeline + comments into HISTORIAL" is a **presentation re-composition**, not a data-model or API change.
- **Enums** (`sale.constants.ts`, value-preserving `as const`): `SALE_STATUS` {DRAFT, CONFIRMED, CANCELED(one L)}, `SALE_PAYMENT_STATUS` {PAID, PARTIAL, CREDIT}, `SALE_DELIVERY_STATUS` {PENDING, DELIVERED, NOT_APPLICABLE}, `PAYMENT_METHOD` (lowercase, draft), `SALE_DETAIL_PAYMENT_METHOD` (UPPERCASE, confirmed), `SALE_TIMELINE_EVENT_TYPE`. These are pin-tested in `__tests__/sale.constants.spec.ts`.
- **Badge helpers** (`saleStatus.utils.ts`): `getPaymentStatusBadge` (PAID→Pagada/success, PARTIAL→Impaga/warning, CREDIT→Deuda/error), `getDeliveryStatusBadge` (DELIVERED→Entregados/success, PENDING→No Entregados/error).
- **Formatters**: `formatCentsMXN` (currency, re-exported via `currency.utils.ts` from `core/shared/utils/currency.utils`), `formatSaleDate`/`formatSaleDueDate` (`saleDate.utils.ts`, date-fns + es locale), `formatPaymentMethod` + `getPaymentMethodColor` (`salePaymentMethod.utils.ts`), `extractFolioNumber` (`saleFolio.utils.ts`), `getMethodMeta` (`paymentMethodMeta.ts`, label+color+icon), `shouldShowEditReference` (`referenceEditAffordance.ts`, whitelist {CARD_DEBIT, CARD_CREDIT, TRANSFER}).
- **Backend error codes driving the UI**:
  - PDF (`SalePdfError`): `INVALID_FORMAT`, `SALE_NOT_CONFIRMED`, `PDF_GENERATION_FAILED` (+ HTTP 401/403/404 → toasts).
  - Comments (`SaleCommentError`): `COMMENT_NOT_FOUND`, `COMMENT_AUTHOR_FORBIDDEN`, `SALE_NOT_FOUND`.
  - Reference edit (`ReferenceUpdateError`): `ENTITY_NOT_FOUND`, `SALE_UPDATE_FORBIDDEN`, `NETWORK_ERROR`.
  - Debt payment (`DebtPaymentDomainErrorCode`): `SALE_NOT_FOUND`, `SALE_NOT_CONFIRMABLE_FOR_PAYMENT`, `NO_OUTSTANDING_DEBT`, `PAYMENT_EXCEEDS_DEBT`, `IDEMPOTENCY_KEY_*`.

## 4. Composables contract

- **`useSaleDetail(id: ComputedRef<string>)`** → `{ sale, isLoading, isError }`. Uses `useQuery` with `saleQueryKeys.detail(tenantId, id)` = `['sales', tenantId, 'detail', saleId]`. On error, toasts (`404`→"Venta no encontrada", else "No pudimos cargar la venta") and `router.push('/pos/ventas')`. `retry: false`, `enabled: id.length > 0`.
- **`useSaleComments(saleId: MaybeRefOrGetter<string>)`** → `{ addComment, updateComment, deleteComment, isPending, lastError }`. Three `useMutation`s; each on success invalidates `saleQueryKeys.detail(...)`; `lastError` set to `SaleCommentError` on error (view maps code → toast via `mapCommentErrorMessage`). Does NOT touch the timeline array directly — invalidation refetches the detail.
- **`useDebtPayment(saleId: string)`** → `{ submit, submitSafe, isSubmitting, externalErrorCode, shouldClose, resetError }`. Mutation `registerDebtPayment`; on success invalidates `detail` + `confirmed`; on error classifies domain codes (refetch detail / refetch list / close modal / toast). `DebtPaymentModal` consumes `submitSafe` + `shouldClose` + `externalErrorCode`; the VIEW only consumes `isSubmitting` (to disable the header button).
- **`useUpdatePaymentReference(saleId: MaybeRefOrGetter<string>)`** → `{ updateReference, isPending, lastError }`. Mutation `PATCH .../payments/:paymentId/reference`; retry up to 3 on network, skips retry for `ReferenceUpdateError`; on `ENTITY_NOT_FOUND` toasts + refetches detail. The view owns the handler (`handleReferenceSubmit`); `PaymentsListSection` stays presentational and emits `submit`.

## 5. Test surface inventory

Test command: `pnpm test:unit` (`vitest`). Stack: Vitest 4 + Vue Test Utils + `mountWithUApp` helper (`@/test/mountWithUApp`). `useToast` is auto-imported by the Nuxt UI plugin and must be mocked via `vi.mock('@nuxt/ui/composables/useToast')`.

`SaleDetailView.test.ts` has **25 test cases** and mocks `useSaleDetail`, `useDebtPayment`, `useSaleComments`, `useUpdatePaymentReference`, `saleApi.getById/getPdfBlob`, `AssignSellerSlideover`, `PaymentsListSection`, `useAuthStore`, and `vue-router`. It stubs the four body components as `data-testid="items"/"totals"/"timeline"/"comment-input"`.

Complete `data-testid` inventory (MUST survive verbatim):

**SaleDetailView (header + datos + structure):** `sale-detail-layout`, `sale-detail-skeleton`, `sale-detail-header`, `header-folio`, `header-date`, `badge` (×2: delivery + payment), `register-payment-header`, `sale-detail-tabs`, `sale-detail-payments-list` (attr on PaymentsListSection), `sidebar-data-reflow`, `reflow-cajero`, `reflow-vendedor`, `reflow-cliente`, `reflow-price-list`, `reflow-payment-methods`.

**SaleDetailItemsList:** `items-table`, and per-index `item-row-${i}`, `item-name-${i}`, `item-subtitle-${i}`, `item-original-price-${i}`, `item-pre-discount-price-${i}`, `item-quantity-${i}`, `item-discount-${i}`, `item-subtotal-${i}`, `item-line-original-${i}`.

**SaleDetailTotalsCard:** `totals-subtotal-value`, `totals-discount-row`, `totals-discount-value`, `totals-total-value`, `totals-paid-row`, `totals-debt-row`, `totals-change-row`, `register-debt-payment`.

**PaymentsListSection:** `payments-list-section`, `payments-count`, `payments-list-skeleton`, `payments-list-empty`, `payments-list`, `payment-row-${paymentId}`, `payment-reference-${paymentId}`, `payment-amount-${paymentId}`, `payment-edit-${paymentId}`, `payments-list-edit-slideover`.

**SaleDetailTimeline:** `timeline-event`, `timeline-event-icon-${event.type}`, `timeline-icon`, `timeline-actor`, `timeline-comment-body`, `comment-edit-form`, `comment-edit-textarea`, `comment-edit-cancel`, `comment-edit-save`, `comment-edit-trigger`, `comment-delete-trigger`.

**SaleCommentInput / Slideover:** `sale-comment-input`, `comment-open`, `comment-form`, `comment-body`, `comment-cancel`, `comment-submit`.

Tests that snapshot/assert structure and will need selector parity (not deletion): `SaleDetailView.test.ts` (asserts the 4 body stubs coexist, `sale-detail-header` coco classes, reflow card coco classes, `register-payment-header` Cobrar classes), `SaleDetailItemsList.test.ts`, `SaleDetailTotalsCard.test.ts`, `SaleDetailTimeline.test.ts`, `SaleCommentInput.test.ts`, `PaymentsListSection.spec.ts`. The view test's "renders tabbed workbench layout" and "renders the sidebar data reflow section" tests assert the CURRENT tab layout; these will be updated, not deleted. No test asserts `sale-detail-tabs` directly (it's only in the source), but `sale-detail-payments-list` is asserted via `PaymentsListSection.spec.ts`'s mount contract.

## 6. Spec home decision

**Recommendation: add the delta to `openspec/specs/sales/spec.md`** — with an explicit flag.

Reasoning FOR `sales/spec.md`:
- Precedent: `sales-pos-charge` added `REQ-NEW-1..15` + `REQ-19 MODIFIED` to `sales/spec.md` (the most recent sales change).
- `sales/spec.md` already hosts UI-layout requirements for the sales LIST (REQ-12 card mode, REQ-16 sortable headers, REQ-17 view mode, REQ-18 toolbar), so a sale-detail layout delta is not out of place.
- The sale detail screen has no competing dedicated spec home today.

Counter-consideration (flag for proposal phase): the codebase also maintains a dedicated `sales-screen-redesign/spec.md` (10 requirements) for the SalesView **layout**, and `sales-view-coco-redesign/spec.md` (7 requirements) for **tokens**. Those are the precedent for PURE visual/structural changes. If the proposal phase finds the delta is large (>~12 requirements) or token-heavy, a new capability home `sale-detail-layout` (or `sale-detail-redesign`) mirroring `sales-screen-redesign` is the more consistent alternative. **Decision deferred to proposal phase**, with `sales/spec.md` as the default.

⚠️ **Coordination finding:** `openspec/changes/sales-history-coco/` is IN-FLIGHT (has `archive-report.md` but was never moved to `archive/`). Its delta `specs/sales/spec.md` defines **HST-REQ-001..008** — Coco surface treatment that PINS the SaleDetailView sticky header (`bg-coco-neutral-50/90 dark:bg-coco-neutral-950/90`), the five Datos cards (`bg-coco-neutral-50 dark:bg-coco-neutral-950`), and the Cobrar CTA pattern (`!bg-(--brand-action) !text-black ...`). These HST-REQ requirements are **NOT yet merged** into the canonical `sales/spec.md`. The redesign MUST NOT regress them, and the spec phase should confirm whether `sales-history-coco` will be archived first (to avoid a merge-order conflict on `sales/spec.md`).

## 7. Risks and unknowns

- **Tight coupling to UTabs**: `SaleDetailView.vue` does NOT use `useTemplateRef` on tab panels; the only UTabs coupling is the `tabItems` computed (lines 178–190) + `:unmount-on-hide="false"` + `default-value="0"` + the four `#slot` templates. Low coupling — removal is mechanical.
- **Test that asserts the tabs exist**: `SaleDetailView.test.ts` "renders tabbed workbench layout with header title" and "renders the sidebar data reflow section" comment the tab structure and assert the four body stubs coexist. These survive a flat layout (all four still mount) but the test TITLES/COMMENTS and the `sale-detail-tabs` testid must be reconciled. No test asserts `sale-detail-tabs` by selector, so only narrative updates are needed — plus any new testids introduced for the new columns.
- **Prop drilling in the flat layout**: the inline "datos" block depends on `priceListName` + `uniquePaymentMethods` computeds and the `productApi.getGlobalPriceLists()` fetch currently owned by the view. Extracting a `DATOS DE LA VENTA` card forces a decision: move the fetch+computeds into the child (cleaner, shrinks the view) vs. pass props (more plumbing). Recommendation: move into the child.
- **PDF dropdown / "Comprobante"**: today it is an icon-only `UDropdownMenu` ("Más acciones", `i-lucide-file-text` + chevron) with a `hasAnyAction` gate + DRAFT-only tooltip. The user's mockup labels it "Comprobante". Open question: keep the icon-only trigger in the sticky header (KEEP per confirmed decision) or add a visible "Comprobante" label? Confirmed decision says "KEEP all actions … PDF dropdown" — so the trigger stays in the header; only the label/relabel is ambiguous.
- **Mobile responsiveness**: the header currently renders a `sm:hidden` mobile total AND a `hidden sm:block` desktop total. The proposed layout shows TOTAL prominently in the right column at all sizes. On mobile, the two-column grid must collapse to single column (TOTALES/PAGOS stack below PRODUCTOS/DATOS/HISTORIAL), and the header total may become redundant — decide whether to keep the mobile header total.
- **Two "Registrar pago" CTAs coexist** (header `register-payment-header` + totals-card `register-debt-payment`), both opening `DebtPaymentModal`. Keep both (distinct testids) per the confirmed "keep all actions" decision; verify no visual duplication regression in the flat layout.
- **`sale-detail-payments-list` testid** is an attribute passed from the view to `PaymentsListSection`; it must stay on the component mount in the right column.
- **In-flight parallel work** on the same surfaces: `sales-history-coco` (HST-REQ Coco tokens on the header + Datos cards), `sales-layout-redesign` (SalesView tabs — different screen), `sales-pos-charge` (mid-archive). The `sales-history-coco` delta overlaps the exact header/Datos markup this change restructures.

## 8. Out-of-scope (explicit non-goals)

- NO new design system or new color tokens — reuse `coco-neutral` + existing Nuxt UI components (`UCard`, `UBadge`, `USeparator`, `UTooltip`, `USkeleton`).
- NO backend/API changes — the redesign is 100% frontend; `sale.timeline` already carries COMMENT events.
- NO new data-testids except where a new wrapper needs an identity for parity tests; existing testids are preserved, not renamed.
- NO changes to `SaleDetailItemsList`, `SaleDetailTotalsCard`, `PaymentsListSection`, `SaleCommentSlideover`, `DebtPaymentModal`, `AssignSellerSlideover` internals (they are presentational and already correct).
- NO "Comprobante" PDF section in the body unless the proposal phase explicitly approves moving the dropdown out of the header (default: stays in header).
- NO infinite-scroll/virtualization, no "ver más" pagination of the timeline.
- NO editing of products/payments/discounts from the detail screen (read-only detail remains read-only).

## 9. Open questions for the proposal phase

1. **PDF dropdown relabel**: does "Comprobante" replace the icon-only "Más acciones" trigger in the header, or is "Comprobante" a separate body section? (User's words say KEEP the PDF dropdown in the header, but the mockup mentions "Comprobante".)
2. **HISTORIAL composer placement**: should `SaleCommentInput` live INSIDE the HISTORIAL card (footer of the card) or directly beneath it in the left column? And should HISTORIAL be a new `SaleDetailHistoryCard` wrapper, or just `SaleDetailTimeline` + `SaleCommentInput` as siblings?
3. **DATOS card extraction**: extract to a new `SaleDetailSalesDataCard.vue` component (moving the price-list fetch + computeds into it) vs. keep inline in the view. This drives the line-count/budget forecast.
4. **Column ordering at mobile**: confirm the single-column stacking order (PRODUCTOS → DATOS → HISTORIAL → TOTALES → PAGOS) and whether the header total is removed/hidden on mobile.
5. **Spec home**: `sales/spec.md` delta (default) vs. new `sale-detail-layout` capability home. Depends on delta size and the `sales-history-coco` archive ordering.
6. **`sale-detail-tabs` testid**: remove it (the tab strip is gone) — confirm no hidden consumer/e2e depends on it (only source + no test references it today).

## 10. Implementation-shape preview

Components that stay untouched: `SaleDetailItemsList`, `SaleDetailTotalsCard`, `PaymentsListSection`, `SaleCommentInput`, `SaleCommentSlideover`, `SaleDetailTimeline`, `DebtPaymentModal`, `AssignSellerSlideover`.

New/renamed/extracted:

| File | Action | Est. lines |
|---|---|---|
| `SaleDetailView.vue` | Rewrite body: drop `UTabs` + `tabItems` (~90 lines), wrap left/right in a responsive 2-col grid, keep header + modals, mount new `SaleDetailSalesDataCard` + `SaleDetailHistoryCard` | net ~-60 (churn ~280–320) |
| `components/SaleDetailSalesDataCard.vue` | NEW — extracted "datos" cards (cajero/vendedor/cliente/lista/precio/métodos); owns `priceListName` + `uniquePaymentMethods` + price-list fetch; emits `assign-seller` | +80 |
| `components/SaleDetailHistoryCard.vue` | NEW (optional) — `UCard` wrapping `SaleDetailTimeline` + `SaleCommentInput` under a "HISTORIAL" header | +45 |
| `SaleDetailView.test.ts` | Retitle tab-layout tests → flat-layout; reconcile `sale-detail-tabs` removal; add assertions for the two-column structure | ~80 changed |

Budget forecast: authored additions+deletions ≈ **350–420 lines**, i.e. at/above the 400-line single-pr budget. **Medium risk** — the proposal/tasks phase should either (a) keep `SaleDetailSalesDataCard` and `SaleDetailHistoryCard` extractions minimal, or (b) plan `size:exception` / chained slices. A leaner alternative (keep "datos" inline, skip the HistoryCard wrapper) lands ≈ **280–320 lines** and fits single-pr cleanly.
