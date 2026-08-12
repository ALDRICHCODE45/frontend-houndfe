# Archive Report: standardize-admin-tenant-members-table

**Change**: standardize-admin-tenant-members-table
**Archived**: 2026-08-12
**Cycle verdict**: PASS WITH WARNINGS — closed intentionally with 6 carried WARNINGs (0 CRITICAL)

---

## Executive Summary

All 7 requirements (19 scenarios) shipped across 3 implementation commits + 1 docs commit on `feat/standardize-admin-tenant-members-table`. Final verification: 3933 tests pass (exit 0), memberships focused 128/128 pass, `pnpm build` clean. The new `admin-tenant-members-list` capability is now source-of-truth under `openspec/specs/admin-tenant-members-list/`, with REQ-3 reconciled at archive-time to match the implementation (chip row = `StatusDotBadge` only, body `Rol` = plain text — NOT `AppBadge`). All 21 tasks marked `[x]`. Change folder archived; cycle complete.

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: PASS WITH WARNINGS — 7/7 requirements, 19/19 scenarios, `pnpm test:unit --run` exit 0 (3933 tests), `pnpm build` exit 0. 0 CRITICAL, 6 WARNINGs carried.
- **Implementation commits** (all on `feat/standardize-admin-tenant-members-table`):
  - `96f9a4e` — `docs(admin-tenant-members): add proposal, spec, design, and tasks for table standardization`
  - `d16a1f6` — `feat(admin-tenant-members): add view mode, surface list errors, fix default sort` (WU-A, **545 lines — exceeds forecast ~150, shared test stubs**)
  - `a81a354` — `feat(admin-tenant-members): add EmployeeCard-pattern card view with click-to-edit` (WU-B, no-tests)
  - `7f54c04` — `test(admin-tenant-members): cover list view, view mode, columns, and gating` (WU-C)
  - `7ad2139` — `docs(standardize-admin-tenant-members-table): tick WU-A, WU-B, WU-C tasks`
- **Tasks artifact**: All 21 implementation tasks marked `[x]` in `tasks.md` (archived). No stale unchecked boxes.
- **Spec source of truth**: `openspec/specs/admin-tenant-members-list/spec.md` created from the delta spec (capability was new; no prior main spec existed).
- **Archived folder**: `openspec/changes/archive/2026-08-12-standardize-admin-tenant-members-table/`
- **Active changes directory**: `standardize-admin-tenant-members-table` no longer present.
- **REQ-7 invariants verified**: `memberships.api.ts` UNTOUCHED; `tenantId` from `route.params`; per-tenant persistKey `'admin-tenant-members-{tenantId}'`; `AdminPageHeader` + `useTenantSummary` header; CASL `userCan('*','TenantMembership')` gates; `defaultPinning.right: ['actions']`; `defaultSorting` fixed `userEmail`→`userName`; no type/route/backend change.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-tenant-members-list` | **Created** | 7 ADDED requirements (REQ-1 through REQ-7); 19 scenarios. No MODIFIED / REMOVED / RENAMED. Delta was full spec — copied as the main spec with REQ-3 reconciled at archive-time. |

### REQ-3 Reconciliation at Archive (per Final-State Authority)

The delta spec REQ-3 listed `AppBadge(roleName, info)` in the chip row beside `StatusDotBadge`. The design contract moved the role chip to the body `Rol` column but still specified `AppBadge(roleName, info)`. The implementation shipped neither: chip row = `StatusDotBadge` only, body `Rol` = plain text `member.roleName`. Per the orchestrator's launch-prompt final-state fact and the design decision that won (carried as verify-report WARNING #3), the base spec at `openspec/specs/admin-tenant-members-list/spec.md` matches the implementation:

- Chip row: `StatusDotBadge(userIsActive → activityToBadgeTone, compact, label Activo/Inactivo)` — null-safe via `v-if !== undefined`. **No `AppBadge` here.**
- Body `Rol`: plain text `member.roleName` rendered in the 2-col body. **No `AppBadge`.**
- Reconciled main spec also carries a note block explaining the deviation from the original proposal/design contract for audit traceability.

The main spec at `openspec/specs/admin-tenant-members-list/spec.md` now defines the admin-tenant-members-list capability and supersedes the delta. It is the source of truth from this point forward.

---

## Archive Contents

```
openspec/changes/archive/2026-08-12-standardize-admin-tenant-members-table/
├── proposal.md                ✅
├── design.md                  ✅
├── tasks.md                   ✅  (21/21 tasks complete, all [x])
├── verify-report.md           ✅  (PASS WITH WARNINGS — 7/7 reqs, 19/19 scenarios)
├── archive-report.md          ✅  (this file)
└── specs/
    └── admin-tenant-members-list/
        └── spec.md            ✅  (delta spec, archived for audit trail)
