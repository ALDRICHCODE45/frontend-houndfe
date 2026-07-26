# Delta for Sales — Sales History Coco

## ADDED Requirements

### Requirement: HST-REQ-001 No Primary-Blue Survival

`SalesListView.vue`, `SaleDetailView.vue`, `SaleCard.vue`, `SaleDetailTimeline.vue`, `SaleDetailTotalsCard.vue`, and `SaleCommentInput.vue` MUST NOT render any `text-primary`, `bg-primary`, classes matching `/border-primary\//`, `data-color="primary"` on a UButton without a `!bg-` override, or implicit-primary (no-`color`-prop) UButton. All props, emits, validation, computed logic, `data-testid`, `aria-label`, focus order, and `UTabs`/`UModal`/`USlideover` shell semantics MUST remain identical.

#### Scenario: zero primary class tokens in the 6 target files
- GIVEN the six target components are mounted
- WHEN the DOM is inspected for `text-primary`, `bg-primary`, `/border-primary\//`, and UButton elements where the `color` prop is `primary` (or absent, implying `primary`) WITHOUT a `!bg-` override class
- THEN none are found

#### Scenario: props, emits, computed logic are unchanged
- GIVEN existing test suites for all six components
- WHEN each component is mounted with the same prop combos as pre-change
- THEN all emit payloads, button labels, and computed states match pre-change behavior

### Requirement: HST-REQ-002 Coco Surface Treatment

The `SaleDetailView` sticky header and five Datos-tab cards MUST use `bg-coco-neutral-50 dark:bg-coco-neutral-950` in place of raw `bg-white/90 dark:bg-zinc-950/90` (header) and `bg-white dark:bg-zinc-900` (cards). `SaleCard` MUST replace `bg-default` with `bg-coco-neutral-50 dark:bg-coco-neutral-950` on its `<UCard>` wrapper. `SalesListView` `<UCard>` SHOULD receive the same coco-neutral surface treatment.

#### Scenario: sticky header renders coco-neutral surface
- GIVEN `SaleDetailView` mounted with `isLoading: false` and a valid sale
- WHEN `[data-testid="sale-detail-header"]` is inspected
- THEN its class list includes `bg-coco-neutral-50 dark:bg-coco-neutral-950`
- AND it does NOT include `bg-white/90` or `dark:bg-zinc-950/90`

#### Scenario: Datos-tab cards render coco-neutral surface
- GIVEN `SaleDetailView` mounted with the Datos tab panel rendered
- WHEN any `[data-testid^="reflow-"]` card is inspected
- THEN its class list includes `bg-coco-neutral-50 dark:bg-coco-neutral-950`
- AND it does NOT include `bg-white` or `dark:bg-zinc-900`

#### Scenario: SaleCard UCard renders coco-neutral surface
- GIVEN `SaleCard` mounted with a valid `ConfirmedSaleRow`
- WHEN the `<UCard>` wrapper element is inspected
- THEN its class list includes `bg-coco-neutral-50 dark:bg-coco-neutral-950`
- AND it does NOT rely solely on `bg-default`

### Requirement: HST-REQ-003 Cobrar Action Button Pattern

The "Nueva Venta" button in `SalesListView`, the "Registrar pago" header button in `SaleDetailView`, and the "Registrar Pago" button in `SaleDetailTotalsCard` MUST follow the Cobrar precedent: `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"`. A `color="primary"` prop MAY remain as a semantic fallback, overridden by the `!bg-` class.

#### Scenario: Nueva Venta button renders Cobrar gold action style
- GIVEN `SalesListView` mounted
- WHEN the "Nueva Venta" button renders
- THEN its class list includes `!bg-(--brand-action)` and `!text-black`
- AND any `color="primary"` prop is visually overridden

#### Scenario: Registrar pago header button renders Cobrar gold action style
- GIVEN `SaleDetailView` mounted with `canRegisterPayment: true`
- WHEN `[data-testid="register-payment-header"]` renders
- THEN its class list includes `!bg-(--brand-action)` and `!text-black`

#### Scenario: Registrar Pago totals card button renders Cobrar gold action style
- GIVEN `SaleDetailTotalsCard` mounted with `canRegisterPayment: true`
- WHEN `[data-testid="register-debt-payment"]` renders
- THEN its class list includes `!bg-(--brand-action)` and `!text-black`

### Requirement: HST-REQ-004 Coco Gold Inline Accents

The timeline `SALE_REGISTERED` event icon MUST use `text-coco-gold-700 dark:text-coco-gold-400 bg-coco-gold-500/10` instead of `text-primary bg-primary/10`. The timeline connector line MUST use `bg-coco-neutral-200 dark:bg-coco-neutral-800` instead of `bg-gray-200`. The `SalesListView` folio link, `SaleCard` folio text, and `SaleCommentInput` trigger button MUST use `text-coco-gold-700 dark:text-coco-gold-400` in place of `color="primary"` / `text-primary`. The `SaleCommentInput` trigger MUST NOT carry `color="primary"` or `data-color="primary"`.

#### Scenario: SALE_REGISTERED icon renders coco-gold tint
- GIVEN `SaleDetailTimeline` mounted with a `SALE_REGISTERED` event
- WHEN `[data-testid="timeline-event-icon-SALE_REGISTERED"]` renders
- THEN its classes include `text-coco-gold-700`, `dark:text-coco-gold-400`, and `bg-coco-gold-500/10`
- AND it does NOT include `text-primary` or `bg-primary/10`

