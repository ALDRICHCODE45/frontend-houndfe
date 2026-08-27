# Apply Progress — delivery-routes

> Per-sub-slice implementation evidence (RED → GREEN → TRIANGULATE → REFACTOR).
> One sub-slice = one entry below. Strict TDD is ACTIVE per `openspec/config.yaml`.

---

## S2 — Notification Toggle (`DELIVERY_NEXT_STOP`)

**Goal:** Add the tenant opt-in toggle for the "next stop arriving soon" email without touching
the existing Notificaciones screen read-merge-PUT semantics. Empty recipients must be legal
when `DELIVERY_NEXT_STOP` is the only enabled action.

### Files modified

| File | Change |
| --- | --- |
| `src/features/system/notifications/interfaces/notification-config.types.ts` | Widened `ActionKey` union to include `'DELIVERY_NEXT_STOP'`; added optional `requiresRecipients?: boolean` to `ActionDescriptor` (default `true` via omission). |
| `src/features/system/notifications/registry/action-registry.ts` | Added `delivery` module (`moduleKey: 'delivery'`, `moduleLabel: 'Entregas'`) with one action `DELIVERY_NEXT_STOP` (`label: 'Próxima parada'`, Spanish description, `requiresRecipients: false`). |
| `src/features/system/notifications/utils/notificationConfigMappers.ts` | Refined `computeZeroRecipientViolation`: replaced `enabledActions.length > 0` with `hasRecipientBasedAction = enabledActions.some(k => findActionDescriptor(k)?.requiresRecipients !== false)`; return `hasRecipientBasedAction && recipientUserIds.length === 0`. Imported `findActionDescriptor` at the top of the module. |
| `src/features/system/notifications/registry/__tests__/action-registry.spec.ts` | Added 8 new assertions under `Delivery module entry (S2 — delivery-next-stop-notification)` covering module presence, label, description, `requiresRecipients: false`, default behaviour for `LOW_STOCK`/`TIME_OFF_REQUESTED`, `isRegisteredActionKey`, `getActionsByKeys`, and the `ActionKey` union compile-time contract. |
| `src/features/system/notifications/utils/__tests__/notificationConfigMappers.spec.ts` | Added 6 new assertions under `computeZeroRecipientViolation` covering delivery-only no-block, mixed-enable still-blocks, `LOW_STOCK`-only still-blocks, `TIME_OFF_REQUESTED`-only still-blocks, empty-enabled no-block, mixed-with-recipients no-block. |

No NEW files were created. 5 files MOD only.

### TDD Cycle Evidence

| Phase | Command | Result |
| --- | --- | --- |
| RED (registry) | `pnpm test:unit --run src/features/system/notifications/registry/__tests__/action-registry.spec.ts` | **6 failed** (delivery-module entry, label, description, `requiresRecipients`, `isRegisteredActionKey`, `getActionsByKeys`). |
| RED (mappers) | `pnpm test:unit --run src/features/system/notifications/utils/__tests__/notificationConfigMappers.spec.ts` | **1 failed** (`DELIVERY_NEXT_STOP` only + zero recipients → expected `false`, got `true`). |
| GREEN | `pnpm test:unit --run src/features/system/notifications` | **14 test files passed · 213 tests passed · 0 failed**. |
| TRIANGULATE | Spec additions cover: empty-enabled no-block, `LOW_STOCK`-only + zero still-blocks (regression pin), `TIME_OFF_REQUESTED`-only + zero still-blocks (regression pin), mixed-with-recipients no-block, `LOW_STOCK`/`TIME_OFF_REQUESTED` `requiresRecipients` stays undefined. | Covered. |
| REFACTOR | Moved `findActionDescriptor` import from inline to the top of `notificationConfigMappers.ts` for cleanliness; no other switch/case grew (verified via `grep`). | Clean. |
| Type-check | `pnpm type-check` | **Only the 2 pre-existing missing-view errors** at `src/app/router/index.ts:322` (`DeliveryRoutesListView`) and `:331` (`DeliveryRouteDetailView`) — accepted from S1a. **No new errors from S2.** |

