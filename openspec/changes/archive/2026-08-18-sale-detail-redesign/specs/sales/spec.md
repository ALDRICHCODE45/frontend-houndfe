# Delta Spec: sales

Extends `openspec/specs/sales/spec.md` with **REQ-LAYOUT-001..008** (flat two-column redesign of `SaleDetailView`) and a **MODIFIED** carve-out for **HST-REQ-008** (owned by the in-flight `sales-history-coco` delta) releasing the `UTabs`-shell clause and the PDF-trigger `aria-label`. **HST-REQ-001..007 continue to apply unmodified** — the Coco-token constraints on the sticky header, reflow cards, Cobrar CTAs, SALE_REGISTERED icon, timeline connector, and comment composer must not regress.

## MODIFIED Requirements

### Requirement: HST-REQ-008 Accessibility Preservation

(Owned by the in-flight `sales-history-coco` delta; mirrored here so archive ordering is unambiguous.)

`data-testid` anchors (excluding `sale-detail-tabs`, removed by REQ-LAYOUT-005), `aria-label` attributes (except the PDF dropdown trigger, relabeled by REQ-LAYOUT-003), focus order, and `UModal` / `USlideover` shell semantics MUST remain identical. The `UTabs` clause is RELEASED: the four-tab workbench is removed in favor of a flat two-column grid (REQ-LAYOUT-001). The PDF dropdown trigger `aria-label` MAY change from `"Más acciones"` to `"Comprobante"` (REQ-LAYOUT-003). The "Registrar pago" header button (`data-testid="register-payment-header"`) and the totals card button (`data-testid="register-debt-payment"`) MUST remain focusable and keyboard-operable. Color MUST NOT be the sole indicator of any state.

(Previously: `UTabs` shell semantics + all `aria-label` values pinned identical.)

#### Scenario: accessibility anchors preserved (UTabs clause released)

- GIVEN the six target components mounted after the redesign
- WHEN `data-testid` anchors, `aria-label` attributes, and focus order are inspected
- THEN non-released values match pre-change values
- AND `UModal` / `USlideover` shell semantics remain identical
- AND Cobrar action buttons retain their `data-testid` and keyboard operability

## ADDED Requirements

### REQ-LAYOUT-001 Flat Two-Column Shell

`SaleDetailView` SHALL render a flat two-column grid replacing the `UTabs` workbench. The left column SHALL stack `SaleDetailItemsList` (PRODUCTOS), `SaleDetailSalesDataCard` (DATOS DE LA VENTA), and `SaleDetailHistoryCard` (HISTORIAL) in that order. The right column SHALL stack `SaleDetailTotalsCard` (TOTALES) and `PaymentsListSection` (PAGOS REGISTRADOS) in that order. The grid SHALL be implemented as `grid gap-6 lg:grid-cols-[1fr_360px]` and the root container SHALL carry `data-testid="sale-detail-layout-body"`. The `UTabs` workbench, the `tabItems` computed, the four `#slot` templates (`#productos`, `#pagos`, `#datos`, `#comentarios`), and `data-testid="sale-detail-tabs"` SHALL be removed.

#### Scenario: flat layout renders both columns at lg+

- GIVEN a confirmed sale with items, totals, payments, and timeline
- WHEN the view renders at viewport `lg`
- THEN `[data-testid="sale-detail-layout-body"]` renders with `items-table` + `sidebar-data-reflow` + the HISTORIAL card on the left
- AND `totals-total-value` + at least one `payment-row-*` on the right

#### Scenario: UTabs workbench is removed

- GIVEN the redesigned view
- WHEN the DOM is inspected
- THEN no element with `data-testid="sale-detail-tabs"` exists
- AND the four body stubs (`items`, `totals`, `timeline`, `comment-input`) coexist in the flat grid

### REQ-LAYOUT-002 Unified HISTORIAL Card

`SaleDetailHistoryCard` SHALL render a single `UCard` titled "HISTORIAL" that mounts `SaleDetailTimeline` in the card body and `SaleCommentInput` in the card footer. The HISTORIAL card MUST subsume the previous `UTabs` `#comentarios` panel content. `sale.timeline` already interleaves COMMENT events, so no data-shape change is needed.

