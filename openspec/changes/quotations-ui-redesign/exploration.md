# Exploration: Quotations UI Redesign

## Current State

The quotations detail view (`QuotationDetailView.vue`) uses a single-column layout with cards stacked vertically. The reference target design introduces a **2-column grid layout** with a sticky right sidebar for the totals/summary, adds a **progress stepper**, and refines the visual language to match the "Coco" brand identity (blue primary, mustard accent).

### Architecture

```
QuotationDetailView.vue (orchestrator)
├── QuotationItemRow.vue (item cards)
├── QuotationTotalsFooter.vue (totals bar)
├── QuotationExpiryPicker.vue (date + clear button)
├── QuotationPriceOverrideModal.vue (manual price)
├── QuotationSendDialog.vue (send confirmation)
├── QuotationCancelDialog.vue (cancel with reason)
├── AssignCustomerSlideover.vue (customer selection)
├── PriceListSelector.vue (price list dropdown)
└── ProductSearchPanel.vue (product search slideover)
```

The composables powering the view:
- `useQuotationDetail(quotationId)` — fetch/create/assign customer/change price list
- `useQuotationDraft(quotationId)` — 15 mutations (add/remove/update items, price overrides, promotions, expiry, send, cancel)
- `useAvailablePromotions(tenantId, type)` — load MANUAL and AUTOMATIC promos
- `useQuotationItemStock(productId, variantId)` — per-item stock badge

### Shared Components Available

- **`EntityAvatar`** — initials + deterministic color hash from seed string. Used by employees, products. Can serve as customer avatar without building a new component.
- **`StatusDotBadge`** — semantic status pill with colored dot. Already used in QuotationDetailView header and QuotationsListView status column.
- **`AppDataTable`** — standard table wrapper (UTable + toolbar + pagination). Used by all list views.
- **`AppBadge`** — tone-driven badge (error/warning/neutral/info). Used for stock badges in QuotationItemRow.
- **`ConfirmModal`** — generic confirmation dialog.
- **`DateFieldPopover`** — date picker wrapper. Used by QuotationExpiryPicker.
- **Nuxt UI v4 components**: UButton, UInput, USelectMenu, UModal, USlideover, UDropdownMenu, USeparator, UIcon, UAlert, UBadge, UPagination, UFormField

## Affected Areas

### Files to modify

| File | Impact |
|------|--------|
| `src/features/POS/quotations/views/QuotationDetailView.vue` | **Major refactor** — new 2-column grid layout, stepper integration, restructured sections |
| `src/features/POS/quotations/components/QuotationTotalsFooter.vue` | **Refactor** — add IVA row, restructure as sidebar summary card with CTAs |
| `src/features/POS/quotations/components/QuotationItemRow.vue` | **Refactor** — more padding, stock badge contrast, card-style rows |
| `src/features/POS/quotations/components/QuotationExpiryPicker.vue` | **Refactor** — add shortcut chips (7/15/30 días, Sin expiración) |
| `src/features/POS/quotations/views/QuotationsListView.vue` | **Minor** — consistent styling if needed |
| `src/features/POS/quotations/__tests__/` | **All test files** — update data-testids, selectors, assertions |

### New components to create

| Component | Purpose |
|-----------|---------|
| `QuotationProgressStepper.vue` | 4-state stepper: BORRADOR → ENVIADA → ACEPTADA → PEDIDO |
| `QuotationPromotionCard.vue` | Card with `border-l-4 border-[--coco-accent]` for promo items |
| `QuotationCustomerCard.vue` | Refactored customer panel with EntityAvatar, email, phone |

### No changes needed

- `QuotationPriceOverrideModal.vue` — already well-structured
- `QuotationSendDialog.vue` — already well-structured
- `QuotationCancelDialog.vue` — already well-structured
- `StatusDotBadge.vue` — shared component, no changes
- `EntityAvatar.vue` — shared component, consumed as-is

## Detail View Gaps (current → target)

