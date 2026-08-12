# Design: Standardize Promotions Table

## Technical Approach

Bring `PromotionsView.vue` to `CustomersView`/`ProductsView` parity by layering five independent, low-risk changes onto the existing view without touching its mutation/bulk/offending-IDs machinery. The view keeps every current behavior; we add error surfacing, view-mode toggle with cards, filters relocation, `updatedAt` sort, and a permission gate.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Mirror `useCustomerViewMode`/`useSalesViewMode` vs generic inline mode | Custom code duplicates a settled pattern | **Mirror exactly** — `usePromotionViewMode` wraps `useViewMode` (key `promotions-view-mode`, modes `['table','card']`, default `'table'`), exports `isPromotionViewMode` guard + `displayMode` bridging `card`→`cards` |
| Card kebab vs click-only card | Spec REQ-3 mentions a gated kebab; proposal + directive say actions stay in table | **Click-only card** — no kebab, no checkbox. `article @click` emits `click`; view does `router.push('/pos/promociones/${id}')` (route already used by `handleEdit`) |
| `formatDate` reuse vs duplication | `formatDate` is private to `usePromotionColumns`; calling it per card rebuilds the columns array | **Extract to `utils/promotionDate.utils.ts`**; `usePromotionColumns` re-imports it (view unchanged), `PromotionCard` imports it directly with the badge config getters |
| `#filters` slot vs keeping standalone div | Standalone div ≠ gold standard toolbar | **Move into `<template #filters>`** — `DataTableToolbar` renders it beside search; keep `w-48/w-44/w-40` widths, keep all 4 testids |
| WU-B without tests | Risk vs 400-line budget | **No tests in WU-B** (customers WU-B over-budget lesson). WU-C owns all new tests |
| Error precedence | Products has a whitelist-constraints branch promotions never hits | **Customers-style precedence**: `response.data.message` string → array first element → `error.message` → `'No se pudieron cargar las promociones. Reintenta.'` |

## Data Flow

```
useServerTable ──isError/error──▶ promotionsErrorMessage ──▶ AppDataTable :error/:error-message
useViewMode('promotions-view-mode') ──▶ ViewToggle(#actions) ──▶ displayMode
    AppDataTable display-mode="cards" ──▶ #cards slot ──▶ PromotionCardGrid ──▶ PromotionCard
    PromotionCard click ──▶ view handleCardClick ──▶ router.push(/pos/promociones/:id)
3× USelect (#filters) ──▶ watch reset (pageIndex=0, rowSelection={})  [existing, untouched]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `composables/usePromotionViewMode.ts` | Create | `useViewMode` wrapper + `isPromotionViewMode` + `displayMode` |
| `components/PromotionCard.vue` | Create | `article` + `EntityAvatar(:name=title,:seed=id,size=lg)` + title + `StatusDotBadge(status)` + `AppBadge(type)` + `AppBadge(method, outline)` + dashed divider + 2-col body (`Inicio`=startDate, `Creada`=createdAt). Emits `click` only |
| `components/PromotionCardGrid.vue` | Create | Props `{promotions, loading, empty}`; emits `card-click`. Ladder `grid gap-3 sm:2 lg:3 xl:5 2xl:7`, 8 pulse skeletons, `i-lucide-percent` empty state |
| `utils/promotionDate.utils.ts` | Create | `formatDate` extracted from `usePromotionColumns` (timezone-safe, unchanged logic) |
| `composables/usePromotionColumns.ts` | Modify | Import `formatDate` from new util, re-export (no behavior change) |
| `views/PromotionsView.vue` | Modify | Destructure `isError`/`error`; `promotionsErrorMessage`; `:error`/`:error-message`; `usePromotionViewMode` + `handleViewModeChange`; `#actions` ViewToggle; `#filters` (3 USelects + Limpiar); `#cards` slot; `:display-mode`; `#updatedAt-header` SortableHeader ("Actualizada"); `canManagePromotionActions` + `v-if` on `UDropdownMenu`; `handleCardClick` |
| `views/__tests__/PromotionsView.test.ts` | Modify | WU-C: error state, mode toggle, card click, gate, filters testids (mock `useServerTable` must add `isError`/`error`) |

## Interfaces / Contracts

```ts
// usePromotionViewMode.ts
export type PromotionViewMode = 'table' | 'card'
export function isPromotionViewMode(value: string): value is PromotionViewMode
export function usePromotionViewMode(): {
  viewMode: Ref<PromotionViewMode>
  setMode: (m: PromotionViewMode) => void
  toggleViewMode: () => void
  displayMode: ComputedRef<'table' | 'cards'>
}

// PromotionCard.vue
defineProps<{ promotion: PromotionResponse }>()
defineEmits<{ click: [promotion: PromotionResponse] }>()

// PromotionCardGrid.vue
defineProps<{ promotions: PromotionResponse[]; loading?: boolean; empty?: string }>()
defineEmits<{ 'card-click': [promotion: PromotionResponse] }>()
```

`defineExpose` gains `canManagePromotionActions` (tests). All existing exposes stay.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| WU-C unit | Error block + precedence, ViewToggle→displayMode, card click → `mockRouterPush`, read-only gate, filters testids resolve, `updatedAt` SortableHeader, invariants regression | Extend `PromotionsView.test.ts` (mock `useServerTable` adds `isError: {value:false}`, `error: {value:null}`); stubs `ViewToggle`/`AppDataTable` per `ProductsView.test.ts` pattern |
| WU-C component | `PromotionCardGrid` ladder/skeleton/empty | Optional light mount (grid only, no card internals) — skip if WU-C risks budget |
| Build | `pnpm test:unit --run` + `pnpm build` clean | WU-A/B/C completion gates |

## Threat Matrix

N/A — no routing-definition, shell, subprocess, VCS/PR-automation, executable-classification, or process-integration boundary. Card click reuses the existing client-side `router.push` pattern already present in `handleEdit`.

## Migration / Rollout

No migration. Per-WU rollback: WU-A reverts slots/composable (one view file + 2 files); WU-B removes 4 card-related files + slots; WU-C only touches tests.

## Open Questions

- [ ] Spec REQ-3 still says cards carry a kebab gated by `canManagePromotionActions`; proposal + directive say actions stay in the table. Design implements **no card kebab** — reconcile REQ-3 wording at archive.
- [ ] `#filters` renders inline next to search on `sm+`; verify 3 narrow USelects + Limpiar fit without wrapping on `lg` — revert path is moving the div back (documented rollback).
