# Exploration: Responsive Tables System Audit

## 1. Scope and audit method

This phase inventories and classifies table-like UI only. It does not select a final remediation, change source, run tests/builds, or create proposal/spec/design/tasks artifacts.

Project context is `openspec/config.yaml`: Vue 3.5, TypeScript, Nuxt UI 4.6, Tailwind 4, TanStack Vue Table types/state, Vitest/jsdom, and a dashboard shell. The audit treats a **surface** as a user-visible repeated-record presentation with column-like fields, whether rendered as `UTable`, native `<table>`, a card/list substitute, a settings matrix, or an ordered operational list.

### Required responsive evaluation matrix for later verification

Every inventoried surface must eventually be evaluated at **320, 375, 768, and 1024 CSS px** against all of these criteria:

1. No document/page-level horizontal overflow; the dashboard's `overflow-x-hidden` must not merely mask it.
2. Wide tables may scroll only in a local, discoverable region; cards and stacked rows must not introduce horizontal scrolling.
3. Primary identity, status/value, and primary action remain visible or predictably reachable.
4. Interactive targets are at least 44×44 CSS px and retain keyboard activation, visible focus, logical focus order, and focus restoration for overlays.
5. Native table semantics remain valid; card/list substitutions expose appropriate list/article/button semantics and accessible names.
6. Long unbroken names, email, SKU, IDs, account numbers, CLABE, currency, dates, status chips, and multi-badge rows do not widen or silently clip the surface.
7. Search, filters, filter sheets, view toggles, pagination, bulk actions, loading, fetching, empty, no-match, and error states remain usable.
8. Sticky headers and pinned columns remain aligned and usable at both horizontal-scroll extremes.
9. Shell/sidebar/navbar gutters, card clipping, modal/slideover widths, sticky footers, and viewport-height constraints do not conflict with the surface.

## 2. Completeness proof

### Searches performed

All source searches were scoped to `src/**/*.{vue,ts,tsx,css}`. Generated/vendor content and `.git/gentle-ai/candidate-views/**` were excluded by scope.

| Query/pattern | Reconciled result |
|---|---|
| `<AppDataTable` | 15 user-visible consumers. |
| `<UTable` | 1 occurrence, the implementation inside `src/core/shared/components/DataTable/AppDataTable.vue`; no direct leaf `UTable` consumer. |
| `<table` | 9 tags: 6 in `ProductDetailView.vue` plus 1 each in `PriceListSection.vue`, `VariantPricingTable.vue`, and `SaleDetailItemsList.vue`. The 6 product-detail tags reconcile to 4 logical surfaces because create/edit variants and create/edit lots are mutually exclusive renderings of the same records. Total: 7 logical native-table surfaces. |
| `@tanstack/vue-table\|useVueTable` | TanStack types/state appear in shared table types, sorting/selection helpers, preferences/URL synchronization, `useSalesColumns.ts`, and `PendingApprovalsView.vue`; there is no leaf `useVueTable` instance. Nuxt UI's `UTable` is the rendering engine. |
| `#.*-cell\|mobile-card\|#cards\|<component :is` | Dynamic table cell slots are centralized through `AppDataTable`; all 15 consumers were reconciled. Dynamic `<component :is>` is confined to `DriverCockpitDrawer.vue` mode content and does not hide a table. |
| filenames `*Table*.vue`, `*List*.vue`, `*Grid*.vue`, `*Card*.vue` | Identified native tables, shared card fallbacks, and five list/matrix hybrids. `PriceListSelector.vue`, public catalog grids, tenant selection, promotion flat cards, and cockpit current/next cards were reviewed as false positives because they do not present a table-equivalent repeated dataset. |
| `role="table|row|grid|list"`, `grid-template-columns`, `grid-cols-[...]`, `overflow-*`, `min-w-*`, `whitespace-nowrap` | Reconciled CSS/list hybrids and shell containment; no additional semantic table/grid implementation was found. |
| co-located `__tests__`, plus `320|375|768|1024|viewport|overflow|mobile|touch|44|keyboard|focus|sticky` | Established test evidence and the absence of browser geometry coverage. |

### Inventory totals and duplicate handling

- **27 logical surfaces**: 15 AppDataTable lists, 7 native tables, and 5 list/matrix hybrids.
- Card grids paired with an AppDataTable row set are recorded as that surface's responsive strategy, not as additional surfaces.
- Product-detail create/edit variants and create/edit lots are each one logical surface with two mutually exclusive DOM tables.
- `VariantPricingTable` is separate because it is embedded in `VariantDetailModal.vue` and has its own data/actions.
- `SalesHistoryList`, `PaymentsListSection`, active-sale line items, notification action rows, and route reordering are included because they are repeated structured records with aligned identity/value/action content.

## 3. Row-per-surface inventory

