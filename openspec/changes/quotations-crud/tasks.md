# Tasks: Quotations CRUD

## Review Workload Forecast

Estimated changed lines: ~2,600 across 8 slices (15 new + 4 modified files). 400-line budget risk: High — every slice capped ~400. Chained PRs recommended: No (solo-dev: feature branch → merge to main). Delivery strategy: solo-dev. Decision needed before apply: No.

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

### Work Units

| # | Goal | Test cmd | Runtime | Rollback |
|---|------|----------|---------|----------|
| 1 | Foundation: types, CASL, keys, routes | `pnpm test:unit` | `pnpm dev` (build fails until S3/S4 — expected) | revert CASL/nav/router |
| 2 | API layer (15 endpoints) | `pnpm test:unit` | N/A | delete `api/quotation.api.ts` |
| 3 | List view | `pnpm test:unit` | `/pos/cotizaciones` | delete `QuotationsListView.vue` |
| 4 | Detail skeleton + createDraft | `pnpm test:unit` | `/pos/cotizaciones/nueva` | delete detail view + composables |
| 5 | Item rows + item mutations | `pnpm test:unit` | `/pos/cotizaciones/:id` add/qty/override | remove `QuotationItemRow` |
| 6 | Promotions + expiry | `pnpm test:unit` | apply/veto/expiry | delete `QuotationExpiryPicker` |
| 7 | PDF + Send + Cancel | `pnpm test:unit` | preview/send/cancel | delete send/cancel dialogs |
| 8 | Stock + read-only + EXPIRED | `pnpm test:unit` | full lifecycle | revert read-only branches |

## Dependency Graph

```
S1 (Foundation) ──┬── S2 (API) ──┬── S3 (List)
                  └── types ─────└── S4 (Detail + createDraft)
                                         ├── S5 (Items)
                                         ├── S6 (Promos)
                                         └── S7 (PDF + Send + Cancel)
                                              └── S8 (Stock + read-only)
```

## Implementation Order

Numerical order. S1 unlocks all; S3/S4 fork list/detail; S5-S7 detail vertical; S8 hardens.

---

## Slice 1 — Foundation (REQs 001 partial, 014) — ~250 lines

- [x] 1.1 TDD `interfaces/quotation.types.ts` — `QuotationStatus`, `CancelReason`, `PriceSource`, `QuotationResponseDto`, `QuotationItemResponseDto`, `AppliedPromotion`, `QuotationListParams`, `PaginatedQuotations` (NEW + test)
- [x] 1.2 TDD `constants/quotation.constants.ts` — `QUOTATION_STATUS` map (DRAFT/SENT/EXPIRED/CANCELLED → tone+label), `CANCEL_REASONS` (NEW + test)
- [x] 1.3 TDD `utils/quotation.utils.ts` — `isExpired`, `statusToTone`, `statusToLabel`, `isDraft` (NEW + test)
- [x] 1.4 `utils/currency.utils.ts` re-exports `formatCentsMXN` (NEW)
- [x] 1.5 Add `quotationQueryKeys` to `src/core/shared/constants/query-keys.ts` (MOD)
- [x] 1.6 Register `'Quotation'` in CASL `APP_SUBJECTS` + `AppSubject` union (`auth.types.ts`) (MOD x2)
- [x] 1.7 Sidebar item `pos-quotations` with `read:Quotation` in `navigation.registry.ts` (MOD)
- [x] 1.8 3 lazy routes in `router/index.ts` — views filled in S3/S4 (MOD)
- **Files**: 4 NEW + 3 tests; 5 MOD. **Verify**: `pnpm test:unit`. `pnpm build` fails until S3/S4 — expected.
- **Commit**: `feat(quotations): add types, constants, query keys, CASL, sidebar, routes`

---

## Slice 2 — API layer (REQs 003 partial, 015 partial) — ~290 lines

- [x] 2.1 TDD `api/quotation.api.ts` (mock `http`) — URL/method/payload for all 15 endpoints (NEW + test)
- [x] 2.2 Implement `quotationApi`: 17 methods (15 endpoints + `createDraft` + `getPdfBlob`) — `list`, `getById`, `createDraft`, `assignCustomer`, `setPriceList`, `addItem`, `updateQuantity`, `removeItem`, `overridePrice`, `applyManualPromotion`, `removeManualPromotion`, `vetoPromotion`, `unvetoPromotion`, `setExpiry`, `send`, `cancel`, `getPdfBlob`
- [x] 2.3 `getPdfBlob`: `responseType:'blob'`, `timeout:15_000`, `AbortSignal`, `format=quotation-a4`
- **Files**: 2 NEW. **Verify**: `pnpm test:unit`.
- **Commit**: `feat(quotations): add quotationApi with 15 endpoints`

---

## Slice 3 — List view (REQs 001 list, 002, 016) — ~340 lines

- [x] 3.1 TDD `composables/useQuotationsList.ts` — status tab, `refDebounced` search, pagination (mirrors `useEmployeesList`) (NEW + test)
- [x] 3.2 `views/QuotationsListView.vue`: header with `Nueva cotización` button gated by `create:Quotation` (NEW)
- [x] 3.3 Status tabs (Todos/Borradores/Enviadas/Expiradas/Canceladas)
- [x] 3.4 `AppDataTable` columns: ID (truncated UUID), Cliente, Estado (`StatusDotBadge`), Total (`formatCentsMXN`), Expira, Fecha
- [x] 3.5 Skeleton + empty state + error retry; toast on errors (handled by AppDataTable props)
- **Files**: 3 NEW (composable + view + view test). **Verify**: `pnpm test:unit` 3277 pass; `pnpm type-check` clean; `pnpm build` green; `/pos/cotizaciones` renders list.
- **Commit**: `feat(quotations): add list view with status tabs, search, pagination`

