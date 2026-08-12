# Archive Report: standardize-admin-tenants-table

**Change**: standardize-admin-tenants-table
**Archived**: 2026-08-12
**Cycle verdict**: PASS WITH WARNINGS — closed cleanly after archive-time task-checkbox reconciliation (no blockers, no CRITICAL)

---

## Executive Summary

All 7 requirements (15 scenarios) shipped across 3 implementation commits + 1 docs reconciliation commit on `feat/standardize-admin-tenants-table` (branch — user merges manually). Final verification: 3938/3938 full-suite tests (exit 0), 238/238 tenants-scoped, `pnpm build` clean, 0 blockers. The new `admin-tenants-list` capability is now source-of-truth under `openspec/specs/admin-tenants-list/spec.md` with REQ-5/6 reconciled to explicitly state the new `phone` column (added in this capability — pre-standardization the column was missing from `useTenantColumns.ts`). Change folder archived; cycle complete.

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: FAIL-as-blocked initially on stale `tasks.md` checkboxes only — sole CRITICAL was a missing audit-trail record, not an implementation defect. Reconciled at archive gate (commit `07ea773`) with no code change. Runtime compliance 7/7 REQs, 15/15 scenarios (13 runtime + 2 source-verified per WU-B no-tests precedent). 0 blockers, 0 implementation CRITICAL findings.
- **Implementation commits** (all on `feat/standardize-admin-tenants-table`, no merge to `main` per user):
  - `fac7ab6` — `docs(admin-tenants): add proposal, spec, design, and tasks for table standardization` (proposal/spec/design/tasks initial)
  - `b045100` — `feat(admin-tenants): add view mode, surface list errors, standardize header and filters` (WU-A)
  - `e8241ac` — `feat(admin-tenants): add EmployeeCard-pattern card view with click-to-edit` (WU-B, no tests)
  - `ede6318` — `test(admin-tenants): cover list view, view mode, columns, and gating` (WU-C)
  - `07ea773` — `docs(admin-tenants): reconcile task checkboxes after verified apply` (archive-gate reconciliation)