```

---

## Review Budget Note (carried forward)

The proposal forecast was "Medium" risk; total ~620 lines estimated (WU-A ~150 + WU-B ~180 + WU-C ~290). Final tally: ~1220 authored lines vs 700-line ledger (maintainer-delegated exception, reset done). WARNING #1.

- **WU-A (`d16a1f6`) — 545 lines**: exceeds the ~150 forecast. Shared test-stub mock setup (RED stubs in WU-A that WU-C expanded) is the driver. Under the Chained-PR threshold; not split. WARNING #2.
- **WU-B (`a81a354`) — ~180 lines**: no tests (design decision, Fase 1 + Fase 2-#1/#2/#3 lesson — customers/users/roles/tenants all WU-B went over budget). WARNING #6 (2 presentational card scenarios verified via source + tasks §2.4 `pnpm dev` smoke).
- **WU-C (`7f54c04`) — ~290 lines**: as forecast.

---

## Carried Warnings (Final State from verify-report.md)

Per the orchestrator's launch prompt and `verify-report.md` WARNINGs section, the following are explicitly accepted at archive-time (none blocks archive; all 6 are WARNINGs):

1. **Ledger exception**: 1220 total authored lines vs 700-line ledger — maintainer-delegated exception; reset done.
2. **WU-A 545-line overrun**: shared test-stub mock setup (RED stubs in WU-A that WU-C expanded). Under Chained-PR threshold; not split.
3. **REQ-3 role-chip divergence (RECONCILED)**: chip row = `StatusDotBadge` only; body `Rol` = plain text — base spec REQ-3 reconciled to match implementation. See "REQ-3 Reconciliation at Archive" above.
4. **`data-testid="status-badge"` divergence**: added to `StatusDotBadge` (diverges from `TenantCard`; enables the null-safe chip test required by spec).
5. **Card-mode error bypass**: `AppDataTable`'s `#cards` branch renders the grid empty state instead of the error block. Parity limitation with tenants/users/roles; fix belongs in `AppDataTable`, out of scope (W3 follow-up).
6. **2 presentational card scenarios**: REQ-3 "ladder and no kebab" + "loading and empty" lack dedicated unit tests — verified via source inspection + tasks §2.4 `pnpm dev` smoke per the design-sanctioned WU-B no-tests scoping.

Per `sdd-archive` Strict-vs-OpenSpec Archive Policy, this is a **non-critical partial / intentional archive** — recorded as "intentional-with-warnings". Archive proceeds because:
- 0 CRITICAL issues.
- All WARNINGs have documented acceptance (orchestrator launch-prompt final-state fact).
- REQ-3 base-spec reconciliation applied at archive-time.

---

## Contradictions and Final-State Resolutions

Per the Final-State Authority hierarchy (Section "Final-State Authority" of `sdd-archive/SKILL.md`):

- **Higher-ranked sources (orchestrator launch prompt + native review gate)**: WIN. 3933 tests pass, 0 CRITICAL, all 21 tasks ticked, REQ-3 reconciled per implementation.
- **Intermediate snapshot (`verify-report.md`, observation 3691)**: VALID history. The 3933-test figure matches what `verify-report.md` reports, so there is no stale test-count drift.
- **Earlier `apply-progress` snapshot**: superseded by the 7ad2139 docs-tick commit that marked all 21 tasks `[x]`. No residual "pending" claims to echo.

No unrankable contradictions. The REQ-3 chip divergence is the one place where delta-spec and implementation diverged; the base spec was reconciled at archive-time per the orchestrator's explicit instruction.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized admin tenant members list behavior:

- `openspec/specs/admin-tenant-members-list/spec.md`

---

## Fase 2 Status — ADMIN PARITY COMPLETE

This is the **4th and final** admin-table standardization change in Fase 2. All 4 admin modules are now on the same standard:

| Module | Branch | Archived | Cycle Verdict |
|--------|--------|----------|---------------|
| Users | `feat/standardize-admin-users-table` | ✅ | PASS WITH WARNINGS (796 lines) |
| Roles | `feat/standardize-admin-roles-table` | ✅ | PASS WITH WARNINGS (~600 lines) |
| Tenants | `feat/standardize-admin-tenants-table` | ✅ | PASS WITH WARNINGS (~650 lines) |
| **Tenant Members** | `feat/standardize-admin-tenant-members-table` | ✅ (this archive) | PASS WITH WARNINGS (~1220 lines) |

The user merges all 4 branches to `main` manually when back. **FASE 2 ADMIN PARITY — COMPLETE.**

---

## Open Follow-ups (Not in Spec Sync)

Carried from the verify-report WARNINGs + design Open Questions:

- **W4** — Component tests across Fase 2 (Users/Roles/Tenants/Tenant Members shared test infrastructure; the same stubs are duplicated in each module).
- **W3** — `AppDataTable` card-mode error fix (parity gap shared across tenants/users/roles/tenant-members).
- **G5** — Users list filter → `houndfe-backend` (member-side has no equivalent because no `isActive` query param exists on memberships — accepted out of scope).

**Fase 3 candidates** (separate SDD cycles):

- **Empleados custom pagination** — needs backend support first.
- **Docs por Vencer client-side** — local date math + threshold config.
- **Approvals Pendientes list** — pagination + filter UX (already has a `feat/pending-approvals-pagination` branch).

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (21/21 [x]) |
| Apply | ✅ complete (3 WU commits + 2 docs commits on branch) |
| Verify | ✅ PASS WITH WARNINGS (0 CRITICAL) |
| **Archive** | ✅ **complete (intentional-with-warnings)** |

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
