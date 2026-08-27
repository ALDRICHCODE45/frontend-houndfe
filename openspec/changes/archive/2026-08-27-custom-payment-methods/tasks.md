# Tasks — custom-payment-methods (Métodos de cobro)

> Phase: `sdd-tasks` · Store: `openspec` · Change id: `custom-payment-methods`
> Authoritative inputs: `proposal.md` (5-slice boundary — preserved), `design.md`
> (§1 tile identity, §2 contracts, §3 component split, §4 query keys, §5 permissions,
> §8 errors, §10 rollout/slice alignment, §11 risks), the four spec files under
> `specs/`, and `houndfe-backend/docs/payment-methods-frontend.md` (backend contract).
> Strict TDD mode is ACTIVE (`pnpm test:unit --run` is the gate for every slice).

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (additions + deletions) | **~4 500** (across 5 design slices; see per-sub-slice breakdown below) |
| 400-line review budget risk | **High** — single-PR is not within budget without a `size:exception` |
| Chained PRs recommended | **Yes** — `design.md §10` itself notes slices 1–3 and 4–5 are independently verifiable |
| Suggested split (if chained) | **PR 1 = S1 Foundations + S2 Admin Read · PR 2 = S3 Admin Mutations · PR 3 = S4 POS Tiles + S5 Detail/Timeline/Errors** |
| Delivery strategy | **ask-on-risk → chained PRs** — preflight resolved `single-pr`; the honest estimate (~4 460) invalidates it. User approved chained PRs on the Review Workload Guard. |
| Chain strategy | **stacked-to-main** — user-chosen on the Review Workload Guard gate (each PR merges to main in sequence S1→…→S5). |

Honest per-sub-slice estimate (additions only; deletions ≈ 0 because every touched file gets additive changes only):

| Sub-slice | New files | Mod files | Est. add | ≤ 600? |
|-----------|-----------|-----------|---------:|--------|
| S1 | 5 | 4 | ~250 | ✅ |
| S2A (api + composables + specs) | 5 | 0 | ~280 | ✅ |
| S2B (view + route + nav + spec) | 2 | 2 | ~330 | ✅ |
| S3A (form + actions util + specs) | 3 | 0 | ~400 | ✅ |
| S3B (slideover + card grid + view-mod + specs) | 3 | 1 | ~620 | ⚠ tight (split into S3B.1 slideover + S3B.2 card-grid + S3B.3 view-mod if needed) |
| S4A (tile util + sale projection + types + specs) | 4 | 1 | ~520 | ✅ |
| S4B (modal integrations + entry util + view-mod + specs) | 2 | 4 | ~560 | ✅ |
| S5A (charge error map + dispatch + specs) | 2 | 2 | ~360 | ✅ |
| S5B (sale detail + timeline display + specs) | 0 | 2 | ~340 | ✅ |
| **Total** | **24** | **16** | **~4 460** | — |

Guard lines (plain text, as required by the Review Workload Guard):

```text
Decision needed before apply: Yes (RESOLVED — chained PRs)
Chained PRs recommended: Yes (RESOLVED — chained PRs)
Chain strategy: stacked-to-main (RESOLVED — user-chosen)
400-line budget risk: High (mitigated by chaining)
```

**Why `decision_needed: Yes`.** The preflight resolved `delivery_strategy: single-pr`
*conditional* on staying inside the 400-line review budget. The honest estimate
(~4 460 add+del) is ~11× the budget. Single-PR violates the Review Workload Guard
in `openspec/config.yaml` (`slice_budget.max_changed_lines: 600` per slice, and the
400-line PR budget per `Review Workload Forecast` rules). Two paths forward, both
require explicit parent/user confirmation before apply:

1. **`size:exception`** — record the exception in `verify-report.md`, ship as one PR.
   Reviewers MUST be warned in the PR description.
2. **Chained PRs (recommended)** — execute the three-PR split above using
   `stacked-to-main` (each PR merges independently; S4 cannot start until S1 is on
   `main`; S5 cannot start until S4 is on `main`). `feature-branch-chain` is
   equivalent but heavier and unnecessary here because the design slices have no
   cross-slice feature flags to gate.

The apply phase MUST refuse to start until one of the two is chosen and recorded.

---

## Work Units

Each row = one sub-slice with explicit start / finish / verification / rollback.

| # | Goal | Test cmd | Runtime path | Rollback |
|---|------|----------|--------------|----------|
| S1 | Register `PaymentMethod` CASL subject + admin type/label/error files + shared category constant + query keys; pass all pin tests | `pnpm test:unit --run src/features/auth src/core/shared/constants/payment-method-category src/features/admin/payment-methods/interfaces` | compile-only (no UI yet); menu/route still hidden behind CASL because no subject = no permission | revert 6 files (3 NEW, 4 MOD) |
| S2A | Admin read scaffolding: `paymentMethodsApi` + `usePaymentMethodsTable` + `usePaymentMethodColumns` + `usePaymentMethodViewMode` (no view yet) | `pnpm test:unit --run src/features/admin/payment-methods/api src/features/admin/payment-methods/composables` | none yet (only consumed by S2B) | delete 5 NEW files |
| S2B | Admin read view: `AdminPaymentMethodsView` (read-only) + route + nav + view spec | `pnpm test:unit --run src/features/admin/payment-methods/views` + `pnpm build` | navigate to `/admin/payment-methods` with `read:PaymentMethod` → table renders active+inactive | delete 2 NEW + revert 2 MOD (router/nav) |
| S3A | Form state + actions utility + spec | `pnpm test:unit --run src/features/admin/payment-methods/composables/usePaymentMethodForm src/features/admin/payment-methods/utils/payment-method-actions` | none yet (consumed by S3B) | delete 3 NEW files |
| S3B | Slideover (create/edit with `isActive` toggle) + card grid + ConfirmModal integration + view-mod wiring (isActive REVERSAL pinned) + specs | `pnpm test:unit --run src/features/admin/payment-methods/components src/features/admin/payment-methods/views` | open `/admin/payment-methods` → "Crear método" opens slideover; edit prefills + `isActive` toggle; kebab → ConfirmModal → DELETE; row goes Inactiva | revert `views/AdminPaymentMethodsView.vue`; delete 3 NEW files |
| S4A | Tile-identity utility (`paymentMethodTile.utils.ts`) + POS projection composable + `saleApi.getPaymentMethods()` + additive type extensions on `PaymentEntry` / `LegacyChargePayload` / `SaleDetailPayment` / `PAYMENT_RECEIVED` + UUID guard | `pnpm test:unit --run src/features/POS/sales/utils/paymentMethodTile.utils src/features/POS/sales/composables/useSalePaymentMethods src/features/POS/sales/api src/features/POS/sales/interfaces` | compile-time only (no UI consumes yet) | revert 1 MOD (`sale.api.ts`); delete 4 NEW files |
| S4B | `PaymentModal` + `DebtPaymentModal` merged tile grid (tile-keyed toggle/count/entries-list) + `paymentEntries.utils` `paymentMethodId` threading + `SalesView` `catalogClearSignal` wiring + specs | `pnpm test:unit --run src/features/POS/sales/components/__tests__/PaymentModal.test.ts src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts src/features/POS/sales/utils/__tests__/paymentEntries.utils.spec.ts src/features/POS/sales/views/__tests__/SalesView.test.ts` | open charge modal → 4 fixed tiles + N custom tiles render with subtitle sub-line; tap custom tile → entry carries `paymentMethodId`; tap fixed tile → entry omits it; legacy payload byte-identical when only fixed | revert 4 MOD files; delete 2 NEW files |
| S5A | `paymentMethodChargeErrors.utils` (new map + short-circuit resolver) + dispatch wired in `SalesView.handleChargeDraft` and `useDebtPayment.onError` + specs | `pnpm test:unit --run src/features/POS/sales/utils/__tests__/paymentMethodChargeErrors.utils src/features/POS/sales/composables/__tests__/useDebtPayment.test.ts src/features/POS/sales/views/__tests__/SalesView.test.ts` | trigger `PAYMENT_METHOD_CATEGORY_MISMATCH` → entries filtered, no toast; `PAYMENT_METHOD_NOT_FOUND` / `INACTIVE_PAYMENT_METHOD` → entries filtered + projection invalidated + toast; legacy `getSalePaymentErrorAction` path NOT taken when catalog code matches | revert 2 MOD; delete 2 NEW files |
| S5B | `PaymentsListSection` + `SaleDetailTimeline` prefer `paymentMethodName` + render grey `paymentMethodSubtitle` (when present + trimmed); spec assertions for both branches | `pnpm test:unit --run src/features/POS/sales/components/__tests__/PaymentsListSection.spec.ts src/features/POS/sales/components/__tests__/SaleDetailTimeline.test.ts` | open sale detail → row with `paymentMethodName: "Mercado Pago"` shows the snapshot; legacy row falls back to base label silently; timeline `PAYMENT_RECEIVED` parity | revert 2 MOD files |

