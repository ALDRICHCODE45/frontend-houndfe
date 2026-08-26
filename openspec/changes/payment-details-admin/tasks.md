# Tasks — payment-details-admin (Datos bancarios) · COMPACT rerun

This is the **corrective rerun** of `tasks.md` for the compact `tenants`/`users`-style design.
Three files (3 dedicated mutation composables, `NoActiveAccountBanner.vue`,
`PaymentDetailCard.vue`) and their specs were removed versus the previous over-engineered
design. Everything else from the locked contracts in `design.md` §3 is preserved byte-for-byte
and is **not** renegotiated here.

Slice split **respects the user-set 600-line per-slice budget** as a HARD constraint
(`openspec/config.yaml` `slice_budget.max_changed_lines: 600`). The previous design's S2
(~700 lines) is now split into S2 and S3. Four slices total, each ≤ ~590 lines, dependency-ordered.
Delivery remains **single-pr** (one feature branch, multiple self-contained commits, no chained PRs).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,900–2,200 (22 new files + 6 modified code + ≤3 modified tests) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR (feature branch) with 4 internal slices/commits |
| Delivery strategy | single-pr (user-settled: one dev, one delivery to main via feature branch → merge) |
| Chain strategy | stacked-to-main (single PR into main via the feature branch; per-slice = per-commit) |
| Per-slice budget check (600) | S1 ≤ ~360 · S2 ≤ ~520 · S3 ≤ ~580 · S4 ≤ ~590 |

Estimate basis (honest, compact tree):

| Module | Lines |
| ------ | ----- |
| `interfaces/payment-detail.types.ts` | ~80 |
| `interfaces/errors.ts` | ~40 |
| `api/payment-details.api.ts` | ~120 |
| `composables/usePaymentDetailsTable.ts` | ~70 |
| `composables/usePaymentDetailColumns.ts` | ~80 |
| `composables/usePaymentDetailViewMode.ts` | ~30 |
| `composables/usePaymentDetailForm.ts` | ~50 |
| `utils/payment-detail-actions.utils.ts` | ~60 |
| `components/PaymentDetailCardGrid.vue` | ~110 |
| `components/PaymentDetailUpsertSlideover.vue` | ~110 |
| `views/AdminPaymentDetailsView.vue` | ~230 |
| 11 co-located specs (lean, ~50–110 lines each) | ~850 |
| 6 modified code sites (≈2–30 lines each) | ~60 |
| ≤3 modified test files (extending only) | ~55 |

Total is honestly ~1,900–2,200 — under the previous ~2,600–2,900 forecast and now
**distributed as 4 budget-compliant slices** with no slice over 600.

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

## Work Units table

| Slice | Goal (design mapping) | Files (new / mod) | Test cmd | Runtime path | Rollback |
|-------|-----------------------|--------------------|----------|--------------|----------|
| **S1** | Foundation: types + error map + CASL registration + query keys (design §5.1, §5.2, §6.1, §7.1–7.3) | 4 new / 6 mod code + ≤3 mod test | `pnpm test:unit --run` | none (no route yet) | `git revert <S1 commit>` |
| **S2** | Pure data layer: API + filter/sort/paginate + form + view-mode + actions utils (design §8.1, §9.1, §9.2, + viewMode composable) | 8 new / 0 mod | `pnpm test:unit --run` | none | `git revert <S2 commit>` |
| **S3** | Table assembly + columns + card grid + nav/route (design §8.2, §7.4) | 6 new / 2 mod | `pnpm test:unit --run` | `/admin/payment-details` reachable read-only for `read:PaymentDetail` holders | `git revert <S3 commit>` |
| **S4** | Upsert slideover + view (inline mutations + banner + confirm + gating) (design §8.3) | 4 new / 0 mod (extends existing view spec) | `pnpm test:unit --run` | full CRUD live at `/admin/payment-details` | `git revert <S4 commit>` |

Feature-level rollback (any slice): `git revert` of the feature-branch merge or delete the
branch pre-merge. The 6 registration/routing edit sites revert atomically with the branch.
No data/migration surface exists on the frontend.

## Dependency Graph

