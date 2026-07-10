# Verification Report — notification-config

- **Change**: `notification-config`
- **Branch**: `feat/notification-config` (merge-base = `main` @ `d2d4a92`)
- **Mode**: STRICT TDD active · artifact store `hybrid`
- **Verdict**: **PASS** ✅ (independent, fresh-context verification)
- **Next**: `archive`

---

## Executive summary

The change is fully implemented and spec-compliant. All 10 requirements have real
implementation AND tests that assert the actual contract (not tautologies). The
authoritative gate `pnpm build` is **GREEN**. The three previously-fixed bugs are
regression-proofed with tests that feed the REAL production shapes.

The unit suite is **non-deterministic under full parallel load** — but this
flakiness is **pre-existing and present on `main`**, NOT introduced by this change.
In isolation, all 186 notification-config tests pass deterministically.

---

## Gate results

### `pnpm build` — GREEN ✅
`vue-tsc --build` + `vite build` completed clean in ~55s. `NotificationConfigView`
chunk emitted (18.41 kB). No type errors — notably WITHOUT any `as` cast masking a
type hole in the form composable (the double-map cast was removed in `de30844`).

### `pnpm test:unit` — baseline-only failures ✅ (with a flakiness caveat)

| Run | Scope | Result |
|---|---|---|
| Isolation: `src/features/system/notifications` + router/sidebar notif specs | 15 files | **186/186 PASS** |
| Full suite (branch) run A | 187 files | 2210 pass / 19 fail / 6 files |
| Full suite (branch) run B | 187 files | 2208 pass / 21 fail / 8 files |
| Full suite (**main**) run A | 172 files | **2015 pass / 18 fail / 5 files** |
| Full suite (**main**) run B | 172 files | 18+ fail incl. `router.spec.ts`, `ProductDetailView.test.ts` (NOT in the 5-file baseline) |

**Stable baseline (confirmed identical on main): 18 failures across 5 files** —
`useAuthStore`, `usePromotionColumns`, `DebtPaymentModal`, `useDebtPayment`,
`SaleDetailMetadataCard`.

**Diagnosis**: running the full suite on `main` (before this change exists) ALSO
produces extra flaky failures in untouched files (`router.spec.ts`,
`ProductDetailView.test.ts`). This proves the non-determinism is a **pre-existing,
suite-wide problem** (parallel-worker / router-cache pollution), not a regression
from notification-config. No new deterministic failure is attributable to this change.

---

## Per-requirement coverage

| REQ | Implemented | Test asserts real behavior |
|---|---|---|
| REQ-1 Permission subject registration | ✅ `auth.types.ts:53` + `ability.ts:22` | ✅ `ability.test.ts` — `userCan('read','NotificationConfig')` + `parsePermissionCode` |
| REQ-2 Screen visibility (sidebar + 403 guard) | ✅ route `meta.permission=['read','NotificationConfig']`; sidebar entry gated | ✅ `router.notifications.spec.ts` + `useSidebar.notifications.spec.ts` |
| REQ-3 Hydration on mount + never-configured defaults render OFF/empty (not error) | ✅ query maps GET once; form `watch(immediate)`; `buildDefaultForm` OFF/empty | ✅ `NotificationConfigView.spec` "never configured" + form hydration `undefined→value` |
| REQ-4 Master/action independence; master OFF greys | ✅ `computeActionRowState.disabled = !masterEnabled` | ✅ `notificationRowState.spec` + `ActionsAccordion.spec` |
| REQ-5 Recipient multi-select; names/stale chip; NOT auto-removed | ✅ `resolveSelectedRows` + `RecipientSelect.vue` chips | ✅ `recipientSelectState.spec` + `RecipientSelect.spec` (stale chip survives, removable only by user) |
| REQ-6 Save guards (dirty/in-flight/zero-recipient/update perm) | ✅ `computeCanSave` + `computeZeroRecipientViolation` | ✅ form spec triangulation + View permission-gate spec |
| REQ-7 Save behavior (PUT + invalidate + re-hydrate + toast) | ✅ `handleUpdateSuccess` | ✅ mutation spec asserts invalidate + `setForm(fromConfigResponse(resp))` + Spanish success toast |
| REQ-8 Spanish error mapping | ✅ `mapNotificationConfigError` + `extractErrorPayload` | ✅ mutation spec: real `{error:'INVALID_RECIPIENT'}` → field/no-toast; `UNKNOWN_ACTION_KEY` → toast; 401/403/400 fallbacks |
| REQ-9 Loading skeleton | ✅ `USkeleton` v-if `isLoading`, controls disabled | ✅ `NotificationConfigView.spec` |
| REQ-10 Data-driven action registry | ✅ `ACTION_REGISTRY` (single extension point) | ✅ `action-registry.spec` + `ActionsAccordion.spec` "extension via registry only" |
| PUT whitelist (exactly 3 keys) | ✅ `toPutBody` returns `{enabled, recipientUserIds, enabledActions}` | ✅ `notificationConfigMappers.spec` asserts exactly 3 keys, no extras |