Legend: density `L/M/H/VH`; complexity `S/M/L`; blast radius `leaf/feature/shared`. “Tests” means existing evidence, not proof that responsive behavior is correct.

| ID | Feature / route / view | Source paths | Primitive / engine | Density; actions | Filters / pagination | Existing mobile strategy; breakpoint classes | Overflow / fixed width | Tests | Classification: archetype; strategy; severity; root cause; complexity/blast |
|---|---|---|---|---|---|---|---|---|---|
| DT-01 | Products, `/pos/products`, `ProductsView` | `src/features/POS/products/views/ProductsView.vue`; `components/ProductCardGrid.vue`; `components/ProductCard.vue`; `composables/useProductColumns.ts` | AppDataTable → Nuxt `UTable`; TanStack state | VH; create, details/edit/delete kebab, column chooser, view toggle | Search, type filter; server sort/page | User-selected table/cards; `md:px-10`; auto-fit cards | Shared local table scroller; contained pilot shell; row kebab `size-7` | `views/__tests__/ProductsView.test.ts`, `ProductsView.typeFilter.test.ts`; card/grid tests | Catalog CRUD; mixed local scroll/card substitution; **high** (dense columns and sub-44 actions); R1/R3; M/feature |
| DT-02 | Customers, `/pos/customers`, `CustomersView` | `src/features/POS/customers/views/CustomersView.vue`; `components/CustomerCardGrid.vue`; `components/CustomerCard.vue`; `composables/useCustomerColumns.ts` | AppDataTable/UTable | H; create, edit/delete/history, view toggle | Search; server sort/page | User-selected table/cards; `md:px-10`; auto-fit cards | Shared scroller; contained pilot; `size-7` kebabs | `views/__tests__/CustomersView.test.ts`; card/grid tests | CRM CRUD/history; mixed; **high** (long contact data, action targets); R1/R3; M/feature |
| DT-03 | Confirmed sales, `/pos/ventas`, `SalesListView` | `src/features/POS/sales/views/SalesListView.vue`; `components/SaleCardGrid.vue`; `components/SaleCard.vue`; `composables/useSalesColumns.ts` | AppDataTable/UTable | VH (about 11 visible/business columns); create and row navigation, view toggle | Search, advanced filters, 3 quick tabs, sort select; server page | User-selected table/cards; filter sheet below `md` | **Unconditional `px-10` route + `px-6` body**; local table scroll; quick tabs `overflow-x-auto` | `views/__tests__/SalesListView.test.ts`, persistence test; card/grid tests | Transaction history; mixed; **critical** (widest daily-use table and stacked gutters at 320/375); R1/R2/R4; M/feature |
| DT-04 | Quotations, `/pos/cotizaciones`, `QuotationsListView` | `src/features/POS/quotations/views/QuotationsListView.vue`; `components/QuotationCardGrid.vue`; `components/QuotationCard.vue`; `composables/useQuotationsListTable.ts` | AppDataTable/UTable | H; create, detail, delete kebab, view toggle | Status tabs, advanced filters; server sort/page | User-selected table/cards; `mobile-render="cards"` is ineffective whenever explicit `displayMode='table'`; filter sheet `<md` | Route `px-4 sm:px-10`, inner `px-6`; local scroll; `size-7` action | `views/__tests__/QuotationsListView.test.ts`; card/grid tests | Transactional CRUD; mixed; **high** (historical mobile intent contradicted by explicit mode precedence); R2/R3; M/feature |
| DT-05 | Promotions, `/pos/promociones`, `PromotionsView` | `src/features/POS/promotions/views/PromotionsView.vue`; `components/PromotionCardGrid.vue`; `components/PromotionCard.vue`; `composables/usePromotionColumns.ts` | AppDataTable/UTable | VH; create, edit/end/delete, selection/bulk actions, kebab, view toggle | Search, 3 selects; server sort/page | User-selected table/cards; filter controls stack at `sm` | Inner `px-6`; local scroll; pinned `actions`; `size-7` kebab | `views/__tests__/PromotionsView.test.ts`; card/grid tests | Promotional admin CRUD; mixed; **high** (many columns, bulk bar, filters/actions); R1/R3/R5; L/feature |
| DT-06 | Employees, `/admin/colaboradores`, `EmployeesListView` | `src/features/admin/employees/views/EmployeesListView.vue`; `components/EmployeeCardGrid.vue`; `components/EmployeeCard.vue`; `composables/useEmployeesList.ts` | AppDataTable/UTable | VH; create/detail/lifecycle, selection/bulk, kebab, view toggle | Search, status tabs; server page | User-selected table/cards; pilot auto-fit cards; filter sheet `<md` | Contained pilot; local scroller; pinned actions; `size-7` kebab | `views/__tests__/EmployeesListView.test.ts`, batch spec; card/grid tests | HR admin CRUD; mixed; **high** (dense identity/chips plus bulk bar); R1/R3/R5; L/feature |
| DT-07 | Pending approvals, `/admin/colaboradores/aprobaciones-pendientes` | `src/features/admin/employees/views/PendingApprovalsView.vue`; `components/PendingApprovalCard.vue`; `composables/usePendingApprovalsViewMode.ts` | AppDataTable/UTable, client paging | H; approve/reject inline, view toggle | Search; client page; toolbar hidden on empty queue | **Card-first default**, user table option; cards stack vertically | Outer responsive gutters + inner `px-6`; table local scroll; pinned actions | `views/__tests__/PendingApprovalsView.test.ts`; pending-card tests | Approval queue; mixed/card substitution; **medium** (better default, but dual xs actions and dense table); R3/R5; M/feature |
| DT-08 | Expiring documents, `/admin/colaboradores/documentos-vencer` | `src/features/admin/employees/views/ExpiringDocumentsView.vue`; `composables/useExpiringDocuments.ts` | AppDataTable/UTable | H; no row action | Threshold filter; server sort/page | Table only; filter sheet `<md`; no card slot | Inner `px-6`; local table scroll, no discoverability cue | `views/__tests__/ExpiringDocumentsView.test.ts`; composable tests | Analytical/exception queue; horizontal scroll; **high** (table-only at 320/375); R2/R4; M/feature |
| DT-09 | Users, `/admin/users`, `AdminUsersView` | `src/features/admin/users/views/AdminUsersView.vue`; `components/UserCardGrid.vue`; `components/UserCard.vue` | AppDataTable/UTable | H; create/edit/delete kebab, view toggle | Search; server sort/page | User-selected table/cards | Inner `px-6`; local scroll; role chips; `size-7` kebab | `views/__tests__/AdminUsersView.test.ts`; card/grid tests | Admin CRUD; mixed; **medium**; R1/R3; M/feature |
| DT-10 | Roles, `/admin/roles`, `AdminRolesView` | `src/features/admin/roles/views/AdminRolesView.vue`; `components/RoleCardGrid.vue`; `components/RoleCard.vue` | AppDataTable/UTable | H; create/edit/permissions/delete kebab, view toggle | Search; server sort/page | User-selected table/cards | Inner `px-6`; local scroll; `size-7` kebab | `views/__tests__/AdminRolesView.test.ts`; role-card/grid tests | Admin CRUD/security; mixed; **medium**; R1/R3; M/feature |
| DT-11 | Tenants, `/admin/tenants`, `AdminTenantsView` | `src/features/admin/tenants/views/AdminTenantsView.vue`; `components/TenantCardGrid.vue`; `components/TenantCard.vue` | AppDataTable/UTable | M/H; create/edit/deactivate/members kebab, view toggle | Search, inactive checkbox; server sort/page | User-selected table/cards; filter sheet `<md` | Inner `px-6`; local scroll; `size-7` kebab | `views/__tests__/AdminTenantsView.test.ts`, `.spec.ts`; card/grid tests | Super-admin CRUD; mixed; **medium**; R1/R3; M/feature |
| DT-12 | Tenant members, `/admin/tenants/:tenantId/members` | `src/features/admin/tenants/memberships/views/AdminTenantMembersView.vue`; `components/MemberCardGrid.vue`; `components/MemberCard.vue` | AppDataTable/UTable | M/H; add/edit/remove kebab, view toggle | Search; server sort/page | User-selected table/cards | Inner `px-6`; local scroll; long email; `size-7` kebab | both `AdminTenantMembersView` tests; card/grid tests | Super-admin membership CRUD; mixed; **medium**; R1/R3; M/feature |
| DT-13 | Bank payment details, `/admin/payment-details` | `src/features/admin/payment-details/views/AdminPaymentDetailsView.vue`; `components/PaymentDetailCardGrid.vue`; `composables/usePaymentDetailColumns.ts` | AppDataTable/UTable | H; create/edit/deactivate kebab, view toggle | Search; client/table composable page | User-selected table/cards | Inner `px-6`; CLABE/account min-content; local scroll; `size-7` | `views/__tests__/AdminPaymentDetailsView.spec.ts`; card-grid tests | Financial admin CRUD; mixed; **high** (sensitive long numeric identifiers); R1/R3/R4; M/feature |
| DT-14 | Payment methods, `/admin/payment-methods` | `src/features/admin/payment-methods/views/AdminPaymentMethodsView.vue`; `components/PaymentMethodCardGrid.vue`; `composables/usePaymentMethodColumns.ts` | AppDataTable/UTable | H; create/edit/deactivate kebab, view toggle | Search; client/table composable page | User-selected table/cards | Inner `px-6`; local scroll; `size-7` kebab | `views/__tests__/AdminPaymentMethodsView.spec.ts`; card-grid tests | Financial admin CRUD; mixed; **medium**; R1/R3; M/feature |
| DT-15 | Delivery routes manager list, `/pos/rutas-de-entrega`, manager branch | `src/features/delivery-routes/views/DeliveryRoutesListView.vue`; `composables/useDeliveryRoutesTable.ts` | AppDataTable/UTable | M; create/start kebab | Search; server sort/page | Table only; driver branch is separate card UI | Responsive route gutters; local scroll; pinned action; `size-7` | `views/__tests__/DeliveryRoutesListView.spec.ts`; composable tests | Operational dispatch; horizontal scroll; **high** (table-only, critical start action); R2/R3; M/feature |
| NT-01 | Product detail/create variants, `/pos/products/new` and `/pos/products/:id` | `src/features/POS/products/views/ProductDetailView.vue` (create/edit tables at lines around 2136/2217) | Native table | H; inline quantity/price, image/detail/edit/delete | None | None; same 4-column table at all widths | Wrapper is `overflow-hidden`; `min-w-full`; fixed `w-28`, `max-w-[8rem]`; action row does not wrap | `views/__tests__/ProductDetailView.test.ts`, service-type test (behavior; no responsive geometry) | Embedded editable detail; none; **critical** (clipping likely at 320/375); R4/R6; L/leaf |
| NT-02 | Product lots, same routes | `src/features/POS/products/views/ProductDetailView.vue` (around 2337/2374) | Native table | M; edit/delete | None | None | `overflow-hidden`, `min-w-full`; 4 columns | ProductDetailView tests, no responsive assertions | Embedded inventory detail; none; **high**; R4; M/leaf |
| NT-03 | Product create pending price lists, `/pos/products/new` | `src/features/POS/products/views/ProductDetailView.vue` (around 2464) | Native table | VH; inline price/tier/remove | None | None | `overflow-hidden`, `min-w-full`; 6 columns, fixed input maxima | ProductDetailView tests do not cover responsive table contract | Embedded pricing editor; none; **critical**; R4/R6; L/leaf |
| NT-04 | Pending variant price editor modal | `src/features/POS/products/views/ProductDetailView.vue` (around 2798) | Native table in `UModal sm:max-w-4xl` | H; inline price/tier | None | Modal stacks elsewhere, table unchanged | `overflow-hidden`, `min-w-full`; 5 columns, `max-w-[14rem]` | ProductDetailView tests; no table geometry | Modal embedded pricing; none; **critical** at phone modal widths; R4/R6/R7; L/leaf |
| NT-05 | Existing product sale price lists | `src/features/POS/products/components/PriceListSection.vue`, mounted by `ProductDetailView.vue` | Native table | VH; inline price, tier editor, delete | None | Tier modal rows stack at `md`; primary table does not | Table wrapper lacks overflow scrolling and uses `min-w-full`; 5 columns; fixed/max inputs | No direct component test found; parent stubs it | Embedded pricing administration; none; **critical**; R4/R6; L/feature |
| NT-06 | Variant price lists in variant detail modal | `src/features/POS/products/components/VariantPricingTable.vue`; `components/VariantDetailModal.vue` | Native table | VH; inline price/tier editor | None | Tier modal rows stack at `md`; primary table unchanged | No local overflow; `min-w-full`; 5 columns | No direct `VariantPricingTable` test found | Modal embedded pricing; none; **critical**; R4/R6/R7; L/feature |
| NT-07 | Confirmed sale items, `/pos/ventas/:id` | `src/features/POS/sales/components/SaleDetailItemsList.vue`; mounted by `views/SaleDetailView.vue` | Native table | VH; informational | None | None; detail page changes to one column below `lg`, but table stays 5 columns | `w-full` only; no local overflow/card fallback; long product/badge content | `components/__tests__/SaleDetailItemsList.test.ts`; `views/__tests__/SaleDetailView.test.ts` | Transaction detail; none; **critical** (5 numeric/content columns on 320); R4; M/leaf |
| HY-01 | Active POS cart, `/pos/ventas/nueva` | `src/features/POS/sales/components/ActiveSalePanel.vue`; `components/SaleItemRow.vue`; `views/SalesView.vue` | List-table hybrid: repeated compact line-item cards | VH; quantity, delete, price, discount, promotion actions | Scrollable item body; no paging | Below `lg` cart moves to existing slideover; rows remain horizontal compact cards | Right price stack `min-w-[64px]`, 48px image; center truncates; xs icon controls lack explicit 44px floor | `ActiveSalePanel.spec.ts`, `SaleItemRow.test.ts`, `SalesView.test.ts` | Transactional/POS; stacked-row/card; **high** (primary checkout loop, narrow slideover, small controls); R3/R6/R7; L/feature |
| HY-02 | Sale payment rows, `/pos/ventas/:id` | `src/features/POS/sales/components/PaymentsListSection.vue`; `views/SaleDetailView.vue` | Structured `<ul>` rows | H; edit-reference icon | None | Flex row with wrapping metadata, no breakpoint switch | Amount/action cluster is non-wrapping; xs edit button; reference truncates at 20 chars | `components/__tests__/PaymentsListSection.spec.ts`; SaleDetailView tests | Financial detail; stacked rows; **high** (money/action preservation and touch size); R3/R6; M/leaf |
| HY-03 | Customer sales history slideover | `src/features/POS/customers/components/SalesHistoryList.vue`; `components/CustomerSalesHistorySlideover.vue`; entry from `/pos/customers` | Accessible `<ul>` of full-row buttons | M; select sale | Parent query/state; no visible pagination in list component | Stacked responsive rows; metadata wraps | Name truncates, right date cluster shrinks; full row is button but no explicit `min-h-11` | No direct history-list/slideover test found | Analytical/history overlay; stacked rows; **medium**; R3/R7; M/feature |
| HY-04 | Notification action settings matrix, `/sistema/configuracion/notificaciones` | `src/features/system/notifications/components/ActionsAccordion.vue`; `ModuleAccordionItem.vue`; `ActionRow.vue`; `views/NotificationConfigView.vue` | Accordion-grouped list/table matrix | M; one switch per action, master toggle/save in view | No paging; module grouping | Stacked card rows; text `min-w-0`, accordion label breaks | No horizontal scroller/fixed width; switch target size depends on Nuxt UI default | `ActionRow.spec.ts`, `ActionsAccordion.spec.ts`, `NotificationConfigView.spec.ts` | Settings matrix; stacked rows; **low/medium** (already mobile-shaped; touch geometry unknown); R3; S/feature |
| HY-05 | Draft route stop reordering, `/pos/rutas-de-entrega/:id` | `src/features/delivery-routes/components/DeliveryRouteReorderPanel.vue`; mounted by `views/DeliveryRouteDetailView.vue` | `vuedraggable` ordered `<ul>` rows | M; drag handle, up/down, save | None | Single flex row at all widths; customer truncates | No width containment classes on row; xs up/down controls; drag is not sole input | `components/__tests__/DeliveryRouteReorderPanel.spec.ts`; detail-view test | Operational ordered list; stacked rows; **high** (order-changing actions and touch/accessibility); R3/R6; M/leaf |