---

## Dependency Graph (ASCII)

```
                                         ┌──────────────────────┐
                                         │  parent preflight    │
                                         │  (delivery_strategy) │
                                         └──────────┬───────────┘
                                                    │ decision_needed
                                                    ▼
                          ┌─────────────────────────────────────────────────┐
                          │  size:exception  OR  chained PRs (3-PR split)   │
                          └─────────────────────────────────────────────────┘
                                                    │
   ┌────────────────────────────────────────────────┼─────────────────────────────────────────────────┐
   │                                                │                                                 │
   ▼                                                ▼                                                 ▼
 ╔════════════╗                                ╔════════════╗                                       ╔════════════╗
 ║   S1       ║──┐                             ║   S4A      ║──┐                                    ║   S5A      ║
 ║ CASL/Typ   ║  │                             ║ Tile+Types ║  │                                    ║ Charge Err ║
 ╚════╤═══════╝  │                             ╚════╤═══════╝  │                                    ╚════╤═══════╝
      │          │                                  │          │                                         │
      │          ▼                                  │          ▼                                         │
      │    ╔════════════╗                           │     ╔════════════╗                                  │
      │    ║   S2A      ║                           │     ║   S4B      ║                                  │
      │    ║ Admin API  ║                           │     ║ Modal mods ║                                  │
      │    ╚════╤═══════╝                           │     ╚════╤═══════╝                                  │
      │          ▼                                  │          │                                         │
      │    ╔════════════╗                           │          │                                         │
      │    ║   S2B      ║                           │          │                                         │
      │    ║ Admin View ║                           │          │                                         │
      │    ╚════╤═══════╝                           │          │                                         │
      │          ▼                                  │          │                                         │
      │    ╔════════════╗                           │          │                                         │
      │    ║   S3A      ║                           │          │                                         │
      │    ║ Form/Actns ║                           │          │                                         │
      │    ╚════╤═══════╝                           │          │                                         │
      │          ▼                                  │          │                                         │
      │    ╔════════════╗                           │          ▼                                         │
      │    ║   S3B      ║                           │     ╔════════════╗                                  │
      │    ║ Slideover  ║                           │     ║   S5A      ║ ◄─── parallel-ready (POS only) │
      │    ╚════════════╝                           │     ╚════════════╝                                  │
      │                                             │                                                     │
      │                                             │           …and S5B depends on S4A (types) +        │
      │                                             │           S4B (entries.filter signature)…          │
      │                                             │                                                     │
      │                                             └──────────────► S5A ◄──── S5B (sale-detail / timeline)
      │                                                                                                   │
      │                                                                                                   ▼
      └──────────────────────────────────────────────────────────────────────────────► (parallel after S1: S2*, S3*, S4*, S5*)
```

**Parallelism note.** After S1 lands:
- The **admin track** (S2A → S2B → S3A → S3B) and the **POS track** (S4A → S4B → S5A → S5B) are
  *independent*: S2/S3 never touch POS code and S4/S5 never touch admin code.
- Within the POS track, S5A and S5B are also independent (S5A = charge error dispatch;
  S5B = sale detail / timeline display). They share no file edits.
- However, `paymentsListSection.spec.ts` and `saleDetailTimeline.test.ts` in S5B assert
  behaviour that depends on the new fields in `SaleDetailPayment` / `PAYMENT_RECEIVED` that
  ship in S4A. So **S5B depends on S4A**, even though S5B does not depend on S4B (the modal mods).

---

## Implementation Order

Dependency-respecting numbered sequence. Strict-TDD per slice.

1. **S1 — Foundations** (CASL + types + shared category + query keys + error map)
2. **S2A — Admin API + composables** (depends on S1)
3. **S2B — Admin read view + route + nav** (depends on S2A)
4. **S3A — Form + actions utility** (depends on S2A)
5. **S3B — Slideover + card grid + view-mod (isActive REVERSAL pinned)** (depends on S3A and S2B)
6. **S4A — Tile identity util + POS projection composable + type extensions + UUID guard** (depends on S1; can run in parallel with S2* / S3*)
7. **S4B — Modal integrations + entry util + `catalogClearSignal` wiring** (depends on S4A)
8. **S5A — Charge error map + dispatch short-circuit** (depends on S4B — needs the
   `entries.filter(e => e.paymentMethodId)` signature; can run in parallel with S5B)
9. **S5B — Sale detail + timeline display** (depends on S4A — needs the new
   `SaleDetailPayment` / `PAYMENT_RECEIVED` fields; can run in parallel with S5A)

After all 9 sub-slices land: `pnpm build` (type-check + vite build) MUST exit 0.

---

## S1 — Foundations (CASL + types + query keys + error map)

**Strict TDD steps.**

- **RED 1.a.** Write `interfaces/__tests__/payment-method.types.spec.ts` asserting the
  zod schemas:
  - `CreatePaymentMethodSchema` rejects empty / >60-char `name`, accepts exactly the
    4 enum values for `category`, and omits `subtitle` from the inferred TS type when
    unset.
  - `UpdatePaymentMethodSchema` has `isActive: z.boolean().optional()` in the inferred
    type and accepts `{ isActive: false }`.
- **RED 1.b.** Write `interfaces/__tests__/errors.spec.ts` asserting
  `extractPaymentMethodErrorCode(error)` returns the known code when
  `error.response.data.error` matches; returns `null` when only `error.message` is set.
- **RED 1.c.** Write `core/shared/constants/__tests__/payment-method-category.spec.ts`
  asserting `PAYMENT_METHOD_CATEGORY_VALUES` is exactly
  `['cash','card_credit','card_debit','transfer']` (lowercase; **`credit` excluded**).
- **RED 1.d.** Write `auth/authorization/__tests__/ability.test.ts` additions: assert
  `parsePermissionCode('create:PaymentMethod')` returns
  `['create','PaymentMethod']` (the silent-drop regression test).
- Run `pnpm test:unit --run` — at least 4 failures (one per spec).
- **GREEN.** Implement:
  - `src/core/shared/constants/payment-method-category.ts` (NEW)
  - `src/features/admin/payment-methods/interfaces/payment-method.types.ts` (NEW)
  - `src/features/admin/payment-methods/interfaces/errors.ts` (NEW)
  - `src/features/auth/interfaces/auth.types.ts` (MOD — insert `| 'PaymentMethod'`
    immediately **before** `| 'all'` per `auth.types.ts:70`)
  - `src/features/auth/authorization/ability.ts` (MOD — insert `'PaymentMethod'`
    immediately **before** `'all'` per `ability.ts:28`)
  - `src/features/admin/roles/i18n/permissions.ts` (MOD — add
    `PaymentMethod: 'Métodos de cobro'` to `SUBJECT_LABELS` near line 61 and the
    4-action `PERMISSION_COPY` block at end of file per `design.md §5.1`; do NOT add
    to `HIDDEN_SUBJECTS`)
  - `src/core/shared/constants/query-keys.ts` (MOD — add
    `adminPaymentMethodQueryKeys` + `saleQueryKeys.paymentMethods` per `design.md §4.1`)
