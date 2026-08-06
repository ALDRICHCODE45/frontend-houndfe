# Capability: quotations-ui

## Description

Presentation-layer specification for the quotations screens (detail + list), adopting the Coco reference design (`docs/redesign/quotations-detail-comparison.md`). Defines visual structure, layout, scoped design tokens, and required components for `QuotationDetailView.vue` and `QuotationsListView.vue`. **Pure view-layer spec — no behavior requirements**; behavior is owned by `quotations-management` (REQ-QTN-001…017). Proposal decisions baked in: 3-state stepper, client-side IVA `totalCents * 0.16`, UI-only customer notes, no `Copiar` button, Coco tokens scoped to this change (`--coco-primary: #2557D6`, `--coco-accent: #E0A800`).

## Requirements

### REQ-UI-001: Coco design tokens (scoped)

All Coco tokens MUST be defined in a dedicated CSS layer named `coco-quotations` and MUST NOT mutate `:root` or project-wide tokens. Required tokens: `--coco-primary: #2557D6`, `--coco-primary-50: #EFF4FF`, `--coco-accent: #E0A800`, `--coco-accent-50: #FEF8E7`, `--coco-bg: #F9FAFB`, `--coco-card: #FFFFFF`, `--coco-border: #E5E7EB`, `--coco-text: #111827`, `--coco-text-secondary: #6B7280`, `--coco-text-tertiary: #9CA3AF`, `--coco-success: #10B981`, `--coco-warning: #F59E0B`, `--coco-danger: #DC2626`, `--coco-info: #3B5BFF`. Components MUST consume tokens via Tailwind arbitrary values (e.g. `bg-[var(--coco-primary)]`).

#### Scenario: Tokens apply only to quotations screens

- GIVEN the app stylesheets
- WHEN the quotations detail view renders
- THEN the `--coco-*` variables resolve from the `coco-quotations` layer
- AND non-quotations screens show no token change

### REQ-UI-002: Detail view two-column layout

`QuotationDetailView` MUST render a 2-column grid at the `lg` breakpoint (`lg:grid-cols-3`): left column `col-span-2` holding the CLIENTE, LISTA DE PRECIOS, VIGENCIA, Productos, and Promociones panels; right column `col-span-1` holding RESUMEN, notes, and CTAs, positioned `sticky top-4`. Section cards MUST use `rounded-xl` radius, subtle border, `p-5` padding, and `gap-4` spacing per the reference.

#### Scenario: Sidebar stays visible while scrolling

- GIVEN a quotation with many product items on an `lg` viewport
- WHEN the user scrolls the left column
- THEN the right summary column remains visible in view

#### Scenario: Stacked on small screens

- GIVEN a viewport below `lg`
- WHEN the detail view renders
- THEN panels render as a single stacked column (no sticky behavior)

### REQ-UI-003: Progress stepper (3 states only)

`QuotationProgressStepper` MUST render exactly three steps in order: `BORRADOR` → `ENVIADA` → `EXPIRADA/CANCELADA`. `ACEPTADA` and `PEDIDO` MUST NOT appear. The current step MUST be the active node (filled with accent token, dark label); steps before it MUST show accent-colored connectors; future steps MUST render as neutral outline nodes. Root testid: `quotation-stepper`. Status→step mapping MUST be isolated in a single helper for later extension.

#### Scenario: Draft quotation renders first step active

- GIVEN a quotation with status `DRAFT`
- WHEN the stepper renders
- THEN exactly 3 steps are shown (`BORRADOR`, `ENVIADA`, `EXPIRADA/CANCELADA`)
- AND `BORRADOR` is the active node

#### Scenario: Cancelled quotation renders final step active

- GIVEN a quotation with status `CANCELLED`
- WHEN the stepper renders
- THEN `EXPIRADA/CANCELADA` is the active node

### REQ-UI-004: Header composition

The detail header MUST show: back link `← Volver a cotizaciones` (no background), title `Cotización`, a neutral monospace ID chip, a status badge (mustard `--coco-accent` background for BORRADOR), a secondary metadata line (`Creada … · Expira … · Vendedor …`), and actions `Previsualizar PDF` (outlined) and `Cancelar` (outlined red). MUST NOT render any duplicate/Copiar action.

#### Scenario: No duplicate action present

- GIVEN the detail header renders
- WHEN the header action list is inspected
- THEN no button labeled `Copiar` (or duplicate icon) exists

