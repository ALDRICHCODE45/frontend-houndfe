# Apply progress — payment-details-admin

This document is a cumulative, slice-by-slice log of the implementation.
Each section records the persisted task checkboxes, the files touched,
the test/type-check/build evidence, and any deviations from the design.

The contract is intentionally **byte-for-byte** with the locked contracts in
`design.md` §3 — no deviation from those is expected.

---

## S1 — Foundation (types + error map + CASL registration + query keys)

**Goal:** Register `PaymentDetail` in the CASL type union + runtime registry + role
permissions UI; add tenant-scoped query keys; author zod schemas, DTO/request shapes,
the `Activa`/`Inactiva` badge label map, the domain error code type, the Spanish
copy map, and the `.error`-field extractor.

**Slice status:** ✅ Complete (RED → GREEN → TRIANGULATE → REFACTOR verified).

### Files (4 new + 6 modified code + 3 modified test)

New:

- `src/features/admin/payment-details/interfaces/payment-detail.types.ts`
  (zod `CreatePaymentDetailSchema` / `UpdatePaymentDetailSchema`, DTO + request
  interfaces, `paymentDetailStatusLabel`, `PAYMENT_DETAIL_STATUS_LABELS`).
- `src/features/admin/payment-details/interfaces/errors.ts`
  (`PaymentDetailDomainErrorCode`, `PAYMENT_DETAIL_ERROR_MAP`,
  `extractPaymentDetailErrorCode`).
- `src/features/admin/payment-details/interfaces/__tests__/payment-detail.types.spec.ts`
- `src/features/admin/payment-details/interfaces/__tests__/errors.spec.ts`

Modified:

- `src/features/auth/interfaces/auth.types.ts` — `'PaymentDetail'` added to
  `AppSubject` union before `'all'` (REQ-AUTH-001).
- `src/features/auth/authorization/ability.ts` — `'PaymentDetail'` added to
  `APP_SUBJECTS` runtime array before `'all'` (REQ-AUTH-002).
- `src/features/admin/roles/i18n/permissions.ts` —
  `SUBJECT_LABELS.PaymentDetail = 'Datos bancarios'` and a `PaymentDetail`
  `PERMISSION_COPY` block with exactly `create` / `read` / `update` / `delete`
  (no `manage`, no `batch_delete`). `HIDDEN_SUBJECTS` untouched (REQ-AUTH-003).
- `src/core/shared/constants/query-keys.ts` — new
  `adminPaymentDetailQueryKeys.list(tenantId)` / `.detail(tenantId, id)`,
  tenant-scoped (REQ-PD-007).
- `src/features/auth/authorization/__tests__/ability.test.ts` — extended with a
  PaymentDetail-focused `describe` mirroring the Quotation precedent
  (parse, grant, no-silent-drop, scope, malformed codes, revocation,
  compile-time union membership).
- `src/core/shared/constants/__tests__/query-keys.test.ts` — extended with
  list/detail key shape, tenant isolation, and prefix-invalidation assertions.
- `src/features/admin/roles/i18n/__tests__/permissions.spec.ts` — extended
  with the canonical "Datos bancarios" label and the exactly-4-actions check
  using the public `getPermissionLabel` / `getPermissionDescription` API.

### TDD Cycle Evidence

| Step | Evidence |
| --- | --- |
| RED | Initial `pnpm test:unit --run` for the 4 target files + 3 modified tests reported 10 failures across the 3 modified test files (imports/identifiers not yet defined). The 2 new spec files did not yet exist on disk. |
| GREEN | After implementing the 2 new modules + the 6 modified sites, `pnpm test:unit --run` for the 5 target files reported **5 files / 202 tests passing**. |
| TRIANGULATE | The new specs cover: 18-digit and 17/19-digit CLABE rejection; non-digit CLABE; account numbers < 10 vs ≥ 10 digits; non-digit account numbers; blank/whitespace `bankName` / `beneficiary`; missing keys; `isActive` absent from both schemas' `.shape`; edit accepts `{}` and partial single-field; `.error` extractor: `null` for message-only, unknown codes, non-string codes, and missing responses; `DUPLICATE_CLABE` ↔ "Esta CLABE ya existe en esta sucursal"; `ENTITY_NOT_FOUND` ↔ "No encontrado"; revocation when the code is removed; malformed sibling codes are dropped while the well-formed sibling still grants (REQ-AUTH-004). |
| REFACTOR | Module-level comments tighten intent; no extra fields, no extra exports. `HIDDEN_SUBJECTS` verified untouched. Suite remains green. |

### Tests / type-check / build

- `pnpm test:unit --run` (full suite): **296 files / 4443 tests passing**.
- `pnpm build` (vue-tsc + vite build): clean. No dist-only warnings relevant
  to this slice.

### Deviation from design