- **TRIANGULATE.** Add cases for: `subtitle` whitespace-only is omitted (create);
  `subtitle >120 chars` is rejected; `isActive` accepts `true` and `false`; error
  extractor ignores `message` array (string[]) and only matches when `error` is a
  string code; `category: 'credit'` is rejected client-side.
- **REFACTOR.** Tighten the `CategoryFieldSchema` message wording; collapse duplicated
  enum literals if any; ensure `PAYMENT_METHOD_CATEGORY_VALUES` is the single import
  source in both `payment-method.types.ts` and the POS modules that will import it.

**Files (NEW):**
- `src/core/shared/constants/payment-method-category.ts`
- `src/core/shared/constants/__tests__/payment-method-category.spec.ts`
- `src/features/admin/payment-methods/interfaces/payment-method.types.ts`
- `src/features/admin/payment-methods/interfaces/errors.ts`
- `src/features/admin/payment-methods/interfaces/__tests__/payment-method.types.spec.ts`
- `src/features/admin/payment-methods/interfaces/__tests__/errors.spec.ts`

**Files (MOD):**
- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/authorization/ability.ts`
- `src/features/admin/roles/i18n/permissions.ts`
- `src/core/shared/constants/query-keys.ts`
- `src/features/auth/authorization/__tests__/ability.test.ts` (REO-PM-006 cross-check
  scenario: `parsePermissionCode` returns `null` when `'PaymentMethod'` is NOT
  registered; returns the tuple once it IS — this is the silent-drop guard)

**Verify.**
- `pnpm test:unit --run` green for the new spec files and the modified `ability.test.ts`.
- No other slice broken (existing `payment-details` specs stay green — the only cross-
  touch is the `PaymentDetail` line in `auth.types.ts` / `ability.ts` / `permissions.ts`,
  which we do NOT modify).
- `pnpm exec vue-tsc --build` exits 0 (no `AppSubject` regression).

**Commit message.**
```
feat(admin/payment-methods): foundations — CASL subject, query keys, type+error contracts

- Register 'PaymentMethod' in AppSubject union, APP_SUBJECTS, and PERMISSION_COPY
  (4 CRUD actions; no manage/batch_delete). Insertion points verified against
  auth.types.ts:70 and ability.ts:28 (REQ-PM-006 — silent-drop guard).
- Add core/shared/constants/payment-method-category.ts as the single lowercase
  enum + label + icon source shared by admin and POS (4 values, no 'credit').
- Add admin/payment-methods/interfaces/{payment-method.types,errors}.ts with
  CreatePaymentMethodSchema + UpdatePaymentMethodSchema (isActive REVERSAL
  per design §2.2) and PAYMENT_METHOD_ERROR_MAP.
- Add adminPaymentMethodQueryKeys + saleQueryKeys.paymentMethods per design §4.1.
- Pin tests: ability parsePermissionCode, category enum (no 'credit'),
  error extractor reads 'error' field not 'message', create omits isActive,
  update accepts isActive.
```

---

## S2A — Admin API + composables + view-mode

**Strict TDD steps.**

- **RED 2A.a.** Write `api/__tests__/payment-methods.api.spec.ts` asserting:
  - `paymentMethodsApi.list()` calls `http.get('/admin/payment-methods')` (flat array).
  - `paymentMethodsApi.create(payload)` calls `http.post('/admin/payment-methods', payload)`
    with body **never** containing `isActive`, `id`, `tenantId`, `createdAt`,
    `updatedAt`, or `metadataJson` (REQ-PM-002 pin).
  - `paymentMethodsApi.update(id, payload)` calls
    `http.patch('/admin/payment-methods/:id', payload)` and **forwards** `isActive`
    when present (REQ-PM-003 pin) and **never** forwards `tenantId` (REO-PD-NOTE-001
    pin: do NOT copy `filterAllowedKeys` from `payment-details.api.ts`).
  - `paymentMethodsApi.remove(id)` calls `http.delete('/admin/payment-methods/:id')`.
  - Pure helpers `applyLocalPaymentMethodFilters` / `paginatePaymentMethods` shape
    `PaginatedResponse<PaymentMethodTableRow>` like the payment-details analog.
- **RED 2A.b.** Write `composables/__tests__/usePaymentMethodsTable.spec.ts` asserting:
  - `queryKey` is `adminPaymentMethodQueryKeys.list(tenantId.value)`.
  - `defaultSorting` is `[{ id: 'updatedAt', desc: true }]`.
  - `defaultPinning` pins `actions` to the right.
  - `persistKey` is `'admin-payment-methods'`.
  - The wrapper exposes `fullList` (the whole flat array) and a `data` slice.
- **RED 2A.c.** Write `composables/__tests__/usePaymentMethodColumns.test.ts` asserting
  the column set: `name`, `category` (label-mapped), `subtitle`, `isActive`, `updatedAt`,
  `actions`; `isActive` and `actions` use `createSimpleHeader` (non-sortable).
- **RED 2A.d.** Write `composables/__tests__/usePaymentMethodViewMode.test.ts` asserting
  the wrapper exposes `displayMode` / `setMode` and persists via `useViewMode` with
  key `'admin-payment-methods'`.
- Run `pnpm test:unit --run` — at least 4 failures.
- **GREEN.** Implement the 4 files (api + 3 composables).
- **TRIANGULATE.** Add cases for: search matches `name` only (not `subtitle` per
  exploration §9.9); local sort on `category` uses the lowercase wire value as the
  sort key; `paginatePaymentMethods` returns `pageCount: 1` for empty arrays (no
  divide-by-zero); `update()` payload retains `isActive: undefined` semantics
  (assert the key is absent from the wire object passed to `http.patch`).
- **REFACTOR.** Extract the lowercase→label map for `category` so the columns
  composable and the slideover can share it.

**Files (NEW):**
- `src/features/admin/payment-methods/api/payment-methods.api.ts`
- `src/features/admin/payment-methods/api/__tests__/payment-methods.api.spec.ts`
- `src/features/admin/payment-methods/composables/usePaymentMethodsTable.ts`
- `src/features/admin/payment-methods/composables/usePaymentMethodColumns.ts`
- `src/features/admin/payment-methods/composables/usePaymentMethodViewMode.ts`
- `src/features/admin/payment-methods/composables/__tests__/usePaymentMethodsTable.spec.ts`
- `src/features/admin/payment-methods/composables/__tests__/usePaymentMethodColumns.test.ts`
- `src/features/admin/payment-methods/composables/__tests__/usePaymentMethodViewMode.test.ts`

**Files (MOD):** none.

**Verify.**
- `pnpm test:unit --run` green for the 4 new spec files.
- Pin: `payment-methods.api.spec.ts` asserts `isActive` IS forwarded on update and
  `tenantId` is NEVER forwarded (REO-PD-NOTE-001).

**Commit message.**
```
feat(admin/payment-methods): S2A — API + single-source table wrapper + columns + view-mode

- paymentMethodsApi: list/getById/create/update/remove mirroring the backend
  /admin/payment-methods contract. update() forwards isActive (reactivate,
  REQ-PM-003) and never forwards tenantId (REQ-PM-002 + REO-PD-NOTE-001).
- usePaymentMethodsTable: single-source wrapper over useServerTable that keeps
  fullList; queryKey adminPaymentMethodQueryKeys.list(tenantId); default sort
  updatedAt DESC; persistKey admin-payment-methods.
- usePaymentMethodColumns: name, category (label-mapped), subtitle, isActive,
  updatedAt, actions; isActive + actions via createSimpleHeader.
- usePaymentMethodViewMode: thin wrapper around useViewMode('admin-payment-methods').
- applyLocalPaymentMethodFilters + paginatePaymentMethods: pure helpers, name-only
  search, single-column local sort.
- Pin tests pin the isActive reversal (design §2.2, REO-PD-NOTE-001) — the
  filterAllowedKeys strip from payment-details.api.ts is NOT generalized here.