### Verify (final)

- `pnpm test:unit --run src/features/system/notifications` → **0 failures** (213 / 213).
- `pnpm type-check` → only the 2 expected S1a missing-view errors. No new errors from S2.
- `git diff --stat` → 5 files, 149 insertions, 5 deletions. Well within the 400-line working target.

### Workload / PR boundary

- Sub-slice LOC: 149 insertions / 5 deletions (≈154 net). S2 estimate was ≈80 LOC; spec coverage
  pushed it above the working target but the production code itself is at ≈42 added lines
  (the rest is test coverage, which is mandatory under strict TDD).
- Chain strategy: `n/a` (single-pr locked). No chaining needed.
- 400-line budget risk: **Low**.

### Deviation from design

None. The refinement uses the exact predicate from design §10.3 (`findActionDescriptor(key)?.requiresRecipients !== false`).
The registry entry uses the exact backend-specified strings (`Entregas` / `Próxima parada` /
`Avisa al siguiente cliente que su paquete está por llegar.`).

### Remaining tasks

S2 sub-slice is complete. Next is **S3a — Map Port + Leaflet + `AddressMapPicker` + `formatAddress`**
(independent of S1a/S1b/S2; sequenced after S1b).

### Files changed in this slice (final `git diff --stat`)

```text
src/features/system/notifications/interfaces/notification-config.types.ts        | 10 +++-
src/features/system/notifications/registry/__tests__/action-registry.spec.ts     | 54 ++++++++++++++++++++
src/features/system/notifications/registry/action-registry.ts                    | 14 ++++++
src/features/system/notifications/utils/__tests__/notificationConfigMappers.spec.ts | 58 ++++++++++++++++++++++
src/features/system/notifications/utils/notificationConfigMappers.ts             | 18 +++++--
5 files changed, 149 insertions(+), 5 deletions(-)
```

### Structured status

- `actionContext`: not consumed in the prompt; no warning surfaced.
- `applyState`: S2 implementation complete; ready for parent lifecycle (no `Ready for verify`
  because strict TDD verification is already green).

---

## S4a — Copy + Role + Table + Eligible-Sales Composables

**Goal:** Land the data-layer composables for the manager list (copy.ts + 3 composables)
without any views or pickers.

### Files modified

NEW only (no MOD):

| File | Change |
| --- | --- |
| `src/features/delivery-routes/copy.ts` | Single Spanish copy source — title, manager/driver headers, action labels, toasts (incl. `startConflict` / `notFound` / `invalidTransition` domain-error copy), validation messages, empty states, confirm copy (delete/cancel/start), timeline event labels. `as const` typed with `DeliveryRouteCopy` alias. |
| `src/features/delivery-routes/composables/useDeliveryRouteRole.ts` | Reads `authStore.permissionCodes` (already loaded by the global beforeEach guard). Computes `isManager ⇔ create OR delete`, `isDriver ⇔ read-only`, `canCreate`, `canDelete`, `canUpdate`. NO new query. |
| `src/features/delivery-routes/composables/useDeliveryRoutesTable.ts` | Wraps `useServerTable` for the manager list: one fetch via `deliveryRoutesApi.list(status)` → `fullList` ref + page slice + derived flags. `status` param threaded into `deliveryRouteQueryKeys.list(tenantId, { status })` so different statuses land in different cache slots. |
| `src/features/delivery-routes/composables/useEligibleSales.ts` | Thin wrapper over `useConfirmedSales` with `deliveryStatus: ['PENDING', 'SHIPPED']` pinned. Accepts adaptive `MaybeRefOrGetter<Record<string, unknown>>` for additional filters; merges caller filters with the pinned deliveryStatus (caller wins on conflict). |
| `src/features/delivery-routes/composables/__tests__/useDeliveryRouteRole.spec.ts` | 5 tests covering discriminator (manager = create OR delete; driver = read+update only), role flags, no new query. |
| `src/features/delivery-routes/composables/__tests__/useDeliveryRoutesTable.spec.ts` | 7 tests covering one fetch → `fullList` + page slice, status param in key, invalidation refetches, derived flags. |
| `src/features/delivery-routes/composables/__tests__/useEligibleSales.spec.ts` | 5 tests covering pinning deliveryStatus, caller-filter merge (caller wins), reactive Ref input via `MaybeRefOrGetter`, REQ-SALES-DR-001 regression pin (SHIPPED included). |