1. **Layout** — Single column → 2-column grid (`lg:grid-cols-3`, left span-2, right span-1, sticky)
2. **Progress Stepper** — Missing → BORRADOR/ENVIADA/ACEPTADA/PEDIDO with visual state tracking
3. **Header title** — `Cotización #{folio}` one-liner → `Cotización` + ID chip + BORRADOR chip (mustard bg, white text)
4. **Customer panel** — Name + email, no avatar/phone → EntityAvatar (pink circle) + name + email icon + phone icon + "Cambiar cliente" outlined button
5. **Price list help text** — Missing → `Mayoreo · desde 2 unidades. Los precios unitarios se recalculan al cambiar de lista.`
6. **Expiry shortcuts** — Missing → Chips: `7 días | 15 días | 30 días | Sin expiración` (active chip with mustard bg)
7. **Product items** — Basic card rows → Card-like rows with rounded corners, more padding, stock badge with better contrast, menu overflow
8. **Promotion cards** — Flat list → Cards with `border-l-4 border-yellow-500` accent, "AUTOMÁTICA" badge, discount in blue, "× Vetar" button
9. **Totals/Summary** — Full-width footer → Sticky right sidebar card with: RESUMEN title, Subtotal, Descuentos, IVA 16%, grand TOTAL (text-3xl), "Enviar cotización" CTA (full-width blue), "Guardar borrador" (gray), validity notice
10. **Customer notes** — Missing → Textarea with placeholder `Condiciones de entrega, referencias de pago...` + `0 / 280` char counter
11. **Back button** — `← Cotizaciones` → `← Volver a cotizaciones` (gray/blue text, no background)
12. **Header actions** — Previsualizar PDF + Enviar (primary) + Cancelar (error) → Previsualizar PDF (outlined) + Copiar (outlined) + Cancelar (outlined red), move "Enviar" to sidebar CTA
13. **IVA row** — Missing in totals → Show `IVA 16%` as a line item between Descuentos and TOTAL
14. **Stock badges** — Functional but inconsistent contrast → Mustard bg for low stock, neutral for healthy stock
15. **Cancelled/Expired banners** — Present → Keep as-is but re-position in new layout

## List Table Gaps

The list view (`QuotationsListView.vue`) is already well-structured and follows established patterns:

- ✅ Uses `AppDataTable` (same as EmployeesListView, SalesListView)
- ✅ Uses `StatusDotBadge` for status column
- ✅ Status tabs with proper aria roles
- ✅ Pagination via `DataTablePagination`
- ✅ Search input with debounce

**Minor alignment opportunities:**
- Consider matching the Coco brand primary color (`#2557D6`) in the "Nueva cotización" button
- The table card wrapper could use the `rounded-2xl` border + shadow-sm pattern from EmployeesListView

## Reference Patterns

### Table Component
All list views use `AppDataTable` from `@/core/shared/components/DataTable`. Props pattern:
```vue
<AppDataTable
  v-model:pagination="pagination"
  :columns="columns"
  :data="data"
  :loading="isLoading"
  :fetching="isFetching"
  :error="isError"
  :error-message="errorMessage"
  :page-count="pageCount"
  :total-count="totalCount"
  :showing-from="showingFrom"
  :showing-to="showingTo"
  :page-size-options="[10, 20, 50]"
  ...
/>
```

### Status Badges
`StatusDotBadge` with `tone` prop (success/warning/error/info/neutral/secondary) + `compact` for denser contexts. Tone mapping:
- DRAFT → `info` (blue)
- SENT → `success` (green)
- EXPIRED → `warning` (amber)
- CANCELLED → `error` (red)

### Card Styling
Consistent pattern across the app:
```html
<section class="rounded-xl border border-default bg-default p-5">
```

### Pagination
`DataTablePagination` renders UPagination + page size dropdown. The `pagination` computed property bridges 0-indexed (AppDataTable) ↔ 1-indexed (backend/composable).

### Row Actions
`UDropdownMenu` with grouped items array, triggered by an ellipsis-vertical button. Pattern from `QuotationItemRow` and `SaleItemRow`.

## Design Tokens (from reference)