```text
S1 ──► S2 ──► S3 ──► S4
 │           │       │
 │           │       └──► S4 uses S3's `usePaymentDetailsTable` (`fullList` + `hasActiveAccount`)
 │           │            and `PaymentDetailCardGrid` (card markup inlined)
 │           └──► S3 wraps S2's `paymentDetailsApi.list` + `paginatePaymentDetails`
 │                and registers the route/menu gated by `read:PaymentDetail` (S1)
 └──► S1 unlocks `userCan('*','PaymentDetail')`, `adminPaymentDetailQueryKeys`,
      zod schemas and the domain error map for S4's mutations.
```

All edges are strict: never start a slice before its dependencies' commits exist.

## Implementation Order

1. **S1** — Foundation (types + errors + registrations + keys)
2. **S2** — Pure data layer (API + filter/sort/paginate + form + view-mode + actions utils)
3. **S3** — Table wrapper + columns + card grid + nav/route (read-only list live)
4. **S4** — Slideover + view (inline mutations + banner + confirm + gating) — feature complete

### Requirements coverage map

| Slice | Requirements covered |
|-------|----------------------|
| **S1** | REQ-AUTH-001..004, REQ-PD-001 (keys only), REQ-PD-002/003 (schemas), REQ-PD-008 (error map: codes + extractor + copy) |
| **S2** | REQ-PD-001 (filter/sort/paginate helpers), REQ-PD-002/003 (form state + schema selection), REQ-PD-005 (`isLastActivePaymentDetail` + description builder) |
| **S3** | REQ-PD-001 (columns + view-mode + cards), REQ-PD-006 (full-list derivation in `usePaymentDetailsTable` — locked decision), REQ-PD-007 (menu + route guard via `meta.permission`) |
| **S4** | REQ-PD-001 (view assembly), REQ-PD-002 (create mutation + slideover), REQ-PD-003 (edit mutation + prefill), REQ-PD-004 (delete mutation + confirm + idempotency), REQ-PD-005 (confirm wiring), REQ-PD-006 (inline banner), REQ-PD-007 (button gating), REQ-PD-008 (mutation error mapping) |

**REQ-PD-009** (bot transfer message reflects created account) is **E2E/bot-owned**, explicitly
**out of unit-test scope**. It is recorded as a **verify-phase optional check** at the bottom of
this file and is not on any apply-phase critical path.

---

## S1 — Foundation (types + error map + registrations + keys)

- **Goal:** Register `PaymentDetail` in the CASL type union + runtime registry + role-permissions UI;
  add tenant-scoped query keys; author zod schemas, DTO/request shapes and the `Activa`/`Inactiva`
  badge label map; author the domain error code type, Spanish copy map and `.error`-field extractor.
  Unlocks `userCan('*','PaymentDetail')`, `parsePermissionCode`, and the list query key.
- **Files — NEW (4):**
  - `src/features/admin/payment-details/interfaces/payment-detail.types.ts`
  - `src/features/admin/payment-details/interfaces/errors.ts`
  - `src/features/admin/payment-details/interfaces/__tests__/payment-detail.types.spec.ts`
  - `src/features/admin/payment-details/interfaces/__tests__/errors.spec.ts`
- **Files — MOD (6 code + ≤3 test):**
  - `src/features/auth/interfaces/auth.types.ts` — add `'PaymentDetail'` to `AppSubject` union (before `'all'`).
  - `src/features/auth/authorization/ability.ts` — add `'PaymentDetail'` to `APP_SUBJECTS` runtime array (before `'all'`).
  - `src/features/admin/roles/i18n/permissions.ts` — add `SUBJECT_LABELS.PaymentDetail = 'Datos bancarios'`;
    add `PERMISSION_COPY.PaymentDetail` block with exactly `create/read/update/delete`; `HIDDEN_SUBJECTS` untouched.
  - `src/core/shared/constants/query-keys.ts` — add `adminPaymentDetailQueryKeys.list(tenantId)` and
    `.detail(tenantId, id)`; tenant-scoped, mirroring `adminUserQueryKeys`.
  - `src/features/auth/authorization/__tests__/ability.test.ts` — extend with `PaymentDetail`
    membership/grant/no-silent-drop/revocation cases (REQ-AUTH-001/002/004).
  - `src/features/admin/roles/i18n/__tests__/permissions.spec.ts` — extend with
    `SUBJECT_LABELS.PaymentDetail === 'Datos bancarios'` and `PERMISSION_COPY.PaymentDetail`
    having exactly the 4 actions, no `manage`/`batch_delete` (REQ-AUTH-003).
  - `src/core/shared/constants/__tests__/query-keys.test.ts` — extend with list/detail key shape
    + tenant isolation + prefix invalidation assertions.