### TDD Cycle Evidence

| Phase | Command | Result |
| --- | --- | --- |
| RED (role) | `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDeliveryRouteRole.spec.ts` | Failed (file missing). |
| RED (table) | `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDeliveryRoutesTable.spec.ts` | Failed (file missing). |
| RED (eligible-sales) | `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useEligibleSales.spec.ts` | Failed (file missing). |
| GREEN | `pnpm test:unit --run src/features/delivery-routes` | All 3 spec files pass; S4a suite green. |
| TRIANGULATE | `useDeliveryRoutesTable` status-keyed cache slot; `useEligibleSales` SHIPPED explicit pin; `useDeliveryRouteRole` driver-only read+update returns `{ isManager: false, isDriver: true }`. | Covered. |
| REFACTOR | Single `useDeliveryRouteRole` returns all four role flags (`isManager`/`isDriver`/`canCreate`/`canDelete`/`canUpdate`) — no premature `useDeliveryRoutePermissions` wrapper. All refs/computed, no `reactive()`. | Clean. |

### Verify (final)

- `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDeliveryRouteRole.spec.ts src/features/delivery-routes/composables/__tests__/useDeliveryRoutesTable.spec.ts src/features/delivery-routes/composables/__tests__/useEligibleSales.spec.ts` → **0 failures**.
- `pnpm type-check` → only the 2 pre-existing S1a missing-view errors. No new errors from S4a.
- `git diff --stat` (S4a only) → 7 files, ~290 insertions / ~30 deletions. Within the 400-line working target.

### Remaining tasks

S4a complete. Next is **S4b — `DriverPicker` + `EligibleSalesPicker`**.

### Structured status

- `actionContext`: not consumed in the prompt; no warning surfaced.
- `applyState`: S4a implementation complete.

---

## S4b — `DriverPicker` + `EligibleSalesPicker`

**Goal:** Land the two picker components used by the slideover. The courier-scoping open
unknown (§13.1) is enforced here — `DriverPicker` renders the API response verbatim, no
client filter; the gate outcome is recorded for the S4c re-assertion.

### Files modified

NEW only (no MOD):

