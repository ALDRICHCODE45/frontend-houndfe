# Design: Quotations UI Redesign

## Technical Approach

View-layer-only redesign of `QuotationDetailView` to a 2-column Coco reference layout. Composables untouched — all data flows are prop-driven. Four incremental phases with strict TDD.

## Component Tree (new in **bold**)

```
QuotationDetailView (refactored — lg:grid-cols-3)
├── **QuotationProgressStepper**        3-state: BORRADOR→ENVIADA→EXPIRADA/CANCELADA
├── Header (refactored)                  Back link, ID chip, mustard status badge, metadata, actions
├── Left col (col-span-2)
│   ├── **QuotationCustomerCard**       EntityAvatar + name + email + phone + "Cambiar cliente"
│   ├── PriceListSelector (unchanged)
│   ├── QuotationExpiryPicker (refactored)  Adds 7|15|30 días|Sin expiración shortcut chips
│   ├── QuotationItemRow (refactored)       Card-style padding, stock badge contrast
│   └── **QuotationPromotionCard**          border-l-4 accent card; vetoed/manual-picker stay inline
└── Right col (col-span-1, sticky top-4)
    ├── QuotationTotalsFooter (refactored)  RESUMEN sidebar: subtotal/disc/IVA 16%/TOTAL + CTAs
    └── Customer notes (inline)             UI-only textarea, 0/280 counter, localStorage cache
```

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Token scope | `@layer coco-quotations` in `quotations/styles/coco-tokens.css` | #2557D6 matches ref; scoped per proposal; no `:root` mutation |
| Stepper mapping | `stepperIndexFromStatus(status)` util — 3 states | Easy extension when ACEPTADA/PEDIDO arrive |
| IVA 16% | `computeIva16(totalCents)` in `quotation.utils.ts`, `TODO: replace when backend exposes taxCents` | Centralized, testable, greppable |
| Notes persistence | `localStorage` keyed `quotation-notes-${id}` + "(no implementado aún)" hint | Non-persistent safety net |
| Promo card extraction | New `QuotationPromotionCard` | border-l-4 applied once; reuse for applied/vetoed |
| Customer card | New `QuotationCustomerCard` wrapping `EntityAvatar` | Optional omission for missing phone/email |

## Data Flow

`QuotationResponseDto` flows as prop into `QuotationDetailView`, which destructures and passes slices:
- `quotation.customer` → `QuotationCustomerCard`
- `quotation.status` → `QuotationProgressStepper`
- `quotation.expiresAt` → `QuotationExpiryPicker`
- `quotation.items[i]` → `QuotationItemRow` (unchanged emit contract)
- `quotation.appliedPromotions[i]` → `QuotationPromotionCard`
- `quotation.*` → `QuotationTotalsFooter` (same prop, expanded template)
- `quotation.totalCents` → IVA computed in TotalsFooter via `computeIva16`

## Phase Breakdown

| Phase | Files | Scope |
|---|---|---|
| **1 — Tokens + Grid** | `coco-tokens.css` (NEW), `QuotationDetailView.vue` | Tokens, lg:grid-cols-3, sticky sidebar skeleton |
| **2 — Stepper** | `QuotationProgressStepper.vue` (NEW), `quotation.utils.ts` | 3-node stepper + `stepperIndexFromStatus` helper |
| **3 — Sections** | 3 new + 4 refactored components | Customer card, promo cards, expiry chips, item-row polish, IVA row + RESUMEN |
| **4 — List + Tests** | `QuotationsListView.vue`, all `__tests__/` | Card wrapper, primary CTA, testid migration, new `.test.ts` files |

## New Component APIs

**QuotationProgressStepper** — Props: `status: QuotationStatus`. No emits. Computed `currentIndex` (0–2). Root testid `quotation-stepper`; per-step `stepper-step-{index}`. Tests: 3 statuses × active/future/connector styling.

