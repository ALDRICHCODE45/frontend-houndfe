# Tasks: Standardize Promotions Table

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400 (100 + 120 + 180) |
| Delivery strategy | no PRs, structured commits on main |

### Work Units

| Unit | Goal | Commit | Test | Rollback |
|------|------|--------|------|----------|
| WU-A | Mode+error+sortable+gate | `feat(promotions): add view mode, surface list errors, sortable updatedAt` | `pnpm test:unit --run PromotionsView` | 1 view + 1 composable |
| WU-B | Card+Grid+wiring+filters (NO tests) | `feat(promotions): add EmployeeCard-pattern card view and consolidate toolbar` | N/A | 4 files |
| WU-C | Tests | `test(promotions): cover list view, view mode, card, and columns` | `pnpm test:unit --run PromotionsView` | 1 test file |

## Phase 1: WU-A — Mode, Error, Sortable, Gate (~100 lines)

- [x] 1.1 Create `composables/usePromotionViewMode.ts`: wrap `useViewMode` (key `promotions-view-mode`, modes `['table','card']`, default `'table'`); export `isPromotionViewMode` guard + `displayMode` computed
- [x] 1.2 In `views/PromotionsView.vue`: destructure `isError`/`error`; add `promotionsErrorMessage` (precedence: `response.data.message` → array first → `error.message` → fallback); pass `:error` + `:error-message` to `AppDataTable`
- [x] 1.3 Wire `usePromotionViewMode`; render `ViewToggle` in `#actions`; pass `:display-mode` to `AppDataTable`
- [x] 1.4 Add `#updatedAt-header` slot with `SortableHeader` ("Actualizada") mirroring `#createdAt-header`
- [x] 1.5 Add `canManagePromotionActions = canUpdate || canDelete`; `v-if` on `UDropdownMenu`
- [x] 1.6 `pnpm test:unit --run PromotionsView` — pass (no test changes)

## Phase 2: WU-B — Card View + Filters (NO TESTS, ~120 lines)

- [x] 2.1 Create `utils/promotionDate.utils.ts`: extract `formatDate` from `usePromotionColumns` (logic unchanged)
- [x] 2.2 Modify `composables/usePromotionColumns.ts`: import + re-export `formatDate`
- [x] 2.3 Create `components/PromotionCard.vue`: article + `EntityAvatar(:name=title,:seed=id,size=lg)` + title + `StatusDotBadge(status)` + `AppBadge(type)` + `AppBadge(method,outline)` + dashed divider + 2-col body (`Inicio`=startDate, `Creada`=createdAt). Props `{promotion}`, emits `click`. NO kebab, NO checkbox
- [x] 2.4 Create `components/PromotionCardGrid.vue`: ladder `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`, 8 pulse skeletons, `i-lucide-percent` empty. Props `{promotions,loading,empty}`, emits `'card-click'`
- [x] 2.5 In `views/PromotionsView.vue`: add `#cards` slot → `PromotionCardGrid`; `handleCardClick` → `router.push('/pos/promociones/${id}')`
- [x] 2.6 Move 3 `USelect`s + Limpiar into `<template #filters>`; preserve testids (`filter-type`, `filter-status`, `filter-method`, `clear-filters-btn`)
- [x] 2.7 Manual verify card click navigates; filters fit on `lg+`; `pnpm build` clean

## Phase 3: WU-C — Tests (~180 lines)

- [x] 3.1 Update mock `useServerTable` in test: add `isError: {value:false}`, `error: {value:null}`
- [x] 3.2 Tests for error block (precedence + retry) and ViewToggle (toggle + persistence + invalid fallback)
- [x] 3.3 Tests for card click → `mockRouterPush` `/pos/promociones/{id}` and `canManagePromotionActions` gate (false hides, true shows, bulk gated by `batch_delete`)
- [x] 3.4 Test filters testids resolve inside `AppDataTable` toolbar
- [x] 3.5 Test `#updatedAt-header` click → `sortBy=updatedAt&sortOrder=desc`, next `asc`
- [x] 3.6 Test invariants — offending-IDs ring on `#title-cell`, selection-clear watch, `actions` pinned right
- [x] 3.7 `pnpm test:unit --run` + `pnpm build` — both clean

## Phase 4: Cleanup

- [ ] 4.1 Reconcile REQ-3 kebab wording at archive (design = no-kebab)
- [ ] 4.2 Verify mobile (`<sm`) toolbar layout for filters