```

---

## S2B — Admin read view + route + nav

**Strict TDD steps.**

- **RED 2B.a.** Write `views/__tests__/AdminPaymentMethodsView.spec.ts` asserting:
  - When `usePaymentMethodsTable` resolves with 3 rows (2 active, 1 inactive) the
    table renders all 3; active rows show "Activo" badge, inactive shows "Inactivo"
    (REQ-PM-001).
  - The default order is `updatedAt DESC` (REQ-PM-001 backend-order preserved).
  - The view emits no "no active methods" banner when all rows are inactive
    (REQ-PM-001 — banner is intentionally absent).
  - The table/cards toggle persists via `useViewMode` (REQ-PM-001 cards/table).
  - No `create` button is rendered when `userCan('create','PaymentMethod')` is false
    (REQ-PM-006).
  - List-fetch error renders the error block (NOT a toast) (REQ-PM-011).
  - Background refetch shows a soft `:fetching` indicator (REQ-PM-011).
- **RED 2B.b.** Assert the route registration in `router/index.ts` carries
  `meta.permission: ['read','PaymentMethod']` (REQ-PM-006).
- **RED 2B.c.** Assert the `navigation.registry.ts` entry has the
  `'Métodos de cobro'` label and `permission: ['read','PaymentMethod']`.
- Run `pnpm test:unit --run` — at least 3 failures (view spec, plus the cross-checks).
- **GREEN.** Implement:
  - `src/features/admin/payment-methods/views/AdminPaymentMethodsView.vue` (read-only,
    no slideover yet — S3B adds it)
  - `src/app/router/index.ts` (MOD — add `/admin/payment-methods` route next to
    `/admin/payment-details` per `exploration.md §5.1`)
  - `src/app/navigation/navigation.registry.ts` (MOD — add the sidebar entry per
    `exploration.md §5.2`)
- **TRIANGULATE.** Add cases for: empty list shows the "No hay métodos de cobro"
  empty state (REQ-PM-011); the loading skeleton has 8 card skeletons (REQ-PM-011);
  the kebab menu is hidden entirely when the user has neither `update:PaymentMethod`
  nor `delete:PaymentMethod` (REQ-PM-005).
- **REFACTOR.** Extract the table-error block markup so the mutation-bearing S3B
  view-mod can reuse it without duplication.

**Files (NEW):**
- `src/features/admin/payment-methods/views/AdminPaymentMethodsView.vue`
- `src/features/admin/payment-methods/views/__tests__/AdminPaymentMethodsView.spec.ts`

**Files (MOD):**
- `src/app/router/index.ts`
- `src/app/navigation/navigation.registry.ts`

**Verify.**
- `pnpm test:unit --run src/features/admin/payment-methods/views` green.
- `pnpm build` (type-check) green — the view must type-check against the
  `AdminPaymentMethodsView` props shape.

**Commit message.**
```
feat(admin/payment-methods): S2B — read-only view + route + sidebar entry

- AdminPaymentMethodsView.vue: read-only table/cards surface, Activo/Inactivo
  badges (REQ-PM-001), empty/loading/error states (REQ-PM-011), no "no active
  methods" banner (REQ-PM-001 explicit absence).
- router/index.ts: /admin/payment-methods gated by ['read','PaymentMethod']
  (REQ-PM-006).
- navigation.registry.ts: sidebar entry 'Métodos de cobro' with the same gating.
- CASL gate assertions in the view spec cover read/create/update/delete (REQ-PM-006).
```

---

## S3A — Form state + actions utility

**Strict TDD steps.**

- **RED 3A.a.** Write `composables/__tests__/usePaymentMethodForm.spec.ts` asserting:
  - `schema` switches by `mode: 'create' | 'edit'` and the edit schema allows
    `isActive: boolean` (REQ-PM-003).
  - `createState` / `editState` are independent; `setValues(row)` prefills edit
    fields from a `PaymentMethodResponse` row, including `isActive`.
  - `resetForm()` clears both states.
  - `setCreateField` / `setEditField` per-field setters used by the slideover work.
- **RED 3A.b.** Write `utils/__tests__/payment-method-actions.utils.spec.ts` asserting:
  - `buildPaymentMethodDeactivateDescription(row)` returns Spanish copy that mentions
    the method name and "ya no aparecerá al cobrar" (REQ-PM-004).
  - `buildPaymentMethodRowActions({ row, canUpdate, canDelete })` returns the kebab
    items with the correct CASL gating (REQ-PM-005). When `canUpdate: false` AND
    `canDelete: false` the array is empty (the kebab is then hidden entirely).
- Run `pnpm test:unit --run` — at least 2 failures.
- **GREEN.** Implement the 2 NEW files.
- **TRIANGULATE.** Add cases for: `setValues` filters out `id` / `tenantId` /
  `createdAt` / `updatedAt` / `metadataJson` (so the slideover cannot leak them
  back to the form); the edit payload includes `isActive` so the slideover toggle
  works (REQ-PM-003); the kebab never returns a "Reactivar" entry (REQ-PM-005 —
  reactivation happens via the edit slideover, not the kebab); the kebab never
  returns a "Eliminar definitivamente" / hard-delete entry (REQ-PM-005).
- **REFACTOR.** Factor `paymentMethodCategoryLabel(value)` so both this slice and
  the slideover share the lowercase→Spanish label map.

**Files (NEW):**
- `src/features/admin/payment-methods/composables/usePaymentMethodForm.ts`
- `src/features/admin/payment-methods/utils/payment-method-actions.utils.ts`
- `src/features/admin/payment-methods/composables/__tests__/usePaymentMethodForm.spec.ts`
- `src/features/admin/payment-methods/utils/__tests__/payment-method-actions.utils.spec.ts`

**Files (MOD):** none.

**Verify.**
- `pnpm test:unit --run` green for the 2 new spec files.
- Pin: edit payload passes `isActive` (REQ-PM-003 reversal).

**Commit message.**
```
feat(admin/payment-methods): S3A — form state composable + row actions utility

- usePaymentMethodForm: createState + editState, schema by mode, setValues
  prefiltering derived keys (id/tenantId/createdAt/updatedAt/metadataJson),
  edit schema includes isActive (REQ-PM-003 REVERSAL pin).
- payment-method-actions.utils: buildPaymentMethodDeactivateDescription (REQ-PM-004),
  buildPaymentMethodRowActions with CASL gating; no "Reactivar" kebab entry
  (reactivate lives in the edit slideover, REQ-PM-005); no hard-delete entry.
- Pin tests assert the REVERSAL — setValues forwards isActive and the kebab never
  offers Reactivar as a separate action.
