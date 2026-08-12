# Design: Standardize Customers Table

## Technical Approach

Mirror `ProductsView.vue` 1:1 for error handling, view mode, and post-create reset. Follow `EmployeeCard` + `EmployeeCardGrid` as the card pattern. Wrap `useViewMode` shared composable into `useCustomerViewMode` following the `useSalesViewMode` shape (internal `displayMode` bridge).

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| View mode composable shape | `useSalesViewMode` pattern (internal `displayMode` computed) | Spec requires `displayMode` in return. `useProductViewMode` computes it in the view — less clean for reuse. |
| Card pattern | EmployeeCard (`article`, dashed divider, 2-col body, top-right kebab) | EmployeeCard is the gold standard for entity cards. ProductCard has a different layout (price-focused). |
| Error message precedence | Backend `response.data.message` → `error.message` → Spanish fallback | Identical to ProductsView; `useServerTable` already surfaces `isError`/`error`. |
| Card click action | Opens edit slideover (no detail route exists) | Single emit `card-click`; flipping to `router.push` later is one line. |
| Sortable columns | Remove `createSimpleHeader` on email/phone/globalPriceListName; add `SortableHeader` slots | Backend already accepts `sortBy`/`sortOrder`; columns already have `accessorKey`. |

## Data Flow

```
useServerTable<Customer> ──→ data, isError, error, pagination, globalFilter
         │
         ├── customersErrorMessage (computed) ──→ AppDataTable :error/:error-message
         ├── isCustomerViewMode guard ──→ handleViewModeChange ──→ useCustomerViewMode.setMode
         │                                                     ──→ localStorage
         ├── customerMatchesFilter() ──→ resetVisibilityContextAfterCreate()
         └── canManageCustomerActions (computed) ──→ v-if on kebab (table + card)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/POS/customers/composables/useCustomerViewMode.ts` | **New** | Wraps `useViewMode('customers-view-mode', ['table','card'], 'table')`. Exports `isCustomerViewMode`, `useCustomerViewMode()` returning `{ viewMode, setMode, toggleViewMode, displayMode }`. |
| `src/features/POS/customers/components/CustomerCard.vue` | **New** | Props: `customer: Customer, canUpdate?, canDelete?`. Emits: `edit`, `delete`, `click`. Article + EntityAvatar + fullName/email + chip row (AppBadge for globalPriceListName) + dashed divider + 2-col body (phone with country code / createdAt). Kebab gated by computed `canManage`. |
| `src/features/POS/customers/components/CustomerCardGrid.vue` | **New** | Props: `customers, loading?, empty?`. Emits: `card-click`, `edit`, `delete`. Ladder grid (1/2/3/5/7), 8 skeletons, `i-lucide-users` empty icon. Forwards card events. |
| `src/features/POS/customers/views/CustomersView.vue` | **Modify** | Add: destructure `isError`/`error` from `useServerTable`, `customersErrorMessage` computed, `useCustomerViewMode`, `resetVisibilityContextAfterCreate`, `canManageCustomerActions`, `customerMatchesFilter`. Add slots: `#actions` (ViewToggle), `#cards` (CustomerCardGrid), `#email-header`/`#phone-header`/`#globalPriceListName-header` (SortableHeader). Gate kebab with `canManageCustomerActions`. Wire `:error`/`:error-message`/`:display-mode` to AppDataTable. |
| `src/features/POS/customers/composables/useCustomerColumns.ts` | **Modify** | Remove `createSimpleHeader` on email, phone, globalPriceListName columns (they become sortable with `SortableHeader` slots). |
| `src/features/POS/customers/views/__tests__/CustomersView.test.ts` | **New** | Stub `useServerTable`, `useAuthStore`, `useCustomerViewMode`, `useQuery`/`useMutation`. Assert: error banner when `isError=true`, error message precedence, ViewToggle renders, ViewToggle switches display mode, kebab hidden when no perms. |
| `src/features/POS/customers/composables/__tests__/useCustomerColumns.test.ts` | **New** | Assert: column count, `actions` pinned right & not sortable/hideable, email/phone/globalPriceListName have `accessorKey` and no `createSimpleHeader` wrapper. |

## Interfaces / Contracts

```ts
// useCustomerViewMode — mirrors useSalesViewMode
export type CustomerViewMode = 'table' | 'card'
export const CUSTOMER_VIEW_MODE_STORAGE_KEY = 'customers-view-mode'
export function isCustomerViewMode(value: string): value is CustomerViewMode
export function useCustomerViewMode(): {
  viewMode: Ref<CustomerViewMode>
  setMode: (mode: CustomerViewMode) => void
  toggleViewMode: () => void
  displayMode: ComputedRef<'table' | 'cards'> // 'card' → 'cards'
}
```

```ts
// canManageCustomerActions — mirrors ProductsView's canManageProductActions
const canUpdate = computed(() => authStore.userCan('update', 'Customer'))
const canDelete = computed(() => authStore.userCan('delete', 'Customer'))
const canManageCustomerActions = computed(() => canUpdate.value || canDelete.value)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — CustomersView | Error state renders, ViewToggle wired, kebab gated, SortableHeader slots exist | `shallowMount`, stub `useServerTable`/`useAuthStore`/`useCustomerViewMode`. Assert `data-testid` on error banner. |
| Unit — useCustomerColumns | Column count, `actions` pinned, sortability flags, no `createSimpleHeader` wrappers | Call `useCustomerColumns()`, assert `columns` array shape. |
| Integration | Card click opens slideover, toggle persists across remount | Manual verification in this change; automated in future detail route change. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Error handling is additive (computed falls back when `error` is null). Removing card view deletes the new composable + components and strips `#cards` slot — table view unchanged. Tests live next to their source files.

## Open Questions

None. All decisions above are resolved from the existing codebase patterns.