**QuotationCustomerCard** — Props: `customer: QuotationCustomer | null`, `editable: boolean`. Emits: `change-customer`. Uses `EntityAvatar(name=customerName, seed=customerId, size='lg')`. Testid `quotation-customer-card`; subs: `customer-avatar`, `customer-email`, `customer-phone`, `change-customer-button`. Tests: with/without phone, null customer, emit.

**QuotationPromotionCard** — Props: `promotion: AppliedPromotion`, `method: 'Manual'|'Automática'`, `readonly: boolean`. Emits: `remove`, `unveto`. Slot `#actions`. Testid `quotation-promotion-card`; subs: `promo-title`, `promo-discount`, `promo-method-badge`, `promo-remove-btn`. Tests: title/discount/badge render, border-l-4 accent.

## Refactored Components

**QuotationDetailView.vue** — Template restructured to grid. Header simplified (no folio in title, ID chip monospace, status badge mustard, metadata line). Enviar moves to sidebar CTA; no Copiar. New imports added; inline promo rendering delegates to QuotationPromotionCard.

**QuotationTotalsFooter.vue** — New: `RESUMEN` title, context line, IVA 16% row, full-width `Enviar cotización` CTA, `Guardar borrador` secondary, validity notice. Props gain `priceListName`, `expiresAt`; emits gain `send`, `save-draft`. Total → `text-3xl font-bold`.

**QuotationExpiryPicker.vue** — New: shortcut chips row below date input. Chips emit `update:expiresAt` with computed ISO. Active chip highlighted with `--coco-accent-50`/`--coco-accent`. New testids: `expiry-chips`, `expiry-chip-{days}`.

**QuotationItemRow.vue** — Padding increase (`p-4`), `rounded-xl`. Stock badge uses `--coco-warning`. No prop/emit changes.

**QuotationsListView.vue** — `rounded-2xl shadow-sm` card wrapper. CTA `bg-[var(--coco-primary)]`. AppDataTable/StatusDotBadge unchanged.

## testid Migration

| Old | New |
|---|---|
| `quotation-actions` | `detail-header-actions` (PDF/cancel) + `detail-sidebar-actions` (send/save) |
| `customer-section` | `quotation-customer-card` (new component) |
| `promotions-section` | `quotation-promotion-card` instances |
| — new | `quotation-stepper`, `customer-notes-textarea`, `notes-char-counter`, `summary-iva-row`, `summary-send-btn`, `summary-save-draft-btn`, `expiry-chips` |

Root `quotation-detail-view`, `back-button`, `status-badge`, `items-section`, `items-list`, `expiry-section`, `quotation-totals-footer` — unchanged.

## CSS Token Integration

File `src/features/POS/quotations/styles/coco-tokens.css`:

```css
@layer coco-quotations {
  :where(.quotation-detail-view, .quotations-list-view) {
    --coco-primary: #2557D6; --coco-primary-50: #EFF4FF;
    --coco-accent: #E0A800;  --coco-accent-50: #FEF8E7;
    --coco-bg: #F9FAFB;      --coco-card: #FFFFFF;
    --coco-border: #E5E7EB;  --coco-text: #111827;
    --coco-text-secondary: #6B7280;  --coco-text-tertiary: #9CA3AF;
    --coco-success: #10B981; --coco-warning: #F59E0B;
    --coco-danger: #DC2626;  --coco-info: #3B5BFF;
  }
}
```

Imported in `main.css` after the existing `@theme static` block. Consumed via `bg-[var(--coco-primary)]` etc. Scoped to `.quotation-detail-view` / `.quotations-list-view` — no `:root` mutation.

## Responsive Behavior

Below `lg`: grid collapses to single stacked column. `lg:sticky` → no sticky. Panels reflow vertically.

## Threat Matrix

N/A — no routing, shell, subprocess, or process-integration changes. Pure view-layer template + CSS.

## Open Questions

None — all risks addressed in proposal mitigations.