## 4. Shared infrastructure and dependency edges

### Core dependency graph

```text
DashboardLayout / Nuxt UI dashboardPanel theme
  └─ route view gutters + UCard (global root overflow-hidden)
      └─ AppDataTable
          ├─ DataTableToolbar
          │   ├─ search/add/refresh/column visibility
          │   ├─ #filters → FilterSectionCard or DataTableFilters
          │   ├─ #actions → ViewToggle / local selects
          │   └─ mobile USlideover (<md)
          ├─ Nuxt UI UTable (Nuxt root owns overflow-auto)
          │   ├─ feature column definitions
          │   ├─ dynamic #*-header / #*-cell slot forwarding
          │   ├─ SortableHeader
          │   └─ SelectColumn / pinned action columns
          ├─ #cards or #mobile-card → feature card grid/card
          ├─ DataTablePagination
          └─ DataTableBulkActions

useServerTable
  ├─ TanStack Vue Query
  ├─ useTablePreferences (pinning/visibility in localStorage)
  └─ useTableUrlSync (sorting/search/page URL state)

feature use*ViewMode
  └─ useViewMode (localStorage) → explicit AppDataTable displayMode
```

### Shared infrastructure map

| Infrastructure | Paths | Consumers / responsive implication |
|---|---|---|
| Table wrapper | `src/core/shared/components/DataTable/AppDataTable.vue`; `src/core/shared/types/table.types.ts` | All 15 DT surfaces. Owns mode precedence, UTable, sticky header, states, pagination, bulk bar, and dynamic slots. `displayMode='table'` overrides `mobileRender='cards'`. |
| Toolbar and filter sheet | `src/core/shared/components/DataTable/DataTableToolbar.vue`; `FilterSectionCard.vue`; `src/core/shared/data-table-filters/components/DataTableFilters.vue` | Search/actions/filter layout changes at `md` (768). Mobile has three regions and one bottom sheet. Active count is consumer-supplied and may drift from embedded filter state. |
| Pagination | `src/core/shared/components/DataTable/DataTablePagination.vue` | All paginated DT surfaces. Stacks before `sm`; unit tests assert containment classes, but real `UPagination` geometry is unverified. |
| Selection and bulk bar | `SelectColumn.vue`; `DataTableBulkActions.vue` | Employees and promotions materially use it. Bulk bar has two non-wrapping flex clusters and no narrow breakpoint; its action callback currently receives `[]`, so responsive work must not broaden into behavior repair without a separate defect scope. |
| Sorting/column definitions | `SortableHeader.vue`; `DataTableColumnHeader.ts`; feature `use*Columns.ts` and view-local arrays | Column IDs are API-sort contracts. Hiding/reordering cannot be decided only visually. |
| State engine | `src/core/shared/composables/useServerTable.ts`; `useTablePreferences.ts`; `useTableUrlSync.ts` | Server pagination/search/sort plus persisted pinning/visibility. Responsive migration must preserve stored modes and pinning. |
| View mode | `src/core/shared/composables/useViewMode.ts`; feature `use*ViewMode.ts`; `src/core/shared/components/ViewToggle.vue` | Most card-capable pages default to explicit table mode, not viewport auto mode. ViewToggle itself has tested 44px floors; row/action buttons generally do not. |
| Reusable card patterns | `ProductCardGrid.vue`, `CustomerCardGrid.vue`, `EmployeeCardGrid.vue` use available-width `auto-fit`; `SaleCardGrid.vue`, `QuotationCardGrid.vue`, and admin grids use feature-specific grid wrappers | Card substitution is widespread but not automatic. Three density pilots use container-aware tracks; other grids retain older ladder variants, creating deliberate pattern drift. |
| Shell/container constraints | `src/app/layouts/DashboardLayout.vue`; `vite.config.ts` | Dashboard body adds `p-4 sm:p-6`; route/card wrappers add more padding. Dashboard panel applies `overflow-x-hidden`; global UCard root applies `overflow-hidden`, which can hide rather than solve overflow. Sidebar behavior changes around `lg`/1024. |
| Native embedded tables | `ProductDetailView.vue`; `PriceListSection.vue`; `VariantPricingTable.vue`; `SaleDetailItemsList.vue` | They bypass every shared responsive table facility, including local overflow, cards, states, pagination conventions, and tests. This is the highest-leverage uncovered family. |