#### Scenario: HISTORIAL card composes timeline + composer

- GIVEN a sale with ≥1 timeline event
- WHEN the HISTORIAL card renders
- THEN `timeline-event` testids render in the card body
- AND `sale-comment-input` renders in the card footer
- AND no separate HISTORIAL/COMENTARIOS section exists outside the card

#### Scenario: HISTORIAL renders without throwing when timeline is empty

- GIVEN a confirmed sale with `timeline.length === 0`
- WHEN the view renders
- THEN the empty-state affordance renders in the card body
- AND `SaleCommentInput` still renders in the footer

### REQ-LAYOUT-003 Comprobante Trigger

The PDF dropdown trigger in the sticky header SHALL render as a `UButton` labeled `"Comprobante"` (with `i-lucide-file-text` icon and chevron) when `sale.status !== 'DRAFT'` AND `hasAnyAction === true`. When `hasAnyAction === false` (e.g. CANCELED sales), the trigger SHALL fall back to the icon-only affordance, identical to today's behavior. The DRAFT-status `UTooltip` that disables the trigger MUST remain in effect. The trigger `aria-label` MAY change from `"Más acciones"` to `"Comprobante"` (released per MODIFIED HST-REQ-008); all other trigger attributes (`UDropdownMenu`, `actionItems`) remain unchanged.

#### Scenario: confirmed sale with actions renders Comprobante label

- GIVEN `sale.status === 'CONFIRMED'` with ≥1 PDF-eligible action
- WHEN the sticky header renders
- THEN the trigger shows visible `"Comprobante"` text + `i-lucide-file-text` icon
- AND the dropdown opens on click

#### Scenario: canceled sale falls back to icon-only

- GIVEN `sale.status === 'CANCELED'` (no PDF actions)
- WHEN the sticky header renders
- THEN the trigger renders icon-only
- AND no `"Comprobante"` text renders

#### Scenario: DRAFT sale keeps disabled tooltip behavior

- GIVEN `sale.status === 'DRAFT'`
- WHEN the sticky header renders
- THEN the trigger is disabled
- AND the existing DRAFT `UTooltip` text renders on hover

### REQ-LAYOUT-004 Mobile Stacking Order

Below the `lg` breakpoint, the flat grid SHALL collapse to a single column. In single-column mode, the right column (TOTALES → PAGOS REGISTRADOS) SHALL render BEFORE the left column (PRODUCTOS → DATOS DE LA VENTA → HISTORIAL) in DOM order. At `lg` and above, the layout SHALL snap back to two columns with the left column first and the right column second. The right column root SHALL carry `order-1 lg:order-2` and the left column root SHALL carry `order-2 lg:order-1`.

#### Scenario: mobile viewport stacks right column first

- GIVEN viewport width < `lg`
- WHEN the view renders
- THEN the right column (TOTALES, PAGOS) renders above the left column (PRODUCTOS, DATOS, HISTORIAL) in DOM order
- AND both columns render at full width

#### Scenario: lg viewport restores two-column layout

- GIVEN viewport width ≥ `lg`
- WHEN the view renders
- THEN the left column renders first AND the right column renders second in DOM order
- AND the grid renders as `1fr_360px`

### REQ-LAYOUT-005 Data-testid Parity

The redesign MUST preserve verbatim: header anchors (`sale-detail-layout`, `sale-detail-skeleton`, `sale-detail-header`, `header-folio`, `header-date`, `badge`, `register-payment-header`); datos anchors (`sidebar-data-reflow`, `reflow-cajero`, `reflow-vendedor`, `reflow-cliente`, `reflow-price-list`, `reflow-payment-methods`); payments anchor (`sale-detail-payments-list` attribute on `PaymentsListSection`). The `sale-detail-tabs` testid MUST be removed (no test or e2e consumer references it). The redesign MUST add `data-testid="sale-detail-layout-body"` on the flat grid container. No other testids are renamed or removed.

#### Scenario: preserved testids render on the new structure

