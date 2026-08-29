# Tasks — driver-route-cockpit-redesign

Strict-TDD work plan for the driver route cockpit redesign. Authority chain: `design.md` (final technical authority) > `specs/{driver-cockpit-derivation,driver-cockpit-shell,driver-cockpit-drawer,delivery-route-check-in}/spec.md` > `proposal.md`/`exploration.md` (product context only). Where a preliminary proposal name conflicts (e.g. `DriverCurrentStopCard`, `DriverStopSheet`, `DriverDeliveryActionBar`, `useCockpitManualRefresh`), the final design/specs supersede it — those artifacts do not exist.

Architecture lock (design §3, §10): exactly seven new SFCs under `src/features/delivery-routes/components/cockpit/` (`DriverRouteCockpit`, `DriverCockpitHeader`, `DriverOperationalStops`, `DriverRouteSpine`, `DriverCockpitDrawer`, `DriverStopPanel`, `DriverCockpitFooter`), one pure derivation composable, one quick-actions utility. `DeliveryRouteDetailView.vue` remains the single server-state surface (one `useDeliveryRouteDetail` observer, one `useCheckInStop` mutation). Manager branch, driver list, API, DTO schemas, query keys, mutation composable, router/guard/sidebar, and global shell are untouched. No backend/API/schema/dependency/global-shell work is scheduled. The superseded `DriverStopDetail.vue` and its obsolete spec are deleted **inside S11b** — the explicit REFACTOR continuation of S11a's already-proven RED → GREEN → TRIANGULATE cycle. S11b introduces no new behavior, runs no fresh RED/GREEN cycle (a deletion-only RED cycle is fake TDD), and inherits S11a's green evidence; its checkboxes are REFACTOR/VERIFY/CLEANUP only.

Commit execution note: every slice below plans its commit message as a review unit, but **actual commit execution remains parent/user-authorized** per repository safety policy — apply phase records evidence and proposes the commit; it does not force it.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,429 (12 slices; additions + deletions, tests included) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: S1+S2+S3 · PR 2: S4–S7 · PR 3: S8–S10 · PR 4: S11a (view wiring, bounded ~380) · PR 5: S11b (old-card deletion continuation, ~559) — recommended chain B; every PR above 400 carries an explicit size exception with its exact total (see decision A/B/C); S11a is bounded |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

**Estimate basis (honest, incl. co-located specs):**

| Slice | NEW impl | NEW spec | MOD code | DEL | Σ |
|-------|----------|----------|----------|-----|---|
| S1 derivation | ~180 | ~420 | 0 | 0 | **~600 (exact hard cap)** |
| S2 quick actions | ~100 | ~190 | 0 | 0 | ~290 |
| S3 copy source | 0 | 0 | ~110 | 0 | ~110 |
| S4 header | ~130 | ~150 | 0 | 0 | ~280 |
| S5 operational stops | ~160 | ~180 | 0 | 0 | ~340 |
| S6 spine | ~100 | ~150 | 0 | 0 | ~250 |
| S7 footer | ~150 | ~190 | 0 | 0 | ~340 |
| S8 stop panel | ~170 | ~210 | 0 | 0 | ~380 |
| S9 drawer | ~180 | ~250 | 0 | 0 | ~430 |
| S10 cockpit root | ~220 | ~250 | 0 | 0 | ~470 |
| S11a view wiring | 0 | 0 | ~380 (view ~110 + view spec rework ~260 + composable comment ~10) | 0 | **~380** |
| S11b old-card deletion (REFACTOR continuation) | 0 | 0 | 0 | ~559 (DriverStopDetail.vue ~152 + spec ~407) | **~559** |