### REQ-UI-005: Customer card

`QuotationCustomerCard` MUST show `EntityAvatar` with initials derived from the customer name (graceful fallback when name fields are missing), customer name in bold, email with icon, phone with icon, and a full-width outlined `Cambiar cliente` button. Missing email or phone MUST omit the corresponding row rather than render blank placeholders.

#### Scenario: Customer without phone

- GIVEN a customer with no phone number
- WHEN the customer card renders
- THEN avatar, name, and email render
- AND the phone row is omitted

### REQ-UI-006: Expiry shortcut chips

`QuotationExpiryPicker` MUST render shortcut chips `7 días | 15 días | 30 días | Sin expiración` below the date input. The chip matching the current `expiresAt` MUST be highlighted (`--coco-accent-50` background, accent text). Selecting `N días` SHALL set `expiresAt` to now + N days; `Sin expiración` SHALL clear it.

#### Scenario: Selecting a shortcut updates expiry

- GIVEN a draft quotation without expiry
- WHEN the user selects the `15 días` chip
- THEN `expiresAt` becomes now + 15 days
- AND the `15 días` chip renders as active

### REQ-UI-007: Product item rows

`QuotationItemRow` MUST render as card-style rows: generous padding, rounded corners, thumbnail placeholder, product name in bold, SKU · variant in secondary text, unit price, discount in `--coco-info` blue, quantity stepper, right-aligned line subtotal in tabular-nums, overflow action menu, and a stock badge — neutral for healthy stock, amber (`--coco-warning`) for low stock (advisory semantics per REQ-QTN-013).

### REQ-UI-008: Promotion cards

`QuotationPromotionCard` MUST render each applied promotion as a card with a 4px left accent border (`border-l-4` in `--coco-accent`), promo name in bold, description in secondary text, `AUTOMÁTICA` outline badge, discount amount in `--coco-info` blue, and a `× Vetar` outlined button. The manual-promo selector and vetoed section SHALL keep their existing structure with the same card treatment.

### REQ-UI-009: Totals sidebar (RESUMEN)

`QuotationTotalsFooter` refactored as the right sidebar card MUST show: title `RESUMEN`, a context line (`N productos · M unidades · lista X`), rows `Subtotal`, `Descuentos` (blue), `IVA 16%`, a separator, and `TOTAL` (32px bold, tabular-nums, right-aligned). `IVA 16%` MUST be computed client-side as `totalCents * 0.16` — no backend field; the formula MUST be centralized in a single util carrying a `// TODO: replace when backend exposes taxCents` comment. The card MUST include a full-width primary CTA `Enviar cotización` in `--coco-primary`, a secondary `Guardar borrador`, and a validity notice (`Válida hasta …`).

#### Scenario: IVA computed client-side

- GIVEN a quotation with `totalCents = 33500`
- WHEN the summary renders
- THEN the `IVA 16%` row shows `$53.60`

#### Scenario: Summary renders in right column on desktop

- GIVEN an `lg` viewport
- WHEN the detail view renders
- THEN the summary appears in the right `col-span-1` sticky column

### REQ-UI-010: Customer notes (UI-only, not persisted)

A textarea with placeholder `Condiciones de entrega, referencias de pago...` and a `0 / 280` character counter MUST render in the right column below the summary. Notes MUST NOT be persisted; no control implying backend persistence SHALL be shown. A visible `(no implementado aún)` hint or an interim `localStorage` draft cache MAY be added (proposal risk mitigation).

#### Scenario: Character counter updates

- GIVEN the notes textarea is empty
- WHEN the user types 5 characters
- THEN the counter shows `5 / 280`
- AND the counter MUST NOT exceed `280 / 280`

### REQ-UI-011: List view alignment

`QuotationsListView` MUST retain `AppDataTable` and `StatusDotBadge` and align with system patterns: `rounded-2xl` card wrapper with subtle shadow (EmployeesListView pattern) and the `Nueva cotización` button in `--coco-primary`. No structural or table changes.

### REQ-UI-012: Anti-requirements

MUST NOT modify `useQuotationDetail`, `useQuotationDraft`, or any composable/behavior logic. MUST NOT render `ACEPTADA`/`PEDIDO` stepper states. MUST NOT add a `Copiar` button. All new components MUST ship `.test.ts` coverage; existing quotations tests MUST stay green and data-testids remain semantic (not positional).