```

---

## S3B — Slideover + card grid + view-mod (isActive REVERSAL pinned end-to-end)

**Strict TDD steps.**

- **RED 3B.a.** Write `components/__tests__/PaymentMethodUpsertSlideover.spec.ts`
  asserting:
  - In `mode: 'create'`, submitting a valid form emits a `create` payload that
    contains exactly `name`, `category`, optional `subtitle` — never `isActive`,
    `id`, `tenantId`, `createdAt`, `updatedAt`, `metadataJson` (REQ-PM-002).
  - In `mode: 'edit'`, prefilling a row binds `name`, `category`, `subtitle`,
    `isActive` (REQ-PM-003). Changing only `subtitle` emits an `edit` payload with
    `{ subtitle }` only (partial PATCH, REQ-PM-003).
  - Toggling `isActive` from `true` to `false` (or vice versa) and submitting emits
    an `edit` payload with `isActive: false` (or `true`) — pinning the REVERSAL
    (REQ-PM-003 + design §2.2 / §11).
  - Field-level validation: `name` empty / >60 chars blocks submit; `category` not in
    the 4 enum values blocks submit (REQ-PM-002 + REQ-PM-008).
  - `subtitle` whitespace-only is omitted from the emit (REQ-PM-009); `subtitle`
    >120 chars blocks submit.
  - When `props.open` flips to `false`, the form resets (no stale fields on reopen).
- **RED 3B.b.** Write `components/__tests__/PaymentMethodCardGrid.spec.ts` asserting:
  - The grid renders one card per row with the Activo/Inactivo badge.
  - Card click emits `card-click` with the row id.
  - The 8-skeleton loading state renders when `loading: true` (REQ-PM-011).
- **RED 3B.c.** Extend `views/__tests__/AdminPaymentMethodsView.spec.ts` to assert:
  - "Crear" button visible only with `create:PaymentMethod` (REQ-PM-006).
  - Kebab visible only when user has update or delete; "Editar" visible only with
    `update:PaymentMethod`; "Desactivar" visible only with `delete:PaymentMethod`
    (REQ-PM-005).
  - Submitting the slideover emits `create` / `edit`; the view invokes the matching
    mutation and invalidates `adminPaymentMethodQueryKeys.list(tenantId)`
    (REQ-PM-010).
  - "Desactivar" opens `ConfirmModal`; confirming it calls DELETE and re-fetches the
    list (REQ-PM-004). Repeat-delete on an already-inactive row is a no-op success
    (REQ-PM-004 idempotency).
  - `409 DUPLICATE_NAME` shows the toast "Ya existe un método con ese nombre en
    esta sucursal" and keeps the slideover open (REQ-PM-007).
  - `404 ENTITY_NOT_FOUND` shows "No encontrado" without distinguishing missing
    vs another tenant (REQ-PM-007).
  - Server-fallback validation `400 NAME_TOO_LONG` shows the same field toast as
    client-side validation (REQ-PM-007).
  - Admin mutations do NOT invalidate `saleQueryKeys.paymentMethods` (REQ-PM-010).
- **GREEN.** Implement:
  - `src/features/admin/payment-methods/components/PaymentMethodUpsertSlideover.vue`
  - `src/features/admin/payment-methods/components/PaymentMethodCardGrid.vue`
  - MOD `src/features/admin/payment-methods/views/AdminPaymentMethodsView.vue` —
    wire `useMutation` for create/update/remove, ConfirmModal, error toast dispatch,
    and `invalidateQueries({ queryKey: adminPaymentMethodQueryKeys.list(tenantId.value) })`
    on each mutation success. Resolve `tenantId.value` via `useSafeTenantId`.
- **TRIANGULATE.** Add cases for: when the edit slideover closes without submit,
  `editState` is cleared; when the create slideover re-opens after a `DUPLICATE_NAME`
  rejection, the field values are preserved (so the cashier can rename);
  `normalizeSubtitle(undefined)` and `normalizeSubtitle('   ')` both return `undefined`;
  `paymentMethodStatusLabel(isActive)` is the single source for the badge label.
- **REFACTOR.** Tighten the slideover's emit signatures so the view's `create` /
  `edit` handlers receive strongly-typed payloads (`CreatePaymentMethodRequest` /
  `UpdatePaymentMethodRequest`). Extract the error dispatcher into the view's
  `resolveMutationError(err, fallback)` so the DUPLICATE_NAME / ENTITY_NOT_FOUND
  cases are co-located.

**Files (NEW):**
- `src/features/admin/payment-methods/components/PaymentMethodUpsertSlideover.vue`
- `src/features/admin/payment-methods/components/PaymentMethodCardGrid.vue`
- `src/features/admin/payment-methods/components/__tests__/PaymentMethodUpsertSlideover.spec.ts`
- `src/features/admin/payment-methods/components/__tests__/PaymentMethodCardGrid.spec.ts`

**Files (MOD):**
- `src/features/admin/payment-methods/views/AdminPaymentMethodsView.vue` (mutation
  wiring, ConfirmModal integration, error dispatch)
- `src/features/admin/payment-methods/views/__tests__/AdminPaymentMethodsView.spec.ts`
  (extend for mutation lifecycle + CASL gate assertions)

**Verify.**
- `pnpm test:unit --run src/features/admin/payment-methods` green for all 5 spec
  files of the admin module.
- Pin: edit PATCH payload forwarded via `paymentMethodsApi.update()` carries
  `isActive` (REQ-PM-003 REVERSAL); `tenantId` is never forwarded (REQ-PM-002 +
  REO-PD-NOTE-001); admin mutations do NOT invalidate
  `saleQueryKeys.paymentMethods(tenantId)` (REQ-PM-010).

**Commit message.**
```
feat(admin/payment-methods): S3B — slideover (create/edit + isActive reactivate) + card grid + view-mod

- PaymentMethodUpsertSlideover: create + edit + REVERSAL isActive toggle
  (REQ-PM-003 pin via payment-method.types.ts); category select with exactly
  4 options, no 'credit' (REQ-PM-008); subtitle whitespace-omitted (REQ-PM-009);
  per-field validation with the same copy as PAYMENT_METHOD_ERROR_MAP.
- PaymentMethodCardGrid: presentational, 8-skeleton loading, empty/error/no-banner
  states.
- AdminPaymentMethodsView: inline useMutation for create/update/remove,
  ConfirmModal for delete, resolveMutationError dispatch with DUPLICATE_NAME
  staying open (REQ-PM-007) and ENTITY_NOT_FOUND neutral copy, list-key
  invalidation on every mutation (REQ-PM-010). NO invalidation of
  saleQueryKeys.paymentMethods (REQ-PM-010 cross-check).
- Pin: edit PATCH carries isActive; create does NOT. tenantId never forwarded.
  Repeat-delete on inactive is no-op success.
