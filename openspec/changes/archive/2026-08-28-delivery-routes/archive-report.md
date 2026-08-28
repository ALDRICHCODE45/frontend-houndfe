# Archive Report — delivery-routes

> Phase: `sdd-archive` · Store: `openspec` · Change id: `delivery-routes`
> Archive path: `openspec/changes/archive/2026-08-28-delivery-routes/`
> Branch: `feat/delivery-routes` · Archive HEAD: `a874d58` (working tree holds the rename)
> Archived: 2026-08-28

---

## Verdict

**PASS — archived.** The `delivery-routes` change was fully implemented across 13 sub-slices,
verified with a PASS audit (62/62 requirements, 152/152 scenarios, 0 blockers, 0 critical findings),
and is now moved to the dated archive. The active `openspec/changes/delivery-routes/` source of truth
has been retired; future work on this capability will reuse the canonical delivery-route domain
specs that landed via the separate `sdd-sync` flow (out of scope for this archive per the parent brief).

---

## Final State (PASS verify, 13 slices)

### Verification evidence

- **`verify-report.md`** carries a valid `gentle-ai.verify-result/v1` fenced-yaml envelope:
  - `verdict: pass`
  - `requirements: 62/62`
  - `scenarios: 152/152`
  - `blockers: 0`
  - `critical_findings: 0`
  - `test_command: pnpm test:unit --run src/features/delivery-routes` → exit 0, **382 passed / 0 failed** (27 files)
  - `build_command: pnpm build` → exit 0 (vue-tsc + vite clean; only pre-existing Rollup chunk-size advisory)
- **Cross-feature remediation suites** re-run green: 23 passed / 0 failed across
  `customer.types.spec.ts` + `saleStatus.utils.spec.ts`.
- **Validated** with `gentle-ai sdd-verify-validate --requirements 62 --scenarios 152` → `valid: true`.
- **`tasks.md`**: **57/57 checkboxes complete** (`grep -c '^- \[x\]' = 57`; `grep -c '^- \[ \]' = 0`).
  All parent-owned gates (courier-scoping, label-vs-lat-lng, per-sub-slice bounded review, apply→verify
  handoff, verify→archive handoff) are `[x]`.

### Requirement coverage (62 REQ across 7 capabilities)

| Capability | REQ count | Status |
|------------|-----------|--------|
| address-map-pin (AMP) | 11 | PASS 11/11 |
| authorization (AUTH) | 5 | PASS 5/5 |
| customer-address (CA) | 11 | PASS 11/11 |
| delivery-next-stop-notification (DNS) | 7 | PASS 7/7 |
| delivery-route-check-in (DRC) | 8 | PASS 8/8 |
| delivery-route-management (DRM) | 15 | PASS 15/15 |
| sales (SALES) | 5 | PASS 5/5 |
| **Total** | **62** | **PASS 62/62** |

---

## Slice Commits

All 13 sub-slices landed on `feat/delivery-routes` (single-pr strategy; ≤600 LOC hard cap respected per
slice; strict TDD with RED → GREEN → TRIANGULATE → REFACTOR per slice).