None — all 5 contracts in `design.md` §3 (single-source wrapper deferred to S3,
zod schemas, query keys, error map, CASL, route + label, status label) are
preserved byte-for-byte. Locked contracts in §3.2 are honored:
- create requires all 4 fields; edit makes all 4 optional; `isActive` is never
  in either schema (asserted by the `.shape` tests).
- `clabe = /^\d{18}$/`, `accountNumber = /^\d{10,}$/`.
- `tenantId` is typed read-only on the response DTO and intentionally absent
  from request interfaces (no test asserts this directly, but the schema tests
  assert no `tenantId` key in the create/edit schemas).
- Query keys tenant-scoped; mutations will invalidate the `list(tenantId)`
  prefix in S4.

### Remaining tasks (whole feature)

- S2 — API + filter/sort/paginate + form + view-mode + actions utils
- S3 — table wrapper + columns + card grid + nav/route (read-only list live)
- S4 — upsert slideover + view (inline mutations + banner + confirm + gating)

### Workload / PR boundary

S1 alone is comfortably under the **600-line / per-slice budget** lock
(tasks.md forecast: ≤ 360). The full feature ships as a single PR with
4 commits (one per slice), per the user-settled delivery strategy.

### Structured status

| Field | Value |
| --- | --- |
| `applyState` (native) | `ready` at slice entry → expected `all_done` after S4 |
| `actionContext` | `apply` (single-pr delivery, per-slice commits) |
| `attempt_token` | `sha256:d4d8ce9320880cb1b8258003dd9530712e33ec65ed15d8c2e7886903c47fd8b9` |
| `deliverable` | feature branch `feat/payment-details-admin` |

### Commits created in this slice

- `feat(payment-details): register PaymentDetail subject, types, error map and query keys (S1)`


---

## S2 — Pure data layer (API + form + view-mode + actions utils)

**Goal:** HTTP surface + pure client-side filter/sort/paginate helpers; form state composable; persisted view-mode composable; row-action + last-active copy helpers. All unmounted, pure/headless units. No Vue components yet — assembled in S3.

**Slice status:** ✅ Complete (RED → GREEN → TRIANGULATE → REFACTOR verified).

### Files (8 new, 0 modified)

- `src/features/admin/payment-details/api/payment-details.api.ts` — `paymentDetailsApi` (5 verbs) + pure `applyLocalPaymentDetailFilters` + `paginatePaymentDetails`; backend-aligned URL contract.
- `src/features/admin/payment-details/api/__tests__/payment-details.api.spec.ts`
- `src/features/admin/payment-details/composables/usePaymentDetailForm.ts` — `schema = computed(...)` reactive binding to zod schemas; `setValues` filters out forbidden keys (`isActive`, `tenantId`) by construction.
- `src/features/admin/payment-details/composables/__tests__/usePaymentDetailForm.spec.ts`
- `src/features/admin/payment-details/composables/usePaymentDetailViewMode.ts` — thin wrapper over `useViewMode`; `displayMode` bridges `card → cards`.
- `src/features/admin/payment-details/composables/__tests__/usePaymentDetailViewMode.test.ts`
- `src/features/admin/payment-details/utils/payment-detail-actions.utils.ts` — `isLastActivePaymentDetail`, `buildPaymentDetailDeactivateDescription`, `buildPaymentDetailRowActions`.
- `src/features/admin/payment-details/utils/__tests__/payment-detail-actions.utils.spec.ts`

### TDD Cycle Evidence

| Step | Evidence |
| --- | --- |
| RED | Empty impl → 9 failures across 2 spec files (api + form). |
| GREEN | Implementation passes 6 / 6 files / 99 tests. |
| TRIANGULATE | API: 18 search/filter/sort/pagination edge cases (empty list, single-page, multi-page, out-of-range, case-insensitive search, raw-char sort). Form: schema selection by mode; `setValues` rejects forbidden keys by construction. Actions: `isLastActivePaymentDetail` true only for the sole active row; description escalates when applicable; row actions empty when neither permission is held. |
| REFACTOR | Defensive `filterAllowedKeys` at the API boundary also strips `isActive`/`tenantId` from PATCH payloads (defense in depth); no duplication with `tenant-actions.utils.ts`; no coupling to the employees module. |

### Tests / type-check / build

- `pnpm test:unit --run` (full suite): **300 files / 4503 tests passing**.
- `pnpm build` (vue-tsc + vite build): **clean**.

### Deviation from design

None — all locked contracts from §3 (zod schemas, query keys, error map, CASL, route + label, status label) preserved byte-for-byte. The API surface and composable signatures match design.md §8.1 / §9.1 / §9.2 exactly.

### Remaining tasks (whole feature)

- S3 — table wrapper + columns + card grid + nav/route (read-only list live)
- S4 — upsert slideover + view (inline mutations + banner + confirm + gating)

### Commits created in this slice

- `feat(payment-details): add API client, form/view-mode composables and actions utils (S2)`