```

---

## S4A — Tile identity util + POS projection composable + type extensions

**Strict TDD steps.**

- **RED 4A.a.** Write `utils/__tests__/paymentMethodTile.utils.spec.ts` (design §1.2
  + REO-PT-001) asserting:
  - `paymentMethodTileKey(fixedTile)` returns `'cash'` (the base method) when
    `paymentMethodId === undefined`; returns the UUID when defined.
  - `paymentMethodTileKey(customTile)` returns the UUID (NOT the base category).
  - `entryMatchesTile(customEntry, fixedTile)` returns `false` when
    `customEntry.paymentMethodId !== undefined` — the fixed-matcher guard pin
    (design §11 / REO-PT-001).
  - `entryMatchesTile(fixedEntry, fixedTile)` returns `true` when
    `fixedEntry.paymentMethodId === undefined` and `fixedEntry.method === fixedTile.value`.
  - `findEntryIndex` / `getMethodCount` / `findTileForEntry` all use the matcher so
    two customs of the same `category` get distinct keys and never collide
    (REO-PT-001).
  - `buildMergedMethodOptions(projection)` returns `[...FIXED_METHOD_OPTIONS,
    ...customs]` in that order; customs with non-UUID `id` are dropped by
    `isUuidString` (REO-PT-003 UUID guard).
  - `resolveEntryDisplay(entry, tiles)` returns `{ label: entry.paymentMethodName ?? baseLabel, subtitle: trimmed-or-null }`.
- **RED 4A.b.** Write `composables/__tests__/useSalePaymentMethods.spec.ts` asserting:
  - One `GET /sales/payment-methods` fires per call; queryKey is
    `saleQueryKeys.paymentMethods(tenantId)`.
  - `staleTime: 5 * 60_000`, `refetchOnWindowFocus: false`.
- **RED 4A.c.** Extend `interfaces/__tests__/sale.types.test.ts` (or add a focused
  spec) asserting the new optional fields type-check:
  - `PaymentEntry` accepts `{ method, amountCents, paymentMethodId }` (REO-CAT-001).
  - `LegacyChargePayload` accepts `paymentMethodId?` (REO-CAT-002).
  - `SaleDetailPayment` accepts the three optional catalog fields (REO-CAT-003).
  - `PAYMENT_RECEIVED` accepts the same three (REO-CAT-004).
- **RED 4A.d.** Write `api/__tests__/sale.api.test.ts` additions: assert
  `saleApi.getPaymentMethods()` calls `http.get('/sales/payment-methods')` (no
  query params).
- Run `pnpm test:unit --run` — at least 4 failures.
- **GREEN.** Implement:
  - `src/features/POS/sales/utils/paymentMethodTile.utils.ts` (NEW) — the tile
    identity contract per `design.md §1.2`. Imports the shared
    `PAYMENT_METHOD_CATEGORY_ICONS` from `core/shared/constants/payment-method-category`.
  - `src/features/POS/sales/composables/useSalePaymentMethods.ts` (NEW) —
    `useQuery` over `saleApi.getPaymentMethods()`, gated only by `useSafeTenantId`
    (NOT by CASL `read:PaymentMethod`).
  - `src/features/POS/sales/api/sale.api.ts` (MOD) — add
    `getPaymentMethods(): Promise<ActivePaymentMethodProjection[]>`.
  - `src/features/POS/sales/interfaces/sale.types.ts` (MOD) — add
    `ActivePaymentMethodProjection`; add `paymentMethodId?` to `PaymentEntry` and
    `LegacyChargePayload`; add `paymentMethodId?` / `paymentMethodName?` /
    `paymentMethodSubtitle?` to `SaleDetailPayment` and the `PAYMENT_RECEIVED`
    timeline member.
- **TRIANGULATE.** Add cases for: `isUuidString` accepts canonical UUID v4, rejects
  empty string, rejects `not-a-uuid`, rejects UUIDs with the wrong version digit;
  the legacy payload hash when only a fixed entry is present matches the pre-change
  shape byte-for-byte (no `paymentMethodId` key); the `PAYMENT_RECEIVED` legacy row
  (no catalog fields) still type-checks (REO-CAT-004); `useSalePaymentMethods`
  does NOT throw when the query is disabled (the composable returns
  `enabled: computed(() => tenantId.value !== null)` so a tenantless auth state
  doesn't crash).
- **REFACTOR.** Tighten the `ActivePaymentMethodProjection` type so admin's
  `PaymentMethodResponse` is NOT assignable to it (missing `tenantId` / `isActive`
  / timestamps / `metadataJson`); use a `type X = Omit<PaymentMethodResponse, ...>`
  if it helps, or keep them as two parallel interfaces with a single-source constant
  for the category enum.

**Files (NEW):**
- `src/features/POS/sales/utils/paymentMethodTile.utils.ts`
- `src/features/POS/sales/utils/__tests__/paymentMethodTile.utils.spec.ts`
- `src/features/POS/sales/composables/useSalePaymentMethods.ts`
- `src/features/POS/sales/composables/__tests__/useSalePaymentMethods.spec.ts`

**Files (MOD):**
- `src/features/POS/sales/api/sale.api.ts`
- `src/features/POS/sales/api/__tests__/sale.api.test.ts` (extend)
- `src/features/POS/sales/interfaces/sale.types.ts`
- `src/features/POS/sales/interfaces/__tests__/sale.types.test.ts` (extend)

**Verify.**
- `pnpm test:unit --run src/features/POS/sales/utils/__tests__/paymentMethodTile.utils.spec.ts src/features/POS/sales/composables/__tests__/useSalePaymentMethods.spec.ts` green.
- Pin tests:
  - `paymentMethodTile.utils.spec.ts` — fixed-matcher requires
    `paymentMethodId === undefined` (design §11 / REO-PT-001).
  - `sale.api.test.ts` — `getPaymentMethods` URL exactly `/sales/payment-methods`.

**Commit message.**
```
feat(pos/payment-method-tiles): S4A — tile identity utility + POS projection + additive types

- paymentMethodTile.utils.ts: single source for tile keying
  (paymentMethodId ?? method) per design §1.2. entryMatchesTile fixed branch
  requires paymentMethodId === undefined (design §11 guard pin). Two customs
  of the same category get distinct keys. buildMergedMethodOptions drops
  non-UUID ids (defense in depth per REO-PT-003 / REO-CAT-010).
- useSalePaymentMethods: useQuery over GET /sales/payment-methods. NOT gated by
  CASL (read:Sale is sufficient — REO-PT-008). staleTime 5m, no window-focus
  refetch. Tenant-scoped via useSafeTenantId.
- sale.api.ts: getPaymentMethods() returning ActivePaymentMethodProjection[].
- sale.types.ts: PaymentEntry.paymentMethodId? (REO-CAT-001),
  LegacyChargePayload.paymentMethodId? (REO-CAT-002),
  SaleDetailPayment + PAYMENT_RECEIVED gain the 3 optional catalog fields
  (REO-CAT-003 / REO-CAT-004). Fixed entries keep legacy byte-identical shape.
- Pin tests pin the fixed-matcher guard and the UUID drop in buildMergedMethodOptions.
```

---

## S4B — Modal integrations + entry util + `catalogClearSignal` wiring

**Strict TDD steps.**

- **RED 4B.a.** Extend `components/__tests__/PaymentModal.test.ts` asserting:
  - `methodOptions` is now `buildMergedMethodOptions(projection)` — 4 fixed tiles
    followed by N custom tiles in the order returned by the projection
    (REO-PT-004).
  - Grid `:key` is `paymentMethodTileKey(option)` (design §1.4).
  - Toggling a custom tile creates an entry with
    `{ method: tile.value, amountCents, paymentMethodId: tile.paymentMethodId }`
    (REO-PT-001 / REO-CAT-001); toggling a fixed tile creates an entry WITHOUT
    `paymentMethodId` (legacy byte-identical).
  - `getMethodCount(entries, customTile)` uses the UUID (REO-PT-004).
  - `normalizeEntries()` propagates `paymentMethodId` to the
    `PaymentEntry[]` output.
  - `buildPayload()` flattens a single-entry custom charge into
    `{ method, amountCents, paymentMethodId }` (REO-CAT-002); flattens a fixed
    charge into `{ method, amountCents }` (no `paymentMethodId`).
  - Tile testid for a fixed tile stays `payment-method-tile-${option.value}`; for a
    custom tile it becomes `payment-method-tile-custom-${option.paymentMethodId}`
    (design §1.4).
  - Custom tile with `subtitle: "Link"` renders the grey sub-line; with
    `subtitle: null` or whitespace-only it does not (REO-PT-007).
  - Empty projection `[]` renders exactly 4 fixed tiles with no warning
    (REO-PT-005). Projection fetch failure renders 4 fixed tiles with no toast /
    no blocking error (REO-PT-006).
  - When the parent increments the `catalogClearSignal` prop, every entry with a
    `paymentMethodId` is removed from `entries` and fixed entries are preserved
    (REO-CAT-007).
- **RED 4B.b.** Extend `components/__tests__/DebtPaymentModal.test.ts` mirroring
  the assertions above for the debt surface:
  - `handleMethodToggle` (debt) uses the tile matcher.
  - `normalizedPayments` carries `paymentMethodId` for customs and omits it for
    fixed.
  - When `useDebtPayment`'s `catalogClearSignal` increments, custom entries are
    filtered and fixed entries preserved.
- **RED 4B.c.** Extend `utils/__tests__/paymentEntries.utils.spec.ts` asserting
  `createEntry(method, remainingCents, paymentMethodId?)` and
  `addEntry(entries, method, debtCents, paymentMethodId?)` thread the id (entry
  carries `paymentMethodId` only when provided).
- **RED 4B.d.** Extend `views/__tests__/SalesView.test.ts` asserting:
  - `SalesView` passes `catalogClearSignal` as a prop to `PaymentModal` and
    initially starts at `0`.
- Run `pnpm test:unit --run` — at least 4 failures (one per touched spec).
- **GREEN.** Implement:
  - MOD `src/features/POS/sales/components/PaymentModal.vue` — replace the local
    `methodOptions` array with `buildMergedMethodOptions(projection)` driven by
    `useSalePaymentMethods()`. Replace `toggleMethod(method)` with
    `toggleMethod(tile)` using the matcher. Replace `getMethodCount(method)` with
    `getMethodCount(entries, tile)`. Update the entries-list `:key`,
    testids, and labels per `design.md §1.4`. Thread `paymentMethodId` through
    `PaymentEntryForm`, `normalizeEntries()`, and `buildPayload()`. Watch the new
    `catalogClearSignal: number` prop and filter entries on increment.
  - MOD `src/features/POS/sales/components/DebtPaymentModal.vue` — same surface
    changes. Watch `useDebtPayment`'s returned `catalogClearSignal` ref.
  - MOD `src/features/POS/sales/utils/paymentEntries.utils.ts` — extend
    `createEntry` / `addEntry` signatures with optional `paymentMethodId`.
  - MOD `src/features/POS/sales/views/SalesView.vue` — pass
    `catalogClearSignal: Ref<number>` to `PaymentModal`. (The increment-on-error
    side of the wire lives in S5A.)
- **TRIANGULATE.** Add cases for: empty-projection rendering keeps the legacy
  `payment-method-tile-cash` testid exactly (no testid drift); a failed
  projection fetch shows no toast and no `<UAlert>`; the entries list `:key` for
  a custom entry is its UUID (not its index — design §1.4); idempotency-key
  regeneration still triggers on any entry mutation (the existing `entries`
  deep watcher covers this without change).
- **REFACTOR.** Extract the tile-badge count into a single `getMethodCount` so
  both modals import the same util rather than re-deriving it. Confirm
  `PaymentEntryForm` stays an internal-only type — the wire type is `PaymentEntry`.

**Files (NEW):** none.

**Files (MOD):**
- `src/features/POS/sales/components/PaymentModal.vue`
- `src/features/POS/sales/components/__tests__/PaymentModal.test.ts` (extend)
- `src/features/POS/sales/components/DebtPaymentModal.vue`
- `src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts` (extend)
- `src/features/POS/sales/utils/paymentEntries.utils.ts`
- `src/features/POS/sales/utils/__tests__/paymentEntries.utils.spec.ts` (extend)
- `src/features/POS/sales/views/SalesView.vue` (catalogClearSignal prop pass-through)
- `src/features/POS/sales/views/__tests__/SalesView.test.ts` (extend)

**Verify.**
- `pnpm test:unit --run src/features/POS/sales/components/__tests__/PaymentModal.test.ts src/features/POS/sales/components/__tests__/DebtPaymentModal.test.ts src/features/POS/sales/utils/__tests__/paymentEntries.utils.spec.ts src/features/POS/sales/views/__tests__/SalesView.test.ts` green.
- Pin: fixed-tile entry has no `paymentMethodId` key (REO-CAT-001); single-entry
  custom charge flattens to `{ method, amountCents, paymentMethodId }`
  (REO-CAT-002); fixed-matcher guard stays in place (REO-PT-001).

**Commit message.**
```
feat(pos/payment-method-tiles): S4B — PaymentModal + DebtPaymentModal merged tiles + entry util + catalogClearSignal