## 5. Root-cause families

| Family | Evidence | Affected surfaces |
|---|---|---|
| **R1 — Explicit persisted table mode defeats responsive substitution** | `AppDataTable.isCardsMode` returns false immediately for `displayMode='table'`; feature view-mode composables default to table. A card slot's existence does not create a phone fallback. | DT-01–07, DT-09–14 (all card-capable consumers). |
| **R2 — Table-only/local-scroll dependence lacks discoverability and consistent policy** | Nuxt UTable owns `overflow-auto`, but no shared cue/gradient/instruction establishes that more columns exist. Some views have no cards. | DT-03/04/08/15 and table mode of every DT surface. |
| **R3 — Compact action controls violate or do not prove the 44×44 target** | Repeated `class="size-7"` row kebabs and `size="xs"` icon/text buttons; only ViewToggle and selected cockpit controls explicitly test `min-h-11/min-w-11`. | Most DT rows, HY-01/02/03/04/05, native editor actions. |
| **R4 — Native tables bypass containment and responsive infrastructure** | Native wrappers use `overflow-hidden` or no overflow while tables use `min-w-full`/`w-full`; product pricing has 5–6 columns and fixed-width inputs. | NT-01–07. |
| **R5 — Adjacent toolbar/pagination/bulk controls are independent overflow systems** | Shared toolbar is responsive, but feature slots can add selects/tabs; bulk bar has non-wrapping clusters; pagination geometry is only class-tested. | Dense DT surfaces, especially DT-03/05/06/07. |
| **R6 — Dense editable rows preserve desktop horizontal composition** | Fixed/max input widths, non-wrapping amount/action clusters, 48px media plus price columns, and multiple inline actions. | NT-01/03/04/05/06, HY-01/02/05. |
| **R7 — Overlay viewport and table strategy are disconnected** | Tables/lists inside modals, slideovers, or the POS mobile cart retain desktop row composition even though available width is smaller than viewport width. | NT-04/06, HY-01/03. |
| **R8 — Geometry cannot be proven by current test stack** | Vitest/jsdom checks classes/props/events but not scrollWidth, clipping, sticky positions, or measured targets; no Playwright/Cypress dependency is present. | System-wide. |

