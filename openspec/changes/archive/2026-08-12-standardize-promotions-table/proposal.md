# Proposal: Standardize Promotions Table

## Intent

Bring `PromotionsView.vue` to parity with `ProductsView.vue` / `CustomersView.vue`: surface backend errors, add card view, move 3 USelects into AppDataTable `#filters` (one toolbar row), gate empty kebab, finish `updatedAt` sortable header. Card click → `/pos/promociones/:id` (Customers opens a slideover — no detail route).

## Scope

### In Scope

- **G1 error (HIGH)** — destructure `isError`/`error`; `promotionsErrorMessage` → `<AppDataTable>`.
- **G2 cards (HIGH)** — `usePromotionViewMode`, `PromotionCard`/`Grid`, ViewToggle, `#cards`, `display-mode`. Click → `router.push('/pos/promociones/:id')`.
- **G3 filters slot (MED)** — 3 USelects into `<template #filters>`; preserve testids.
- **G4 gate (LOW)** — `canManagePromotionActions = canUpdate || canDelete`; `v-if` on `UDropdownMenu`.
- **G5 `updatedAt` slot (LOW)** — mirror `#createdAt-header`.

### Out of Scope

`PromotionDetailView.vue`/`PromotionForm.vue`, brand pass, backend. Filter slideover (user). Cards bulk-checkbox (user). New routes/types/schema/column order.

## Capabilities

### New

- `promotions-list` — error surfacing, card view (EmployeeCard, no checkboxes), `#filters` toolbar, `updatedAt` sortable, gated kebab, `promotions-view-mode` localStorage, card-click → detail. Existing `promotions` covers form composition only.

## Approach

Mirror `CustomersView.vue`. `usePromotionViewMode` wraps `useViewMode` (key `promotions-view-mode`; `displayMode` bridges `'card'` → `'cards'`). `PromotionCard` follows EmployeeCard (EntityAvatar seeded by `promotion.id`, chips, dashed divider, 2-col start/createdAt).

**Preserved invariants:** `batch_delete` on `bulkActions`, offending-IDs ring on `#title-cell`, filter/selection-clear watch, `defaultPinning.right: ['actions']`, `:enable-row-selection="canBatchDelete || canBatchEnd"`, empty `getRowItems` hidden by `canManagePromotionActions`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `views/PromotionsView.vue` | Modified | `isError`/`error`, `promotionsErrorMessage`, `#filters`, `#actions`, `#cards`, `canManagePromotionActions`, `#updatedAt-header`. |
| `composables/usePromotionViewMode.ts` | **New** | `useViewMode` wrapper, guard, `displayMode`. |
| `components/PromotionCard.vue` | **New** | `defineProps<{ promotion }>`, `click`. EmployeeCard. |
| `components/PromotionCardGrid.vue` | **New** | Ladder `sm:2 lg:3 xl:5 2xl:7`. |
| `views/__tests__/PromotionsView.test.ts` | Modified | Error, ViewToggle, card, gate. |

## Risks

| Risk | Mitigation |
|------|------------|
| Card-click vs. future inline-edit | Single `card-click`; `router.push` one line. |
| `#filters` breaks mobile toolbar | 3 narrow USelects fit. |
| Empty-kebab regression | `v-if canManagePromotionActions`. |

## Rollback Plan

Per work unit. Filters revert = move USelects back into original `div`. Cards revert = remove 4 files + slots. No backend impact.

## Dependencies

`useViewMode`, `ViewToggle`, `EntityAvatar`; `useServerTable` returns `isError`/`error`; route exists.

## Success Criteria

- [ ] Error banner on failed requests; ViewToggle persists.
- [ ] 3 USelects render inside toolbar; testids resolve there.
- [ ] Read-only users see no empty kebab; card click → detail.
- [ ] `updatedAt` sortable; bulk + offending-IDs unchanged.
- [ ] `pnpm test:unit --run` + `pnpm build` clean.

## Work Units (forecast)

- **WU-A — mode + error + filters + updatedAt + gate** (~140 lines).
- **WU-B — card view** (~120 lines). **No tests** (customers WU-B over-budget lesson).
- **WU-C — tests** (~160 lines).

Forecast: `Decision: No`, `Chained PRs: No` (main), `400-line risk: Low`.