- [x] RED — Write failing specs: `payment-detail.types.spec.ts` (create requires all 4 fields; rejects bad `clabe`/short `accountNumber`/blank `bankName` or `beneficiary`; edit accepts `{}` and partial single-field; `isActive` **absent** from both schemas' `.shape`; `paymentDetailStatusLabel` returns `Activa`/`Inactiva`), `errors.spec.ts` (`extractPaymentDetailErrorCode` returns the code from `.response.data.error`, `null` for `.message`-only and unknown codes; `PAYMENT_DETAIL_ERROR_MAP` copy exact per REQ-PD-008), and extend the three modified test files with the PaymentDetail assertions above. Run `pnpm test:unit --run` → ≥1 failure in the target files. <!-- sdd-owner: implementation -->
- [x] GREEN — Add `'PaymentDetail'` to `AppSubject` + `APP_SUBJECTS`; add `SUBJECT_LABELS.PaymentDetail = 'Datos bancarios'` and `PERMISSION_COPY.PaymentDetail` block with exactly the 4 actions (no `manage`/`batch_delete`); add `adminPaymentDetailQueryKeys.list/detail` (tenant-scoped); implement `payment-detail.types.ts` per design §5.1 (create all-required, edit all-optional, `isActive` never present; `clabe` `/^\d{18}$/`, `accountNumber` `/^\d{10,}$/`; `tenantId` typed read-only) and `errors.ts` per design §5.2 (extractor reads `.response.data.error`; codes `DUPLICATE_CLABE`, `ENTITY_NOT_FOUND`, `NO_ACTIVE_PAYMENT_DETAIL`; copy exact). Run `pnpm test:unit --run` → target files pass; no other suite broken. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Edge cases: edit schema accepts `{}`; unknown/`message`-only error codes return `null`; malformed codes `read:PaymentDetail:extra`, `fly:PaymentDetail`, `read:UnknownSubject` are dropped while unrelated grants persist (REQ-AUTH-004); removal revokes. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten names/comments; confirm `HIDDEN_SUBJECTS` unchanged and no `manage`/`batch_delete` anywhere in the new copy; behavior unchanged, suite green. <!-- sdd-owner: implementation -->
- **Verify:** `pnpm test:unit --run` (target files, then full suite) green; `pnpm build` (vue-tsc type-check) green — no view/components yet, so nothing references missing files.
- **Commit:** `feat(payment-details): register PaymentDetail subject, types, error map and query keys (S1)`
- **Estimated changed lines:** ~360 (≤ 600 ✓)

---

## S2 — Pure data layer (API + composables + utils)

- **Goal:** HTTP surface + pure client-side search/sort/paginate helpers; form state composable;
  persisted view-mode composable; row-action and last-active confirmation helpers. All unmounted,
  pure/headless units. No Vue components yet — they assemble in S3.
- **Files — NEW (8):**
  - `src/features/admin/payment-details/api/payment-details.api.ts`
  - `src/features/admin/payment-details/api/__tests__/payment-details.api.spec.ts`
  - `src/features/admin/payment-details/composables/usePaymentDetailForm.ts`
  - `src/features/admin/payment-details/composables/__tests__/usePaymentDetailForm.spec.ts`
  - `src/features/admin/payment-details/composables/usePaymentDetailViewMode.ts`
  - `src/features/admin/payment-details/composables/__tests__/usePaymentDetailViewMode.test.ts`
  - `src/features/admin/payment-details/utils/payment-detail-actions.utils.ts`
  - `src/features/admin/payment-details/utils/__tests__/payment-detail-actions.utils.spec.ts`

- [x] RED — Write failing specs: `payment-details.api.spec.ts` (`applyLocalPaymentDetailFilters` searches the 4 fields case-insensitively + sorts `updatedAt`/string columns; `paginatePaymentDetails` correct `totalCount`/`pageCount`/slice for empty/single/multi-page cases; `paymentDetailsApi.list/getById/create/update/remove` URL+method+payload via `vi.mock` of the `http` client), `usePaymentDetailForm.spec.ts` (schema selection per mode — create all-required, edit all-optional; `resetForm` resets both states; `setValues` prefills edit with partials; initial create/edit states; `isActive` **never** in any payload shape), `usePaymentDetailViewMode.test.ts` (default `'table'`; `isPaymentDetailViewMode` type guard; `displayMode` bridge maps `'card' → 'cards'`), `payment-detail-actions.utils.spec.ts` (`isLastActivePaymentDetail` true only for the sole active row; `buildPaymentDetailDeactivateDescription` base copy vs last-active escalation; `buildPaymentDetailRowActions` respects `canUpdate`/`canDelete` and yields empty sections when neither). Run `pnpm test:unit --run` → failures in target files. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement `payment-details.api.ts` per design §8.1 (flat-array `list` + pure `applyLocalPaymentDetailFilters` + `paginatePaymentDetails` exported; URL contract `/admin/payment-details` and `/admin/payment-details/:id`); `usePaymentDetailForm.ts` per design §9.1 (imports schemas from `interfaces/payment-detail.types.ts`; reactive `createState`/`editState`; `resetForm`/`setValues`); `usePaymentDetailViewMode.ts` (persisted `table`/`card` via `useViewMode`; `displayMode` bridge `card → cards`); `payment-detail-actions.utils.ts` per design §9.2 (`isLastActivePaymentDetail`, `buildPaymentDetailDeactivateDescription`, `buildPaymentDetailRowActions`). Run `pnpm test:unit --run` → target files pass. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Empty list → `pageCount === 1`; default sort `updatedAt desc`; globalFilter across all 4 search fields case-insensitively; edit schema accepts `{}`; last-active detection false when target is already inactive or another active exists; actions returns empty sections when neither `update` nor `delete` is permitted. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Keep pure helpers exported and free of component coupling; no duplication with `tenant-actions.utils.ts`; no type leak from the employees module; suite green. <!-- sdd-owner: implementation -->
- **Verify:** `pnpm test:unit --run` green; `pnpm build` (type-check) green.
- **Commit:** `feat(payment-details): add API client, form/view-mode composables and actions utils (S2)`
- **Estimated changed lines:** ~520 (≤ 600 ✓)

---

## S3 — Table wrapper + columns + card grid + nav/route (read-only list live)

- **Goal:** Locked single-source wrapper `usePaymentDetailsTable` (one fetch → `fullList` + page slice
  + `hasActiveAccount`); table column definitions; presentational card grid; nav entry + guarded route
  for `read:PaymentDetail`. The list page becomes reachable read-only at `/admin/payment-details`.
- **Files — NEW (6):**
  - `src/features/admin/payment-details/composables/usePaymentDetailsTable.ts`
  - `src/features/admin/payment-details/composables/__tests__/usePaymentDetailsTable.spec.ts`
  - `src/features/admin/payment-details/composables/usePaymentDetailColumns.ts`
  - `src/features/admin/payment-details/composables/__tests__/usePaymentDetailColumns.test.ts`
  - `src/features/admin/payment-details/components/PaymentDetailCardGrid.vue`
  - `src/features/admin/payment-details/components/__tests__/PaymentDetailCardGrid.spec.ts`
- **Files — MOD (2):**
  - `src/app/navigation/navigation.registry.ts` — add to the `admin` group children:
    `{ id: 'admin-payment-details', label: 'Datos bancarios', icon: 'i-lucide-credit-card',
    to: '/admin/payment-details', permission: ['read', 'PaymentDetail'] }`.
  - `src/app/router/index.ts` — lazy import + route
    `{ path: '/admin/payment-details', name: 'admin-payment-details',
    component: AdminPaymentDetailsView,
    meta: { layout: 'dashboard', permission: ['read', 'PaymentDetail'] as RoutePermission } }`.

- [ ] RED — Write failing specs: `usePaymentDetailsTable.spec.ts` (**locked decision**: queryFn fills
  `fullList` AND returns the page slice; `hasActiveAccount` derives from the full list regardless of
  the page slice — active on page 2 still `true`; invalidation refetches; default sort `updatedAt desc`;
  `useServerTable` is the **only** fetch — no second query); `usePaymentDetailColumns.test.ts` (column
  ids; `actions` pinned right/non-hideable; data columns hideable); `PaymentDetailCardGrid.spec.ts`
  (use `mountWithUApp` from `src/test/mountWithUApp.ts`: renders 8 skeleton cards while `loading`; empty
  block when `paymentDetails.length === 0`; grid with bankName/beneficiary/CLABE/accountNumber +
  `StatusDotBadge` showing `Activa`/`Inactiva`; `card-click` emits the row). Run `pnpm test:unit --run`
  → failures in target files. <!-- sdd-owner: implementation -->
- [ ] GREEN — Implement `usePaymentDetailsTable.ts` per design §8.2 verbatim: ONE fetch via
  `useServerTable<PaymentDetailTableRow>` with `queryKey: () => adminPaymentDetailQueryKeys.list(tenantId.value)`,
  `queryFn` populates `fullList.value = rows` then returns `paginatePaymentDetails(rows, params)`;
  `defaultSorting: [{ id: 'updatedAt', desc: true }]`, `defaultPinning.right = ['actions']`,
  `persistKey: 'admin-payment-details'`; `hasActiveAccount` derived from `fullList`. Implement
  `usePaymentDetailColumns.ts` (table column definitions). Implement `PaymentDetailCardGrid.vue`
  per design §10 (skeleton/empty/grid; card markup inlined; `StatusDotBadge` via
  `paymentDetailStatusLabel` + `activityToBadgeTone`). Add nav registry child + router route.
  Run `pnpm test:unit --run` → target files pass. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — Empty list → `pageCount === 1` and `hasActiveAccount === false`; active on page 2
  keeps `hasActiveAccount === true` (banner derivation); default sort persists across pagination;
  card emits `card-click` with the exact row object; menu entry hidden without `read:PaymentDetail`
  (existing `userCan`-driven nav registry). <!-- sdd-owner: implementation -->
- [ ] REFACTOR — Confirm the wrapper performs **exactly one** fetch per query run (no shared
  `useServerTable` change); keep the card component purely presentational (props in, events out);
  suite green. <!-- sdd-owner: implementation -->
- **Verify:** `pnpm test:unit --run` green; `pnpm build` (type-check) green. `/admin/payment-details`
  is now reachable read-only for holders of `read:PaymentDetail`; guard redirects others to `/403`
  via the existing global `beforeEach`. **No mutations yet** — that is S4.
- **Commit:** `feat(payment-details): add table wrapper, columns, card grid and read-only route (S3)`
- **Estimated changed lines:** ~580 (≤ 600 ✓)

---

## S4 — Upsert slideover + view (inline mutations + banner + confirm + gating)

- **Goal:** `PaymentDetailUpsertSlideover` (create/edit, `isActive` **never** rendered); the
  composition view `AdminPaymentDetailsView.vue` wires **inline `useMutation`** (create/edit/
  deactivate — `users`/`tenants` convention, **no dedicated mutation composables**); inline
  `UAlert` "Sin cuenta activa" banner; `ConfirmModal` deactivate flow with last-active copy; button
  gating per action.
- **Files — NEW (4):**
  - `src/features/admin/payment-details/components/PaymentDetailUpsertSlideover.vue`
  - `src/features/admin/payment-details/components/__tests__/PaymentDetailUpsertSlideover.spec.ts`
  - `src/features/admin/payment-details/views/AdminPaymentDetailsView.vue`
  - `src/features/admin/payment-details/views/__tests__/AdminPaymentDetailsView.spec.ts`

- [ ] RED — Write failing specs: `PaymentDetailUpsertSlideover.spec.ts` (use `mountWithUApp`):
  create mode shows title "Crear cuenta"; **no** `isActive` control/field; submit emits parsed
  `create` payload with only the 4 fields; edit mode prefills all 4 fields with the row's values;
  submit emits parsed `edit` payload (no `isActive`, no `tenantId`). Then the read-write part of
  `AdminPaymentDetailsView.spec.ts`: list error block renders + retry works; **inline banner**
  (`data-testid="no-active-account-banner"`) renders when `!isLoading && !isError && !hasActiveAccount`,
  hidden when at least one account is active; add button only with `create:PaymentDetail`; row
  kebab hidden when neither `update` nor `delete` is held; edit action only with `update`; delete
  action only with `delete`; `ConfirmModal` "Desactivar" flow — cancel sends no request; last-active
  description uses strengthened copy; confirming calls the deactivate mutation; submitting closes
  the slideover. Run `pnpm test:unit --run` → failures in target files. <!-- sdd-owner: implementation -->
- [ ] GREEN — Implement `PaymentDetailUpsertSlideover.vue` per design §10.2 (`USlideover` + `UForm`
  + zod via `usePaymentDetailForm`; props `mode` / `loading` / `paymentDetail?`; `v-model:open`;
  emits `create` / `edit`; **no** `isActive` control). Implement `AdminPaymentDetailsView.vue`
  per design §8.3 verbatim: **destructure** `usePaymentDetailsTable()` at the top of `<script setup>`
  so template refs auto-unwrap; `canCreatePaymentDetail`/`canUpdatePaymentDetail`/`canDeletePaymentDetail`/
  `canManagePaymentDetailActions` computeds; **inline** `<UAlert color="warning" v-if="showNoActiveAccountBanner"
  data-testid="no-active-account-banner" ... />`; **three inline `useMutation`** calls (create/edit/
  deactivate) — each invalidates `adminPaymentDetailQueryKeys.list(tenantId.value)` on success; each
  `onError` calls `extractPaymentDetailErrorCode` first (specific toast if known, else generic via
  `normalizeApiError`); `ConfirmModal` with `confirm-label="Desactivar"`, `confirm-color="error"`;
  `openEdit` guarded by `canUpdatePaymentDetail`; `handleDeactivate` uses
  `buildPaymentDetailDeactivateDescription(row, fullList)`; `getRowItems` builds via
  `buildPaymentDetailRowActions`. Run `pnpm test:unit --run` → target files pass. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — Submit payloads never contain `isActive` or `tenantId` (REQ-PD-002/003);
  `DUPLICATE_CLABE` (409) and `ENTITY_NOT_FOUND` (404) each surface the specific Spanish toast
  read from `.error` (REQ-PD-008); unknown errors fall back to `normalizeApiError` generic toast;
  repeated DELETE on inactive account is idempotent (204) with no error toast (REQ-PD-004); last-active
  warning visible before confirm (REQ-PD-005); banner reappears after deactivating the last active
  account without a manual reload (REQ-PD-006); banner reflects the full list not the page slice
  (active on page 2 keeps it hidden) (REQ-PD-006). <!-- sdd-owner: implementation -->
- [ ] REFACTOR — View stays thin (composition surface only — no card markup, no field markup);
  confirm state centralized; all copy sourced from `utils`/`interfaces`; no type leak from the
  employees module; suite green. <!-- sdd-owner: implementation -->
- **Verify:** `pnpm test:unit --run` green (target files, then full suite); `pnpm build` (vue-tsc +
  vite build) green; pre-commit `pnpm lint` clean. Full CRUD live at `/admin/payment-details`.
- **Commit:** `feat(payment-details): add upsert slideover, view mutations and confirm flow (S4)`
- **Estimated changed lines:** ~590 (≤ 600 ✓)

---

## Post-apply (parent-owned — grouped separately, runs after S4 commit on the feature branch)

- [ ] Start or reuse bounded review of the full feature branch (S1–S4) before merge. <!-- sdd-owner: parent -->
- [ ] Confirm per-slice budget adherence (each slice ≤ 600 changed lines; total forecast ~1,900–2,200 disclosed) and requirement coverage against REQ-PD-001..008 / REQ-AUTH-001..004 in the verify phase. <!-- sdd-owner: parent -->
- [ ] Verify-phase optional check for REQ-PD-009 (E2E/bot-owned, out of unit scope): exercise the real admin create flow + the bot's transfer-instruction message for the same tenant; record outcome in `verify-report.md` (no apply-phase gate). <!-- sdd-owner: parent -->
- [ ] Lifecycle gate: merge feature branch → main as the single delivery (single-pr), then run the verify phase and archive the change. <!-- sdd-owner: parent -->