Total ≈ **4,429 changed lines** (additions + deletions, **12 slices**). **Slice-size confirmation: every slice is ≤ 600 lines** — S1 sits exactly at the 600 hard cap (180 impl + 420 spec = 600, **no apply expansion allowed**), S11a = ~380, S11b = ~559, and no slice exceeds 600; **no slice-cap exceptions remain**. Four units exceed the 400-line review budget — S1 (600), S9 (430), S10 (470), S11b (559) — and each carries an explicit PR-level size exception with its exact estimated total (decision options A/B/C below). In the strict-budget grouping, **S2+S3 = 400 sits exactly at the review budget** (no exception, no over-claim) and **S11a = 380 is bounded** (no exception). The former 939-line combined S11 is split into bounded S11a (full RED/GREEN/TRIANGULATE, no deletions) + S11b (REFACTOR continuation inheriting S11a's evidence) per the parent recovery correction. SDD apply-progress (checkbox toggles) and the later `verify-report.md` are artifact-only and excluded from the source budget. Generated goldens: none.

Four units above 400 lines → **High budget risk** → chained PRs recommended. `chain_strategy` is **deferred/pending** by parent instruction; **Decision needed before apply: Yes** — the parent/user must approve a chain strategy and the size-exception acceptance under `ask-on-risk`.

## User decision needed before apply (ask-on-risk)

`delivery_strategy=ask-on-risk`, `chain_strategy=pending`. Planning only — commit execution stays user-authorized. Totals are additions + deletions, tests included; SDD artifacts excluded.

**A. Strict-budget chain — 11 PRs.** Every PR ≤ 400 except four justified atomic exceptions; S2+S3 sits exactly at 400; S11a is bounded.

| PR | Slices | Total | Status |
|----|--------|-------|--------|
| A1 | S1 | 600 | Size exception — atomic single module at the exact 600 hard cap; no apply expansion allowed |
| A2 | S2+S3 | 400 | **Exactly at budget** — no exception |
| A3 | S4 | 280 | Bounded |
| A4 | S5 | 340 | Bounded |
| A5 | S6 | 250 | Bounded |
| A6 | S7 | 340 | Bounded |
| A7 | S8 | 380 | Bounded |
| A8 | S9 | 430 | Size exception — single SFC + co-located spec (tests-with-code atomicity; no legal split) |
| A9 | S10 | 470 | Size exception — single SFC + co-located spec (tests-with-code atomicity; no legal split) |
| A10 | S11a | 380 | **Bounded** — view wiring + branch swap fits the 400 budget with no deletions |
| A11 | S11b | 559 | Size exception — pure deletion continuation of S11a (REFACTOR/VERIFY/CLEANUP only, inherits S11a's RED/GREEN evidence); atomic single deletion unit; no slice-cap exception (559 ≤ 600) |

Modules that still require a justified atomic exception: **S1, S9, S10, S11b** — no legal further split of any of them under tests-with-code atomicity (S11b's component + spec are one atomic deletion unit; splitting them would create an orphan-spec or fake-RED state). Cost: **9 of 11 PRs are foundation-only** — the first user-visible path lands in PR A10 (S11a); A11 is the cleanup continuation; maximal merge churn and forwarding risk.

**B. Coherent practical chain — 5 PRs (design §12-aligned; recommended).** Fewer PRs; every PR total enumerated and every size exception explicit; S11a stays its own bounded PR.

| PR | Slices | Total | Exception |
|----|--------|-------|-----------|
| B1 | S1+S2+S3 (pure foundation: derivation + quick actions + copy) | 1,000 | Yes |
| B2 | S4+S5+S6+S7 (shell SFCs: header / operational stops / spine / footer) | 1,210 | Yes |
| B3 | S8+S9+S10 (overlays: stop panel + drawer + cockpit root) | 1,280 | Yes |
| B4 | S11a (view wiring + driver branch swap) | 380 | **No — bounded** |
| B5 | S11b (old-card deletion continuation — REFACTOR only) | 559 | Yes |

First user-visible path lands in **PR B4** (S11a); PRs B1–B3 are foundation-only by dependency necessity (the view cannot mount the cockpit before S10 exists); B5 is the cleanup continuation with no new behavior. Re-merging S11a+S11b into one PR (the old 939-line unit) is not recommended: it recreates a 939-line review and a near-cap slice for zero review benefit.

**C. Single-PR size exception.** Entire change as one PR ≈ **4,429** total (one exception; zero foundation-only PRs, but a single ~4,429-line review; viable only with staged per-slice review inside the one PR, which effectively re-creates the chain as internal gates).

**Recommendation: B** — the smallest topology (5 PRs) that keeps every PR a complete, coherent, individually reviewable unit (pure foundation → shell → overlays → integration → cleanup), lands the user-visible path in PR B4 (vs PR A10 in the strict chain), and produces no forwarding-only stubs: every PR ships finished, tested modules; B4 is the first bounded wiring PR and B5 is a pure, verifiable deletion continuation. Tradeoff: each of B1–B3 and B5 is 559–1,280 lines (1.4–3.2× the 400 budget), so each requires a disciplined bounded review and the per-slice TDD gates still run inside each PR; three of the five PRs have no user-visible path because the dependency graph is strictly serial — no legal reordering surfaces user-visible value earlier without a forwarding-only stub. If reviewers want diffs closer to budget, a 6-PR variant exists (B′: S4+S5=620, S6+S7=590, S8+S9=810) at the cost of two extra foundation-only merges. Foundation-only/forwarding risk applies to every option except C: PRs before S11a mount nothing user-visible; mitigation is the per-slice bounded reviews plus the final integration review (B4/A10) that owns the swap and B5's narrow zero-runtime-reference proof.

## Work Units table

| Slice | Goal (design/spec mapping) | Files (NEW / MOD / DEL) | Test cmd | Runtime path | Rollback |
|-------|---------------------------|-------------------------|----------|--------------|----------|
| **S1** | Pure derivation selector: types + `deriveDriverRouteCockpit` + `useDriverRouteCockpit` (REQ-DCD-001..008). Exactly at the 600 hard cap — no apply expansion. | NEW: `composables/cockpit/useDriverRouteCockpit.ts` + spec | `pnpm test:unit --run src/features/delivery-routes/composables/cockpit` | N/A (pure; no DOM/I/O) | `git revert <S1>` (one new module) |
| **S2** | Truthful quick-action predicates + guarded helpers (REQ-DCK-005) | NEW: `utils/cockpit/driverCockpitQuickActions.ts` + spec | `pnpm test:unit --run src/features/delivery-routes/utils/cockpit` | N/A (pure; guarded browser helpers mocked) | `git revert <S2>` |
| **S3** | Cockpit/drawer/confirmation/refresh copy in the single copy source (REQ-DCS-002/003/004/006/008, REQ-DCK-002/003/005/006, REQ-DRC-104/110/112 copy pins) | MOD: `copy.ts`, `__tests__/copy.spec.ts` | `pnpm test:unit --run src/features/delivery-routes/__tests__/copy.spec.ts` | N/A | `git revert <S3>` |
| **S4** | `DriverCockpitHeader`: sticky identity/lifecycle/progress/history/refresh/back (REQ-DCS-002, REQ-DCS-007 emit part, REQ-DRC-111 header touch) | NEW: `components/cockpit/DriverCockpitHeader.vue` + spec | `pnpm test:unit --run src/features/delivery-routes/components/cockpit` | N/A (presentational; jsdom + stubs) | `git revert <S4>` |
| **S5** | `DriverOperationalStops`: current-card + notes + next-preview hierarchy (REQ-DCS-003, REQ-DCS-004) | NEW: `components/cockpit/DriverOperationalStops.vue` + spec | same | N/A | `git revert <S5>` |
| **S6** | `DriverRouteSpine`: accessible ordered sequence, no re-sort, all nodes selectable (REQ-DCS-005, REQ-DRC-111 spine a11y) | NEW: `components/cockpit/DriverRouteSpine.vue` + spec | same | N/A | `git revert <S6>` |
| **S7** | `DriverCockpitFooter`: mutually exclusive current-action / IN_PROGRESS / terminal / empty modes (REQ-DCS-006, REQ-DCS-008, REQ-DCS-009 footer gates, REQ-DRC-111 footer 44px + safe area) | NEW: `components/cockpit/DriverCockpitFooter.vue` + spec | same | N/A | `git revert <S7>` |
| **S8** | `DriverStopPanel`: stop detail + read map gate + quick actions + secondary delivery action (REQ-DCK-003, REQ-DCK-005 panel wiring, REQ-DRC-106 map reanchored) | NEW: `components/cockpit/DriverStopPanel.vue` + spec | same | N/A | `git revert <S8>` |
| **S9** | `DriverCockpitDrawer`: one UDrawer, stop/history modes, native `animationEnd(false)` synthesis, direct timeline reuse (REQ-DCK-001, 002, 004, 006 drawer part, 007, 008 drawer part, REQ-DRC-105 timeline-in-drawer) | NEW: `components/cockpit/DriverCockpitDrawer.vue` + spec | same (drawer integration uses `mountWithUApp`) | N/A (portal/focus covered by mountWithUApp integration) | `git revert <S9>` |
| **S10** | `DriverRouteCockpit` root: non-null composition, local UI state only, drawer→confirm state machine, exactly-once `request-check-in`, focus return (REQ-DCS-001, REQ-DCK-006, REQ-DCK-008, REQ-DCS-009 non-current flow, REQ-DRC-104 event, REQ-DRC-112 zero-stops) | NEW: `components/cockpit/DriverRouteCockpit.vue` + spec | same | N/A | `git revert <S10>` |
| **S11a** | View wiring + driver branch swap: view-owned `useCheckInStop`, observer `refetch`/`isFetching`, cockpit mount on driver-success branch, `useDeliveryRouteDetail` comment (REQ-DRC-103/104/107/108/109/110/112, REQ-DCS-007/009/010). **No deletions** — `DriverStopDetail` still exists and its tests still pass (S11b precondition) | MOD: `views/DeliveryRouteDetailView.vue`, `views/__tests__/DeliveryRouteDetailView.spec.ts`, `composables/useDeliveryRouteDetail.ts` (comment only) | `pnpm test:unit --run src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts` then `pnpm test:unit --run` | N/A (no e2e harness; dev-server smoke optional at `/pos/rutas-de-entrega/:id` as driver) | `git revert <S11a>` restores the old driver branch (view back to the `DriverStopDetail` stack; both old-card files still exist) |
| **S11b** | Old-card deletion continuation — REFACTOR only, no new behavior: after S11a is green, delete superseded `DriverStopDetail.vue` + obsolete spec with narrow zero-runtime-reference proof; inherits S11a's RED/GREEN/TRIANGULATE evidence (no fresh cycle) | DEL: `components/DriverStopDetail.vue` (~152), `components/__tests__/DriverStopDetail.spec.ts` (~407) | `pnpm test:unit --run` (full suite); `vue-tsc --build`; `pnpm build`; `grep -rn "DriverStopDetail" src/` → no runtime references (imports/templates/mocks/stubs; shared-map prose comments excluded) | N/A (no behavior changed; S11a smoke still valid) | `git revert <S11b>` restores only the deleted files while keeping the new cockpit path; combined `git revert <S11a> <S11b>` restores both |

## Dependency Graph

```text
S1 (derivation types+rules) ─────────────► S4/S5/S6/S7 (shell children: header/ops/spine/footer)
S1 (types: StopTrigger, DrawerMode, CockpitProgress, DriverCockpitState) ──► S8/S9/S10
S2 (quick actions) ──────────────────────► S8 (stop panel)
S3 (copy source) ──► S4/S5/S6/S7/S8/S9/S10 (every UI consumer)
S8 ──► S9 (drawer mounts DriverStopPanel + existing DeliveryRouteTimeline)
S4/S5/S6/S7/S8/S9 ──► S10 (cockpit root composes all seven SFCs + ConfirmModal)
S10 ──► S11a (DeliveryRouteDetailView driver branch swap + query/mutation wiring)
S11a ──► S11b (old-card deletion continuation — REFACTOR only, inherits S11a's green evidence)
```

All edges are truthful and strict: never start a slice before its dependencies' commits exist. Every S1 edge is real — S1's exported types are consumed by S8 (`StopTrigger` on `DriverStopPanel` emits), S9 (`DrawerMode` + `StopTrigger` on `DriverCockpitDrawer` props/emits), and S10 (`DriverCockpitState` via `useDriverRouteCockpit(route)` plus the shared `StopTrigger`/`DrawerMode`), in addition to S4 (`CockpitProgress`), S5/S6/S7 (`StopTrigger`, `CockpitSpineNode`, `CockpitProgress`). S4–S8 are independent siblings after S1–S3 and may land in any order among themselves; implementation order below fixes one valid sequence. S11a is the only slice touching query/mutation concerns and the only slice with a user-visible path (the view swap). S11b is its REFACTOR continuation: the old-card deletion runs only after S11a is green and triangulated, is NOT a fresh behavior slice, and introduces no new behavior — it inherits S11a's RED/GREEN/TRIANGULATE evidence. S9/S10 are the overlay concerns; S4–S8 are visual/presentational — no slice mixes them.

## Implementation Order

1. **S1** — Pure derivation (types + rules + computed adapter)
2. **S2** — Quick-action predicates + guarded helpers
3. **S3** — Cockpit/drawer/confirmation/refresh copy source
4. **S4** — `DriverCockpitHeader`
5. **S5** — `DriverOperationalStops`
6. **S6** — `DriverRouteSpine`
7. **S7** — `DriverCockpitFooter`
8. **S8** — `DriverStopPanel`
9. **S9** — `DriverCockpitDrawer`
10. **S10** — `DriverRouteCockpit` root
11. **S11a** — View wiring + driver branch swap (full RED/GREEN/TRIANGULATE; no deletions)
12. **S11b** — Old-card deletion continuation (REFACTOR/VERIFY/CLEANUP after S11a green; inherits S11a's TDD evidence; no new behavior)

### Requirements coverage map

| Slice | Requirements covered |
|-------|----------------------|
| **S1** | REQ-DCD-001..008 |
| **S2** | REQ-DCK-005 |
| **S3** | Copy pins for REQ-DCS-002/003/004/006/008, REQ-DCK-002/003/005/006, REQ-DRC-104/110/112 |
| **S4** | REQ-DCS-002, REQ-DCS-007 (header emit + disabled-while-fetching part), REQ-DRC-111 (header touch/focus) |
| **S5** | REQ-DCS-003, REQ-DCS-004 |
| **S6** | REQ-DCS-005, REQ-DRC-111 (spine touch/a11y part) |
| **S7** | REQ-DCS-006, REQ-DCS-008, REQ-DCS-009 (footer gates), REQ-DRC-111 (footer 44px + safe area) |
| **S8** | REQ-DCK-003, REQ-DCK-005 (panel wiring), REQ-DRC-106 (map gate reanchored) |
| **S9** | REQ-DCK-001, REQ-DCK-002, REQ-DCK-004, REQ-DCK-006 (drawer part), REQ-DCK-007, REQ-DCK-008 (drawer part), REQ-DRC-105 (timeline mounts only in drawer) |
| **S10** | REQ-DCS-001, REQ-DCK-006 (state machine), REQ-DCK-008 (focus return), REQ-DCS-009 (non-current secondary flow), REQ-DRC-104 (exactly-once event), REQ-DRC-112 (zero-stops cockpit mounts) |
| **S11a** | REQ-DRC-103, REQ-DRC-104 (view-owned mutation), REQ-DRC-107, REQ-DRC-108, REQ-DRC-109, REQ-DRC-110, REQ-DRC-112, REQ-DCS-007 (view handler), REQ-DCS-009 (pending gates), REQ-DCS-010 |
| **S11b** | Superseded REQ-DRC-003 surface removal (deletion continuation — no new behavior; inherits S11a's RED/GREEN/TRIANGULATE evidence) |

**Preserved regression-only (no source change scheduled; asserted by existing green suites and S11a):** REQ-DRC-101/102 (driver list), REQ-DRC-105 baseline (timeline labels/order via existing `DeliveryRouteTimeline.spec.ts`), REQ-DRC-106 baseline map contract via `AddressMapPicker` (unchanged), REQ-DRC-108 manager branch byte-equivalence.

---

## S1 — Pure derivation selector

- **Goal:** `useDriverRouteCockpit.ts` exports `DrawerMode`, `StopTrigger`, `CockpitProgress`, `CockpitNodeState`, `CockpitSpineNode`, `DriverCockpitState`, the pure `deriveDriverRouteCockpit(route | null)` and the `useDriverRouteCockpit(MaybeRefOrGetter)` computed adapter. Rules: terminal gating (COMPLETED/CANCELLED), first-IN_PROGRESS-else-first-PENDING current, relative next (later-PENDING when current is PENDING; first other PENDING incl. earlier residual when current is IN_PROGRESS), one-for-one spine with `completed/current/upcoming/skipped`, `progress = { completed, total }`, `hasStops`, `notes ?? null`, no mutation/re-sort/I/O, no order enforcement. Null input returns the zero sentinel.
- **Concern:** pure logic only — no query, no overlay, no visual.
- **Files — NEW:**
  - `src/features/delivery-routes/composables/cockpit/useDriverRouteCockpit.ts`
  - `src/features/delivery-routes/composables/cockpit/__tests__/useDriverRouteCockpit.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/composables/cockpit`

**TDD steps**

- [x] RED — Write the spec asserting REQ-DCD-001 scenarios (IN_PROGRESS beats earlier PENDING; first PENDING when none IN_PROGRESS; terminal → null current/next; empty array → nulls + 0/0), REQ-DCD-002 scenarios (later-PENDING next; earlier residual PENDING next for IN_PROGRESS current; last-PENDING → null next; all-PENDING first/second split; terminal residual PENDING → null next). <!-- sdd-owner: implementation -->
- [x] GREEN — Implement the minimum: status scan in backend `sortOrder` ASC for current, the two next-selection branches, terminal short-circuit, and the plain-object return shape so the spec passes and nothing else exists. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add adjacent cases for REQ-DCD-003 (spine preserves order/length, exactly one `current` node when current is non-null, SKIPPED stays selectable), REQ-DCD-004 (SKIPPED/IN_PROGRESS never count as completed; 0/0 empty), REQ-DCD-005 (DRAFT/ACTIVE non-terminal vs COMPLETED/CANCELLED terminal), REQ-DCD-006 (deep-equal on repeated calls; `notes ?? null`; `hasStops`; no network/log/storage via a read-100x computed spy), REQ-DCD-007 (all-null stop fields pass verbatim without throwing; null driver name), REQ-DCD-008 (later PENDING nodes never locked/filtered). <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: extract private helpers for current/next selection with names documenting the two branches; ensure the computed adapter unwraps `MaybeRefOrGetter` via `toValue` and returns a `ComputedRef<DriverCockpitState>`; no `.value` leaks into destructuring consumers (plain-object `progress`). Behavior unchanged. <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/delivery-routes/composables/cockpit` → 0 failures; full `pnpm test:unit --run` stays green.
- `vue-tsc --build` clean (new module is self-contained; nothing imports it yet).
- Runtime path: N/A — pure selector; no DOM/HTTP/toast surface.
- Rollback: `git revert <S1>` removes one new module + spec; no other file touched.
- Note: S1 is stated **exactly at the config 600-line hard cap** (impl ~180 + spec ~420 = 600) — **no apply expansion allowed** beyond this estimate. It exceeds the 400-line PR budget (600 > 400) and therefore requires a PR-level size exception in every grouping (A/B/C), as a single-coherent-module atomic unit.

**Commit message**

```text
feat(delivery-routes): add pure driver cockpit derivation selector

- Adds useDriverRouteCockpit.ts: DrawerMode/StopTrigger/CockpitProgress/
  CockpitNodeState/CockpitSpineNode/DriverCockpitState types plus the pure
  deriveDriverRouteCockpit(route|null) selector and its computed adapter.
- Derivation rules per REQ-DCD-001..008: terminal (COMPLETED/CANCELLED)
  yields null current/next; current is first IN_PROGRESS else first PENDING
  in backend sortOrder; next is the first later PENDING when current is
  PENDING, or the first other PENDING (incl. earlier residual) when current
  is IN_PROGRESS; spine is a one-for-one ordered map with
  completed/current/upcoming/skipped and every node selectable; progress
  counts only COMPLETED over all stops; hasStops and notes ?? null.
- No query/mutation/query-client/HTTP/browser I/O; null input returns the
  zero sentinel; later PENDING stops are never locked (no order enforcement).

Tests: co-located spec covers all eight REQ-DCD requirements incl. spine
order/length, exactly-one-current, SKIPPED selectability, deep-equal repeat
calls, null tolerance, and side-effect freedom.

Refs: design §3-§4, §10-§11; specs/driver-cockpit-derivation (REQ-DCD-001..008).
```

---

## S2 — Truthful quick-action predicates and guards

- **Goal:** `driverCockpitQuickActions.ts` exports the typed synchronous predicates `canOpenExternalMap`, `canCopyAddress`, `canOpenEmail` and guarded helpers `openExternalMap`, `copyAddressToClipboard`, `openEmail` returning `QuickActionResult { ok, message }`. Map visibility = trimmed formatted address exists OR both coordinates finite (one coordinate never sufficient); coordinate pair preferred in the encoded Google Maps query with address fallback; `window.open(url, '_blank', 'noopener,noreferrer')`; clipboard via `navigator.clipboard.writeText`; email via encoded `mailto:` without `window.open`; no helper throws.
- **Concern:** pure logic only (browser helpers guarded/mocked).
- **Files — NEW:**
  - `src/features/delivery-routes/utils/cockpit/driverCockpitQuickActions.ts`
  - `src/features/delivery-routes/utils/cockpit/__tests__/driverCockpitQuickActions.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/utils/cockpit`

**TDD steps**

- [x] RED — Write the spec asserting the exact predicate matrix from REQ-DCK-005 scenarios: address-only map input true; finite pair + address true (coordinates preferred in query); both-finite without address true; one/non-finite coordinate false; non-empty trimmed address gates copy; non-empty trimmed email gates email. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement predicates and helpers minimally: `canOpenExternalMap`, `canCopyAddress`, `canOpenEmail`, then `openExternalMap`/`copyAddressToClipboard`/`openEmail` returning typed results with blocked/unsupported/runtime failure paths. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add edge cases: whitespace-only strings fail trimmed checks; `undefined`/`null` inputs never throw; coordinate `0,0` is legal (finite); `window.open` returning null → blocked failure result; clipboard rejection → `{ ok: false }` with canonical failure copy; SSR absence of `navigator`/`window` → typed failure, no throw. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: shared `encodeQuery`/`encodedMailto` helpers, no duplicated URL building, pure functions exported for direct unit testing (no Vue refs, no toast runtime in the util). <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/delivery-routes/utils/cockpit` → 0 failures; full suite green.
- `vue-tsc --build` clean.
- Runtime path: N/A — browser globals mocked in jsdom; toast wiring is S8's concern.
- Rollback: `git revert <S2>`.

**Commit message**

```text
feat(delivery-routes): add truthful quick-action predicates and guards

- Adds driverCockpitQuickActions.ts per REQ-DCK-005: synchronous predicates
  canOpenExternalMap (trimmed formatted address OR both finite coords; one
  coordinate never sufficient), canCopyAddress, canOpenEmail plus guarded
  helpers openExternalMap (prefers finite coordinate pair in the encoded
  Google Maps query, address fallback, window.open with noopener,noreferrer),
  copyAddressToClipboard (navigator.clipboard.writeText), openEmail (encoded
  mailto:, no window.open).
- Every helper returns QuickActionResult { ok, message } and never throws;
  blocked popups, SSR absence, unsupported clipboard, and runtime failures
  return typed failures.

Tests: co-located spec pins the predicate matrix, 0,0-as-legal-pin, whitespace
trimming, blocked/SSR/clipboard-rejection paths.

Refs: design §8; specs/driver-cockpit-drawer (REQ-DCK-005).
```

---

## S3 — Cockpit, drawer, confirmation, and refresh copy source

- **Goal:** Extend the single Spanish copy source (`copy.ts`) with every spec-pinned cockpit string so S4–S10 import labels instead of inlining. Pinned copy: identity fallback `Ruta`, refresh `Actualizar ruta`, `Sin parada activa`, `Cliente sin nombre`, `Notas de la ruta`, `Siguiente · Parada N`, `Última parada`, `No hay más pendientes`, `Sin paradas`, `Marcar entregada` (reuse existing `actions.checkIn`), terminal `Ruta completada` / `Entregaste {completed} de {total} paradas.`, `Ruta cancelada` / `Esta ruta fue cancelada.`, `Ver historial`, drawer `Parada N — {customer}` / `Historial de la ruta` / `Cerrar`, quick actions `Ver en mapa` / `Copiar dirección` / `Email` + copy-failure toast `No se pudo copiar la dirección`, confirmation `Confirmar entrega` / `Entrega para {customer} — Parada {N} ({folio}). Esta acción registra la entrega y no se puede deshacer.` / `Cancelar`, refresh-failure toast `No se pudo actualizar la ruta`. No existing key changes; tree shape preserved (additive `cockpit.*` subtree + one toast key).
- **Concern:** copy only — no query/overlay/visual.
- **Files — MOD:**
  - `src/features/delivery-routes/copy.ts`
  - `src/features/delivery-routes/__tests__/copy.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/__tests__/copy.spec.ts`

**TDD steps**

- [x] RED — Add spec assertions (additive) pinning each new string verbatim against the spec copy sections; existing assertions must keep passing untouched. <!-- sdd-owner: implementation -->
- [x] GREEN — Add the `cockpit.*` subtree + `toasts.refreshFailed` key to `copy.ts` minimally; no renames of existing keys. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Pin the exact terminal body templates (`{completed}`/`{total}` placeholders present and ordered), the confirmation body template (`{customer}`, `{N}`, `{folio}` placeholders), and that `actions.checkIn` remains `Marcar entregada` (no duplicate key). <!-- sdd-owner: implementation -->
- [x] REFACTOR — Group the new keys under a `cockpit` namespace with `header/operational/footer/drawer/quickActions/confirm` sub-groups; no dead keys. <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/delivery-routes/__tests__/copy.spec.ts` → 0 failures; full suite green.
- `vue-tsc --build` clean.
- Runtime path: N/A.
- Rollback: `git revert <S3>`.

**Commit message**

```text
feat(delivery-routes): add cockpit drawer and confirmation copy source

- Extends copy.ts with an additive cockpit.* subtree: header identity/refresh,
  operational current/next copy, four-mode footer terminal copy, drawer
  stop/history titles and close label, quick-action labels plus the
  copy-failure toast, confirmation modal title/body/labels, and the
  refresh-failure toast "No se pudo actualizar la ruta".
- Template placeholders ({completed}/{total}, {customer}/{N}/{folio}) pinned
  verbatim; existing keys untouched.

Tests: copy.spec.ts pins every new string and keeps existing assertions green.

Refs: design §6-§8, §11; specs driver-cockpit-shell/drawer copy matrices.
```

---

## S4 — Sticky cockpit header (`DriverCockpitHeader`)

- **Goal:** Presentational header: back, identity (`route.driver?.name ?? 'Ruta'`), existing lifecycle badge/labels, `{completed}/{total}`, history, refresh. Emits `back`, `refresh`, `open-history(trigger)`; does not push router. Interactive controls ≥44×44px; no horizontal scroll at 320px; sticky within the panel.
- **Concern:** visual/presentational only — no query, no overlay.
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverCockpitHeader.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitHeader.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit`

**TDD steps**

- [x] RED — Write the spec (mount + component stubs): null driver name renders `Ruta` with no empty line; `{ completed: 2, total: 5 }` renders `2/5`; back emits once without router import; refresh button present with aria-label `Actualizar ruta` and disabled while `isFetching`; history button emits `open-history` with its element. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement the header SFC: typed props `{ route; progress; isFetching }`, typed emits `{ back; refresh; 'open-history' }`, identity/badge/progress copy from `copy.ts`, 44px touch classes, sticky panel-contained classes. No router, no query imports. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add cases: `isFetching=true` renders refresh disabled and a click emits nothing; all interactive controls carry visible focus classes and min 44×44 classes; header does not include an ETA/distance/next section (scope pin); history emit carries the originating `HTMLElement`. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: extract `progressLabel` computed; ensure no inline Spanish strings (all from `copy.ts`); script/template/style order. <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/delivery-routes/components/cockpit` → 0 failures; full suite green.
- `vue-tsc --build` clean (unused SFC until S10 — accepted, build stays green).
- Runtime path: N/A — presentational; jsdom + stubs.
- Rollback: `git revert <S4>`.

**Commit message**

```text
feat(delivery-routes): add sticky cockpit header shell

- Adds DriverCockpitHeader.vue per REQ-DCS-002/007: sticky panel-contained
  header with back, route identity (driver name fallback "Ruta"), lifecycle
  badge, completed/total progress, history and refresh controls. Emits
  back/refresh/open-history; never pushes the router; all interactive
  controls ≥44×44px with visible focus; refresh disabled while isFetching.

Tests: co-located spec pins identity fallback, 2/5 progress, single back
emit, refresh disable, and open-history trigger payload.

Refs: design §3, §6, §9.3; specs/driver-cockpit-shell (REQ-DCS-002, 007).
```

---

## S5 — Operational current/next stop hierarchy (`DriverOperationalStops`)

- **Goal:** Current section (position + optional folio, `EntityAvatar`, `Cliente sin nombre` fallback, formatted address when present, `Notas de la ruta` only when present; PENDING → gold emphasis, IN_PROGRESS → navy, other → muted) and next-preview section (`Siguiente · Parada N`, no map/ETA/distance; `Última parada` when null next non-terminal; `No hay más pendientes` when terminal; nothing fabricated when empty). Emits `open-stop({ stopId, trigger })`.
- **Concern:** visual/presentational only.
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverOperationalStops.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverOperationalStops.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit`

**TDD steps**

- [x] RED — Spec (stub `EntityAvatar`): PENDING current renders gold emphasis class and IN_PROGRESS renders navy; null current renders `Sin parada activa` with no customer/address decoration; null customer uses stop-id avatar seed + `Cliente sin nombre`; null address/notes omit rows without stray punctuation. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement both sections with typed props `{ currentStop; nextStop; notes; hasStops; isTerminal }` and emit `open-stop`; all copy from `copy.ts`; `formatAddress` for address rows. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add: next preview shows position/customer/address and no ETA/distance/map element; `Última parada` for null-next non-terminal; `No hay más pendientes` for terminal; empty route renders no fabricated next; both section triggers emit `{ stopId, trigger }` from the originating element. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: share one `openStop(trigger)` handler; ensure `hasStops && !isTerminal` guards the `Última parada` branch exactly. <!-- sdd-owner: implementation -->

**Verify**

- Focused cmd → 0 failures; full suite green; `vue-tsc --build` clean.
- Runtime path: N/A.
- Rollback: `git revert <S5>`.

**Commit message**

```text
feat(delivery-routes): add operational current/next stop sections

- Adds DriverOperationalStops.vue per REQ-DCS-003/004: current-card section
  with position/folio/EntityAvatar/customer fallback/address/notes and
  PENDING-gold vs IN_PROGRESS-navy emphasis, plus next-preview section with
  "Siguiente · Parada N", "Última parada", "No hay más pendientes", and no
  fabricated stop on empty routes. No map/ETA/distance in preview.

Tests: co-located spec pins emphasis classes, null-field fallbacks, row
omission without stray punctuation, and open-stop trigger payloads.

Refs: design §3, §4; specs/driver-cockpit-shell (REQ-DCS-003, 004).
```

---

## S6 — Accessible route spine (`DriverRouteSpine`)

- **Goal:** One ordered-list node per derived spine entry in backend order, never re-sorted; real `<button>` per node, textual status labels, descriptive `aria-label` (e.g. `Parada 3: Pendiente — Ana`), visible focus ring, ≥44×44px target, connector; state never color-only; every node (incl. SKIPPED and non-current PENDING) selectable, emitting `select-stop({ stopId, trigger })` once on Enter/Space activation.
- **Concern:** visual/a11y only.
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverRouteSpine.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteSpine.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit`

**TDD steps**

- [x] RED — Spec: five input nodes render five nodes in identical order with textual status; `Parada 3: Pendiente — Ana` accessible label for the third PENDING node; Enter/Space on a focused node emits exactly once with the originating element. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement ordered-list spine with buttons, `aria-label` builder, connector element, textual labels from `DELIVERY_ROUTE_STOP_STATUS_LABELS`, and `select-stop` emit. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add: SKIPPED and later PENDING nodes visible/selectable with no locked/disabled attribute; visible focus-ring class on every button; min 44×44 classes; `isCurrent` node carries the current-state marker without relying on color alone. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: `nodeAriaLabel(node)` helper, no inline labels, no re-sort anywhere (defensive assertion via tests). <!-- sdd-owner: implementation -->

**Verify**

- Focused cmd → 0 failures; full suite green; `vue-tsc --build` clean.
- Runtime path: N/A.
- Rollback: `git revert <S6>`.

**Commit message**

```text
feat(delivery-routes): add accessible route spine sequence

- Adds DriverRouteSpine.vue per REQ-DCS-005: ordered-list sequence rendered
  in backend order (never re-sorted), one real button per derived node with
  textual stop-status labels, descriptive aria-label (e.g. "Parada 3:
  Pendiente — Ana"), visible focus ring, ≥44×44px targets, and a connector.
  Every node including SKIPPED and later PENDING stays selectable and emits
  select-stop once on Enter/Space.

Tests: co-located spec pins order/length, aria-label, single activation
emit, and no-lock invariants.

Refs: design §3, §4; specs/driver-cockpit-shell (REQ-DCS-005).
```

---

## S7 — Four-mode cockpit footer (`DriverCockpitFooter`)

- **Goal:** Exactly one of: current-action (PENDING current, `Marcar entregada`, only when `canCheckIn`, disabled while `checkInPending`, emits `request-confirm({ stopId, trigger })`, ≥44px), disabled IN_PROGRESS mode (emits nothing, safe-area padding + body clearance), terminal mode (COMPLETED: `Ruta completada` / `Entregaste {completed} de {total} paradas.`; CANCELLED: `Ruta cancelada` / `Esta ruta fue cancelada.`; plus `Ver historial` emitting `open-history`), or empty mode. No mutation.
- **Concern:** visual/interaction surface only (emits, never mutates).
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverCockpitFooter.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitFooter.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit`

**TDD steps**

- [x] RED — Spec: PENDING + `canCheckIn` + not pending renders enabled ≥44px `Marcar entregada` and emits the current id; `checkInPending` disables it and repeated clicks emit nothing; `canCheckIn=false` renders no delivery action; IN_PROGRESS renders one disabled mode and emits nothing; null/non-actionable current renders empty mode. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement the four mutually exclusive modes with typed props `{ routeStatus; currentStop; progress; hasStops; canCheckIn; checkInPending }` and emits `request-confirm` / `open-history`; terminal copy from `copy.ts` with `{completed}/{total}` interpolation. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add: COMPLETED terminal renders completion summary and no delivery control; CANCELLED renders cancellation summary; `Ver historial` emits with its trigger; safe-area bottom padding class + body-clearance counterpart documented in the spec; all text state pairs (color + label). <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: one `mode` computed resolving the four exclusive branches; no duplicated button markup; all copy from `copy.ts`. <!-- sdd-owner: implementation -->

**Verify**

- Focused cmd → 0 failures; full suite green; `vue-tsc --build` clean.
- Runtime path: N/A.
- Rollback: `git revert <S7>`.

**Commit message**

```text
feat(delivery-routes): add four-mode cockpit footer

- Adds DriverCockpitFooter.vue per REQ-DCS-006/008/009: mutually exclusive
  current-action (PENDING, canCheckIn, disabled while checkInPending, emits
  request-confirm), disabled IN_PROGRESS mode, terminal mode (COMPLETED and
  CANCELLED summaries + Ver historial emit), and empty mode. No mutation;
  touch target ≥44px with bottom safe-area padding.

Tests: co-located spec pins mode exclusivity, pending disable, read-only
absence, terminal copy interpolation, and history emit.

Refs: design §3, §9.2, §9.3; specs/driver-cockpit-shell (REQ-DCS-006, 008, 009).
```

---

## S8 — Stop panel (`DriverStopPanel`)

- **Goal:** Drawer stop-mode content: position/folio, customer fallback, formatted address above any map, quick actions (map/copy/email, ordered, predicate-gated, ≥44×44px, each settled result via existing `useToast()`), close affordance, and the gated secondary `Marcar entregada` action (visible only PENDING + non-terminal + `canCheckIn`, disabled while `checkInPending`, emits `request-confirm({ stopId, trigger })`; route position never gates). `AddressMapPicker mode="read"` mounts only when `mapReady` and both coordinates finite; tile failure hides only the map.
- **Concern:** visual/interaction surface (uses S2 util + S3 copy; no query, no overlay ownership).
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverStopPanel.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverStopPanel.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit`

**TDD steps**

- [x] RED — Spec (stub `AddressMapPicker` + `UButton`): PENDING/non-terminal/canCheckIn/not-pending renders the secondary action and emits the selected id; `checkInPending` disables and repeat activation emits nothing; COMPLETED/SKIPPED/IN_PROGRESS/terminal/read-only expose no delivery action. <!-- sdd-owner: implementation -->
- [x] GREEN — Implement the panel with typed props `{ stop; routeTerminal; canCheckIn; checkInPending; mapReady }` and emits `close` / `request-confirm`; map gate = `mapReady && pinToGeoPoint(finite both)`; quick actions wired to S2 helpers with toast results. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE — Add: finite coords render the settled map below the address and missing/non-finite omit it (REQ-DRC-106); tile failure hides map while address remains and no toast fires; quick-action buttons mirror predicates exactly and are hidden when ineligible, ordered map/copy/email, ≥44×44px; copy failure toasts `No se pudo copiar la dirección` without throwing; address row renders above the map. <!-- sdd-owner: implementation -->
- [x] REFACTOR — Tighten: single `secondaryActionVisible` computed; quick-action template loop with typed action list; all copy from `copy.ts`. <!-- sdd-owner: implementation -->

**Verify**

- Focused cmd → 0 failures; full suite green; `vue-tsc --build` clean.
- Runtime path: N/A — map runtime stubbed; tile-failure swallow is `AddressMapPicker`'s existing behavior (unchanged).
- Rollback: `git revert <S8>`.

**Commit message**

```text
feat(delivery-routes): add stop panel with map and quick actions

- Adds DriverStopPanel.vue per REQ-DCK-003/005 and REQ-DRC-106: stop
  position/folio, customer fallback, formatted address above the read map
  (mounts only when mapReady and both coords finite; tile failure hides only
  the map), predicate-gated map/copy/email quick actions routed through the
  existing toast helper, and the secondary Marcar entregada action gated to
  PENDING + non-terminal + canCheckIn and disabled while checkInPending.

Tests: co-located spec pins action gating, map gate, quick-action ordering
and failure toasts.

Refs: design §3, §8; specs/driver-cockpit-drawer (REQ-DCK-003, 005);
specs/delivery-route-check-in (REQ-DRC-106).
```

---

## S9 — Two-mode drawer with native-event adaptation (`DriverCockpitDrawer`)

- **Goal:** One `UDrawer` controlled by `open` + `mode: 'stop' | 'history'`; stop mode mounts `DriverStopPanel`, history mode directly mounts the existing `DeliveryRouteTimeline` (no wrapper SFC, no modification). Mode switch closes and reopens instead of swapping trapped content. Custom `closed` event synthesized ONLY from native `animationEnd(false)`; native `close`/`update:open(false)` begin closure but are not completion; `animationEnd(true)` marks opening settled (`mapReady=true`) and never emits `closed`. Sticky titled header with ≥44px close control, independently scrollable body capped at `85dvh`. Reduced motion = no-op/instant cross-fade, native events/semantics unchanged.
- **Concern:** overlay only — owns the one drawer portal and native-event adaptation; no query.
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverCockpitDrawer.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverCockpitDrawer.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit` (drawer integration cases via `mountWithUApp`)

**TDD steps**

- [ ] RED — Write the integration spec (`mountWithUApp`): one drawer portal and no nested drawer/slideover; stop mode mounts `DriverStopPanel`; history mode mounts `DeliveryRouteTimeline` directly with unchanged content; native `close` alone does not emit custom `closed`, `animationEnd(false)` emits it once, `animationEnd(true)` does not. <!-- sdd-owner: implementation -->
- [ ] GREEN — Implement `DriverCockpitDrawer.vue`: typed props `{ open; mode; route; stop; routeTerminal; canCheckIn; checkInPending }`, emits `update:open` / `closed` / `request-confirm`; the `animationEnd` adapter translating native events into synthesized `closed` and `mapReady`; sticky titled header with ≥44px close, `85dvh` scrollable body; stop/history titles from `copy.ts`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — Add: stop→history switch closes, receives `animationEnd(false)`, then reopens with direct timeline content; Escape/drag/overlay/close/parent-close all cause `update:open(false)`; reduced-motion class/token asserted while native event sequence stays identical; body scrolls inside `85dvh` without clipping (class assertions in jsdom); history mode preserves timeline test ids/order incl. `STOP_CHECKED_IN` separate `Parada N` element and empty `Sin eventos registrados` (REQ-DRC-105). <!-- sdd-owner: implementation -->
- [ ] REFACTOR — Tighten: isolate the native-event adapter as a named function/type for direct unit coverage; no duplicated mode content branch (mode → content component map). <!-- sdd-owner: implementation -->

**Verify**

- `pnpm test:unit --run src/features/delivery-routes/components/cockpit` → 0 failures (drawer spec via `mountWithUApp`); full suite green.
- `vue-tsc --build` clean.
- Runtime path: N/A — portal/focus behavior covered by `mountWithUApp` integration; no browser/e2e harness in this repo.
- Rollback: `git revert <S9>`.
- Note: S9 (~430 lines: impl ~180 + spec ~250) exceeds the 400 PR budget and carries a size exception as a single-coherent-module unit (one SFC + its co-located spec; tests-with-code atomicity).

**Commit message**

```text
feat(delivery-routes): add two-mode cockpit drawer with native event adaptation

- Adds DriverCockpitDrawer.vue per REQ-DCK-001/002/004/006/007/008: one UDrawer
  with stop mode (DriverStopPanel) and history mode (direct reuse of the
  existing DeliveryRouteTimeline, no wrapper SFC). Custom closed is synthesized
  only from native animationEnd(false); native close/update:open begin closure
  but never complete it; animationEnd(true) settles opening (mapReady) and
  never emits closed. Sticky titled header, ≥44px close, 85dvh scrollable body,
  and reduced-motion no-op/instant cross-fade without semantic changes.

Tests: mountWithUApp integration spec pins portal singularity, native-event
adaptation, mode switch close/reopen, timeline direct reuse, and reduced
motion.

Refs: design §3, §7; specs/driver-cockpit-drawer (REQ-DCK-001..008);
specs/delivery-route-check-in (REQ-DRC-105).
```

---

## S10 — Cockpit composition root (`DriverRouteCockpit`)

- **Goal:** Non-null `{ route; isFetching; canCheckIn; checkInPending }` composition surface; owns ONLY local UI state (selected stop id, drawer mode/phase, pending confirmation stop id, focus-return `shallowRef`); no `useQuery`/`useMutation`/`useQueryClient`/HTTP. DOM order: header → operational (current then next) → spine → footer; one drawer + sibling `ConfirmModal` as overlays. State machine: CLOSED → DRAWER_STOP/HISTORY → CLOSING → (switch | CONFIRM via `animationEnd(false)`) → CONFIRM → accept: close modal, emit `request-check-in(stopId)` exactly once → MUTATING (view settles) → CLOSED + focus restore (connected origin else cockpit root `tabindex="-1"`, no scroll). Confirmation copy names customer + stop/folio with irreversible statement; cancel emits nothing. While `checkInPending`, no entry point or modal accepts a new request.
- **Concern:** overlay orchestration + composition (the root's single responsibility per design §3); the only slice that bridges S4–S9.
- **Files — NEW:**
  - `src/features/delivery-routes/components/cockpit/DriverRouteCockpit.vue`
  - `src/features/delivery-routes/components/cockpit/__tests__/DriverRouteCockpit.spec.ts`
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/components/cockpit`

**TDD steps**

- [ ] RED — Spec (stub children + `ConfirmModal`): cockpit mounts children with derived data and no loading skeleton; no query/mutation/query-client/HTTP import exists in the SFC (static import assertion); local state limited to selection/drawer/pending-confirmation/focus; accepted confirmation closes the modal and emits `request-check-in` exactly once. <!-- sdd-owner: implementation -->
- [ ] GREEN — Implement the root: `useDriverRouteCockpit(route)` derivation, drawer + `ConfirmModal` siblings with the CLOSED→DRAWER→CLOSING→CONFIRM→MUTATING transitions keyed on synthesized `closed`, exactly-once `request-check-in` emission, focus-return wiring (connected origin else root with `tabindex="-1"`, no scroll). <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — Add REQ-DCK-006/008 scenarios: drawer-initiated confirmation opens the modal only after `animationEnd(false)` and never overlaps portals; footer initiation with no open drawer opens the same modal next tick; cancel emits no `request-check-in` and no toast; repeated activation while pending emits nothing; focus returns to the originating node, detached origin falls back to cockpit root without scrolling; zero-stops route mounts with `0/0` + `Sin parada activa` + `Sin paradas` + empty footer (REQ-DRC-112); non-current PENDING drawer flow confirms the selected id (REQ-DCS-009). <!-- sdd-owner: implementation -->
- [ ] REFACTOR — Tighten: extract the drawer-phase reducer/type (CLOSED/DRAWER_STOP/DRAWER_HISTORY/CLOSING/CLOSING_TO_SWITCH/CLOSING_TO_CONFIRM/CONFIRM/MUTATING) so the transition table is reviewable; confirm modal payload builder from `copy.ts`; no duplicated event handling between footer and panel entry points. <!-- sdd-owner: implementation -->

**Verify**

- Focused cmd → 0 failures; full suite green; `vue-tsc --build` clean.
- Runtime path: N/A — focus trap/return and portal behavior covered by component integration; no e2e harness.
- Rollback: `git revert <S10>`.
- Note: S10 (~470 lines: impl ~220 + spec ~250) exceeds the 400 PR budget and carries a size exception as a single-coherent-module unit (one SFC + its co-located spec; tests-with-code atomicity).

**Commit message**

```text
feat(delivery-routes): compose cockpit root with drawer-confirm state machine

- Adds DriverRouteCockpit.vue per REQ-DCS-001, REQ-DCK-006/008, REQ-DRC-104/
  112: non-null route composition surface owning only local UI state (selected
  stop, drawer mode/phase, pending confirmation, focus-return element). No
  useQuery/useMutation/useQueryClient/HTTP anywhere in the subtree.
- State machine CLOSED -> DRAWER_STOP/HISTORY -> CLOSING -> CONFIRM -> MUTATING
  with confirmation opening only after synthesized closed (no overlay overlap),
  exactly-once request-check-in(stopId) emission on accept, silent cancel, and
  focus return to the connected origin or the cockpit root without scrolling.
- Zero-stops routes still mount (0/0, Sin parada activa, Sin paradas, empty
  footer mode).

Tests: co-located spec pins server-state absence, exactly-once emission,
modal-after-closed ordering, pending gates, focus return, and zero-stops
composition.

Refs: design §3, §7, §9.3, §10; specs/driver-cockpit-shell (REQ-DCS-001, 009),
specs/driver-cockpit-drawer (REQ-DCK-006, 008), specs/delivery-route-check-in
(REQ-DRC-104, 112).
```

---

## S11a — View wiring and driver branch swap (`DeliveryRouteDetailView`)

- **Goal:** `DeliveryRouteDetailView.vue` keeps the single discriminator + existing gates; driver-success branch now mounts `DriverRouteCockpit(route, isFetching, canCheckIn=canUpdate, checkInPending)` instead of the `DriverStopDetail` stack. The view instantiates the single existing `useCheckInStop` and handles `request-check-in(stopId)` with `mutateAsync({ id, stopId })` exactly once per event (no duplicate toast/invalidation/retry — composable owns them). The view destructures `refetch` + `isFetching` from the existing detail observer; `refresh` → one `refetch()` with result inspection/catch; failure toasts `No se pudo actualizar la ruta`; success no toast; cached DTO + scroll retained. `useDeliveryRouteDetail.ts` comment-only update naming mutation invalidation + cockpit manual refresh as freshness sources. **No deletions in this slice** — the superseded `DriverStopDetail.vue` and its obsolete equal-card spec still exist and their tests keep passing at the S11a boundary (that is the S11b deletion precondition). Manager branch, list, privacy mapping, guard, query keys, and mutation composable unchanged.
- **Concern:** query/integration only — the single slice touching server-state wiring and the single slice with a user-visible path; no overlay/visual work; no deletions.
- **Files — MOD:**
  - `src/features/delivery-routes/views/DeliveryRouteDetailView.vue`
  - `src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts`
  - `src/features/delivery-routes/composables/useDeliveryRouteDetail.ts` (doc comment only; behavior unchanged)
- **Test cmd:** `pnpm test:unit --run src/features/delivery-routes/views/__tests__/DeliveryRouteDetailView.spec.ts` then `pnpm test:unit --run`

**TDD steps** — full RED → GREEN → TRIANGULATE → REFACTOR. The REFACTOR here is comment-only + handler tightening; the old-card deletion is S11b and runs only after this slice's GREEN + TRIANGULATE are green.

- [ ] RED — Rework the view spec's driver branch: replace the `DriverStopDetail` stub with a `DriverRouteCockpit` stub asserting props `{ route, isFetching, canCheckIn, checkInPending }`; add failing tests for: `request-check-in` event handled by the single `useCheckInStop` mock exactly once with `{ id, stopId }`; `refresh` invokes the observer `refetch` exactly once; `isFetching=true` disables refresh; rejected/error-result refetch toasts `No se pudo actualizar la ruta` once and keeps cached DTO; 403/404/loading/generic-error/stale-id never mount the cockpit; zero-stops route still mounts it. Manager-branch tests remain green without modification. <!-- sdd-owner: implementation -->
- [ ] GREEN — Implement the view wiring: destructure `refetch`/`isFetching`; instantiate `useCheckInStop` once; `handleRefresh` (one refetch + result/error inspection + canonical failure toast); `handleCheckIn(stopId)` → `mutateAsync`; driver branch template swapped to the cockpit with typed props/events; remove the `DriverStopDetail` import + mock from the view spec. The old-card files still exist at this point and their own tests keep passing (deletion precondition — verified at this slice's boundary, exercised by S11b). <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE — Add: `canCheckIn` equals `canUpdate` at the call site (read-only driver sees no delivery actions through props); `checkInPending` propagates to footer/drawer/panel entry points and blocks repeat emission during pending; refresh failure preserves scroll (asserted via unchanged rendered DTO + toast count); no `useQueryClient`, `refetchQueries`, invalidate/refetch pair, or new query key in the view (static assertion); manager branch byte-equivalence (existing manager tests untouched and green); driver list untouched (REQ-DRC-101/102 regression via existing list specs green). Confirm the full suite is green with the cockpit path fully covered while the obsolete old-card tests still pass (deletion-gate precondition for S11b). <!-- sdd-owner: implementation -->
- [ ] REFACTOR — Comment-only touch to `useDeliveryRouteDetail.ts` naming "mutation invalidation" and "cockpit manual refresh" as freshness sources (no polling/focus-refetch claims); view handlers stay small; props/events contract matches design §3 exactly. Deletion is NOT part of this slice — it is S11b, the explicit REFACTOR continuation, which runs only after this slice's GREEN + TRIANGULATE are green. <!-- sdd-owner: implementation -->

**Verify**

- Focused view spec → 0 failures; full `pnpm test:unit --run` green with the cockpit path fully covered **and the obsolete old-card tests still passing** (S11b precondition).
- `vue-tsc --build` clean (the old-card files still exist and type-check — no dangling references introduced by this slice).
- Runtime path: N/A — no e2e harness; optional dev-server smoke: `/pos/rutas-de-entrega/:id` as a driver shows the cockpit; as a manager shows the unchanged manager branch.
- Rollback: `git revert <S11a>` restores the old driver branch (view back to the `DriverStopDetail` stack); both old-card files still exist, so nothing else needs restoring — no backend/cache coordination.
- Note: S11a is **~380 lines** (view ~110 + view spec rework ~260 + composable comment ~10), all MOD, zero DEL. It fits both the 400-line PR review budget and the 600-line slice cap: **bounded, no size exception**. Its RED/GREEN/TRIANGULATE evidence fully proves the new cockpit path before any deletion happens (deletion-gate rule).

**Commit message**

```text
feat(delivery-routes): wire cockpit into detail view with view-owned check-in and refresh

- DeliveryRouteDetailView.vue now mounts DriverRouteCockpit on the resolved
  driver-success branch with { route, isFetching, canCheckIn=canUpdate,
  checkInPending }; the view owns the single existing useCheckInStop instance
  and handles request-check-in(stopId) exactly once per accepted event.
- Manual refresh forwards one observer refetch(); isFetching disables the
  header control; a failed result or rejection toasts the canonical
  "No se pudo actualizar la ruta" while cached DTO and panel scroll remain;
  success produces no toast.
- No deletions in this slice: DriverStopDetail.vue and its spec still exist
  and keep passing (deletion precondition for the S11b REFACTOR continuation).
- Manager branch, driver list, privacy mapping, route guard, query keys, and
  the mutation composable are unchanged; useDeliveryRouteDetail.ts gets a
  comment-only freshness-source update.

Tests: view spec rework asserts cockpit props, exactly-once event handling,
single-refetch refresh, failure toast, stale/403/404/loading cockpit absence,
zero-stops mount, and untouched manager regression.

Refs: design §5-§6, §9-§10; specs/delivery-route-check-in (REQ-DRC-103, 104,
107-110, 112); specs/driver-cockpit-shell (REQ-DCS-007, 009, 010).
```

---

## S11b — Old-card deletion continuation (REFACTOR only)

- **Goal:** Delete the superseded `DriverStopDetail.vue` (~152 lines) and its obsolete equal-card spec (~407 lines) = **~559 lines**, after S11a is green. This is the explicit REFACTOR continuation of S11a's already-proven RED → GREEN → TRIANGULATE cycle: it is **not** an independent behavior slice, runs **no fresh RED/GREEN cycle** (a deletion-only RED cycle is fake TDD), and introduces **no new behavior** — the new cockpit path is already fully proven and green at the S11a boundary. The narrow zero-runtime-reference proof is this slice's verification: no imports, templates, `vi.mock` stubs, or test assertions may reference the removed component; pre-existing prose comments in shared map files are documentation-only and out of scope.
- **Concern:** cleanup only — no code and no new tests; the only "code" change is the deletion itself.
- **Files — DEL:**
  - `src/features/delivery-routes/components/DriverStopDetail.vue` (~152 lines)
  - `src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts` (~407 lines)
- **Test cmd:** `pnpm test:unit --run` (full suite); `vue-tsc --build`; `pnpm build`; `grep -rn "DriverStopDetail" src/` → no runtime references (imports, templates, `vi.mock` stubs, test assertions; shared-map prose comments excluded)

**REFACTOR / VERIFY / CLEANUP steps** — bounded continuation of S11a's TDD cycle; inherits S11a's RED/GREEN evidence; no new behavior.

- [ ] REFACTOR — Precondition check: confirm S11a is green (focused view spec + full suite) and the obsolete old-card tests still pass, then delete `src/features/delivery-routes/components/DriverStopDetail.vue` and `src/features/delivery-routes/components/__tests__/DriverStopDetail.spec.ts` as one atomic unit (no component-without-spec or spec-without-component intermediate state). <!-- sdd-owner: implementation -->
- [ ] VERIFY — Full `pnpm test:unit --run` stays green after the deletion; `vue-tsc --build` clean (no dangling `DriverStopDetail` type/import references); `pnpm build` succeeds. <!-- sdd-owner: implementation -->
- [ ] VERIFY — Narrow zero-runtime-reference proof: `grep -rn "DriverStopDetail" src/` returns no imports, component usage/templates, `vi.mock` stubs, or test assertions; the only permissible matches are the pre-existing documentation-only prose comments in `src/core/shared/components/AddressMapPicker.vue`, `src/core/shared/components/__tests__/AddressMapPicker.spec.ts`, and `src/core/shared/maps/map-provider.ts` (out of scope; they are not runtime references). <!-- sdd-owner: implementation -->
- [ ] CLEANUP — Confirm no dead copy key remains for the old card surface and no obsolete comment references the removed component. <!-- sdd-owner: implementation -->

**Verify**

- Full `pnpm test:unit --run` green (incl. untouched manager tests and list specs); `vue-tsc --build` clean; `pnpm build` succeeds.
- Narrow zero-runtime-reference proof as above.
- Runtime path: N/A — no behavior changed; the S11a dev-server smoke remains valid (cockpit shows as driver; manager branch unchanged).
- Rollback: `git revert <S11b>` restores **only the deleted files** (DriverStopDetail.vue + spec) while keeping the new cockpit path and view wiring; combined `git revert <S11a> <S11b>` restores both the old driver branch and the old-card files — no backend/cache coordination.
- Note: S11b is **~559 lines** (all DEL), fits the 600-line slice cap (no slice-cap exception), but exceeds the 400-line PR review budget → **PR-level size exception** as an atomic single deletion unit (splitting component from spec breaks tests-with-code atomicity; no further legal split). It is not an independent behavior slice: it inherits S11a's RED/GREEN/TRIANGULATE evidence and its checkboxes are REFACTOR/VERIFY/CLEANUP only — no fresh RED/GREEN cycle is claimed.

**Commit message**

```text
refactor(delivery-routes): remove superseded DriverStopDetail after cockpit wiring

- Deletes DriverStopDetail.vue (~152 lines) and its obsolete equal-card spec
  (~407 lines) as the REFACTOR continuation of the S11a view-wiring slice,
  which is already green and triangulated. No new behavior is introduced and
  no fresh RED/GREEN cycle runs; this slice only removes the superseded
  REQ-DRC-003 surface now that the seven-SFC cockpit is wired into the view.
- Narrow zero-runtime-reference proof: no imports, templates, vi.mock stubs,
  or test assertions reference DriverStopDetail in src/ (shared-map prose
  comments out of scope). Timeline and map contracts continue via the reused
  DeliveryRouteTimeline and AddressMapPicker inside the drawer/panel.

Tests: full suite stays green after deletion; vue-tsc --build and pnpm build
clean.

Refs: design §10, §12; specs/delivery-route-check-in (REQ-DRC-003 superseded).
```

---

## Post-apply parent review gates

Bounded review runs after apply per slice (or grouped per chained PR); each gate checks the slice's TDD evidence, focused test result, and the review-budget ledger with its exact totals. Commit execution and chain strategy remain parent/user-authorized.

- [ ] Start or reuse bounded review for S1 (derivation; size exception — exactly 600 at the hard cap, no apply expansion). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S2 (quick actions). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S3 (copy source). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S4 (header). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S5 (operational stops). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S6 (spine). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S7 (footer). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S8 (stop panel). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S9 (drawer; size exception — ~430 lines). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S10 (cockpit root; size exception — ~470 lines). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S11a (view wiring + branch swap; bounded — ~380 lines, no exception). <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for S11b (old-card deletion continuation; size exception — ~559 lines, REFACTOR/VERIFY/CLEANUP only, inherits S11a's RED/GREEN evidence; no slice-cap exception — within the 600 cap). <!-- sdd-owner: parent -->

Per-PR bounded review additionally runs for each merged PR grouping in the approved chain (A/B/C); the per-slice gates above remain the granular review ledger inside each PR.
