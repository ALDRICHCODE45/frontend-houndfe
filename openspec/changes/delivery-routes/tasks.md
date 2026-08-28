# Tasks — delivery-routes (Rutas de entrega)

> Phase: `sdd-tasks` · Change id: `delivery-routes` · Authoritative inputs: `proposal.md`, `design.md`,
> `specs/**/spec.md` (62 REQ across 7 capabilities: 5 AUTH + 15 DRM + 8 DRC + 7 DNS + 11 AMP + 5 SALES + 11 CA).
> Slice order is locked to design §14 (S1→S7). The coarse 7-slice plan put 5/7 over the 600-line hard cap
> from `slice_budget.max_changed_lines` (S1≈840, S3≈700, S4≈1070, S5≈640, S6≈830). The user chose
> **divide large slices** (no chained PRs, `single-pr` unchanged). The plan below re-balances the
> coarse slices into **13 sub-slices** (S1a→S1b, S2, S3a→S3b, S4a→S4b→S4c, S5a→S5b, S6a→S6b, S7)
> so every sub-slice lands **≤600 LOC** (target ≤400 where practical) while preserving the original
> S1→S7 dependency order and keeping file ownership coherent per sub-slice. Strict TDD is ACTIVE per
> `openspec/config.yaml` (RED → GREEN → TRIANGULATE → REFACTOR, one slice = one commit).
> Delivery: `single-pr` (one branch, manual merge to main, no PRs); chain strategy `n/a`.

---

## Review Workload Forecast

The coarse forecast's 5 over-budget slices are split below. Every sub-slice is sized to land well
under the 600-line hard cap (most ≤450 LOC, none above 600). The single-PR strategy is unchanged:
every sub-slice lands on the same branch, ordered by its dependency, reviewed per-slice by the
parent between commits (parent owns the bounded-review gate).

| Field | Value |
|-------|-------|
| Estimated total changed lines (S1a→S7) | ~4,290 (additions + deletions, matches the coarse total) |
| Per sub-slice estimate | S1a ≈ 200 · S1b ≈ 580 · S2 ≈ 80 · S3a ≈ 550 · S3b ≈ 170 · S4a ≈ 280 · S4b ≈ 430 · S4c ≈ 580 · S5a ≈ 400 · S5b ≈ 290 · S6a ≈ 350 · S6b ≈ 480 · S7 ≈ 80 |
| 400-line budget risk | **Low** — no sub-slice exceeds the 600 hard cap; ~7/13 are within 400, the rest are 410–580 (above the working target but below the hard cap) |
| Chained PRs recommended | **No** (single-pr locked; user explicitly chose divide-over-chained) |
| Suggested split | (already applied — see per-sub-slice LOC above) |
| Decision needed before apply | **No** — single-pr + divide-large-slices is locked by parent decision |
| Delivery strategy | `single-pr` (locked by parent; non-negotiable per the delegated brief) |
| Chain strategy | `n/a` (single-pr; no chained PRs) |