- PaymentModal: methodOptions = buildMergedMethodOptions(projection);
  toggleMethod(tile) using the matcher; grid :key/testid per design §1.4;
  PaymentEntryForm + normalizeEntries + buildPayload thread paymentMethodId.
  Watches catalogClearSignal prop — filters entries with paymentMethodId,
  preserves fixed entries (REO-CAT-007).
- DebtPaymentModal: same surface changes for the debt path; preserves
  paymentMethodId in normalizedPayments (REO-CAT-001 / REO-CAT-002).
- paymentEntries.utils: createEntry + addEntry accept optional paymentMethodId.
- SalesView: passes catalogClearSignal: Ref<number> to PaymentModal. Increment
  side (in the error path) lands in S5A.
- Empty / failing projection: only the 4 fixed tiles render, no warning, no
  toast (REO-PT-005 / REO-PT-006). Legacy payload hash byte-identical when no
  custom tile is selected.
```

---

## S5A — Charge error map + dispatch short-circuit

**Strict TDD steps.**

- **RED 5A.a.** Write `utils/__tests__/paymentMethodChargeErrors.utils.spec.ts`
  asserting:
  - `getPaymentMethodChargeErrorAction('PAYMENT_METHOD_CATEGORY_MISMATCH')` returns
    `{ clearCatalogSelection: true, refetchSelector: false, toast: undefined }`.
  - `getPaymentMethodChargeErrorAction('PAYMENT_METHOD_NOT_FOUND')` returns
    `{ clearCatalogSelection: true, refetchSelector: true, toast: 'Método de cobro no disponible.' }`.
  - `getPaymentMethodChargeErrorAction('INACTIVE_PAYMENT_METHOD')` returns
    `{ clearCatalogSelection: true, refetchSelector: true, toast: 'Este método fue desactivado.' }`.
  - `getPaymentMethodChargeErrorAction('INVALID_PAYMENT_METHOD_ID')` returns
    `{ clearCatalogSelection: false, refetchSelector: false, toast: 'Método de cobro inválido.' }`.
  - `getPaymentMethodChargeErrorAction('PAYMENT_AMOUNT_INSUFFICIENT')` (a legacy
    code) returns `null` so the legacy `getSalePaymentErrorAction` dispatch runs
    (REO-CAT-011).
- **RED 5B.a.** Extend `composables/__tests__/useDebtPayment.test.ts` asserting:
  - When the mutation returns `error: 'PAYMENT_METHOD_CATEGORY_MISMATCH'`,
    `useDebtPayment.onError` calls `getPaymentMethodChargeErrorAction` FIRST,
    increments `catalogClearSignal`, filters `normalizedPayments` to remove custom
    entries, surfaces NO toast, and does NOT invoke
    `getSalePaymentErrorAction` (REO-CAT-007 / REO-CAT-011 short-circuit).
  - When the mutation returns `error: 'PAYMENT_METHOD_NOT_FOUND'`, the projection
    key is invalidated AND `catalogClearSignal` increments AND the toast
    "Método de cobro no disponible." is shown (REO-CAT-008).
  - When the mutation returns `error: 'INACTIVE_PAYMENT_METHOD'`, the same plus
    toast "Este método fue desactivado." (REO-CAT-009).
  - When the mutation returns `error: 'PAYMENT_AMOUNT_INSUFFICIENT'` (legacy code),
    the legacy `getSalePaymentErrorAction` path runs unchanged (REO-CAT-011).
  - When the mutation returns `error: 'INVALID_PAYMENT_METHOD_ID'`, only the
    defensive toast "Método de cobro inválido." is shown — no clearing, no
    invalidation (REO-CAT-010).
- **RED 5A.c.** Extend `views/__tests__/SalesView.test.ts` asserting the same
  dispatch behavior in `SalesView.handleChargeDraft` (charge flow mirror of the
  debt dispatch).
- Run `pnpm test:unit --run` — at least 3 failures.
- **GREEN.** Implement:
  - `src/features/POS/sales/utils/paymentMethodChargeErrors.utils.ts` (NEW) —
    `PaymentMethodChargeErrorCode` union + `PAYMENT_METHOD_CHARGE_ERROR_MAP` +
    `getPaymentMethodChargeErrorAction(code)` per `design.md §8.2`. ISOLATED from
    `salePaymentErrors.utils.ts` (proposal risk #7).
  - MOD `src/features/POS/sales/composables/useDebtPayment.ts` — export a new
    `catalogClearSignal: Ref<number>` (incremented in the catalog-error branch).
    Reorder `onError`: call `getPaymentMethodChargeErrorAction(code)` FIRST; on
    non-null, dispatch (clear + refetch + toast) and RETURN (skip the legacy
    `getSalePaymentErrorAction` call). Wire `invalidateQueries({ queryKey:
    saleQueryKeys.paymentMethods(tenantId.value) })` when `refetchSelector: true`.
  - MOD `src/features/POS/sales/views/SalesView.vue` — same dispatch in
    `handleChargeDraft`. Pass the `catalogClearSignal` ref to `PaymentModal` (the
    surface wire already lives in S4B; S5A only owns the increment).
- **TRIANGULATE.** Add cases for: when `getPaymentMethodChargeErrorAction(code)`
  returns `null` and the legacy path's `getSalePaymentErrorAction` throws, the
  error toast still surfaces (`normalizeApiError` fallback); the
  `catalogClearSignal` increment uses `ref(0).value++` (not `ref.value = ...`
  reassignment) so the modal's `watch` fires; the projection key invalidation
  uses `tenantId.value` at error time (not at submission time) so a tenant
  switch during the in-flight charge does not invalidate the wrong slot.
- **REFACTOR.** Extract the `applyCatalogChargeErrorAction(error, context)` helper
  so both `SalesView.handleChargeDraft` and `useDebtPayment.onError` share the
  filter+increment+refetch+toast pipeline. The helper accepts the typed
  `AxiosError<DomainErrorResponse>` plus `{ queryClient, tenantId, queryKey,
  toast, catalogClearSignal, normalizeCustomEntries }` and returns
  `{ handled: true } | { handled: false }` so callers know whether to fall
  through.

**Files (NEW):**
- `src/features/POS/sales/utils/paymentMethodChargeErrors.utils.ts`
- `src/features/POS/sales/utils/__tests__/paymentMethodChargeErrors.utils.spec.ts`

**Files (MOD):**
- `src/features/POS/sales/composables/useDebtPayment.ts`
- `src/features/POS/sales/composables/__tests__/useDebtPayment.test.ts` (extend)
- `src/features/POS/sales/views/SalesView.vue` (charge dispatch wiring)
- `src/features/POS/sales/views/__tests__/SalesView.test.ts` (extend)

**Verify.**
- `pnpm test:unit --run src/features/POS/sales/utils/__tests__/paymentMethodChargeErrors.utils.spec.ts src/features/POS/sales/composables/__tests__/useDebtPayment.test.ts src/features/POS/sales/views/__tests__/SalesView.test.ts` green.
- Pin: dispatch order — catalog FIRST, legacy NEVER for catalog codes
  (REO-CAT-011). Defensive UUID drop (REO-CAT-010).

**Commit message.**
```
feat(sales): S5A — charge error dispatch short-circuits legacy path

