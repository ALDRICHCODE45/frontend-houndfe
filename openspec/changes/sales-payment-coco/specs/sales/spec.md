# Delta for Sales — Payment Coco

## ADDED Requirements

### Requirement: PMT-REQ-001 No Primary-Blue Survival
`PaymentModal`, `PaymentSuccessModal`, and `DebtPaymentModal` MUST NOT contain any `text-primary`, `bg-primary`, `border-primary/*`, or unoverridden `color="primary"` class/prop. All props, emits, validation, computed logic, `data-testid`, `aria-label`, focus order, and `UModal`/`USlideover` shell semantics MUST remain identical. No new `main.css` `@theme` entries, no `vite.config.ts` changes. `SaleTotalsFooter` diff MUST be empty.

#### Scenario: zero primary class tokens in payment modals
- GIVEN the three target components are mounted
- WHEN the DOM is inspected for `text-primary`, `bg-primary`, classes matching `/border-primary\//`, and `color="primary"` props without a `!bg-` override
- THEN none are found

#### Scenario: props, emits, computed logic are unchanged
- GIVEN existing test suites for all three components
- WHEN each component is mounted with the same prop combos as pre-change
- THEN all emit payloads, button labels, and computed states match pre-change behavior
- AND `SaleTotalsFooter` renders identically to pre-change

### Requirement: PMT-REQ-002 Coco Gold Structural Accents
Total-amount banners and selected method-picker tiles in `PaymentModal` and `DebtPaymentModal` MUST render with coco-gold tint tokens: `border-coco-gold-500/20 bg-coco-gold-500/5` (banners) and `border-coco-gold-500/40 bg-coco-gold-500/5` (selected tiles). Unselected tile hover MUST use `hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5`.

#### Scenario: total banner renders coco-gold tint
- GIVEN `PaymentModal` or `DebtPaymentModal` mounted with `open: true`
- WHEN the total-banner element renders
- THEN its classes include `border-coco-gold-500/20 bg-coco-gold-500/5`
- AND no `border-primary/20` or `bg-primary/5` is present

#### Scenario: selected method tile renders coco-gold accent
- GIVEN a method tile is toggled ON in either modal
- WHEN the tile renders with its active dynamic class
- THEN `border-coco-gold-500/40 bg-coco-gold-500/5` is applied
- AND unselected tiles show `hover:border-coco-gold-500/40 hover:bg-coco-gold-500/5`

### Requirement: PMT-REQ-003 Coco Gold Inline Accents
Method-picker icons, the "Agregar fecha de vencimiento" link in `PaymentModal`, and the Cambio amount row in `PaymentSuccessModal` MUST render coco-gold text. Dark-mode on `coco-neutral-950` MUST use `text-coco-gold-400`; light-mode on `coco-neutral-50` MUST use `text-coco-gold-700`.

#### Scenario: method icons render coco-gold text
- GIVEN a payment modal mounted with method tiles visible
- WHEN the `UIcon` elements inside method tiles render
- THEN they carry `text-coco-gold-400` (dark) or `text-coco-gold-700` (light)
- AND no `text-primary` survives on those elements

#### Scenario: Cambio row renders gold text
- GIVEN `PaymentSuccessModal` mounted with `changeDueCents > 0`
- WHEN the Cambio `<dd>` renders
- THEN it uses coco-gold text tokens, not `text-primary`

### Requirement: PMT-REQ-004 Coco Action Button Pattern
The Confirmar cobro button in `PaymentModal`, Confirmar cobro button in `DebtPaymentModal`, and Cerrar button in `PaymentSuccessModal` MUST follow the `SaleTotalsFooter` Cobrar precedent: `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"`. The `color="primary"` prop MAY remain as semantic fallback, overridden by the `!bg-` class.

#### Scenario: Confirmar cobro button renders gold action style
- GIVEN `PaymentModal` mounted with a valid payment entry
- WHEN the Confirmar cobro button renders
- THEN its classes include `!bg-(--brand-action)` and `!text-black`
- AND the `color="primary"` prop is visually overridden

#### Scenario: Cerrar button follows Cobrar precedent
- GIVEN `PaymentSuccessModal` mounted after a successful charge
- WHEN the Cerrar button renders
- THEN it uses the Cobrar precedent class set

### Requirement: PMT-REQ-005 UInputNumber Color Fallback
`UInputNumber` instances in `PaymentModal` and `DebtPaymentModal` MUST replace `color="primary"`. The implementation SHALL attempt `color="warning"`; if the focused ring renders orange rather than gold on `coco-neutral-950`, the implementation SHALL document the decision and fall back to `color="neutral"`. `data-testid`, `v-model` binding, and disabled logic MUST NOT change.

#### Scenario: UInputNumber uses non-primary color
- GIVEN a payment entry row with UInputNumber mounted
- WHEN the input renders
- THEN its `color` is `"warning"` or `"neutral"` — not `"primary"`
- AND `data-testid` and disabled logic are preserved

### Requirement: PMT-REQ-006 Regression Guard
All existing test assertions on prop contracts, emit payloads, computed labels, `data-testid` selectors, and disabled logic MUST pass. Any test selector pinning a class name with `primary` MUST be updated to expect the corresponding coco-gold token class. `pnpm build` MUST pass.

#### Scenario: existing tests pass after selector updates
- GIVEN test files for `PaymentModal`, `PaymentSuccessModal`, `DebtPaymentModal`
- WHEN `pnpm test:unit` runs
- THEN all three component test suites pass without new test files

#### Scenario: pnpm build is clean
- GIVEN the three components and test files are changed
- WHEN `pnpm build` runs
- THEN the build succeeds with no type or bundle errors
- AND `SaleTotalsFooter.vue` diff is empty