---

## Slice 4 — Detail skeleton + createDraft (REQs 001 create+detail, 003, 015 detail) — ~360 lines

- [x] 4.1 TDD `useQuotationDetail(id)` — `useQuery` on `quotationQueryKeys.detail` (NEW + test)
- [x] 4.2 TDD `useQuotationDraft.createDraft(customerId?)` — replaces cache head on list (NEW + test)
- [x] 4.3 `QuotationDetailView.vue`: `/nueva` → `createDraft()` → `router.replace(/:id)`; `/:id` → load detail (NEW)
- [x] 4.4 Header: folio, `StatusDotBadge`, customer name, price list label, expiry slot
- [x] 4.5 Mode switch shell: `v-if status === 'DRAFT'` → edit; else → read-only
- [x] 4.6 Resolves lazy views from S1
- **Files**: 4 NEW. **Verify**: `pnpm test:unit` + `pnpm build` + `/nueva` creates draft and redirects.
- **Commit**: `feat(quotations): add detail view with createDraft and status mode switch`

---

## Slice 5 — Item rows + mutations (REQs 005, 006, 013 partial) — ~380 lines

- [x] 5.1 Add `useQuotationDraft` mutations: `addItem`, `updateQuantity`, `removeItem`, `overridePrice` (each `setQueryData` on success) (MOD)
- [x] 5.2 TDD `components/QuotationItemRow.vue` — props (`item`, `readonly`); emits (`update-qty`, `override-price`, `remove`) (NEW + test)
- [x] 5.3 Reuse `ProductSearchPanel` + `VariantPickerModal` from `sales/`; wire callbacks to `addItem` (MOD view)
- [x] 5.4 `✏️ PRECIO MANUAL` `AppBadge` when `item.priceSource === 'CUSTOM'`
- [x] 5.5 Display name/SKU/variant/unit price/line subtotal via `formatCentsMXN` + `lineCents`
- **Files**: 2 NEW + 2 MOD. **Verify**: `pnpm test:unit` + manual add/qty/remove/override on `/pos/cotizaciones/:id`.
- **Commit**: `feat(quotations): add item rows with add, quantity, remove, and price override`

---

## Slice 6 — Promotions + expiry (REQs 007, 008) — ~340 lines

- [x] 6.1 TDD `QuotationExpiryPicker.vue` — emits `update:expiresAt` (ISO|null); "Nunca expira" toggle (NEW + test)
- [x] 6.2 TDD `QuotationTotalsFooter.vue` — props `subtotalCents`, `discountCents`, `totalCents` (NEW)
- [x] 6.3 Add `useQuotationDraft` mutations: `applyManualPromotion`, `removeManualPromotion`, `vetoPromotion`, `unvetoPromotion`, `setExpiry` (MOD)
- [x] 6.4 Applied promotions list with veto/unveto (AUTOMATIC) + opt-in/opt-out (MANUAL) (MOD view)
- **Files**: 2 NEW + 2 MOD + 1 test. **Verify**: `pnpm test:unit` + manual apply/veto/expiry.
- **Commit**: `feat(quotations): add manual promotions, automatic veto, and expiry picker`

---

## Slice 7 — PDF + Send + Cancel (REQs 009, 010, 011) — ~380 lines

- [x] 7.1 TDD `QuotationSendDialog.vue` — validates `items.length > 0` + `customer.email != null`; emits `confirm({email})`; empty email → capture input (NEW + test)
- [x] 7.2 TDD `QuotationCancelDialog.vue` — `CancelReason` selector; emits `confirm({cancelReason})` (NEW + test)
- [x] 7.3 Add `useQuotationDraft.send` + `.cancel` mutations: 422 no-email → capture; 502 → toast + stay DRAFT (MOD)
- [x] 7.4 PDF preview: mirror `SaleDetailView.vue:209-246` — blob → `URL.createObjectURL` → `window.open(_blank)` → anchor fallback → revoke after 1s; AbortController on unmount (MOD view)
- **Files**: 2 NEW + 2 MOD + 2 tests. **Verify**: `pnpm test:unit` + manual preview/send/cancel across statuses.
- **Commit**: `feat(quotations): add PDF preview, send, and cancel flows`

---

## Slice 8 — Stock + read-only + EXPIRED (REQs 012, 013 full) — ~280 lines

- [x] 8.1 TDD `useQuotationItemStock(productId)` — `useQuery`, `staleTime: 60_000`; advisory tone (warning for low/zero) (NEW)
- [x] 8.2 `QuotationItemRow` — render `AppBadge` stock badge (NEVER gates actions) (MOD)
- [x] 8.3 View: `status !== 'DRAFT'` → hide edit controls (qty, override, remove, send, cancel); keep PDF (MOD)
- [x] 8.4 `status === 'CANCELLED'` → show `cancelReason`; `status === 'SENT' && expiresAt < now` → EXPIRED badge (client check)
- [x] 8.5 Permission gates: `canRead` baseline; `canUpdate` gates edit; `canCreate` gates new button
- **Files**: 1 NEW + 2 MOD. **Verify**: `pnpm test:unit` + `pnpm build` + full lifecycle (DRAFT→SENT→EXPIRED via lazy, DRAFT→CANCELLED with reason).
- **Commit**: `feat(quotations): add stock badges, read-only mode, and lazy EXPIRED detection`