```css
--coco-primary: #2557D6     /* Blue CTAs, discount values */
--coco-primary-50: #EFF4FF  /* Light blue backgrounds */
--coco-accent: #E0A800      /* Mustard for stepper, promo borders */
--coco-accent-50: #FEF8E7   /* Light mustard for chip backgrounds */
--coco-bg: #F9FAFB          /* Page background */
--coco-card: #FFFFFF        /* Card background */
--coco-border: #E5E7EB      /* Subtle borders */
--coco-text: #111827        /* Primary text */
--coco-text-secondary: #6B7280
--coco-text-tertiary: #9CA3AF
--coco-success: #10B981
--coco-warning: #F59E0B     /* Low stock */
--coco-danger: #DC2626      /* Cancel/destructive */
--coco-info: #3B5BFF        /* Discount blue */
```

### Spacing
- `gap-4` (16px) between sections
- `p-5` (20px) internal card padding
- `rounded-xl` (12px) card radius
- `rounded-md` (8px) input/button radius

### Typography
- H1: 24px/700
- H2: 18px/600
- Body: 14px/400
- Label: 12px/600/uppercase/tracking-wide
- Total: 32px/700

## Approaches

### 1. Incremental Refactor (Recommended)

- Keep `QuotationDetailView.vue` as the orchestrator
- Introduce new components one at a time (stepper first, then sidebar, then refactor sections)
- Refactor `QuotationItemRow` in-place with scoped style adjustments
- Repurpose `QuotationTotalsFooter` into a sidebar summary component
- Add expiry chips inline in `QuotationExpiryPicker`
- Reuse `EntityAvatar` for customer avatar

**Pros**: Smaller PRs, easier to review, less risk of regressions, can ship incrementally
**Cons**: Temporary visual inconsistency during transition, requires careful PR sequencing

**Effort**: Medium

### 2. Big Bang Rewrite

- Build a new `QuotationDetailView.vue` from scratch alongside the old one
- Switch route when complete
- Delete old components

**Pros**: Clean break, no intermediate states
**Cons**: High risk, large PR, hard to review, likely regressions

**Effort**: High

## Recommendation

**Incremental Refactor (Approach 1)** — The existing architecture is sound. The changes are primarily visual/layout, not structural. The composable layer (`useQuotationDetail`, `useQuotationDraft`) stays untouched. Break the work into these phases:

1. **Phase 1: Layout skeleton** — 2-column grid, move totals to right sidebar (sticky)
2. **Phase 2: Progress stepper** — New `QuotationProgressStepper` component
3. **Phase 3: Section refactors** — Customer card, expiry chips, product items, promotions
4. **Phase 4: Polish** — Color tokens, spacing, typography alignment, test updates

## Risks

- **The stepper state mapping**: The backend only has 4 status values (DRAFT/SENT/EXPIRED/CANCELLED), but the design shows an ACEPTADA state. Need to clarify where "ACEPTADA" comes from — backend enum update or frontend-only display? SENT may serve as "Enviada" and ACCEPTED may be a new status not yet implemented.
- **Customer notes endpoint**: The textarea has no visible backend endpoint. If it doesn't exist, the feature is UI-only (no-op) until the backend ships it.
- **IVA 16% calculation**: The current `QuotationResponseDto` has `subtotalCents`, `discountCents`, and `totalCents`. IVA is NOT in the DTO — needs either a client-side calculation or a backend field addition.
- **"Copiar" (duplicate) button**: The reference shows a "Copiar" action. There is no duplicate endpoint in the current API. Either add it or omit the button.
- **Test breakage**: Every changed component has tests. Data-testids will shift. Budget time for test updates.
- **Color tokens**: The project uses Tailwind's `--color-*` CSS variables currently (e.g., `text-muted`, `bg-primary`). The reference introduces `--coco-*` tokens. Need to decide: adopt Coco tokens project-wide or map them to existing Tailwind classes for this change only.

## Ready for Proposal

**Yes** — The scope is well-understood. Proceed to `sdd-propose` with:
- A clear increment plan (phases 1-4)
- Clarification questions for the ACEPTADA state, IVA field, customer notes endpoint, and Copiar action
- A decision on color token strategy (Coco tokens vs Tailwind mapping)