| # | Slice | Commit | Description |
|---|-------|--------|-------------|
| S1a | Foundations part 1 | (in series, see log) | CASL `DeliveryRoute` subject, `SHIPPED` status, query keys, router + nav |
| S1b | Foundations part 2 | (in series, see log) | Zod schemas + inferred DTOs + 10 API methods + domain error map |
| S2 | Notification toggle | (in series, see log) | `DELIVERY_NEXT_STOP` registry entry + `requiresRecipients: false` + mapper refinement |
| S3a | Map port | (in series, see log) | `MapProvider` port + Leaflet default + `AddressMapPicker` + shared `formatAddress` |
| S3b | Customer-address lat/lng | (in series, see log) | Lat/lng optionals + `mapAddress` normalization + `AddressModal` map section + formatter swaps |
| S4a | Copy + role + table + eligible-sales composables | (in series, see log) | `copy.ts` + `useDeliveryRouteRole` + `useDeliveryRoutesTable` + `useEligibleSales` |
| S4b | `DriverPicker` + `EligibleSalesPicker` | (in series, see log) | Picker components |
| S4c | Mutations + slideover + list view | (in series, see log) | `useCreateDeliveryRoute` + `useUpdateDeliveryRoute` + `DeliveryRouteUpsertSlideover` + manager-branch `DeliveryRoutesListView` |
| S5a | Reorder panel | (in series, see log) | `delivery-route-actions.utils` + `useReorderStops` + `DeliveryRouteReorderPanel` |
| S5b | Lifecycle mutations | (in series, see log) | `useDeleteDeliveryRoute` + `useStartDeliveryRoute` (409 race) + `useCancelDeliveryRoute` + `useAppendDeliveryRouteStop` |
| S6a | Driver composables + detail view | (in series, see log) | `useDriverActiveRoutes` + `useDeliveryRouteDetail` + `DeliveryRouteDetailView` (manager branch wired) |
| S6b | Driver visual + check-in | (in series, see log) | `DriverRouteCard` + `DriverStopDetail` + `DeliveryRouteTimeline` + `useCheckInStop` + placeholder replacements |
| S7 | Mobile-first polish | `d7ea031` | Touch-sized check-in targets (≥44px), single-column stop layout < `sm` |

Plus the remediation + verify + docs commits:

| Commit | Description |
|--------|-------------|
| `5c66aba` | **S7 remediation: 7 PARTIAL gaps fixed (see next section)** |
| `bd65b10` | docs(sdd): verify-report PASS for delivery-routes |
| `f908a88` | docs(sdd): mark verify-to-archive handoff (tasks 959) |
| `a874d58` | docs(sdd): add verify-result envelope to verify-report (HEAD) |

Full commit log lives at `git log --oneline feat/delivery-routes -- openspec/changes/delivery-routes/`.

---

## 7 Remediation Gaps Fixed (commit `5c66aba`)

The first verify audit surfaced 7 PARTIAL gaps. All 7 were resolved in commit `5c66aba` with real
source evidence and green targeted suites before the second verify pass landed a PASS verdict.

1. **ConfirmModal for start / cancel / delete** (DRM-010/011/012) — wired in
   `DeliveryRouteDetailView.vue` via the shared `ConfirmModal` from
   `@/core/shared/components/ConfirmModal.vue`, consuming the `copy.ts` confirm block.
2. **Cancel gating `{DRAFT, ACTIVE}`** (DRM-011/013) — `canShowCancel` now enables both DRAFT and ACTIVE.
3. **"Agregar parada" append-stop UI** (DRM-008/013) — `EligibleSalesPicker` + button wired to
   `useAppendDeliveryRouteStop`.
4. **"Editar" DRAFT-gated** (DRM-013) — `canShowEdit` requires `status === 'DRAFT'`.
5. **`NOT_APPLICABLE` badge** (REQ-SALES-005) — `saleStatus.utils.ts` now maps
   `NOT_APPLICABLE: { label: 'N/A', color: 'neutral' }`.
6. **`CreateCustomerAddressPayload.latitude/longitude` → `number | null`** (REQ-CA-003) — fixed in
   `customer.types.ts` (widened from `number` to `number | null`).
7. **Copy strings aligned** — check-in toast `Entrega registrada`, add-button `Nueva ruta`, manager
   empty state, and confirm bodies are aligned (two cosmetic nuances noted in Risks, non-blocking).

---

## Verification Evidence (Fresh, Post-Remediation)

### Targeted delivery-routes suite

```text
pnpm test:unit --run src/features/delivery-routes
Test Files  27 passed (27)
     Tests  382 passed (382)
  Duration  15.32s
```

### Cross-feature remediation suites

```text
pnpm test:unit --run \
  src/features/POS/customers/interfaces/__tests__/customer.types.spec.ts \
  src/features/POS/sales/utils/__tests__/saleStatus.utils.spec.ts
Test Files  2 passed (2)
     Tests  23 passed (23)
  Duration  1.10s
```