## 6. Systemic classification matrix

| Archetype | Surface IDs | Dominant strategy | Risk concentration | Likely systemic direction (not a decision) |
|---|---|---|---|---|
| Admin/catalog CRUD | DT-01/02/05/06/09–14 | User-selected table/cards | High density, pinning, filters, bulk/action target size | Establish mode policy and shared action/overflow contracts before more leaf card work. |
| Transactional history | DT-03/04 | User-selected table/cards plus dense filters | **Critical/high** daily-use width and padding | Treat sales/quotations as a dedicated batch after shared policy; preserve financial/status fields. |
| Analytical/exception queues | DT-07/08 | Card-first mixed or table-only | Table-only documents and approval actions | Define queue-specific essential columns/actions; avoid one generic CRUD rule. |
| Operational dispatch | DT-15, HY-05 | Table scroll / structured list | Start/reorder actions are consequential | Preserve keyboard reorder and pinned action access; verify 1024 shell boundary. |
| Embedded editable product/pricing | NT-01–06 | None | **Critical cluster**: no local scroll or substitution, fixed inputs, modal constraints | Create a native embedded-table responsive pattern before editing six instances independently. |
| Transaction detail | NT-07, HY-02/03 | Native table or stacked rows | Money, status, primary action preservation | Prefer detail-specific stacked semantics where appropriate; preserve exact totals/references. |
| Live POS cart | HY-01 | Horizontal compact cards in `<lg` slideover | Primary revenue path and dense controls | Audit independently from generic tables; 320/375 slideover is the governing container. |
| Settings matrix | HY-04 | Stacked accordion rows | Lower width risk, unknown switch targets | Mostly verification/a11y batch, not a table migration. |