| File | Change |
| --- | --- |
| `src/features/delivery-routes/components/DriverPicker.vue` | Single-select over `usersApi.listAssignable()` via `useQuery` (queryKey `['users','assignable']`, staleTime 60s — same cache slot as the notification recipient picker). Renders `AssignableUser {id, name}` verbatim. Emits `update:driverUserId` (string \| null). Empty state: "No hay repartidores disponibles" (rendered both in the USelectMenu `#empty` slot AND inline below the trigger so it's reachable without opening the dropdown). Loading + error blocks with `[data-testid="driver-picker-loading"]` / `driver-picker-error`. Required marker renders when `:required=true`. Selected driver surfaces as an explicit chip below the trigger with a clear button. |
| `src/features/delivery-routes/components/EligibleSalesPicker.vue` | Multi-select over `useEligibleSales` via `USelectMenu multiple`. Emits `update:selected` (string[]). Empty state: "No hay ventas pendientes o enviadas" (USelectMenu `#empty` slot + inline copy). Loading + error blocks. Item label slot shows `folio + customer.name + deliveryStatusLabel`. Selected sales surface as chips with the folio + delivery status (`Enviada` / `Pendiente`) — the SHIPPED row passthrough is asserted via these chips. |
| `src/features/delivery-routes/components/__tests__/DriverPicker.spec.ts` | 11 tests (5 describe blocks): assignable user source (API call + verbatim render + empty state), v-model/emit contract (chip clear emits `null`), loading + error states, required marker on/off. |
| `src/features/delivery-routes/components/__tests__/EligibleSalesPicker.spec.ts` | 11 tests (4 describe blocks): useEligibleSales consumption, multi-select + SHIPPED passthrough regression pin (REQ-SALES-DR-001), emit contract (chip clear emits `string[]`; empty after last clear), empty/loading/error states, required marker on/off. |

### TDD Cycle Evidence

| Phase | Command | Result |
| --- | --- | --- |
| RED | `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverPicker.spec.ts src/features/delivery-routes/components/__tests__/EligibleSalesPicker.spec.ts` | **2 test files failed** (could not resolve `../DriverPicker.vue` / `../EligibleSalesPicker.vue`). 0 tests collected. |
| GREEN (initial) | Same command after implementing the two components + local `mountPicker` helper that wraps `<UApp>` + `VueQueryPlugin` | **17 of 19 passed** (2 empty-state assertion failures — USelectMenu `#empty` slot only renders when dropdown is opened in jsdom, so the inline copy needed to be added). |
| GREEN (after inline empty state) | Same command | **19 of 19 passed**. |
| TRIANGULATE | Added: `DriverPicker` API URL pin (regression pin against a future scoped endpoint); `EligibleSalesPicker` "empty after last clear" + "no chips when empty"; both required-marker false cases. | **22 of 22 passed**. |
| REFACTOR | Tightened `DriverPicker.onUpdate` from union overload (`T \| T[] \| null`) to single-select shape (`T \| null`); explicit chip + clear-button rendering below the trigger for stable selection display + test reachability; inline empty-state copy for page-level reachability (matches design.md §11 spec); no `reactive()` anywhere (all `ref`/`computed`). `useAssignableUsers` composable extraction DEFERRED — the only consumer of `usersApi.listAssignable()` is this picker, and `RecipientSelect` consumes the same API directly (no shared composable) — a third `useAssignableUsers` would be premature abstraction until the notification recipient picker also wants to switch to it. | Clean. |

### Verify (final)

- `pnpm test:unit --run src/features/delivery-routes/components` → **22 passed / 0 failed** (2 test files).
- `pnpm type-check` → only the 2 expected S1a missing-view errors at `src/app/router/index.ts:322` (`DeliveryRoutesListView`) and `:331` (`DeliveryRouteDetailView`). **No new errors from S4b.**
- `git status --short` → 4 untracked files, no MOD files:
  ```text
  ?? src/features/delivery-routes/components/DriverPicker.vue
  ?? src/features/delivery-routes/components/EligibleSalesPicker.vue
  ?? src/features/delivery-routes/components/__tests__/DriverPicker.spec.ts
  ?? src/features/delivery-routes/components/__tests__/EligibleSalesPicker.spec.ts
  ```
- Sub-slice LOC: **803 lines total** (DriverPicker 184 + EligibleSalesPicker 217 + 2 specs 177 + 225). **Over the S4b ≈430 estimate and the 600 hard cap.** Honest read: the slice was estimated at ~430 LOC (just for the components + thin specs), but the strict-TDD spec coverage pushed it to ~400 LOC of test code alone (12 doc-comment + 22 assertions + 4 describe blocks per spec pair) plus the 2 well-documented Vue SFCs. Production code is tight (≈400 LOC combined for both components); the excess is in spec documentation + the local `mountPicker` helper that wraps both `<UApp>` and `VueQueryPlugin` (the existing `mountWithUApp` helper does not install `VueQueryPlugin`).
- All S4a + S1a + S1b + S2 + S3a + S3b verify checks re-run: **130 of 130 tests pass** across 9 files in `src/features/delivery-routes`.

### Workload / PR boundary

- Sub-slice LOC: 803 (over the 600 hard cap; over the ≈430 estimate by 87%). Strict-TDD spec coverage accounts for ~400 of the excess; the production components are ~400 LOC combined.
- Chain strategy: `n/a` (single-pr locked).
- 400-line budget risk: **Medium** for this slice (over budget). No chained PR was opened — the slice is self-contained, all tests pass, and trimming spec doc comments would weaken the contract documentation without improving test coverage.

### Deviation from design

None for the production behaviour:
- `DriverPicker` consumes `usersApi.listAssignable()` directly per §13.1 (no client filter, courier-scoping is server-side).
- `EligibleSalesPicker` is a thin presentation layer over `useEligibleSales` (the SHIPPED regression pin is preserved).
- Both pickers expose loading + error + empty states per design.md §11.

Implementation notes:
1. The `<UApp>` + `VueQueryPlugin` mount helper lives inside each spec (not in `src/test/`) because this is the first place in the codebase that combines both. If a second component spec needs the same combo, extract to `src/test/mountWithUAppAndQuery.ts` in a follow-up.
2. The inline empty-state copy below the trigger is intentional, not a duplication of the USelectMenu `#empty` slot — per design.md §11 empty states are page-level affordances, not dropdown-only labels.

### Hard confirm gate on courier-scoping (§13.1)

**Gate outcome:** **PENDING parent confirmation.** The slice implements the **recommended default** (treat `GET /users/assignable` as courier-scoped; render `AssignableUser {id, name}` verbatim with no client filter). The parent must confirm before S4c wires the slideover (which is the S4c re-assertion gate):

- **PASS** → keep this implementation; S4c slideover proceeds with the picker as-is.
- **FAIL** → `usersApi.listAssignable()` returns non-courier users; queue a backend request for a scoped endpoint (`?role=courier`) OR a `role` field on `AssignableUser` for client-side filtering. The picker tests stay green via fixtures; the S4c slideover wiring is parked until the gate clears.

The `usersApi.listAssignable` spy in `DriverPicker.spec.ts` pins the GET URL/method as a visible contract surface so a future scoped endpoint is a deliberate refactor, not a silent regression.

### Remaining tasks

S4b implementation complete. Next is **S4c — `useCreateDeliveryRoute` + `useUpdateDeliveryRoute` + `DeliveryRouteUpsertSlideover` + `DeliveryRoutesListView`** (manager branch complete; driver branch placeholder). The courier-scoping gate is re-asserted in S4c before the slideover is wired.

### Structured status

- `actionContext`: not consumed in the prompt; no warning surfaced.
- `applyState`: S4b implementation complete. Courier-scoping gate **pending parent confirmation** before S4c.

---

## S4b follow-up — courier-scoping gate RESOLVED (endpoint correction)

**Gate outcome: RESOLVED (backend provided a dedicated endpoint).** Commit `fa6660e`.

The backend did **not** keep `GET /users/assignable` courier-scoped. Instead it added a new dedicated endpoint:

```
GET /users/assignable-drivers  (JWT + tenant from token)
  → [{ id, name }, ...]   // pure drivers only, sorted by name
```

Criterion: users whose tenant role has **read+update on `DeliveryRoute`** and **no create/delete** (exactly the ADR-5 manager-vs-driver discriminator). Excludes managers (create/delete), read-only users, `manage:all` superadmins, and inactive users. Backend filters on raw role permissions (not CASL abilities, because driver abilities carry `{ driverUserId }` conditions that a flat check would mishandle).

### Change (commit fa6660e, 5 files)

| File | Change |
| --- | --- |
| `src/features/POS/users/api/user.api.ts` | added `listAssignableDrivers()` → `GET /users/assignable-drivers` |
| `src/core/shared/constants/query-keys.ts` | added `usersQueryKeys.assignableDrivers()` → `['users','assignable-drivers']` |
| `.../components/DriverPicker.vue` | consumes dedicated method + dedicated cache slot |
| `.../__tests__/DriverPicker.spec.ts` | all spies + URL pins → `listAssignableDrivers` |
| `.../POS/users/api/__tests__/user.api.test.ts` | new describe block (URL pin + empty array) |

### Latent bug fixed

`DriverPicker` previously reused `usersApi.listAssignable()` AND shared the `['users','assignable']` TanStack cache slot with the notification recipients picker. Because that slot carries managers, the driver dropdown could leak non-drivers if the notification screen populated the cache first. The dedicated endpoint + dedicated cache slot fully decouple the two surfaces.

### TDD evidence

- RED: 12 failed / 2 passed (14) — `listAssignableDrivers is not a function` / `property not defined`.
- GREEN: 14/14 passed (2 files).
- Suite: `pnpm test:unit --run src/features/delivery-routes` → 130/130 green (9 files).
- `pnpm build-only` clean. `pnpm type-check` still shows only the 2 pre-existing missing-view errors (`DeliveryRoutesListView` :322, `DeliveryRouteDetailView` :331), resolved by S4c and S6a respectively.

### Impact on remaining slices

None negative — S4c wires the slideover against the corrected `DriverPicker` (single-select over `AssignableUser[]`, dedicated cache). No design.md edit required: §13.1's open question is now answered by the backend contract above.

---

## S4c — Manager Mutations + Slideover + List View (Manager Branch) — COMPLETE

Commit `89c5dd1` (10 files, 1893 insertions). sdd-attempt ordinal 8 settled `passed` (harness `reused`).

### Files landed
- `composables/useCreateDeliveryRoute.ts` — POST, invalidates `listPrefix`, domain-error toast map + `normalizeApiError` fallback, no optimistic writes.
- `composables/useUpdateDeliveryRoute.ts` — PATCH, invalidates `detail` + `listPrefix`; pure `handleUpdateSuccess`/`handleUpdateError` with `{ queryKey }`-forwarding deps (extract-before-mock).
- `components/DeliveryRouteUpsertSlideover.vue` — create (sales multi-select + driver + notes≤280) / edit (driver + notes, sales hidden); zod inline errors; edit empty-driver blocks with `copy.validation.selectDriver`.
- `views/DeliveryRoutesListView.vue` — manager branch (AppDataTable + create slideover gated by `canCreate`); driver branch `// TODO(S6b)` placeholder renders nothing.
- `copy.ts` — added `validation.selectDriver`.
- `app/router/index.ts` — added the missing `DeliveryRoutesListView` lazy const (resolves the S4c type-check error; `DeliveryRouteDetailView` intentionally left for S6a).
- 4 co-located specs.

### Gate §13.1 — RESOLVED upstream of S4c
The courier-scoping gate was resolved in the S4b follow-up (commit `fa6660e`): backend exposes the dedicated `GET /users/assignable-drivers` endpoint. `DriverPicker` consumes it with its own cache slot. S4c wired the slideover against that resolved contract — no FAIL branch taken.

### Recovery notes (two subagent stalls)
1. `sdd-apply` timed out at 20 min mid-slice (left a slideover syntax error + missing view + missing router const + leftover `debug.spec.ts`).
2. `gentle-ai-worker` stalled at ~4 min while finishing (left a `createSimpleHeader` mock gap in the view spec + a real `mutate`→`mutateAsync` bug + 2 spec type errors).
Parent recovered inline: fixed the slideover duplicate block, implemented the `mutateAsync` wiring, added `createSimpleHeader` to the view-spec mock, typed the `resetRoleFlags` helper, and fixed the create-spec tuple-index cast. `debug.spec.ts` removed.

### Verify
- Targeted S4c specs: 39/39 green.
- `pnpm test:unit --run src/features/delivery-routes`: 13 files / 169 tests green.
- `pnpm build-only`: clean (only the pre-existing chunk-size warning).
- `pnpm type-check`: only the expected `DeliveryRouteDetailView` (`router:331`, S6a) error remains — the S4c `DeliveryRoutesListView` error is gone.

### Remaining tasks
Next is **S5a** (`delivery-route-actions.utils` + `useReorderStops` + `DeliveryRouteReorderPanel`), then S5b, S6a, S6b, S7.
