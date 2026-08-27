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