## 7. Historical OpenSpec decisions and observed drift

| Historical artifact | Decision / precedent | Current consistency or drift |
|---|---|---|
| `openspec/changes/archive/2026-08-11-standardize-quotations-table/design.md` | Standardize around AppDataTable, SortableHeader, ViewToggle, shared toolbar, and explicit display-mode bridge. | Structure remains. Its component map refers to `#mobile-card`; later card-grid work moved sales/quotations to `#cards`. More importantly, explicit table mode now overrides `mobile-render="cards"`, so the apparent automatic mobile fallback is not operative. |
| `openspec/changes/archive/2026-08-12-standardize-card-grids/design.md` | Sales and quotations adopted `#cards`; card grids used the Employee viewport ladder; AppDataTable remained unchanged. | Still present, but the later density pilot intentionally moved Products/Customers/Employees to available-width auto-fit while other grids retained older patterns. The repository now has two card-grid responsiveness systems. |
| `openspec/changes/archive/2026-08-16-unify-table-mobile-header/proposal.md` | One shared `<md` toolbar choke point: search, wrapping actions, filter sheet; initial scope described eight views. | Core pattern remains and now serves 15 AppDataTable consumers. Some newer consumers and dense action slots were never part of the original eight-view acceptance matrix. |
| `openspec/changes/archive/2026-08-16-polish-filters-bottom-sheet/proposal.md` and `specs/mobile-filters-sheet/spec.md` | Exactly one mobile filter sheet, sticky header/footer, scrollable 85vh body, view-owned filter cards; desktop unchanged. | Implemented in shared toolbar and embedded sales/quotation filters. The documented phase-1 active-count limitation remains architectural debt because the wrapper still trusts consumer counts. |
| `openspec/changes/archive/2026-09-06-mobile-dashboard-list-density/exploration.md` and `design.md` | Shell is sole mobile gutter for Products/Customers/Employees; shared `min-w-0`; Nuxt UTable remains sole scroller; card mode must not scroll; 44px ViewToggle; manual geometry at 360/412/740. | Pilot source reflects the containment classes. The intervention was intentionally limited to three pages; sales, quotations, most admin views, native tables, and overlays remain outside it. This audit broadens widths to 320/375/768/1024. |
| `openspec/changes/archive/2026-08-01-sales-screen-redesign/design.md` | Live POS uses desktop ≥1024 split and mobile cart slideover; SaleItemRow became a dense horizontal card. | The responsive shell is intentional, but the row still carries multiple xs controls and a fixed right price stack; 320/375 touch/geometry was not established by the design. The historical phase note also claimed `SaleDetailItemsList` used SaleItemRow, while current source renders its own native table—clear implementation/documentation drift. |
| `openspec/changes/quotations-ui-redesign/design.md` | Quotation detail becomes a single column below `lg`, sticky sidebar only on desktop. | Useful detail-layout precedent, but it does not govern list-table mode or product/sale embedded native tables. |
| `openspec/changes/archive/2026-08-31-driver-cockpit-responsive-polish/exploration.md` | `lg`/1024 is the shell-aligned overlay boundary; mobile requires 44px targets, focus restoration, no premature truncation. | Cockpit code/tests contain strong responsive/a11y precedents, but delivery manager tables and reorder controls do not consistently inherit those standards. |