### Build

```text
pnpm build   # run-p type-check "build-only" → vue-tsc --build + vite build
✓ built in 16.28s
```

- `vue-tsc --build` → 0 errors.
- `vite build` → exit 0. The only diagnostic is the pre-existing Rollup chunk-size advisory
  (`index` ~887 kB; `DeliveryRouteDetailView` ~201 kB) — a warning, not a failure.

### Slice-specific test files exercised (all green)

- `api/__tests__/delivery-routes.api.spec.ts`
- `interfaces/__tests__/{delivery-route.types,errors}.spec.ts`
- `__tests__/copy.spec.ts`
- `utils/__tests__/delivery-route-actions.utils.spec.ts`
- 16 `composables/__tests__/*.spec.ts`
- 7 `components/__tests__/*.spec.ts`
- 2 `views/__tests__/*.spec.ts`
- plus the two cross-feature specs above

The full `pnpm test:unit --run` was intentionally NOT re-run (per the parent brief it takes ~12 min
and has known pre-existing worker-pool flakiness). The prior audit's full-suite run (`5364 passed`)
plus these targeted re-runs are sufficient.

---

## Canonical Spec Sync

**Not performed by this archive.** The parent brief scoped this archive to the move + report only.

The seven delivery-routes domain specs (`address-map-pin`, `authorization`, `customer-address`,
`delivery-next-stop-notification`, `delivery-route-check-in`, `delivery-route-management`,
`sales`) are **net-new domains** — `openspec/specs/delivery-route-management/` (and the 6 sibling
delivery-route domains) do not exist yet. There is no prior canonical content to merge into.