Plain-text guard lines (verbatim — the parent gate consumes these directly):

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a
400-line budget risk: Low
```

> **Honest read for the parent:** the dependency graph and implementation order below preserve the
> coarse S1→S7 sequence from design §14. S2 is independent of S1a/S1b but is sequenced after S1a to
> keep the merge clean (notification registry has no delivery-route coupling; sequencing avoids two
> feature modules touching the same branches in the same commit). S3a is independent of S1a/S1b and
> is sequenced after S1b so the broader foundational layer lands first. S5a and S5b are siblings
> after S4c; either can ship first — the implementation order below lands S5a before S5b because the
> reorder panel precedes the simpler lifecycle mutations in the bounded review flow. The two open
> unknowns (driver-picker courier-scoping, customer `label` vs lat/lng) are locked into the verify
> blocks of the sub-slices that consume them (S4b/S4c/S6a for courier-scoping; S3b for label/lat-lng).

---

## Work Units

| # | Goal | Test cmd | Runtime path | Rollback |
|---|------|----------|--------------|----------|
| **S1a** | CASL registration (`DeliveryRoute` in `AppSubject`/`APP_SUBJECTS`/`PERMISSION_COPY`), `SHIPPED` status (constant + badge + filter + type widening), router + nav entries (no views), `deliveryRouteQueryKeys` shape. | `pnpm test:unit --run src/features/auth src/features/POS/sales src/core/shared/constants` | `/pos/rutas-de-entrega` (route exists, view missing until S4c — `pnpm build` accepted failing only for the two missing route components) | Revert commit; removes `DeliveryRoute` subject, menu, routes, query keys, SHIPPED additions atomically. |
| **S1b** | Zod schemas + inferred DTOs/timeline/payloads + 10 API methods + domain error map + extractor. No views. | `pnpm test:unit --run src/features/delivery-routes/api src/features/delivery-routes/interfaces` | n/a (pure data layer; consumed by S4–S6) | Revert commit; removes the 10 API methods + zod schemas + error map. CASL/menu/routes/query keys stay (S1a atomic). |
| **S2** | Notification toggle: `DELIVERY_NEXT_STOP` registry entry + `requiresRecipients: false` + `computeZeroRecipientViolation` refinement. | `pnpm test:unit --run src/features/system/notifications` | `/sistema/configuracion/notificaciones` (existing screen, gains one row) | Revert commit; registry loses `delivery` module, mapper refinement reverted, `ActionKey` narrowed. |
| **S3a** | Map port (`MapProvider`/`GeoPoint`) + Leaflet default provider + `AddressMapPicker` (write + read) + shared `formatAddress` + `leaflet`/`@types/leaflet` deps. No call-site swaps yet. | `pnpm test:unit --run src/core/shared` | n/a (consumed by S3b and S6b) | Revert commit; map provider files + `AddressMapPicker` + `formatAddress` removed; `leaflet` dep removed from `package.json`. |
| **S3b** | Customer-address `latitude`/`longitude` optionals + `mapAddress` normalization + `AddressModal` map section + 2 call-site formatter swaps. | `pnpm test:unit --run src/features/POS/customers src/features/POS/sales` | `/pos/clientes/*` and `/pos/ventas/*` (write map hosts) + future driver stop detail (read host, S6b) | Revert commit; lat/lng optionals dropped, `AddressModal` map section removed, two formatter swaps reverted. Map port + picker stay (S3a atomic). |
| **S4a** | `copy.ts` + `useDeliveryRouteRole` + `useDeliveryRoutesTable` + `useEligibleSales`. No views/components yet. | `pnpm test:unit --run src/features/delivery-routes/copy.ts src/features/delivery-routes/composables/__tests__/useDeliveryRouteRole.spec.ts src/features/delivery-routes/composables/__tests__/useDeliveryRoutesTable.spec.ts src/features/delivery-routes/composables/__tests__/useEligibleSales.spec.ts` | n/a (consumed by S4b/S4c) | Revert commit; removes the 3 composables + copy. |
| **S4b** | `DriverPicker` + `EligibleSalesPicker`. No slideover yet. | `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverPicker.spec.ts src/features/delivery-routes/components/__tests__/EligibleSalesPicker.spec.ts` | n/a (consumed by S4c slideover) | Revert commit; removes 2 picker components. Underlying composables stay (S4a atomic). |
| **S4c** | `useCreateDeliveryRoute` + `useUpdateDeliveryRoute` + `DeliveryRouteUpsertSlideover` + `DeliveryRoutesListView` (manager branch complete; driver branch is a placeholder). | `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useCreateDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useUpdateDeliveryRoute.spec.ts src/features/delivery-routes/components/__tests__/DeliveryRouteUpsertSlideover.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRoutesListView.spec.ts` | `/pos/rutas-de-entrega` (manager branch) | Revert commit; removes create/update mutations + slideover + manager list view. Picker components stay (S4b atomic). |
| **S5a** | Pure utility `delivery-route-actions.utils` + `useReorderStops` + `DeliveryRouteReorderPanel` (vuedraggable + up/down fallback). | `pnpm test:unit --run src/features/delivery-routes/utils src/features/delivery-routes/composables/__tests__/useReorderStops.spec.ts src/features/delivery-routes/components/__tests__/DeliveryRouteReorderPanel.spec.ts` | n/a (consumed by S6a detail view) | Revert commit; removes utility + reorder panel + reorder mutation. |
| **S5b** | `useDeleteDeliveryRoute` + `useStartDeliveryRoute` (409 race) + `useCancelDeliveryRoute` + `useAppendDeliveryRouteStop` (saleQueryKeys invalidation). | `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDeleteDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useStartDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useCancelDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useAppendDeliveryRouteStop.spec.ts` | n/a (consumed by S6a detail view) | Revert commit; removes 4 mutation composables. Reorder panel + mutation stay (S5a atomic). |
| **S6a** | `useDriverActiveRoutes` + `useDeliveryRouteDetail` + `DeliveryRouteDetailView` (discriminates manager vs driver; wires S4c + S5a + S5b mutations into manager branch; driver branch is a placeholder). | `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDriverActiveRoutes.spec.ts src/features/delivery-routes/composables/__tests__/useDeliveryRouteDetail.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts` | `/pos/rutas-de-entrega/:id` (manager branch complete) | Revert commit; removes detail composables + detail view. Mutation composables stay (S4c/S5a/S5b atomic). |
| **S6b** | `DriverRouteCard` + `DriverStopDetail` (uses `AddressMapPicker` from S3a) + `DeliveryRouteTimeline` + `useCheckInStop` + replaces S4c's list-view driver placeholder + replaces S6a's detail-view driver placeholder. | `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverRouteCard.spec.ts src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts src/features/delivery-routes/components/__tests__/DeliveryRouteTimeline.spec.ts src/features/delivery-routes/composables/__tests__/useCheckInStop.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRoutesListView.spec.ts` | `/pos/rutas-de-entrega` (driver branch) and `/pos/rutas-de-entrega/:id` (driver stop detail + timeline) | Revert commit; removes 3 components + check-in mutation + driver branches. Detail composables stay (S6a atomic). |
| **S7** | Mobile-first driver polish: touch-sized check-in targets (≥44px), single-column stop layout < `sm`. No contract change. | `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverRouteCard.spec.ts src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts` | `/pos/rutas-de-entrega/:id` (driver stop detail on phone) | Revert commit; restores default button heights and grid layouts. No contract change. |

---

## Dependency Graph

```
                                     ┌────────────────────┐
                                     │  S1a (foundations   │
                                     │   part 1: CASL +    │
                                     │   SHIPPED + keys +  │
                                     │   routes/nav)       │
                                     └──────────┬─────────┘
                                                │ (no deps)
            ┌───────────────────────────────────┼───────────────────────────────────┐
            │                                   │                                   │
            ▼                                   ▼                                   ▼
     ┌─────────────┐                    ┌──────────────┐                    ┌──────────────┐
     │ S1b (types  │                    │ S2 (notif)   │                    │ S3a (map port│
     │  + API +    │                    │  toggle,     │                    │  + Leaflet + │
     │  errors)    │                    │  standalone) │                    │  picker +    │
     └──────┬──────┘                    └──────────────┘                    │  formatter)  │
            │                                                                 └──────┬───────┘
            │                                                                        │
            │                                                                        ▼
            │                                                                 ┌──────────────┐
            │                                                                 │ S3b (customer │
            │                                                                 │  lat/lng +   │
            │                                                                 │  AddressModal│
            │                                                                 │  + swaps)    │
            │                                                                 └──────┬───────┘
            │                                                                        │
            ▼                                                                        │
     ┌──────────────┐                                                                 │
     │ S4a (copy +  │                                                                 │
     │  role + table│                                                                 │
     │  + eligible  │                                                                 │
     │  composables)│                                                                 │
     └──────┬───────┘                                                                 │
            │                                                                         │
            ▼                                                                         │
     ┌──────────────┐                                                                 │
     │ S4b (Driver  │                                                                 │
     │  Picker +    │                                                                 │
     │  Eligible    │                                                                 │
     │  SalesPicker)│                                                                 │
     └──────┬───────┘                                                                 │
            │                                                                         │
            ▼                                                                         │
     ┌──────────────┐                                                                 │
     │ S4c (muts +  │◄───────────────────────────────────────────────────────────────┘
     │  slideover + │   (S4c references no map; the lat/lng + AddressMapPicker wiring
     │  list view)  │    was completed in S3b but is independent of S4c's slice scope)
     └──────┬───────┘
            │
            ├─────────────────────────────┐
            │                             │
            ▼                             ▼
     ┌──────────────┐              ┌──────────────┐
     │ S5a (utils + │              │ S5b (delete  │
     │  reorder mut │              │  + start 409 │
     │  + reorder   │              │  + cancel +  │
     │  panel)      │              │  append)     │
     └──────┬───────┘              └──────┬───────┘
            │                             │
            └─────────────┬───────────────┘
                          ▼
                   ┌──────────────┐
                   │ S6a (driver  │
                   │  composables │
                   │  + detail    │
                   │  view)       │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ S6b (cards + │
                   │  stops +     │
                   │  timeline +  │
                   │  check-in +  │
                   │  driver      │
                   │  branches)   │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ S7 (mobile   │
                   │  polish)     │
                   └──────────────┘
```

`S1a` is the only unblocked entry point. `S1b` depends on S1a (uses `deliveryRouteQueryKeys`).
`S2` is independent of `S1a/S1b` (notification registry has no delivery-route coupling) but sequenced
after `S1a` to keep the merge clean. `S3a` is independent of S1a/S1b and sequenced after `S1b` so the
foundational layer lands first. `S3b → S4a → S4b → S4c → {S5a, S5b} → S6a → S6b → S7` is the strict
forward path. `S5a` and `S5b` are siblings — both depend only on `S1b` + `S4a` (copy for action
labels) and neither depends on the other, so they may land in either order; the implementation order
below lands S5a first (panel + DnD) then S5b (4 lifecycle mutations).

---

## Implementation Order

1. **S1a** — Foundations part 1: CASL `DeliveryRoute` (3 touch points) + `SHIPPED` (constant + badge + filter + type widening) + router + nav + `deliveryRouteQueryKeys`. Carries the **driver-picker courier-scoping confirm gate preview** (no DriverPicker touched here; the gate is enforced at the start of S4b) and the **customer `label` decision lock** (S3 lat/lng only is locked into the S3b plan).
2. **S1b** — Foundations part 2: zod schemas (`DeliveryRouteStatus`/`StopStatus`/`Actor`/`ShippingAddress`/`Stop`/5-event timeline discriminated union/`ResponseDto`) + 10 API methods (`list`/`getById`/`create`/`update`/`delete`/`start`/`cancel`/`appendStop`/`reorderStops`/`checkInStop`) + domain error map + extractor.
3. **S2** — `DELIVERY_NEXT_STOP` registry entry + `requiresRecipients: false` + `computeZeroRecipientViolation` refinement. Standalone (sequenced after S1a for clean merge).
4. **S3a** — Map port + Leaflet + `AddressMapPicker` (write + read) + shared `formatAddress` + `leaflet` dep.
5. **S3b** — Customer-address lat/lng + `mapAddress` + `AddressModal` map section + 2 formatter swaps. **Customer `label` decision locked here** (lat/lng only — `label` stays only in the formatter superset + stop projection; the gate passes or a follow-up is queued).
6. **S4a** — `copy.ts` + `useDeliveryRouteRole` (no new query, reads `authStore.permissionCodes`) + `useDeliveryRoutesTable` (wraps `useServerTable` + `fullList`) + `useEligibleSales`.
7. **S4b** — `DriverPicker` + `EligibleSalesPicker`. **Hard confirm gate on courier-scoping** when `DriverPicker` is first wired: parent confirms whether `GET /users/assignable` returns ONLY couriers (PASS keeps `DriverPicker` rendering verbatim; FAIL blocks the slideover wiring in S4c).
8. **S4c** — `useCreateDeliveryRoute` + `useUpdateDeliveryRoute` + `DeliveryRouteUpsertSlideover` + `DeliveryRoutesListView` (manager branch complete; driver branch is a placeholder). **Courier-scoping gate re-asserted** before the slideover is wired (FAIL blocks the slideover mutation composables; picker tests stay green via fixtures).
9. **S5a** — Pure `delivery-route-actions.utils` (`assertReorderCoversStops` + row-action gating + confirm copy + stop-progress `x/y`) + `useReorderStops` + `DeliveryRouteReorderPanel` (vuedraggable@4 + ↑/↓ fallback, explicit "Guardar orden" button, never autosave).
10. **S5b** — `useDeleteDeliveryRoute` (204 + `removeQueries`) + `useStartDeliveryRoute` (409 race: toast + invalidate + no auto-retry) + `useCancelDeliveryRoute` (422 transition) + `useAppendDeliveryRouteStop` (201 + `saleQueryKeys.confirmed` invalidation).
11. **S6a** — `useDriverActiveRoutes` (`?status=ACTIVE`, no `driverUserId` param) + `useDeliveryRouteDetail` (`placeholderData: keepPreviousData`) + `DeliveryRouteDetailView` (manager branch wires S4c + S5a + S5b mutations; driver branch is a placeholder). **Courier-scoping + label/lat-lng gates re-asserted** before mutations are wired into the detail.
12. **S6b** — `DriverRouteCard` + `DriverStopDetail` (uses `AddressMapPicker` from S3a in read mode) + `DeliveryRouteTimeline` (5 events in backend `at` ASC) + `useCheckInStop` + replaces both placeholders (S4c list-view driver branch + S6a detail-view driver branch).
13. **S7** — Mobile-first polish: touch-sized check-in targets (≥44px), single-column stop layout < `sm`. No contract change.

Every sub-slice is its own commit (work-unit discipline). Commits land in numeric order; no skipping.

---

## S1a — Foundations Part 1 (CASL + `SHIPPED` + query keys + routes/nav)

**Goal:** Land the cross-cutting plumbing (CASL subject, `SHIPPED` status, navigation + router entries,
query keys) so `S1b` can build types/API/errors on a known query-key surface and `S4a`–`S6b` can
build on a registered CASL subject and `SHIPPED` filter. No views, no zod schemas, no API methods.
`pnpm build` is accepted to fail only for the two missing route components (`DeliveryRoutesListView`,
`DeliveryRouteDetailView`); all other type errors are S1a defects.

**Files — MOD**
- `src/features/auth/interfaces/auth.types.ts` — append `'DeliveryRoute'` to `AppSubject` before `'all'`.
- `src/features/auth/authorization/ability.ts` — append `'DeliveryRoute'` to `APP_SUBJECTS` before `'all'`.
- `src/features/admin/roles/i18n/permissions.ts` — `SUBJECT_LABELS['DeliveryRoute'] = 'Rutas de entrega'` + `PERMISSION_COPY['DeliveryRoute']` block (exactly `create`/`read`/`update`/`delete` — no `manage`, no `batch_delete`).
- `src/app/navigation/navigation.registry.ts` — POS group child `pos-delivery-routes` (`i-lucide-truck`, `to: '/pos/rutas-de-entrega'`, `permission: ['read','DeliveryRoute']`).
- `src/app/router/index.ts` — two lazy routes (`pos-delivery-routes-list`, `pos-delivery-route-detail`), both `meta.permission: ['read','DeliveryRoute']`. Point at not-yet-existing views (accepted in S1a).
- `src/core/shared/constants/query-keys.ts` — add `deliveryRouteQueryKeys` (`list(tenantId, params)`, `listPrefix(tenantId)`, `detail(tenantId, id)`).
- `src/features/POS/sales/constants/sale.constants.ts` — `SHIPPED: 'SHIPPED'` value in `SALE_DELIVERY_STATUS`.
- `src/features/POS/sales/utils/saleStatus.utils.ts` — `SHIPPED: { label: 'Enviados', color: 'warning' }` in `deliveryStatusBadgeMap`.
- `src/features/POS/sales/config/salesFiltersSchema.ts` — `{ value: SALE_DELIVERY_STATUS.SHIPPED, label: 'Enviada' }` filter option.
- `src/features/POS/sales/interfaces/sale.types.ts` — comment-only update (the `SaleDeliveryStatus` type derives from the const, so the type widens automatically).
- `src/features/auth/authorization/__tests__/ability.test.ts` — assert `parsePermissionCode('create:DeliveryRoute')` grants; assert no silent drop.
- `src/features/admin/roles/i18n/__tests__/permissions.spec.ts` — assert subject label + 4 CRUD copy entries present; assert not in `HIDDEN_SUBJECTS`.
- `src/core/shared/constants/__tests__/query-keys.test.ts` — add `deliveryRouteQueryKeys` shape assertions (incl. `listPrefix`).
- `src/features/POS/sales/interfaces/__tests__/sale.constants.spec.ts` — assert `SHIPPED` membership.
- `src/features/POS/sales/utils/__tests__/saleStatus.utils.spec.ts` — assert badge label/tone.
- `src/features/POS/sales/config/__tests__/salesFiltersSchema.spec.ts` — assert filter option present.

**Files — NEW** — none.

**Test cmd:** `pnpm test:unit --run src/features/auth src/features/POS/sales src/core/shared/constants`

**TDD steps**

- [x] **RED** — Write co-located specs asserting: SHIPPED value + badge + filter, `AppSubject`/`APP_SUBJECTS` membership, `PERMISSION_COPY` 4-CRUD block, `deliveryRouteQueryKeys` shape (incl. `listPrefix` is a separate prefix slot, not `list(tenantId, {})`). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the minimum to make every spec pass: constant additions, three CASL touch points, router/nav stubs pointing at missing views, query keys. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add adjacent cases: SHIPPED plural label vs singular-feminine filter label distinction; `SaleDeliveryStatus` type widening via `pnpm build` (vue-tsc); permissions.ts not in `HIDDEN_SUBJECTS`; assert that adding `DeliveryRoute` to `AppSubject` does NOT alter the existing `PaymentDetail`/`PaymentMethod` subjects. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Tighten: label/tone maps are typed against the inferred `Record<...>` (no string widening); no duplicated copy between the permissions spec assertions. <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/auth src/features/POS/sales src/core/shared/constants` → 0 failures.
- `pnpm build` (vue-tsc) — **accepted to fail only** on the two missing route components (`DeliveryRoutesListView.vue` and `DeliveryRouteDetailView.vue`). All other type errors are S1a defects.
- `git diff --stat` — recorded for the parent; within the 400 working target.
- **Confirm-gate preview for S4b:** capture a note in the verify report that the **driver-picker courier-scoping** open unknown (§13.1) will gate `DriverPicker` wiring in S4b.

**Commit message**

```text
feat(delivery-routes): register CASL subject, SHIPPED status, query keys, and routes

- Closes the SHIPPED frontend gap (was rendering "Desconocido" everywhere) by adding
  the value to SALE_DELIVERY_STATUS, the badge map, and the sales filter schema;
  SaleDeliveryStatus widens automatically via the derived type.
- Registers the DeliveryRoute CASL subject in all three touch points (AppSubject,
  APP_SUBJECTS, permissions i18n copy) with exactly the four CRUD actions —
  no manage, no batch_delete — so parsePermissionCode grants uniformly and the
  role-permissions UI renders a "Rutas de entrega" section.
- Adds the two lazy routes and the sidebar entry gated by read:DeliveryRoute.
  Views are not yet implemented (S4c/S6a) — build is accepted to fail only on
  the two missing route components.
- Adds deliveryRouteQueryKeys (list/listPrefix/detail) so S1b's API specs and
  S4a+ composables have a stable key shape from day one.

Tests: co-located specs cover SHIPPED membership, CASL lock-step, query-key
shape (incl. listPrefix separation), and the permissions.ts not-hidden invariant.

Refs: design §3, §5.2, §6.1, §9.1, §9.2, §14; specs/AUTH (5), SALES (5);
S4b courier-scoping gate is previewed here and enforced in S4b.
```

---

## S1b — Foundations Part 2 (Zod types + API + errors)

**Goal:** Land the type/api/error layer that every delivery-routes composable + mutation + view
will consume. No views. Independent of S2 (notification registry) and S3 (map) — only depends on
S1a (uses `deliveryRouteQueryKeys`).

**Files — NEW**
- `src/features/delivery-routes/api/delivery-routes.api.ts` — 10 axios methods, one per endpoint (`list`, `getById`, `create`, `update`, `delete`, `start`, `cancel`, `appendStop`, `reorderStops`, `checkInStop`).
- `src/features/delivery-routes/interfaces/delivery-route.types.ts` — zod schemas + inferred DTOs for `DeliveryRouteStatus`, `DeliveryRouteStopStatus`, `DeliveryRouteActor`, `DeliveryRouteShippingAddress`, `DeliveryRouteStop`, `DeliveryRouteTimelineEvent` (5-event discriminated union), `DeliveryRouteResponseDto`, plus `Create`/`Update`/`Append`/`Reorder` payload schemas (whitelist). Includes `DELIVERY_ROUTE_STATUS_LABELS`, `DELIVERY_ROUTE_STATUS_TONES`, `DELIVERY_ROUTE_STOP_STATUS_LABELS`.
- `src/features/delivery-routes/interfaces/errors.ts` — `DeliveryRouteDomainErrorCode` union, `DELIVERY_ROUTE_ERROR_MAP`, `extractDeliveryRouteErrorCode`.
- Co-located specs:
    - `src/features/delivery-routes/api/__tests__/delivery-routes.api.spec.ts`
    - `src/features/delivery-routes/interfaces/__tests__/delivery-route.types.spec.ts`
    - `src/features/delivery-routes/interfaces/__tests__/errors.spec.ts`

**Files — MOD** — none outside the new module.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/api src/features/delivery-routes/interfaces`

**TDD steps**

- [x] **RED** — Write co-located specs asserting: 10 API method URLs/methods, zod schemas parse backend sample (5-event timeline + `ROUTE_CREATED.actor === null`), payload whitelist (reject `id`/`tenantId`/`timeline`/`activeRouteId`/`startedAt`/`completedAt`/`cancelledAt`/`createdAt`/`updatedAt`), `extractDeliveryRouteErrorCode` reads `.response.data.error` (never `.message`). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the minimum to make every spec pass: zod schemas, 10 API methods, error map + extractor. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: `paginateDeliveryRoutes` slice/total/pageCount math; forbidden keys enumerated one-by-one; `DeliveryRouteStatus`/`StopStatus` enums reject unknown values; `extractDeliveryRouteErrorCode` returns `null` for `.message`-only errors; the 5-event timeline discriminated union rejects an unknown `type`. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Extract a `paginateDeliveryRoutes` helper in the api spec (used later by `useDeliveryRoutesTable`); ensure label/tone maps are typed against the inferred `Record<DeliveryRouteStatus, …>` (no string widening); remove any duplicated copy between `errors.spec.ts` and the api spec. <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/delivery-routes/api src/features/delivery-routes/interfaces` → 0 failures.
- `pnpm build` (vue-tsc) — accepted failing only for the two route components (S1a carve-out).
- `git diff --stat` — at the 600-line hard cap (≈580 LOC estimated); within the 400-line working target only if specs are tight.

**Commit message**

```text
feat(delivery-routes): add zod schemas, 10 API methods, and domain error map

- Adds delivery-route.types.ts: zod schemas for DeliveryRouteStatus (DRAFT/ACTIVE/
  COMPLETED/CANCELLED), DeliveryRouteStopStatus (PENDING/IN_PROGRESS/COMPLETED/
  SKIPPED), DeliveryRouteActor, DeliveryRouteShippingAddress (lat/lng optional),
  DeliveryRouteStop, the 5-event DeliveryRouteTimelineEvent discriminated union
  (ROUTE_CREATED with actor=null, ROUTE_STARTED, STOP_CHECKED_IN with sortOrder,
  ROUTE_COMPLETED, ROUTE_CANCELLED), DeliveryRouteResponseDto, and the four
  request payload schemas (create/update/append/reorder — all whitelisted via
  forbidNonWhitelisted so id/tenantId/timeline/etc. can never cross the wire).
  Includes DELIVERY_ROUTE_STATUS_LABELS / _TONES and
  DELIVERY_ROUTE_STOP_STATUS_LABELS as the single label/tone source.
- Adds delivery-routes.api.ts: one axios method per endpoint (list, getById,
  create, update, delete, start, cancel, appendStop, reorderStops, checkInStop);
  paginateDeliveryRoutes helper used by useDeliveryRoutesTable in S4a.
- Adds interfaces/errors.ts: DeliveryRouteDomainErrorCode union, the Spanish
  DELIVERY_ROUTE_ERROR_MAP, and extractDeliveryRouteErrorCode that reads
  .response.data.error (never .message) — same defensive shape as
  extractPaymentDetailErrorCode.

Tests: types spec covers backend-sample parse + whitelist rejection + 5-event
discrimination + ROUTE_CREATED.actor=null; errors spec covers the .error-not-
.message extractor; api spec covers the 10 URLs/methods, the paginate helper,
and the forbidden-keys enumeration.

Refs: design §5.1, §5.3, §6.3, §7.1, §8.2; spec/delivery-route-management (15 REQ),
spec/delivery-route-check-in (8 REQ).
```

---

## S2 — Notification Toggle (`DELIVERY_NEXT_STOP`)

**Goal:** Add the tenant opt-in toggle for the "next stop arriving soon" email to the existing
Notificaciones admin screen without touching the screen's read-merge-PUT semantics. Empty recipients
must be legal when this is the only enabled action. Standalone (sequenced after S1a for clean merge).

**Files — MOD**
- `src/features/system/notifications/interfaces/notification-config.types.ts` — widen `ActionKey` union to include `'DELIVERY_NEXT_STOP'`; add `requiresRecipients?: boolean` to `ActionDescriptor` (default `true`).
- `src/features/system/notifications/registry/action-registry.ts` — add `delivery` module (`moduleKey: 'delivery'`, `moduleLabel: 'Entregas'`, `actions: [{ key: 'DELIVERY_NEXT_STOP', label: 'Próxima parada', description: 'Avisa al siguiente cliente que su paquete está por llegar.', requiresRecipients: false }]`).
- `src/features/system/notifications/utils/notificationConfigMappers.ts` — refine `computeZeroRecipientViolation` so empty recipients are legal when no enabled action requires recipients (default behavior unchanged for `LOW_STOCK`/`TIME_OFF_REQUESTED`).
- `src/features/system/notifications/registry/__tests__/action-registry.spec.ts` — assert the `delivery` module entry + copy + `requiresRecipients: false`.
- `src/features/system/notifications/utils/__tests__/notificationConfigMappers.spec.ts` — assert delivery-only-with-zero-recipients does NOT block; mixed enabled actions still block when zero recipients.

**Files — NEW** — none.

**Test cmd:** `pnpm test:unit --run src/features/system/notifications`

**TDD steps**

- [x] **RED** — Write the `delivery` module spec and the refined `computeZeroRecipientViolation` cases (delivery-only zero recipients → `false`; mixed enabled + zero recipients → `true`; LOW_STOCK-only zero recipients → `true`; empty enabled actions + zero recipients → `false`). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Add the registry module, widen `ActionKey`, add `requiresRecipients` to `ActionDescriptor`, refine `computeZeroRecipientViolation` to call `findActionDescriptor(key)?.requiresRecipients !== false`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add a case where `enabledActions: []` and `recipientUserIds: []` returns `false` (no recipient-based action ⇒ no violation); add a case asserting `LOW_STOCK`/`TIME_OFF_REQUESTED` defaults are unchanged. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Push the `findActionDescriptor` lookup behind a single per-action helper so the future registry extension point is one place (the registry already is, but verify no other switch/case grew). <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/system/notifications` → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 400 working target.

**Commit message**

```text
feat(notifications): add DELIVERY_NEXT_STOP toggle with requiresRecipients:false

- Adds the delivery module to the action registry with one action row:
  "Próxima parada" (DELIVERY_NEXT_STOP) carrying requiresRecipients:false so
  the backend can resolve the recipient to the next customer's email without
  requiring recipientUserIds from the UI.
- Widens ActionKey to include DELIVERY_NEXT_STOP and adds requiresRecipients?
  to ActionDescriptor (defaults to true for the existing two actions).
- Refines computeZeroRecipientViolation to ignore recipient requirements when
  no enabled action declares requiresRecipients; LOW_STOCK/TIME_OFF_REQUESTED
  semantics are unchanged.

Tests: action-registry spec asserts module + copy + flag; mappers spec covers
delivery-only, mixed, and the existing two actions' defaults.

Refs: design §10.3; spec/delivery-next-stop-notification (7 REQ DNS-001..007).
```

---

## S3a — Map Port + Leaflet + `AddressMapPicker` + `formatAddress`

**Goal:** Land the reusable map primitive behind a `MapProvider` port so no consumer imports `leaflet`
directly. Land the shared `formatAddress` util. No call-site swaps in this slice — S3b reuses both.

**Files — NEW**
- `src/core/shared/maps/map-provider.ts` — `MapProvider` port (`kind: 'leaflet'`, `createMap(container, opts)`, `geocode(query, signal?)`) + `GeoPoint { lat: number, lng: number }` type.
- `src/core/shared/maps/leaflet-map-provider.ts` — default Leaflet + OSM tile + Nominatim implementation (geocode, draggable marker, clear-pin, tile-failure swallow).
- `src/core/shared/components/AddressMapPicker.vue` — `mode: 'write' | 'read'`, `modelValue: GeoPoint | null`, debounced geocode input + draggable marker + clear-pin in write; static marker + popup in read.
- `src/core/shared/utils/formatAddress.ts` — label-first formatter (label → street + `#exterior` + `Int. interior` → neighborhood, municipality, city, state → `CP zipCode`); accepts a superset input type.
- Co-located specs:
    - `src/core/shared/utils/__tests__/formatAddress.spec.ts`
    - `src/core/shared/maps/__tests__/leaflet-map-provider.spec.ts` (jsdom-light: verify the port is consumed, not that Leaflet renders tiles).
    - `src/core/shared/components/__tests__/AddressMapPicker.spec.ts` (write + read modes, null model, clear-pin).

**Files — MOD**
- `package.json` — `leaflet` + `@types/leaflet` (justification in design §3).

**Test cmd:** `pnpm test:unit --run src/core/shared`

**TDD steps**

- [x] **RED** — Write the `formatAddress` spec asserting the label-first ordering + null/whitespace dropping + missing-everything → `''`; write the `AddressMapPicker` spec for write-mode debounce + draggable + clear-pin, read-mode static marker, null modelValue hides the map, no direct `leaflet` import. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the port + Leaflet provider + `AddressMapPicker` + `formatAddress`; add `leaflet` dep. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add tile-failure swallow test (provider swallows the error and the read view keeps the address text); add a regression spec for the formatters (covered in S3b swaps, but pin the shared output exactly here); add a Nominatim-cancel test (`AbortController.signal` honored). <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Extract a `pinToGeoPoint(formState)` helper from `AddressMapPicker`'s write mode so the emit shape is unit-testable; consolidate the `formatAddress` superset input type into a single `AddressFormatInput` exported from the same module (no cycle). <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/core/shared` → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 600 hard cap (≈550 LOC estimated); slightly above the 400 working target.

**Commit message**

```text
feat(core): add Leaflet MapProvider port, AddressMapPicker, and shared formatAddress

- Adds the MapProvider port (default Leaflet+OSM+Nominatim) so AddressModal and
  DriverStopDetail never import leaflet directly — the vendor swap seam is one
  file.
- Adds AddressMapPicker (write: debounced geocode + draggable pin + clear-pin;
  read: static marker + popup; hidden on null coords / tile failure).
- Adds the shared formatAddress util (label → street #exterior Int. interior →
  neighborhood, municipality, city, state → CP zipCode); call-site swaps land
  in S3b to keep this slice under the 600-line cap.

Tests: formatAddress spec pins label-first ordering; AddressMapPicker spec
covers both modes + null + clear-pin + no-direct-leaflet; leaflet-map-provider
spec covers the port contract (jsdom-light).

Refs: design §3, §4.3, §4.5, §8.1; spec/address-map-pin (11 REQ).
```

---

## S3b — Customer-Address lat/lng + `AddressModal` Map Section + Formatter Swaps

**Goal:** Wire the customer-address lat/lng optionals through every interface, normalize them in
`mapAddress`, mount the `AddressMapPicker` in `AddressModal`, and replace the two divergent local
formatters with the shared `formatAddress`. **Customer `label` decision is locked here.**

**Files — MOD**
- `src/features/POS/customers/interfaces/customer.types.ts` — add `latitude`/`longitude` to `CustomerAddressBackendResponse` (optional), `CustomerAddress` (nullable required), `CreateCustomerAddressPayload` (optional), `AddressFormInput` (nullable required). **Do NOT add `label`** — see Verify gate.
- `src/features/POS/customers/api/customer.api.ts` — `mapAddress` copies `latitude: item.latitude ?? null`, `longitude: item.longitude ?? null`.
- `src/features/POS/customers/components/AddressModal.vue` — mount `<AddressMapPicker mode="write" v-model="pin" />`; add `latitude`/`longitude` to `formState` + `addressSchema` (optional); emit them only when present (`...(event.data.latitude != null ? { latitude } : {})`).
- `src/features/POS/customers/components/CustomerUpsertSlideover.vue` — replace local `formatAddress` with shared import.
- `src/features/POS/sales/components/AssignCustomerSlideover.vue` — replace local `formatAddress` with shared import.
- `src/features/POS/customers/interfaces/__tests__/customer.types.spec.ts` — assert lat/lng acceptance + legacy omission.
- `src/features/POS/customers/api/__tests__/customer.api.spec.ts` — assert `mapAddress` normalizes lat/lng.
- `src/features/POS/customers/components/__tests__/AddressModal.spec.ts` — assert map mounts + emits lat/lng only when present + clear-pin works + doesn't gate eligibility.
- `src/features/POS/customers/components/__tests__/CustomerUpsertSlideover.spec.ts` — assert shared formatter is used (regression pin).
- `src/features/POS/sales/components/__tests__/AssignCustomerSlideover.spec.ts` — assert shared formatter is used (regression pin).

**Files — NEW** — none.

**Test cmd:** `pnpm test:unit --run src/features/POS/customers src/features/POS/sales`

**TDD steps**

- [x] **RED** — Write the `customer.types` spec for lat/lng on all 4 interfaces; write `customer.api` spec for `mapAddress` lat/lng normalization; write `AddressModal` spec asserting the map mounts, emits lat/lng only when present, and never gates eligibility; assert `label` is **NOT** present on the customer address types. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Add lat/lng to customer types; update `mapAddress`; mount the picker in `AddressModal`; swap the two formatter call sites. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add the legacy-omission test for `CustomerAddressBackendResponse` (lat/lng absent ⇒ normalized to `null`); add a regression spec for `CustomerUpsertSlideover` + `AssignCustomerSlideover` that pins the shared formatter output exactly (matches `formatAddress` spec from S3a). <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Extract a `pinToGeoPoint(formState)` helper inside `AddressModal` if it isn't already in S3a; ensure the emit shape is the only place that decides "include lat/lng on the payload" so adding a third call site later is a one-liner. <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/POS/customers src/features/POS/sales` → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 400 working target.
- **Decision locked in this slice:** customer `label` is **NOT** added to the customer address entity; `label` stays only in the `formatAddress` superset + the delivery-route stop projection. Locked at slice start, documented in the verify report.

**Commit message**

```text
feat(customers,sales): add lat/lng to customer-address types and swap to shared formatAddress

- Adds optional latitude/longitude to the four customer-address interfaces and
  CustomerAddressBackendResponse, normalizes them in mapAddress, and mounts
  AddressMapPicker in AddressModal — pin is optional and never gates eligibility.
- Replaces the two divergent local formatters in CustomerUpsertSlideover and
  AssignCustomerSlideover with the shared formatAddress (label → street #exterior
  Int. interior → neighborhood, municipality, city, state → CP zipCode).
- Customer 'label' decision locked to lat/lng-only per design §13.2 — `label`
  stays only in the formatAddress superset + the delivery-route stop projection.

Tests: customer.types/api/AddressModal specs assert the optional lat/lng path;
the two formatter swaps have regression pins; AddressModal spec asserts
clear-pin works and never gates eligibility.

Refs: design §5.3, §8.2, §13.2; spec/customer-address (11 REQ),
spec/address-map-pin (11 REQ).
```

---

## S4a — Copy + Role + Table + Eligible-Sales Composables

**Goal:** Land the data-layer composables for the manager list without any views or pickers yet.
`copy.ts` is the Spanish copy source; the three composables are independent of `AddressMapPicker`
and any view scaffolding.

**Files — NEW**
- `src/features/delivery-routes/copy.ts` — Spanish UI copy (toasts, titles, empty states, confirm copy, validation messages).
- `src/features/delivery-routes/composables/useDeliveryRouteRole.ts` — `isManager` ⇔ `create` or `delete`, `isDriver` ⇔ `read`-only, `canCreate`/`canDelete`/`canUpdate`. No new query (reads `authStore.permissionCodes`).
- `src/features/delivery-routes/composables/useDeliveryRoutesTable.ts` — `useServerTable` wrapper (full-fetch → `fullList` ref + page slice + derived flags). Status param threaded into query key.
- `src/features/delivery-routes/composables/useEligibleSales.ts` — thin wrapper over `useConfirmedSales` with `deliveryStatus: ['PENDING','SHIPPED']`.
- Co-located specs:
    - `src/features/delivery-routes/composables/__tests__/useDeliveryRouteRole.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useDeliveryRoutesTable.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useEligibleSales.spec.ts`

**Files — MOD** — none.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/copy.ts src/features/delivery-routes/composables/__tests__/useDeliveryRouteRole.spec.ts src/features/delivery-routes/composables/__tests__/useDeliveryRoutesTable.spec.ts src/features/delivery-routes/composables/__tests__/useEligibleSales.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for: `useDeliveryRouteRole` (create-or-delete ⇒ manager, read-only ⇒ driver, no new query); `useDeliveryRoutesTable` (one fetch → `fullList` + page slice, status param in key, invalidation refetches); `useEligibleSales` (filters to `{PENDING, SHIPPED}`); `copy.ts` exposes the expected keys (action labels, toasts, empty states). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the composables + copy. Wire `useDeliveryRoutesTable` to the existing `useServerTable` wrapper following the `usePaymentDetailsTable` precedent. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: `useDeliveryRoutesTable` status param changes the cache slot (different `status` ⇒ different cache entry); `useEligibleSales` passes the SHIPPED filter explicitly (regression pin against the S1a SHIPPED addition); `useDeliveryRouteRole` returns `{ isManager: false, isDriver: true }` for a `read+update`-only permission set. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Push the row action gating (`canCreate`/`canDelete`/`canUpdate`) into a single `useDeliveryRoutePermissions()` wrapper (added incrementally — `useDeliveryRouteRole` may export it directly or split it later); confirm no `reactive()` where `ref()` suffices. <!-- sdd-owner: implementation -->

**Verify**

- The 3 spec files → 0 failures.
- `pnpm build` (vue-tsc) → clean (no views to wire).
- `git diff --stat` — within the 400 working target.
- All S1a + S1b + S2 + S3a + S3b verify checks re-run: green.

**Commit message**

```text
feat(delivery-routes): add copy, role discriminator, table composable, and eligible-sales composable

- Adds copy.ts (Spanish UI copy: toasts, titles, empty states, confirm copy,
  validation messages) as the single copy source for S4b/S4c/S5/S6.
- Adds useDeliveryRouteRole: no new query — reads authStore.permissionCodes
  (already loaded by the global beforeEach guard) and exposes isManager
  (create OR delete), isDriver (read-only), canCreate/canDelete/canUpdate.
- Adds useDeliveryRoutesTable: wraps useServerTable with fullList + page slice
  + derived flags following the usePaymentDetailsTable precedent. Status param
  is threaded into the query key (different status ⇒ different cache slot).
- Adds useEligibleSales: thin wrapper over useConfirmedSales with
  deliveryStatus: ['PENDING', 'SHIPPED'] (depends on the S1a SHIPPED addition).

Tests: 3 composable specs cover discriminator, fullList+page slice, status-keyed
invalidation, and the PENDING+SHIPPED filter (regression pin against S1a).

Refs: design §6.2, §6.4, §9.3; spec/delivery-route-management (15 REQ — manager
branch data layer).
```

---

## S4b — `DriverPicker` + `EligibleSalesPicker`

**Goal:** Land the two picker components used by the slideover. **This is where the courier-scoping
open unknown is enforced** — `DriverPicker` is built first, the API response is captured, and the
gate either passes (manager can safely assign) or blocks the S4c slideover wiring.

**Files — NEW**
- `src/features/delivery-routes/components/DriverPicker.vue` — single-select over `usersApi.listAssignable()`, emits `update:driverUserId`, empty-state "No hay repartidores disponibles".
- `src/features/delivery-routes/components/EligibleSalesPicker.vue` — multi-select over `useEligibleSales`, emits `update:selected`, empty-state "No hay ventas pendientes o enviadas".
- Co-located specs:
    - `src/features/delivery-routes/components/__tests__/DriverPicker.spec.ts`
    - `src/features/delivery-routes/components/__tests__/EligibleSalesPicker.spec.ts`

**Files — MOD** — none.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverPicker.spec.ts src/features/delivery-routes/components/__tests__/EligibleSalesPicker.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for `DriverPicker`: lists assignable users, required, empty state, `update:driverUserId` emit. Write specs for `EligibleSalesPicker`: multi-select, status-only client filter (PENDING+SHIPPED), empty state, `update:selected` emit. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the two pickers; `DriverPicker` consumes `usersApi.listAssignable()` directly (no client filter — courier-scoping is server-side per the gate below). <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: `DriverPicker` empty/loading/error state matrix (uses fixture lists); `EligibleSalesPicker` carries the SHIPPED row through verbatim (regression pin against S1a); pin the API URL/method called by `DriverPicker` (`GET /users/assignable`) so a future scoped endpoint is a visible contract change. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Tighten `defineProps`/`defineEmits` types (single-select `onUpdate` simplified from union overload to `AssignableUser | null`); explicit chip below the trigger for stable selection display + test reachability; inline empty-state copy for page-level reachability; no `reactive()` anywhere (all `ref`/`computed`). `useAssignableUsers` extraction deferred — the notification recipient picker already has its own composable (`useManagerPicker`) and `usersApi.listAssignable()` is the only consumer here, so the dedicated composable would be premature abstraction. <!-- sdd-owner: implementation -->

**Verify**

- 2 specs → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 600 hard cap (≈430 LOC estimated); slightly above the 400 working target.
- **Hard confirm gate on courier-scoping:** parent confirms whether `GET /users/assignable` returns ONLY couriers (read+update on `DeliveryRoute`). PASS keeps `DriverPicker` rendering `AssignableUser {id, name}` verbatim with no client filter; FAIL blocks the S4c slideover wiring and queues a backend request for a scoped endpoint/param OR a role field to filter client-side. **Gate outcome (PASS/FAIL + captured backend response) is recorded in the verify report.**

**Commit message**

```text
feat(delivery-routes): add DriverPicker and EligibleSalesPicker

- Adds DriverPicker: single-select over usersApi.listAssignable(), renders
  AssignableUser {id, name} verbatim, empty-state "No hay repartidores
  disponibles". Courier-scoping gate verified in the slice verify report.
- Adds EligibleSalesPicker: multi-select over useEligibleSales (PENDING +
  SHIPPED), empty-state "No hay ventas pendientes o enviadas". Backend
  re-validates address and rejects address-less sales with 422
  DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE (surfaced inline by the slideover in
  S4c).

Tests: pickers specs cover the empty/loading/error matrix, the assignable
URL pin, and the SHIPPED row passthrough (regression pin against S1a).

Refs: design §4.1, §6.4, §9.3, §13.1; spec/delivery-route-management (DRM-001..007
— manager pickers). Courier-scoping gate confirmed.
```

---

## S4c — Manager Mutations + Slideover + List View (Manager Branch)

**Goal:** Land the manager branch of `/pos/rutas-de-entrega`. Composition surfaces stay thin
(vue-best-practices §1.2): `DeliveryRoutesListView` orchestrates, `DeliveryRouteUpsertSlideover`
owns the form. **Courier-scoping gate is re-asserted here before the slideover is wired.**

**Files — NEW**
- `src/features/delivery-routes/composables/useCreateDeliveryRoute.ts` — `useMutation` (POST), invalidates `listPrefix(tenantId)`, maps domain errors.
- `src/features/delivery-routes/composables/useUpdateDeliveryRoute.ts` — `useMutation` (PATCH), invalidates `detail(tenantId, id)` + `listPrefix(tenantId)`, maps domain errors.
- `src/features/delivery-routes/components/DeliveryRouteUpsertSlideover.vue` — create/edit form (sales picker create-only, driver picker, notes ≤280), zod inline errors, emits `create`/`edit`.
- `src/features/delivery-routes/views/DeliveryRoutesListView.vue` — composition + table integration; manager branch complete; driver branch is a placeholder (`return null` with a `// TODO(S6b)` marker) until S6b replaces it.
- Co-located specs:
    - `src/features/delivery-routes/composables/__tests__/useCreateDeliveryRoute.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useUpdateDeliveryRoute.spec.ts`
    - `src/features/delivery-routes/components/__tests__/DeliveryRouteUpsertSlideover.spec.ts`
    - `src/features/delivery-routes/views/__tests__/DeliveryRoutesListView.spec.ts` (manager branch only; driver branch stub returns null)

**Files — MOD** — none outside the new module.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useCreateDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useUpdateDeliveryRoute.spec.ts src/features/delivery-routes/components/__tests__/DeliveryRouteUpsertSlideover.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRoutesListView.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for: `useCreateDeliveryRoute` / `useUpdateDeliveryRoute` (mutationFn URL/method/payload whitelist; invalidations; domain error mapping; never optimistic); `DeliveryRouteUpsertSlideover` (create shows sales picker, edit hides, zod field errors); `DeliveryRoutesListView` manager branch (renders table + new-route button when `create` permitted, empty/loading/error states). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the 2 mutations, the slideover, the manager list view. Wire `DeliveryRoutesListView`'s manager branch to `useDeliveryRoutesTable` + the slideover. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: "Nueva ruta" hidden when `create` absent (no disabled placeholder); inline zod errors for empty sales / empty driver / notes>280; create happy-path payload omits every forbidden key; edit hides the sales picker slot; edit on non-DRAFT surfaces `422` toast; empty/error/loading state matrix; `formatAddress` rendering is unchanged when called from picker (regression pin against S3a/S3b). <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Tighten `DeliveryRouteUpsertSlideover` props/emits contract (typed `defineProps`/`defineEmits` with `Sale[]`/`Assignee[]`); confirm no `reactive()` where `ref()` suffices. <!-- sdd-owner: implementation -->

**Verify**

- 4 specs → 0 failures (manager branch).
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — at the 600-line hard cap (≈580 LOC estimated); within the 400-line working target only with tight specs.
- **Courier-scoping gate re-asserted** before the slideover is wired: PASS keeps the slideover; FAIL blocks this slice's mutation composables (slideover + picker tests still green via fixtures; the mutation tests are parked until the backend exposes a courier-scoped source).

**Commit message**

```text
feat(delivery-routes): add manager list, create slideover, edit slideover, and create/update mutations

- Adds useCreateDeliveryRoute (POST, invalidates listPrefix) and
  useUpdateDeliveryRoute (PATCH, invalidates detail + listPrefix) with the
  standard read-merge-PUT invalidation pattern (no optimistic writes).
- Adds DeliveryRouteUpsertSlideover (create: eligible-sales multi-select +
  driver picker + notes<=280; edit: driver + notes only, sales picker hidden).
- Adds DeliveryRoutesListView with the manager branch complete (table + new-
  route button gated by create:DeliveryRoute); driver branch is a placeholder
  until S6b.

Tests: 4 specs cover mutation URLs/methods/payload-whitelist/invalidations,
slideover create-vs-edit mode, list-view manager branch gating, and the empty/
loading/error matrix. Courier-scoping gate re-asserted.

Refs: design §4.1, §6.3, §6.4, §10; spec/delivery-route-management (DRM-001..015
— manager branch).
```

---

## S5a — Pure Utility + Reorder Mutation + Reorder Panel

**Goal:** Land the pure utility (`delivery-route-actions.utils`), the reorder mutation composable, and
the reorder panel (vuedraggable + up/down fallback, explicit "Guardar orden" button, never autosave).
S5a is the **DnD bundle** — all three files are tightly coupled.

**Files — NEW**
- `src/features/delivery-routes/utils/delivery-route-actions.utils.ts` — pure builders for row-action dropdown items, the `x/y` stop-progress string, the confirm copy, the `assertReorderCoversStops(orderedStopIds, existingStopIds): string | null` exactly-once guard.
- `src/features/delivery-routes/composables/useReorderStops.ts` — `useMutation` (PUT `:id/stops/reorder`), invalidates `detail + listPrefix`, maps 422 transition.
- `src/features/delivery-routes/components/DeliveryRouteReorderPanel.vue` — `vuedraggable@4` over `sortablejs` + ↑/↓ fallback buttons, explicit "Guardar orden" button, never drag-end autosave, calls `assertReorderCoversStops` before `useReorderStops.mutateAsync`. Hidden when `status !== 'DRAFT'`.
- Co-located specs:
    - `src/features/delivery-routes/utils/__tests__/delivery-route-actions.utils.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useReorderStops.spec.ts`
    - `src/features/delivery-routes/components/__tests__/DeliveryRouteReorderPanel.spec.ts`

**Files — MOD** — none outside the new module.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/utils src/features/delivery-routes/composables/__tests__/useReorderStops.spec.ts src/features/delivery-routes/components/__tests__/DeliveryRouteReorderPanel.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for: `assertReorderCoversStops` exactly-once (length mismatch, unknown id, duplicate, valid); `useReorderStops` (URL/method/payload, invalidations, 422 transition toast); `DeliveryRouteReorderPanel` (DnD reorder + ↑/↓ produce same array, guard blocks bad payload, hidden when not DRAFT, "Guardar orden" never autosaves on drag-end). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the pure util + the reorder mutation + the reorder panel using `vuedraggable@4` over the already-installed `sortablejs`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: `useReorderStops` invalidates BOTH `detail` and `listPrefix`; `DeliveryRouteReorderPanel` falls back to up/down when DnD is unavailable (assert the local ordered copy converges across both interactions); assert the panel does NOT autosave when only DnD drags happen (Guard returns null ⇒ mutationFn is not called until "Guardar orden"). <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Push the domain-error toast mapping into a single `surfaceDeliveryRouteError(error, channel)` helper reused by `useReorderStops` (and extended to the S5b mutations when they land). <!-- sdd-owner: implementation -->

**Verify**

- 3 specs → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 600 hard cap (≈400 LOC estimated); right at the 400 working target.

**Commit message**

```text
feat(delivery-routes): add reorder panel, reorder mutation, and pure actions utility

- Adds DeliveryRouteReorderPanel with vuedraggable@4 + per-row ↑/↓ fallback,
  an explicit "Guardar orden" button (no drag-end autosave), and a pure
  assertReorderCoversStops guard that blocks exactly-once violations before
  the request fires. Hidden when status !== 'DRAFT' (DRM-009/010 gating).
- Adds useReorderStops (PUT :id/stops/reorder, invalidates detail + listPrefix,
  maps 422 DELIVERY_ROUTE_INVALID_TRANSITION to a toast + refetch).
- Adds the pure delivery-route-actions utils (row-action dropdown items,
  x/y stop-progress string, confirm copy, exactly-once guard).

Tests: utility spec pins the exactly-once guard; mutation spec covers URL/method/
payload/invalidations; panel spec covers DnD + ↑/↓ convergence + guard + no-
autosave + non-DRAFT hidden.

Refs: design §4.1, §6.3, §10.2; spec/delivery-route-management (DRM-009..012).
```

---

## S5b — Delete + Start (409 Race) + Cancel + Append Mutations

**Goal:** Land the remaining 4 manager mutations. Independent of S5a (no shared file); S5a/S5b are
siblings that both depend on S1b + S4a only.

**Files — NEW**
- `src/features/delivery-routes/composables/useDeleteDeliveryRoute.ts` — `useMutation` (DELETE, 204), invalidates `listPrefix(tenantId)` + `removeQueries(detail)`.
- `src/features/delivery-routes/composables/useStartDeliveryRoute.ts` — `useMutation` (POST `:id/start`), invalidates `detail + listPrefix`, maps 409 specifically (`DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` toast + refetch + no auto-retry).
- `src/features/delivery-routes/composables/useCancelDeliveryRoute.ts` — `useMutation` (POST `:id/cancel`), invalidates `detail + listPrefix`, maps 422 transition.
- `src/features/delivery-routes/composables/useAppendDeliveryRouteStop.ts` — `useMutation` (POST `:id/stops`, 201), invalidates `detail + listPrefix + saleQueryKeys.confirmed`.
- Co-located specs:
    - `src/features/delivery-routes/composables/__tests__/useDeleteDeliveryRoute.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useStartDeliveryRoute.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useCancelDeliveryRoute.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useAppendDeliveryRouteStop.spec.ts`

**Files — MOD** — none outside the new module.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDeleteDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useStartDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useCancelDeliveryRoute.spec.ts src/features/delivery-routes/composables/__tests__/useAppendDeliveryRouteStop.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for the 4 mutation composables (URL/method/payload, invalidations, 409 toast text + refetch + no auto-retry, 422 transition toast, `removeQueries` on delete, `saleQueryKeys.confirmed` invalidation on append). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the 4 mutation composables. Reuse `surfaceDeliveryRouteError` from S5a (now also covers these 4). <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: 409 invalidation hits BOTH `detail` and `listPrefix` (assert two invalidate calls); `useAppendDeliveryRouteStop` invalidates `saleQueryKeys.confirmed` so the eligible picker refreshes; `useDeleteDeliveryRoute` calls `removeQueries(detail)` AND invalidates `listPrefix`; `useStartDeliveryRoute` does NOT auto-retry on 409 (assert mutation is called exactly once even when the resolver errors). <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — All four share the same `surfaceDeliveryRouteError` + `extractDeliveryRouteErrorCode` path; tighten `defineProps`/return types; no `reactive()` where `ref()` suffices. <!-- sdd-owner: implementation -->

**Verify**

- 4 specs → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 600 hard cap (≈290 LOC estimated); well within the 400 working target.
- All S5a + S4a + S4b + S4c verify checks re-run: green.

**Commit message**

```text
feat(delivery-routes): add delete, start (409 race), cancel, and append mutations

- Adds useDeleteDeliveryRoute (204 + removeQueries(detail) + invalidate listPrefix).
- Adds useStartDeliveryRoute: 409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE
  → specific toast + detail + list invalidation + no auto-retry (recovery
  requires the manager to remove/replace the conflicted sale).
- Adds useCancelDeliveryRoute (422 transition toast + refetch).
- Adds useAppendDeliveryRouteStop (201 + detail + listPrefix + saleQueryKeys.
  confirmed invalidation so the eligible picker refreshes).

Tests: 4 mutation specs cover URL/method/payload, invalidations (incl. 409 +
saleQueryKeys.confirmed + removeQueries on delete), and the no-auto-retry
invariant.

Refs: design §6.3, §7.2, §10.1; spec/delivery-route-management (DRM-008..012).
```

---

## S6a — Driver Composables + Detail View (Manager Branch Wired)

**Goal:** Land the detail composables and the detail view composition surface. The manager branch
wires S4c + S5a + S5b mutations; the driver branch is a placeholder (`return null` with a `// TODO(S6b)`
marker). **Courier-scoping + label/lat-lng gates are re-asserted here before mutations are wired
into the detail.**

**Files — NEW**
- `src/features/delivery-routes/composables/useDriverActiveRoutes.ts` — plain `useQuery` over `?status=ACTIVE`; no client filter; no `driverUserId` param.
- `src/features/delivery-routes/composables/useDeliveryRouteDetail.ts` — `useQuery` over `getById(id)`; `placeholderData: keepPreviousData`; invalidation by every mutation.
- `src/features/delivery-routes/views/DeliveryRouteDetailView.vue` — composition surface that discriminates manager vs driver; manager branch wires S4c (create/update) + S5a (reorder + reorder panel) + S5b (delete/start/cancel/append) into the manager actions area; driver branch is a placeholder until S6b.
- Co-located specs:
    - `src/features/delivery-routes/composables/__tests__/useDriverActiveRoutes.spec.ts`
    - `src/features/delivery-routes/composables/__tests__/useDeliveryRouteDetail.spec.ts`
    - `src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts`

**Files — MOD** — none outside the new module.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/composables/__tests__/useDriverActiveRoutes.spec.ts src/features/delivery-routes/composables/__tests__/useDeliveryRouteDetail.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for: `useDriverActiveRoutes` (single `?status=ACTIVE` fetch, NO `driverUserId` param, server-scoping implicit); `useDeliveryRouteDetail` (key shape, `placeholderData: keepPreviousData`, invalidation by mutations); `DeliveryRouteDetailView` (role-gated controls per DRM-013, 404/403 → not-found, 409 start flow, delete hidden unless DRAFT+zero-stop). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the 2 composables + the view. The detail view wires the S4c + S5a + S5b mutations into the manager branch (driver branch returns null placeholder). Driver 403 is mapped to the same full-page "Ruta no encontrada" state as `ENTITY_NOT_FOUND`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: start 409 surfaces the specific copy + refetches (assert no auto-retry); driver 403 never leaks presence (assert no banner / no toast); delete hidden unless DRAFT + zero stops + delete permission; assert the driver branch returns null (placeholder marker) until S6b. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Extract a `useDeliveryRoutePermissions()` wrapper (already started in S4a/S5a) and have the detail view consume it; tighten the view's role-discriminator reads to a single `useDeliveryRouteRole` call. <!-- sdd-owner: implementation -->

**Verify**

- 3 specs → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 600 hard cap (≈350 LOC estimated); within the 400 working target.
- **Hard confirm gate (re-asserted at slice start):** courier-scoping decision from S4b verify report + customer `label` decision from S3b verify report — both must be PASS. If S4b gate was inconclusive, S6a wiring of the manager mutations is blocked (manager-branch tests still green via fixtures; the detail view tests are parked until the gate clears).

**Commit message**

```text
feat(delivery-routes): add driver list/detail composables and detail view (manager branch wired)

- Adds useDriverActiveRoutes: server-scoped ?status=ACTIVE, no driverUserId
  param — CASL scopes server-side.
- Adds useDeliveryRouteDetail: placeholderData: keepPreviousData; invalidated
  by every mutation (verified via the S4c/S5a/S5b mutation specs).
- Adds DeliveryRouteDetailView: discriminates manager vs driver; manager branch
  wires S4c (create/update) + S5a (reorder + panel) + S5b (delete/start/
  cancel/append) mutations; driver branch is a placeholder until S6b.
  Driver 403 is mapped to the same full-page "Ruta no encontrada" state as
  404 ENTITY_NOT_FOUND — no presence leak.

Tests: 2 composable specs (driver list, detail); detail view spec covers
manager-branch mutation wiring + role-gated controls + 404/403 + 409 start
flow + delete gating + driver-branch placeholder.

Refs: design §4.1, §4.2, §6.2, §6.3, §7.2, §10.1, §11; spec/delivery-route-
check-in (8 REQ DRC-001..008 — composables) + manager detail (DRM-013..015).
Courier-scoping + customer-label gates re-asserted.
```

---

## S6b — Driver Visual Components + Check-in + Driver Branches

**Goal:** Land the three driver visual components (`DriverRouteCard`, `DriverStopDetail`,
`DeliveryRouteTimeline`), the check-in mutation, and replace both placeholders (S4c list-view driver
branch + S6a detail-view driver branch) with the real driver rendering.

**Files — NEW**
- `src/features/delivery-routes/composables/useCheckInStop.ts` — `useMutation` (POST `:id/stops/:stopId/check-in`); invalidates `detail + listPrefix`.
- `src/features/delivery-routes/components/DriverRouteCard.vue` — mobile-first card (status badge, driver name, x/y counter, tap target).
- `src/features/delivery-routes/components/DriverStopDetail.vue` — `customer.name` + `formatAddress(stop.shippingAddress)` + read-only `<AddressMapPicker mode="read">` (rendered only when lat/lng non-null) + check-in button (disabled for non-`PENDING`, spinner while `isPending`).
- `src/features/delivery-routes/components/DeliveryRouteTimeline.vue` — read-only vertical timeline, 5 event labels in backend `at` ASC order, no edit/delete affordance.
- Co-located specs:
    - `src/features/delivery-routes/composables/__tests__/useCheckInStop.spec.ts`
    - `src/features/delivery-routes/components/__tests__/DriverRouteCard.spec.ts`
    - `src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts`
    - `src/features/delivery-routes/components/__tests__/DeliveryRouteTimeline.spec.ts`

**Files — MOD**
- `src/features/delivery-routes/views/DeliveryRoutesListView.vue` — replace S4c driver-placeholder with `DriverRouteCard` list (remove the `// TODO(S6b)` marker). Update the co-located spec to assert the driver branch renders the cards.
- `src/features/delivery-routes/views/DeliveryRouteDetailView.vue` — replace S6a driver-placeholder with `DriverStopDetail` + `DeliveryRouteTimeline`. Update the co-located spec to assert the driver branch rendering.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverRouteCard.spec.ts src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts src/features/delivery-routes/components/__tests__/DeliveryRouteTimeline.spec.ts src/features/delivery-routes/composables/__tests__/useCheckInStop.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRoutesListView.spec.ts src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts`

**TDD steps**

- [x] **RED** — Write specs for: `useCheckInStop` (URL/method, invalidations, replay-safe idempotency note); `DriverRouteCard` (status badge, driver name, x/y or "Sin paradas", empty/loading/error); `DriverStopDetail` (stops in backend sortOrder, `formatAddress` rendering, check-in disabled for non-PENDING, map only when coords, fallback to address text on tile failure, fallback "Cliente sin nombre" for null customer); `DeliveryRouteTimeline` (5 event types in backend order, `STOP_CHECKED_IN` shows `sortOrder + 1`, `ROUTE_CREATED` renders no actor line); `DeliveryRoutesListView` driver branch (renders `DriverRouteCard` list, no manager controls); `DeliveryRouteDetailView` driver branch (renders `DriverStopDetail` + timeline + check-in). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the composable + 3 components. Wire the 2 view-file modifications (replace placeholders). <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add cases: last-stop check-in transitions the route to COMPLETED (server-driven, detail refetch reflects it); repeat check-in is idempotent (no duplicate toast, no state change); `STOP_CHECKED_IN` position uses `sortOrder + 1` (regression pin); driver 403 still maps to not-found (assert no banner / no toast). <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Tighten `DriverStopDetail` props to `defineProps<{ stop: DeliveryRouteStop }>()` with `defineEmits` for the check-in event; remove any `reactive()` where `ref()` suffices. <!-- sdd-owner: implementation -->

**Verify**

- 6 specs (4 component + 1 composable + 1 view spec each for list/detail) → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — within the 600 hard cap (≈480 LOC estimated); slightly above the 400 working target.
- All S6a + S5a + S5b + S4a + S4b + S4c + S1a + S1b verify checks re-run: green.

**Commit message**

```text
feat(delivery-routes): add driver visual components, check-in mutation, and replace driver-branch placeholders

- Adds DriverRouteCard (mobile-first, x/y counter, tap-to-detail) and
  DriverStopDetail (customer name + formatAddress + read-only AddressMapPicker
  only when coords present + check-in button gated by stop.status === PENDING,
  spinner while pending, fallback to address text on tile failure).
- Adds DeliveryRouteTimeline (5 event types, backend at ASC, no edit affordance,
  ROUTE_CREATED renders no actor line, STOP_CHECKED_IN renders position as
  sortOrder + 1).
- Adds useCheckInStop (POST :id/stops/:stopId/check-in, invalidates detail +
  listPrefix, replay-safe idempotency note).
- Replaces both placeholders: S4c's list-view driver branch now renders the
  DriverRouteCard list; S6a's detail-view driver branch now renders
  DriverStopDetail + DeliveryRouteTimeline.

Tests: 4 new specs + 2 view-spec updates cover the driver-branch rendering,
the 5-event timeline ordering, the check-in idempotency, and the driver 403
no-presence-leak invariant.

Refs: design §4.2, §4.4, §6.2, §6.3, §7.2, §11; spec/delivery-route-check-in
(8 REQ DRC-001..008) + manager detail (DRM-013..015).
```

---

## S7 — Mobile-First Driver Polish

**Goal:** Touch-sized check-in targets, single-column stop layout on mobile. No contract change.

**Files — MOD**
- `src/features/delivery-routes/components/DriverRouteCard.vue` — check-in / tap target `min-height: 44px`.
- `src/features/delivery-routes/components/DriverStopDetail.vue` — single-column layout below `sm` breakpoint; check-in button is the largest interactive element on the row.
- `src/features/delivery-routes/components/__tests__/DriverRouteCard.spec.ts` — assert touch target heights.
- `src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts` — assert single-column layout below `sm`.

**Files — NEW** — none.

**Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/__tests__/DriverRouteCard.spec.ts src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts`

**TDD steps**

- [x] **RED** — Write specs asserting: `min-height: 44px` on the check-in button + card tap target; single-column layout below `sm`; check-in button is the largest interactive element on the stop row (assert computed `width`/`height` relative to other controls). <!-- sdd-owner: implementation -->
- [x] **GREEN** — Apply the tailwind classes for the layout + min-height (no JS changes). <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Add a viewport test (`sm`/`md`) for the stop row's flex direction + check-in button visibility on a phone-holding thumb zone. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Pull the touch-target constant into a small `constants/touch.ts` if a second surface grows; otherwise inline is fine. <!-- sdd-owner: implementation -->

**Verify**

- 2 specs → 0 failures.
- `pnpm build` (vue-tsc) → clean.
- `git diff --stat` — well within the 400 working target.

**Commit message**

```text
feat(delivery-routes): mobile-first driver polish — touch-sized targets and single-column layout

- Sets check-in / card tap targets to min-height: 44px.
- Stops stack as a single column below sm; the check-in button is the
  largest interactive element on the stop row.

Tests: DriverRouteCard spec asserts touch heights; DriverStopDetail spec
asserts single-column layout below sm.

Refs: design §11 (mobile-first driver polish); spec DRC-008.
```

---

## Parent Actions (grouped after implementation work)

These are the only checkboxes marked `<!-- sdd-owner: parent -->`. Apply executes every
implementation checkbox above; the parent owns the gates between sub-slices.

- [x] **Courier-scoping confirm gate (blocks S4b wiring + S4c slideover + S6a mutation wiring)** — parent confirms whether `GET /users/assignable` returns ONLY couriers (read+update on `DeliveryRoute`). PASS/FAIL recorded; FAIL blocks the S4b `DriverPicker` (the picker spec still passes via fixtures; S4c slideover and S6a mutation wiring are parked until the gate clears). <!-- sdd-owner: parent -->
- [x] **Customer-label vs lat/lng gate (locks S3b decision)** — parent confirms whether `CustomerAddress` gains `label` or only `latitude`/`longitude`. PASS locks the S3b `lat/lng only` decision (already implemented); FAIL triggers a follow-up that threads `label` through `mapAddress` read-only + `AddressModal` display (the shared formatter already handles it). <!-- sdd-owner: parent -->
- [x] **Per-sub-slice bounded review (apply end-of-sub-slice gate)** — after each `feat(delivery-routes): …` commit, parent runs the sub-slice's test cmd + `pnpm build` (vue-tsc) + `git diff --stat` and records PASS/FAIL before the next sub-slice starts. <!-- sdd-owner: parent -->
- [x] **Apply → verify handoff** — once S7 lands, parent triggers `sdd-verify` against `specs/**/spec.md` (62 REQ audit, per-REQ status + evidence with file:line) and writes `verify-report.md`. <!-- sdd-owner: parent -->
- [x] **Verify → archive handoff** — on PASS verdict, parent triggers `sdd-archive` and moves the change to `openspec/changes/archive/<ISO-date>-delivery-routes/`. <!-- sdd-owner: parent -->