- paymentMethodChargeErrors.utils: isolated map for PAYMENT_METHOD_CATEGORY_MISMATCH,
  PAYMENT_METHOD_NOT_FOUND, INACTIVE_PAYMENT_METHOD, INVALID_PAYMENT_METHOD_ID
  per design §8.2 (proposal risk #7 — isolated from salePaymentErrors.utils).
- useDebtPayment.onError: catalog action FIRST, short-circuit before legacy
  getSalePaymentErrorAction (REO-CAT-011). catalogClearSignal incremented on
  clearCatalogSelection; saleQueryKeys.paymentMethods invalidated on
  refetchSelector. Toast text per design §8.2 / REO-CAT-007..010.
- SalesView.handleChargeDraft: same dispatch for the charge surface.
- Pin tests: catalog codes do NOT fall through to legacy dispatch; legacy
  codes (e.g. PAYMENT_AMOUNT_INSUFFICIENT) DO fall through unchanged.
```

---

## S5B — Sale detail + timeline display (snapshot preferred)

**Strict TDD steps.**

- **RED 5B.a.** Extend `components/__tests__/PaymentsListSection.spec.ts` asserting:
  - A `SaleDetailPayment` row with
    `{ paymentMethodName: "Mercado Pago", paymentMethodSubtitle: "Link", method: "TRANSFER" }`
    renders the label "Mercado Pago" (not "Transferencia") and a grey sub-line
    "Link" beneath it (REO-CAT-005 / REO-CAT-006).
  - A legacy row (no `paymentMethodName`) renders the base label via
    `getMethodMeta(method).label` unchanged (REO-CAT-005 fallback).
  - A row with `paymentMethodSubtitle: null` or whitespace-only renders NO sub-line
    (REO-CAT-006 — no "—" placeholder, no empty space).
- **RED 5B.b.** Extend `components/__tests__/SaleDetailTimeline.test.ts` asserting:
  - A `PAYMENT_RECEIVED` event with
    `{ paymentMethodName: "Mercado Pago", paymentMethodSubtitle: "Link" }` renders
    the label as "Mercado Pago" (parity with `PaymentsListSection` per
    REO-CAT-005) and the grey sub-line below it (REO-CAT-006).
  - A legacy `PAYMENT_RECEIVED` event keeps the existing label
    (`formatPaymentMethod(event.method)`).
  - A `PAYMENT_RECEIVED` event with `paymentMethodSubtitle: null` renders NO sub-line.
- Run `pnpm test:unit --run` — at least 2 failures.
- **GREEN.** Implement:
  - MOD `src/features/POS/sales/components/PaymentsListSection.vue` — replace the
    label render with `paymentMethodName ?? getMethodMeta(method).label`. Add the
    grey sub-line render guarded by `paymentMethodSubtitle && paymentMethodSubtitle.trim()`.
  - MOD `src/features/POS/sales/components/SaleDetailTimeline.vue` — same
    preference for `PAYMENT_RECEIVED`. The label composition in `eventLabel(event)`
    gains the snapshot branch; the sub-line render lives in the same `<p>` block
    as the label (or as a sibling `<p>` with `text-muted` per the codebase's
    prevailing idiom — whichever fits the existing markup with minimal churn).
- **TRIANGULATE.** Add cases for: when both `paymentMethodName` and `method` are
  absent (defensive — never observed in practice but the requirement is explicit),
  the implementation falls back to the existing default copy without throwing
  (REO-CAT-005); the snapshot-rendered row still keys off `paymentId` for any
  per-row action affordances; a row with `paymentMethodSubtitle: "  Link  "` is
  trimmed before rendering (visual stability).
- **REFACTOR.** Extract a tiny `paymentMethodDisplayLabel(payment)` helper so
  `PaymentsListSection` and `SaleDetailTimeline` share the same
  `paymentMethodName ?? getMethodMeta(method).label` rule. Add a sibling
  `paymentMethodSubtitleText(payment)` helper returning the trimmed-or-null
  string. Both go in `paymentMethodMeta.ts` (alongside `getMethodMeta`).

**Files (NEW):** none (or a small helper file inside `utils/` if the refactor
introduces one).

**Files (MOD):**
- `src/features/POS/sales/components/PaymentsListSection.vue`
- `src/features/POS/sales/components/__tests__/PaymentsListSection.spec.ts` (extend)
- `src/features/POS/sales/components/SaleDetailTimeline.vue`
- `src/features/POS/sales/components/__tests__/SaleDetailTimeline.test.ts` (extend)

**Verify.**
- `pnpm test:unit --run src/features/POS/sales/components/__tests__/PaymentsListSection.spec.ts src/features/POS/sales/components/__tests__/SaleDetailTimeline.test.ts` green.
- `pnpm build` (vue-tsc + vite build) green at the end of the chain.

**Commit message.**
```
feat(sales): S5B — PaymentsListSection + SaleDetailTimeline prefer snapshot name + grey subtitle

- PaymentsListSection: row label = paymentMethodName ?? getMethodMeta(method).label
  (REO-CAT-005); grey sub-line = paymentMethodSubtitle.trim() when present
  (REO-CAT-006). Legacy rows fall back silently.
- SaleDetailTimeline: same preference for PAYMENT_RECEIVED events; sub-line
  parity with PaymentsListSection.
- Helpers paymentMethodDisplayLabel + paymentMethodSubtitleText co-located
  with getMethodMeta so the rule lives in one place.
- Pin tests cover catalog row, legacy row, subtitle trim+null cases.
```

---

## Out-of-band parent lifecycle gate

The implementation work above is owner-marked `implementation`. Once the apply phase
has finished all 9 sub-slices (and the parent/user has chosen `size:exception` or
the 3-PR chain), the parent runs bounded review across the merged tree:

- [x] Run bounded review on every sub-slice's diff (lint + slice spec + adjacent
      spec coverage) and link each finding to a specific commit. <!-- sdd-owner: parent -->
- [x] Record the final verdict (`size:exception` accepted vs. 3 chained PRs merged)
      in `openspec/changes/custom-payment-methods/verify-report.md` once the
      verify phase completes. <!-- sdd-owner: parent -->
- [ ] Move the change to `openspec/changes/archive/2026-XX-XX-custom-payment-methods/`
      per `config.yaml` `phases.archive` once `verify-report.md` carries a PASS
      verdict. <!-- sdd-owner: parent -->