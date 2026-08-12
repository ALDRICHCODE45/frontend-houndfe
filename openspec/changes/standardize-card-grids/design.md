# Design: Standardize Card Grids

## Technical Approach

Redesign SaleCard/QuotationCard to mirror EmployeeCard's article pattern (EntityAvatar + chip row + dashed divider + 2-col body). Create SaleCardGrid/QuotationCardGrid as view-level wrappers on the Employee ladder (`sm:2 lg:3 xl:5 2xl:7`). Swap view slots from `#mobile-card` → `#cards`. Align ProductCard tokens to theme. Navigation moves to existing view handlers — both `goToSaleDetail` (SalesListView L131) and `goToDetail` (QuotationsListView L193) already exist.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `#cards` receives `{data}` array vs individual rows | Grid owns iteration; views stay thin | `{data}` — grids iterate internally, matching EmployeeCardGrid |
| Keep `data-testid="quotation-card-link"` | RouterLink removed; testid orphaned | Remove it — tests validate `article[data-testid="quotation-card"]` |
| ProductCard hover stays `coco-gold-500/30` vs `primary/30` | Mismatches EmployeeCard's hover token | Align to `hover:border-primary/30` |
| SaleCard debt row layout | Single 2-col row wastes space; span breaks grid | Debt row spans both columns with its own `mt-2` section after the 2-col grid |

## Data Flow

SalesListView `#cards="{ data, loading, empty }"` → SaleCardGrid loops → SaleCard emits `click` → grid forwards `card-click` → view calls `goToSaleDetail(sale.id)`. QuotationsListView same pattern, plus grid forwards `delete` → `handleDelete(row)` (existing ConfirmModal flow).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `POS/sales/components/SaleCard.vue` | Modify | Drop RouterLink+UCard → `<article>` with EmployeeCard classes. EntityAvatar (`seed=sale.id`, `:show-dot="status === 'CONFIRMED'"`). Customer + folio. Chip row (StatusDotBadge × 2 + optional debt). Dashed divider. 2-col body (Total / Fecha / Cliente / Método). Emit `click`. Keep debt testids. |
| `POS/sales/components/SaleCardGrid.vue` | Create | Props `{sales, loading, empty}`. Emits `card-click`. Employee ladder grid. 8 pulse skeletons (`border-default bg-elevated`). Empty: `i-lucide-receipt`. |
| `POS/sales/views/SalesListView.vue` | Modify | L230: `#mobile-card` → `#cards="{ data, loading, empty }"` wiring SaleCardGrid + `@card-click="(sale) => goToSaleDetail(sale.id)"`. |
| `POS/quotations/components/QuotationCard.vue` | Modify | Same article pattern. EntityAvatar (`seed=id`, dot on DRAFT/SENT). Customer + truncated id. StatusDotBadge. Dropdown moves to top-right `@click.stop` (EmployeeCard position). Dashed divider. 2-col body (Total / Expira). Emit `click`; keep `navigate`/`delete`. |
| `POS/quotations/components/QuotationCardGrid.vue` | Create | Same as SaleCardGrid; empty icon `i-lucide-file-text`; forwards `card-click` + `delete`. |
| `POS/quotations/views/QuotationsListView.vue` | Modify | L527: `#mobile-card` → `#cards`; wire `@card-click="goToDetail"` + `@delete="handleDelete"`. |
| `POS/products/components/ProductCard.vue` | Modify | Token swap: `bg-coco-neutral-50`→`bg-default`, `border-coco-neutral-200`→`border-default`, `hover:border-coco-gold-500/30`→`hover:border-primary/30`. |
| `POS/products/components/ProductCardGrid.vue` | Modify | Breakpoints → Employee ladder. Skeleton: `border-default`+`bg-elevated` (was `bg-coco-neutral-100`). |

## Interfaces / Contracts

**SaleCardGrid props**:
```ts
{ sales: ConfirmedSaleRow[]; loading?: boolean; empty?: string }
```
Emits: `{ 'card-click': [sale: ConfirmedSaleRow] }`

**QuotationCardGrid props**:
```ts
{ quotations: QuotationResponseDto[]; loading?: boolean; empty?: string }
```
Emits: `{ 'card-click': [q: QuotationResponseDto]; delete: [q: QuotationResponseDto] }`

**QuotationCard emits expanded**: `click` (new), `navigate` (kept), `delete` (kept). `navigate` is preserved from existing QuotationCard — carries the "Ver detalle" dropdown action to the view.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| SaleCard | Drop RouterLink test (L61-64), drop `bg-coco-neutral-*` + `data-slot="body"` (L69-82) | Replace with: article root, chip row renders both StatusDotBadges, `sale-card-debt` testid survives |
| QuotationCard | Drop `quotation-card-link` href test (L154-157) | Add click-emit test; pin `article[data-testid="quotation-card"]`; keep delete/navigate emit tests |
| ProductCard | `bg-coco-neutral-50`→`bg-default`, `hover:border-coco-gold-500/30`→`hover:border-primary/30` | Update L115-127 class assertions |
| ProductCardGrid | `bg-coco-neutral-100`→`bg-elevated`; breakpoint assert | Update L67-74; verify Employee ladder grid classes |
| View tests | Stubs need `<slot name="cards" />` | Add to appDataTableStub in both view test files |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. `AppDataTable.vue` unchanged — `#cards` slot is already supported (L202-209). Dropping `#mobile-card` has no side effects; the old built-in skeleton/empty path activates only when neither slot is present.

## Open Questions

None.