## 8. Dependency-aware candidate batch plan (planning only)

Each item should become a separate SDD change only after the complete inventory is accepted. Ordering places shared contracts before dependent leaf migrations where evidence supports it. Review estimates are intentionally kept below the 400-line budget; `ask-on-risk` must pause if a real proposal forecasts otherwise.

1. **Batch A — Responsive table policy and browser evidence contract.** Specify mode precedence, essential information/action rules, local-scroll discoverability, 320/375/768/1024 evidence, and geometry tooling approach. Primarily specs/tests/manual harness; no leaf migration bundled.
2. **Batch B — Shared table-adjacent controls.** Audit/fix AppDataTable, toolbar slot containment, pagination, bulk bar wrapping, and shared row-action target pattern without changing feature columns. This is a high-blast shared batch and may need to split into B1 controls and B2 bulk actions.
3. **Batch C — Native embedded table primitive/pattern.** Establish one accessible responsive contract for embedded read-only/editable tables and modal containment. Do not migrate all instances in the same change.
4. **Batch D — Product variants and lots migration.** NT-01/02 only, consuming Batch C.
5. **Batch E — Product/variant pricing migration.** NT-03–06, likely split into E1 create-mode product pricing and E2 existing/variant modal pricing because of stateful inline editing and review size.
6. **Batch F — Sales list responsive remediation.** DT-03 only; preserve filters, tabs, sorting, pinned behavior, financial/status fields, and card mode.
7. **Batch G — Quotations list responsive remediation.** DT-04 only; explicitly reconcile `mobileRender` versus persisted `displayMode` and historical card decisions.
8. **Batch H — Table-only queues and dispatch.** Split DT-08 and DT-15 into independent SDD changes unless one shared policy change fully solves both; their archetypes and actions differ.
9. **Batch I — Remaining CRUD card/table pages.** Small domain batches after shared policy: promotions/employees; financial admins; identity/admin lists. Do not mass-edit all views in one PR.
10. **Batch J — Transaction detail rows.** NT-07 and HY-02 as separate changes if their semantic solutions differ (items versus payments).
11. **Batch K — Live POS cart narrow-width audit/remediation.** HY-01 only; isolated because it is revenue-critical and governed by a `<lg` slideover rather than the dashboard list contract.
12. **Batch L — Secondary list hybrids.** HY-03/04/05 as independent small verification/remediation changes ordered by risk (reorder, history, notification settings).