#### Scenario: timeline connector line renders coco-neutral token
- GIVEN `SaleDetailTimeline` mounted with 2+ events
- WHEN the vertical connector `div.w-px` between events is inspected
- THEN its class list includes `bg-coco-neutral-200 dark:bg-coco-neutral-800`
- AND it does NOT include `bg-gray-200`

#### Scenario: folio link renders coco-gold text
- GIVEN `SalesListView` mounted with a confirmed sale row
- WHEN `[data-testid="sale-link-sale-1"]` renders
- THEN its class list includes coco-gold text tokens
- AND it does NOT render `data-color="primary"` on the folio link

#### Scenario: SaleCard folio renders coco-gold text
- GIVEN `SaleCard` mounted with a valid sale
- WHEN the folio element renders
- THEN its class list includes `text-coco-gold-700 dark:text-coco-gold-400`
- AND it does NOT include `text-primary`

#### Scenario: comment trigger renders coco-gold tint
- GIVEN `SaleCommentInput` mounted
- WHEN `[data-testid="comment-open"]` renders
- THEN its class list includes coco-gold text tokens
- AND `data-color` is NOT `"primary"`

### Requirement: HST-REQ-005 Dark-First and Light-Mode Readability

Dark-mode rendering on `bg-coco-neutral-950` MUST preserve readable text contrast: `text-coco-gold-400` on dark, `text-coco-gold-700` on light. Light-mode on `bg-coco-neutral-50` MUST preserve the same readable contrast. Elements using the Cobrar precedent (`!bg-(--brand-action) !text-black`) MUST be readable in both modes.

#### Scenario: dark-mode text on coco-neutral-950 is readable
- GIVEN the six target components mounted in dark mode (`prefers-color-scheme: dark`)
- WHEN rendered text elements with coco-gold classes are inspected
- THEN they use `text-coco-gold-400` (lighter gold on dark background)

#### Scenario: light-mode text on coco-neutral-50 is readable
- GIVEN the six target components mounted in light mode
- WHEN rendered text elements with coco-gold classes are inspected
- THEN they use `text-coco-gold-700` (darker gold on light background)
- AND Cobrar action buttons have black text (`!text-black`) on `--brand-action` background

### Requirement: HST-REQ-006 No-Token / No-Logic / No-Coco-Regression Guard

No new entries MUST be added to `main.css` `@theme` block. `vite.config.ts` MUST remain unchanged. Props, emits, computed logic, validation, status transitions, and `data-testid` anchors MUST remain identical to pre-change. `PaymentModal.vue`, `PaymentSuccessModal.vue`, `DebtPaymentModal.vue`, `SaleTotalsFooter.vue`, and `ActiveSalePanel.vue` MUST produce an empty diff.

#### Scenario: no new design tokens
- GIVEN the change is applied
- WHEN `main.css` and `vite.config.ts` are diffed against pre-change
- THEN no new `@theme` entries exist in `main.css`
- AND `vite.config.ts` has zero changes

#### Scenario: business logic is unchanged
- GIVEN all six components' test suites run
- WHEN assertions on computed values, emits, disabled logic, and `data-testid` anchors are evaluated
- THEN all pass without behavioral divergence from pre-change

#### Scenario: already-Coco surfaces stay unchanged
- GIVEN the change is applied
- WHEN `git diff` is run on the five already-coco files
- THEN the diff for each is empty

### Requirement: HST-REQ-007 Test Selector Updates

`SaleDetailTimeline.test.ts` MUST update its class assertion for `SALE_REGISTERED` from `['text-primary', 'bg-primary/10']` to `['text-coco-gold-700', 'dark:text-coco-gold-400', 'bg-coco-gold-500/10']`. `SaleCommentInput.test.ts` MUST update its `data-color` assertion from `'primary'` to the new non-primary value. All other behavior assertions in both test files MUST continue to pass.

#### Scenario: timeline test asserts coco-gold classes for SALE_REGISTERED
- GIVEN `SaleDetailTimeline.test.ts` updated
- WHEN the semantic-color-class test runs
- THEN `timeline-event-icon-SALE_REGISTERED` classes include `text-coco-gold-700`, `dark:text-coco-gold-400`, `bg-coco-gold-500/10`
- AND no assertion references `text-primary` or `bg-primary/10`

#### Scenario: comment-input test asserts non-primary color
- GIVEN `SaleCommentInput.test.ts` updated
- WHEN the button-attribute test runs
- THEN `[data-testid="comment-open"]` `data-color` is NOT `"primary"`
- AND the button label and icon assertions still pass

### Requirement: HST-REQ-008 Accessibility Preservation

All `data-testid`, `aria-label`, focus order, and Nuxt UI shell semantics (`UTabs`, `UModal`, `USlideover`) MUST remain identical. The "Registrar pago" header button (`data-testid="register-payment-header"`) and the totals card button (`data-testid="register-debt-payment"`) MUST remain focusable and keyboard-operable. Color MUST NOT be the sole indicator of any state.

#### Scenario: accessibility anchors preserved
- GIVEN the six target components mounted
- WHEN `data-testid` anchors, `aria-label` attributes, and focus order are inspected
- THEN all match pre-change values
- AND Cobrar action buttons retain their `data-testid` and keyboard operability