---

## Regression-proof of the 3 fixed bugs

**(a) Backend error field `error ?? code`** — `extractErrorPayload` reads
`data.error ?? data.code` (`useUpdateNotificationConfigMutation.ts:193`). Test feeds
the REAL `{error:'INVALID_RECIPIENT', message}` shape, asserts `payload.code ===
'INVALID_RECIPIENT'`, routes to inline field, NO toast. Also covers `prefers error
over code`, `falls back to code`, `ignores non-string`. ✅ Real contract, not `{code:...}`-only.

**(b) Hydration watch** — `watch(source, v => v && hydrate(v), {immediate:true})`.
Test drives `undefined → value`, asserts form populated + `isDirty === false`. ✅

**(c) Double-map crash** — `source: Ref<NotificationConfigForm | undefined>`;
`hydrate` applies via `applyFormSnapshot` DIRECTLY, no `fromConfigResponse`, no
`as NotificationConfigResponse` cast in the form composable. GET→Form map happens
exactly ONCE (in the query). Test feeds the query's Form shape through `source` and
asserts `.not.toThrow()` + `recipientUserIds` intact. ✅

---

## Anti-hallucination / real wiring

- `NotificationConfigView.vue:46` passes `query.data` as `source`; does NOT call
  `hydrate()` manually → no double-hydration. ✅
- Sidebar (`useSidebar.ts:239`) + route (`index.ts:247`) both gate on
  `['read','NotificationConfig']`. ✅
- Recipients reuse `usersApi.listAssignable()` + `usersQueryKeys.assignable()` — no
  invented endpoint (`useNotificationConfigQuery.ts:65-70`). ✅

## Language contract

User-facing copy is neutral Spanish (`copy.ts`); identifiers/comments English. ✅

---

## Findings

### CRITICAL
None.

### WARNING
- **W1 — Pre-existing full-suite flakiness.** The unit suite is non-deterministic
  under parallel load (confirmed on `main`). The new `router.notifications.spec.ts`
  participates in the flaky router-cache set and can produce a false-red in CI.
  Not a blocker for THIS change (its tests are green in isolation), but the suite's
  determinism should be addressed separately (isolate router tests / reset the router
  cache or run router specs single-threaded).

### SUGGESTION
- **S1 — Stale-label duplication.** `recipientSelectState.ts:47` hardcodes
  `'Usuario no disponible'` as a raw literal while `copy.ts` exports the same string
  as `staleRecipient`. They match today but can drift. Import from `copy.ts`.
- **S2 — Query cast.** `useNotificationConfigQuery.ts:45` uses a single
  `as NotificationConfigResponse` on `query.data.value`. Legitimate (that ref IS the
  raw view), but typing the `queryFn` generic would remove the cast entirely.

---

## Manual-QA checklist (human click-through)

1. Nav to `/sistema/configuracion/notificaciones` WITH `read:NotificationConfig` → 3 cards render, no error toast.
2. Never-configured tenant → master OFF, recipients empty, actions greyed. No error.
3. Toggle master ON → action rows enable; Save becomes enabled (form dirty).
4. Open Actions accordion → "Punto de venta" / "Bajo inventario"; toggle → count 0/1 → 1/1.
5. Enable "Bajo inventario" with ZERO recipients → Save disabled + inline "Selecciona al menos un usuario a notificar".
6. Pick a recipient → chip with the user's name appears; violation clears; Save enables.
7. Save → PUT round-trip, Spanish success toast "Configuración de notificaciones guardada", form returns non-dirty.
8. Reload → GET re-hydrates prior state, no spurious dirty.
9. Simulate backend 400 `INVALID_RECIPIENT` → inline recipients message, NO toast.
10. Simulate 400 `UNKNOWN_ACTION_KEY` → error toast, no field error.
11. Seed a stale recipient id (not in assignable) → "Usuario no disponible" chip; NOT auto-removed; stays in PUT unless user removes it.
12. Revoke `update:NotificationConfig` (keep read) → sidebar visible, Save disabled, footer "No tienes permisos para guardar cambios".
13. Revoke `read:NotificationConfig` → sidebar entry gone; direct nav redirects to `/403`.

---

## Artifacts

- Engram topic: `sdd/notification-config/verify-report`
- File: `openspec/changes/notification-config/verify-report.md`