- GIVEN the redesigned view mounted with a valid sale
- WHEN the DOM is inspected
- THEN every preserved testid above renders exactly once
- AND `[data-testid="sale-detail-layout-body"]` renders on the grid root
- AND no `[data-testid="sale-detail-tabs"]` exists

#### Scenario: existing test assertions continue to pass

- GIVEN `SaleDetailView.test.ts` updated to assert the new selectors
- WHEN the suite runs (`pnpm test:unit --run`)
- THEN Coco-token class assertions on the header + reflow cards (HST-REQ-002) pass
- AND `register-payment-header` Cobrar-gold class assertions pass (HST-REQ-003)

### REQ-LAYOUT-006 DATOS Extraction Into `SaleDetailSalesDataCard`

The "DATOS DE LA VENTA" block SHALL be extracted into `SaleDetailSalesDataCard.vue`. The card SHALL own the `productApi.getGlobalPriceLists()` `onMounted` fetch (moved out of `SaleDetailView`), the `priceListName` computed, and the `uniquePaymentMethods` computed. The card SHALL emit `assign-seller` upward when the seller field's edit action fires. After extraction, `SaleDetailView` MUST NOT import `productApi`. The card root SHALL carry `data-testid="sidebar-data-reflow"`; each inner card SHALL retain its existing `reflow-*` testid (HST-REQ-002).

#### Scenario: extracted card owns price-list fetch and computeds

- GIVEN `SaleDetailView` mounted with a sale whose `globalPriceListId` resolves to a known price list
- WHEN `SaleDetailSalesDataCard` mounts
- THEN `productApi.getGlobalPriceLists()` is invoked exactly once
- AND `[data-testid="reflow-price-list"]` displays the resolved `priceListName`

#### Scenario: view drops the productApi import

- GIVEN the extraction is complete
- WHEN `SaleDetailView.vue` is type-checked (`pnpm tsc --noEmit`)
- THEN no `import { productApi }` or `import productApi` line exists in the view
- AND the build succeeds

#### Scenario: assign-seller event flows upward

- GIVEN the seller field's edit action is clicked inside `SaleDetailSalesDataCard`
- WHEN the click emits
- THEN the view receives the `assign-seller` event AND opens `AssignSellerSlideover`

### REQ-LAYOUT-007 HISTORIAL Extraction Into `SaleDetailHistoryCard`

The HISTORIAL card SHALL be implemented as `SaleDetailHistoryCard.vue`, a thin `UCard` wrapper that mounts `SaleDetailTimeline` (body) and `SaleCommentInput` (footer). The card's title SHALL be "HISTORIAL". No new props/emits are introduced beyond the child components' existing contracts. Existing `timeline-*` and `comment-*` testids MUST remain on the child components (HST-REQ-007).

#### Scenario: wrapper card composes the existing children

- GIVEN a sale with timeline events
- WHEN `SaleDetailHistoryCard` renders
- THEN `SaleDetailTimeline` mounts in the card body
- AND `SaleCommentInput` mounts in the card footer
- AND the `UCard` title is `"HISTORIAL"`

#### Scenario: composer in card footer is keyboard-operable

- GIVEN the HISTORIAL card renders
- WHEN the cashier tabs through the card
- THEN the footer composer is reachable via keyboard
- AND focus order matches body-then-footer DOM order

### REQ-LAYOUT-008 No Mobile Header Total Duplicate

`SaleDetailView` SHALL NOT render the mobile-only header total (`sm:hidden` block). The right column's `SaleDetailTotalsCard` SHALL own the TOTAL at all viewport sizes. The desktop header total (`hidden sm:block`) MAY remain for visual continuity; the proposal removes only the `sm:hidden` duplicate.

#### Scenario: no mobile header total renders

- GIVEN viewport width < `sm`
- WHEN the sticky header renders
- THEN no `sm:hidden` total element renders
- AND the right column's `[data-testid="totals-total-value"]` is the only TOTAL on screen

#### Scenario: lg viewport still shows the right-column TOTAL

- GIVEN viewport width ≥ `lg`
- WHEN the view renders
- THEN the right column's `SaleDetailTotalsCard` continues to render `totals-total-value`
- AND the totals card stays focusable / keyboard-operable per HST-REQ-008