- **Tasks artifact**: All 21 implementation tasks and all 4 Definition-of-Done items marked `[x]` in `tasks.md` (archived). The reconciliation note appended to `tasks.md` records the orchestrator-approved exceptional repair: "All 21 implementation tasks and 4 DoD items were completed by sdd-apply but left unchecked in this artifact. Verified green before marking: `pnpm test:unit --run src/features/admin/tenants` → 238/238, full suite → 3938/3938, `pnpm build` clean. Commits: WU-A `b045100`, WU-B `e8241ac`, WU-C `ede6318`. Marked [x] at archive gate per the established Fase 1/2 checkbox-reconciliation exception."
- **Spec source of truth**: `openspec/specs/admin-tenants-list/spec.md` created from the delta spec (capability was new; no prior main spec existed). REQ-5/6 wording reconciled per design decision to explicitly state the `phone` data column (added in WU-A — the pre-standardization `useTenantColumns.ts` lacked it; design followed roles' `description` precedent of adding the column inside Modified scope).
- **Archived folder**: `openspec/changes/archive/2026-08-12-standardize-admin-tenants-table/`
- **Active changes directory**: `standardize-admin-tenants-table` no longer present.

---

## Task Reconciliation (Task Completion Gate)

The persisted `tasks.md` arrived at archive with all 21 implementation tasks and all 4 Definition-of-Done items still `- [ ]`. The implementation, design, and verify report all confirm full completion (3 ordered commits on branch, 238/238 scoped + 3938/3938 full tests green, `pnpm build` clean). The reconciliation was performed by the orchestrator (commit `07ea773`) BEFORE archive handoff, per the established Fase 1/2 checkbox-reconciliation exception:

- **Why no CRITICAL**: the CRITICAL in `verify-report.md` was the unchecked checkboxes themselves, not an implementation defect. The exception path (`sdd-archive` SKILL "Task Completion Gate" #3) explicitly allows archive-time mechanical reconciliation when `apply-progress`/`verify-report` prove every unchecked task is complete. Both sources do.
- **Action performed**: all 25 boxes (`- [ ]` → `- [x]`) in the persisted `tasks.md` were reconciled with a docs-only commit (`07ea773`). No code change. A reconciliation note was appended to the archived `tasks.md` naming the commits and the test/build proof.
- **Result**: archived `tasks.md` ships with the audit trail intact and zero stale unchecked tasks.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-tenants-list` | **Created** | 7 ADDED requirements (REQ-1 through REQ-7) / 15 scenarios; no MODIFIED / REMOVED / RENAMED. Delta was a full spec — copied as the main spec after reformatting from delta framing to the standard main-spec shape (Domain/Purpose header, RFC 2119 keywords tightened, scenarios aligned with the roles spec format). REQ-5/6 reconciled to explicitly state the `phone` column per the design decision (see below). |

The main spec at `openspec/specs/admin-tenants-list/spec.md` now defines the `admin-tenants-list` capability and supersedes the delta. It is the source of truth from this point forward.

### REQ-5/6 phone-column reconciliation diff (delta → main)

| Field | Delta wording | Main-spec wording (reconciled) |
|-------|---------------|-------------------------------|
| REQ-5 column order | "insert `phone` at pos 4 (non-sortable, hideable, no custom cell slot)" | "The column order SHALL be `[name, slug, address, phone, isActive, createdAt, actions]` — `phone` is a data column introduced in this capability and SHALL expose `header: 'Teléfono'`." |
| REQ-5 scenario | implicit ("`isActive`/`address`/`phone`/`actions` do not") | explicit (assertion lists each non-sortable column by name) |
| REQ-6 scenario | "every data column toggles independently" | "every data column toggles independently (including `phone`)" |
| Purpose | no mention of `phone` | "`phone` data column (added in this capability — pre-standardization the column was missing from `useTenantColumns.ts`)" |

The reconciled wording matches the verified implementation per `verify-report.md` Spec Compliance Matrix REQ-5 / REQ-6 rows (✅ COMPLIANT — "phone" present in `useTenantColumns.ts` position 4, locked by `useTenantColumns.test.ts`).

---

## Archive Contents

```
openspec/changes/archive/2026-08-12-standardize-admin-tenants-table/
├── proposal.md            ✅
├── design.md              ✅
├── tasks.md               ✅  (25/25 boxes [x] after archive-time reconciliation; note appended)
├── verify-report.md       ✅  (FAIL-as-blocked on checkboxes only — reconciled pre-archive; runtime 7/7 reqs, 15/15 scenarios)
└── specs/
    └── admin-tenants-list/
        └── spec.md        ✅  (delta spec, archived for audit trail)
```

---

## Review Budget Note (carried forward)

The proposal forecast was "Medium" risk; total ~650 changed lines across 3 WU commits + docs reconciliation.

- **WU-A (`b045100`)** — view mode + error + phone column + header + filters (~175 lines).
- **WU-B (`e8241ac`)** — card view + grid + click-to-edit (~180 lines, NO TESTS per Fase 1 + Fase 2-#1/#2 lesson: customers/users/roles WU-B all went over budget when bundled with tests).
- **WU-C (`ede6318`)** — tests (~295 lines).
- **All three under the 400-line authored-risk budget** individually; aggregate ~650 over 3 WUs.
- **Doc reconciliation (`07ea773`)** — tasks.md checkbox reconciliation, mechanical, no authored risk.
- **Precedents**: roles ~600 (PASS WITH WARNINGS), users 796 (PASS WITH WARNINGS). Tenants matches the roles pattern.

---

## Carried Warnings (non-blocking)

1. **REQ-3 card-rendering scenarios source-verified only** — `TenantCard` / `TenantCardGrid` internals (ladder classes, dashed divider, chip, skeleton, `i-lucide-building`) have no runtime covering test. Documented "WU-B ships without tests" decision; roles/users precedent (PASS WITH WARNINGS). Follow-up: add `TenantCard.spec.ts` + `TenantCardGrid.spec.ts` (or extend view tests) in a future change.
2. **Card-mode error bypass in `AppDataTable`** (design open question #1): a failed request in card mode renders the grid empty state instead of the error block. Parity with roles/users; fix belongs in `AppDataTable`, out of scope. Tracked as cross-cutting follow-up (W3 in the Fase 2 shared-components backlog).
3. **Phone-column spec-text discrepancy** — RESOLVED at archive gate via REQ-5/6 reconciliation in the main spec (see Spec Sync section). The base spec now explicitly states `phone` exists as a data column. No follow-up needed.
4. **Test pragmatics** — `inheritAttrs:false` on the `AppDataTable` stub (parity with roles view tests); `#filters` asserted via `[role="checkbox"]` (real UCheckbox renders a button role); `@nuxt/ui` mock bypassed by auto-imports so real UDropdownMenu/UCheckbox/UCard render in view tests; `reka-dropdown-menu-trigger` implementation-detail coupling. Same warning shape as the roles archive report.
5. **Attempt ledger: 1118 total vs 700 ledger** — maintainer-delegated exception (reset done); recorded once across Fase 2 modules.
6. **Dead `@nuxt/ui` mock block in `AdminTenantsView.test.ts`** (lines 196–221) — SUGGESTION to remove. Auto-imports bypass the mock so real components render; the mock misleads readers. Tracked as a code-cleanup follow-up (low priority).

---

## REQ-7 invariants (verified, all preserved)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| `defaultPinning: { right: ['actions'] }` | ✅ preserved | `AdminTenantsView.vue` line 57, untouched |
| `isSuperAdmin` kebab gate (CASL NOT used) | ✅ preserved | `canManageTenantActions = authStore.isSuperAdmin` |
| `persistKey: 'admin-tenants'` | ✅ preserved | `AdminTenantsView.vue` line 55, untouched |
| Full-array local filter/sort/paginate semantics | ✅ preserved | `tenantsApi.getPaginated({pageSize:1000})` fetches full catalog; `tenants.api.ts:29-90` untouched |
| `tenants.api.ts` contract | ✅ untouched | absent from `git diff --name-only feat/standardize-admin-roles-table...HEAD` for src/features/admin/tenants/api/tenants.api.ts (or equivalently absent from WU diff) |
| `tenant-actions.utils.ts` | ✅ untouched | same |
| "Gestionar miembros" routing | ✅ preserved | `tenant-actions.utils.ts` builder unchanged; kebab entry still present for super-admin |
| No `TenantTableRow` type / route / backend change | ✅ confirmed | type + route files absent from WU diff |

---

## Follow-ups (non-blocking, non-archive-blocking)

1. **TenantCard / TenantCardGrid component tests** — add `TenantCard.spec.ts` + `TenantCardGrid.spec.ts` to lift the 2 REQ-3 source-verified scenarios into runtime coverage. Closes the carried WARNING #1.
2. **Remove dead `@nuxt/ui` mock block** in `AdminTenantsView.test.ts` (lines 196–221) — SUGGESTION from verify report.
3. **AppDataTable card-mode error bypass** — cross-cutting fix (W3 in the Fase 2 shared-components backlog). Closes carried WARNING #2 once landed (benefits roles, users, tenants, and any future standardized table).
4. **Install `@vitest/coverage-v8`** — closes the "Coverage: Not available" gap on this and future standardized-table changes (SUGGESTION from verify report).

---

## Contradictions and Final-State Resolutions

The `tasks.md` checkbox state was the only contradiction between the verify-report snapshot (intermediate) and the launch prompt (highest-ranked final-state source):

- `verify-report.md` (intermediate snapshot) reports `Tasks complete (marked [x]) = 0` and lists 21 implementation tasks + 4 DoD items unchecked as CRITICAL. The launch prompt (higher-ranked, more recent account) asserts the orchestrator reconciled all 25 boxes via commit `07ea773` with `apply-progress` / `verify-report` proving every task complete. The archived `tasks.md` is now consistent with the higher-ranked source: all 25 boxes `[x]`, with the reconciliation note naming the WU commits and the test/build proof.
- The phone-column wording was a delta-vs-implementation spec-text drift (delta REQ-5/6 referenced `phone` as if it existed; design added the column inside Modified scope). Resolved at archive by explicitly stating `phone` as a data column in the main spec REQ-5/6/Purpose. The verify report already confirms compliance (✅ COMPLIANT — phone present at position 4, locked by `useTenantColumns.test.ts`).
- Final test/build numbers (3938 full / 238 tenants-scoped, exit 0; build clean) come from the orchestrator's launch prompt (higher-ranked than `verify-report`'s 238/238 + 3938/3938, which are the same numbers here — no contradiction).
- No CRITICAL issues remain. WARNINGS are non-blocking and tracked above.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized admin tenants list behavior:

- `openspec/specs/admin-tenants-list/spec.md` (NEW)

No other main spec was touched. `promotions-list`, `customer-list`, `sales`, `quotations-list`, `admin-roles-list`, etc. are unchanged.

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (21/21 implementation + 4/4 DoD, all `[x]` after reconciliation) |
| Apply | ✅ complete (3 WU commits on `feat/standardize-admin-tenants-table`) |
| Verify | ✅ PASS WITH WARNINGS (0 blockers, 0 implementation CRITICAL; checkbox CRITICAL reconciled) |
| **Archive** | ✅ **complete** |

The change has been fully planned, implemented, verified, and archived on `feat/standardize-admin-tenants-table`. Ready for the next change. User merges branch to `main` manually per session preflight.