The cross-feature canonical specs that this change touched (`authorization`, `customer-list`,
`sales`) are explicitly out of scope per the parent brief ("Do NOT touch `src/` or
`openspec/specs/`").

Future canonical sync for these delivery-route domains will be handled by the parent's
`sdd-sync` phase on a separate change (or as part of the next delivery-routes follow-up).

---

## Risks Observed (carried forward from verify-report, non-blocking)

1. **Two cosmetic copy nuances (non-blocking).** (a) The start ConfirmModal title is
   `"¿Iniciar la ruta?"` (`copy.ts:82`) while DRM-010 UI-copy says `"Iniciar ruta"`; the body is
   exact. (b) The driver empty state is `"No tienes rutas activas en este momento."`
   (`copy.ts:64`) while DRC-001 UI-copy says `"No tienes rutas activas"` — a superset that
   contains the spec phrase verbatim. Both are cosmetic; do not change behavior; archived as-is.
2. **`REQ-CA-001` optional-vs-required nuance (pre-existing, non-blocking).** `CustomerAddress`
   declares `latitude?/longitude?: number|null` (optional) rather than strictly required-nullable;
   `mapAddress` guarantees runtime presence so the entity is always normalized. Non-blocking.
3. **`REQ-DRM-004` endpoint naming.** `DriverPicker` uses `GET /users/assignable-drivers`
   (`user.api.ts`) rather than the spec-literal `listAssignable()`. This is the resolved S4b
   courier-scoping gate (commit `fa6660e`) — an improvement, not a regression — recorded in
   apply-progress.
4. **Chunk-size build advisory (pre-existing).** `index` (~887 kB) and `DeliveryRouteDetailView`
   (~201 kB) exceed Rollup's 500 kB default; advisory only.

---

## Artifacts Archived

The following files (all tracked at the time of the move) were relocated from
`openspec/changes/delivery-routes/` to `openspec/changes/archive/2026-08-28-delivery-routes/` via
`git mv` to preserve rename history:

```text
openspec/changes/archive/2026-08-28-delivery-routes/
├── apply-progress.md                                  # 53 KB — TDD cycle evidence per sub-slice
├── archive-report.md                                  # this file
├── design.md                                          # 53 KB — architecture + data contracts
├── exploration.md                                     # 17 KB — repo reconnaissance
├── proposal.md                                        # 21 KB — Why/What/Capabilities/Approach
├── tasks.md                                           # 80 KB — 13 sub-slice work plan, all `[x]`
├── verify-report.md                                   # 19 KB — PASS verdict + verify-result envelope
└── specs/
    ├── address-map-pin/spec.md
    ├── authorization/spec.md
    ├── customer-address/spec.md
    ├── delivery-next-stop-notification/spec.md
    ├── delivery-route-check-in/spec.md
    ├── delivery-route-management/spec.md
    └── sales/spec.md
```

Total: 7 markdown files + 7 spec files + this archive report = **15 files** preserved.

---

## Pre-Archive Gates Confirmed

| Gate | Result |
|------|--------|
| Active change selection unambiguous | PASS — `delivery-routes` is the unique target |
| `actionContext.mode` not `workspace-planning` | PASS — implementation mode |
| Move target inside `openspec/changes/archive/` | PASS — `2026-08-28-delivery-routes/` |
| `verify-report.md` present | PASS |
| `verify-report.md` verdict `pass` | PASS — `verdict: pass` |
| 0 blockers / 0 critical findings | PASS — `blockers: 0`, `critical_findings: 0` |
| Required artifacts present (proposal, design, tasks) | PASS |
| `tasks.md` has 0 unchecked implementation task boxes | PASS — `grep -c '^- \[ \]' = 0` |
| File-backed sync (or explicit sync fallback approval) | N/A — parent brief: move + report only, no canonical sync |
| Legacy flat `specs.md` only | N/A — `specs/<domain>/spec.md` directory present |
| Destructive merge approval | N/A — net-new domain, no destructive merges |
| `config.yaml` `archive` rule honored | PASS — output path + `archive-report.md` present |

**No Final Task Completion Gate block triggered.** No stale-checkbox reconciliation required.

---

## Next Phase

None. The change has been archived. Future work on this capability will be opened as a new
`delivery-routes-*` follow-up change (or run through `sdd-sync` separately if the parent wants
the seven net-new domain specs to land in `openspec/specs/`).

---

## Commit Gate

The parent owns the RDD commit of this archive move. Working tree status (post-move, pre-commit):

```text
A  openspec/changes/archive/2026-08-28-delivery-routes/apply-progress.md
A  openspec/changes/archive/2026-08-28-delivery-routes/archive-report.md
A  openspec/changes/archive/2026-08-28-delivery-routes/design.md
A  openspec/changes/archive/2026-08-28-delivery-routes/exploration.md
A  openspec/changes/archive/2026-08-28-delivery-routes/proposal.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/address-map-pin/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/authorization/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/customer-address/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/delivery-next-stop-notification/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/delivery-route-check-in/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/delivery-route-management/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/specs/sales/spec.md
A  openspec/changes/archive/2026-08-28-delivery-routes/tasks.md
A  openspec/changes/archive/2026-08-28-delivery-routes/verify-report.md
D  openspec/changes/delivery-routes/apply-progress.md
D  openspec/changes/delivery-routes/design.md
D  openspec/changes/delivery-routes/exploration.md
D  openspec/changes/delivery-routes/proposal.md
D  openspec/changes/delivery-routes/specs/address-map-pin/spec.md
D  openspec/changes/delivery-routes/specs/authorization/spec.md
D  openspec/changes/delivery-routes/specs/customer-address/spec.md
D  openspec/changes/delivery-routes/specs/delivery-next-stop-notification/spec.md
D  openspec/changes/delivery-routes/specs/delivery-route-check-in/spec.md
D  openspec/changes/delivery-routes/specs/delivery-route-management/spec.md
D  openspec/changes/delivery-routes/specs/sales/spec.md
D  openspec/changes/delivery-routes/tasks.md
D  openspec/changes/delivery-routes/verify-report.md
```

(The actual working tree will show renames `R`, not delete+add, since `git mv` was used.)