## 9. Coverage gaps and unknowns

| Gap / unknown | Consequence |
|---|---|
| No browser-level geometry runner or checked-in responsive matrix | Unit tests cannot prove no page overflow, local scroll ownership, sticky alignment, or measured touch targets. |
| No run-time audit was performed in this phase | Severity is source-evidence classification, not screenshot/browser confirmation. |
| Exact Nuxt UI default button dimensions by `size` are not asserted for most row actions | `size-7` is clearly 28px; `size="xs"` target compliance remains unknown until computed geometry is measured. |
| Native table semantics lack captions/scope evidence and responsive alternatives | Screen-reader navigation and card-substitution equivalence are unverified. |
| No direct tests for `PriceListSection.vue`, `VariantPricingTable.vue`, or `SalesHistoryList.vue` | High-risk embedded and overlay surfaces have weak regression boundaries. |
| ProductDetailView tests stub `PriceListSection` | Parent coverage does not exercise NT-05. |
| AppDataTable tests assert class contracts and mocked breakpoints | They do not establish behavior at exact 320/375/768/1024 rendered widths. |
| Stored user view modes and column preferences may preserve a wide table on phones | Any automatic mode policy needs migration/backward-compatibility decisions. |
| Essential columns/actions are domain-specific | A universal hide-column rule could remove financial, status, permission, or operational information. |
| Long-data fixtures are inconsistent across suites | CLABE, UUID, SKU, email, multi-role chips, long names, and large currency need a canonical stress fixture set. |
| Error/loading/empty ownership differs for native tables and hybrids | Shared AppDataTable states cannot automatically cover NT/HY surfaces. |
| `DataTableBulkActions` narrow layout and selected-row callback behavior are coupled risks | Behavior repair is not part of responsive work and should be isolated if confirmed. |

## 10. Explicit non-goals

- No source/application edits, refactors, dependency additions, tests, builds, dev server, screenshots, or runtime measurements.
- No proposal, capability spec, design, task list, implementation commitment, or final batch approval.
- No API, DTO, query, cache, routing, navigation, CASL, or backend changes.
- No decision that every table must become cards, that horizontal scrolling must be removed, or that columns may be hidden without domain review.
- No treatment of ordinary product/catalog card grids, tenant selection, promotional cards, cockpit current/next cards, or other repeated UI as tables unless they are an actual table-equivalent record surface.
- No remediation of unrelated behavioral defects discovered while reading shared infrastructure.

## 11. Exploration conclusion

The repository has a mature but incomplete shared list system: 15 route-level tables converge on AppDataTable and benefit from shared toolbar, state, pagination, sticky headers, local UTable scrolling, and optional cards. The remaining systemic risk is not one bad table. It is the interaction of explicit persisted table mode, inconsistent card-grid generations, stacked shell/view gutters, sub-44 row actions, table-adjacent controls, and seven native embedded tables that bypass the shared system entirely.

The highest-priority evidence clusters are the native product/pricing tables (NT-01–06), confirmed sale items (NT-07), the sales list (DT-03), and the live POS cart (HY-01). Planning should begin with a shared policy/evidence contract and a native embedded-table pattern, then migrate leaves in domain-sized SDD changes rather than one repository-wide implementation.
