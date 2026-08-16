# Archive Report: standardize-expiring-documents-table

**Change**: standardize-expiring-documents-table
**Archived**: 2026-08-16
**Cycle verdict**: PASS WITH WARNINGS — closed intentionally with carried WARNINGs (0 CRITICAL, 0 blockers)

---

## Executive Summary

All 9 requirements (16 scenarios) shipped across 2 commits on `feat/standardize-expiring-documents-table`. Final verification: focused employees suite 922/922 green (34 files), full suite 4257 pass with 2 pre-existing unrelated failures (`POS/sales/SalesListView.test.ts` + `app/router/router.notifications.spec.ts` — OUT OF SCOPE, preserved), `pnpm build` clean. The new `admin-expiring-documents` capability is now source-of-truth under `openspec/specs/admin-expiring-documents/spec.md` (whole-ADDED — no prior main spec existed; delta was copied as-is, byte-identical). 25/26 DoD tasks `[x]`; only the manual `pnpm dev` smoke DoD item is unticked (carried as WARNING, same precedent as Fase 3 #1/#3 and Fase 2 archives). Change folder archived; cycle complete.

---

## Final State (per Final-State Authority)

Per the orchestrator's launch prompt (highest-ranked source after `reviewGate`/`tasks` artifact) and the verified `verify-report.md`, the change closed in the following state:

- **Verify phase verdict**: PASS WITH WARNINGS — 9/9 requirements, 16/16 scenarios (15 test-backed, 1 contract-level), blockers 0, critical_findings 0. Validator-admitted (`evidence_revision` sha256:288e8c013cb86b57cf0b63c0877977b47f8f21a286630ec53eef1a94df1fb276). Focused suite `pnpm test:unit --run src/features/admin/employees` exit 0 (922/922), `pnpm build` exit 0.
- **Implementation commits** (all 2, in order, on `feat/standardize-expiring-documents-table`):
  - `9411f20` — `feat(admin-expiring-documents): migrate to useServerTable, surface errors, add sort/visibility/search/filters` (WU-A)
  - `4e98ad3` — `test(admin-expiring-documents): port wu12b spy and cover adapter/composable/view contracts` (WU-C)
- **Recovery context**: the dedicated sdd-apply sub-agent returned `sdd_task_result_empty` transport failures 3× for WU-A; the orchestrator switched to the general agent (with the sdd-apply skill loaded), which completed and committed WU-A (`9411f20`) and WU-C (`4e98ad3`). Deliverables correct and green; process/transport note, not an implementation defect.
- **Ledger**: WU-A **1407 changed lines vs 400 budget** → maintainer-approved reset (`size:exception`); WU-C settled complete (no overrun). All ledger settled.
- **Tasks artifact**: 25/26 DoD items `[x]` in `tasks.md` (archived); only the manual `pnpm dev` smoke unticked (carried WARNING).
- **Spec source of truth**: `openspec/specs/admin-expiring-documents/spec.md` created from the delta spec (capability was new; no prior main spec existed). Byte-identity confirmed via `diff -r` (empty).
- **Archived folder**: `openspec/changes/archive/2026-08-16-standardize-expiring-documents-table/`
- **Active changes directory**: `standardize-expiring-documents-table` no longer present.
- **REQ-9 invariants verified** (per launch prompt):
  - Shared `useServerTable` **byte-identical vs main** (`git diff main...HEAD -- src/core/shared/composables/useServerTable.ts` = empty).
  - `EmployeeDocument` type **UNCHANGED** (dedicated `ExpiringDocumentItem` response type added).
  - `pagination.utils.ts` header updated: `/expiring` dropped from "full array, NO server pagination" comment; `/pending-approvals` line kept.
  - NO `ViewToggle` / `displayMode` / `useExpiringDocumentsViewMode` / `ExpiringDocumentCard` introduced; no backend change (frontend-only — `houndfe-backend` never accessed).
  - Pure helpers (`formatDaysRemaining` / `computeExpiringDocumentRow` / `formatTimeOffDate`) unchanged.
  - `git diff main...HEAD --name-only` = exactly 7 files.
- **Preserved specs**: `s5-tray-reframe`, `wu11-timeoff-review-emergency-contacts`, `foundation`, `PendingApprovalsView.test`, `EmployeesListView.test`, `EmployeesListView.batch`, `wu03-card-view`, `wu09-documentos` UNCHANGED.
- **Backend contract (evidence, no backend code read)**: `GET /admin/employees-documents/expiring` now server-side paginated `{ data, meta: { total, page, limit, totalPages } }` with `page`/`limit` (max 100), `search` (≥2 chars), `sortBy` (`expiresAt`|`createdAt`|`category`|`employeeName`), `sortOrder` — confirmed by backend team. Items carry server-resolved `fullName`/`employeeNumber`.

---

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| `admin-expiring-documents` | **Created** | 9 ADDED requirements (REQ-1 through REQ-9); 16 scenarios. No MODIFIED / REMOVED / RENAMED. Delta was whole spec — copied as the main spec byte-identically (no reconciliation required; design and implementation aligned on Approach A). |

### Mechanical copy verification (MUST appear in phase result)

```
$ diff -r openspec/changes/standardize-expiring-documents-table/specs/admin-expiring-documents/spec.md \
         <temp staging copy>
DIFF-1-EMPTY-OK   (empty — byte-identity confirmed; no differences produced)
```

Post-move re-verification (main spec vs archived delta):

```
$ diff -r openspec/specs/admin-expiring-documents/spec.md \
         openspec/changes/archive/2026-08-16-standardize-expiring-documents-table/specs/admin-expiring-documents/spec.md
MAIN-VS-ARCHIVED-IDENTICAL   (empty — byte-identity confirmed)
```

The main spec at `openspec/specs/admin-expiring-documents/spec.md` now defines the `admin-expiring-documents` capability and supersedes the delta. It is the source of truth from this point forward.

---

## Archive Contents

```
openspec/changes/archive/2026-08-16-standardize-expiring-documents-table/
├── proposal.md                       ✅
├── explore.md                        ✅
├── design.md                         ✅
├── tasks.md                          ✅  (25/26 DoD [x]; manual pnpm dev smoke carried)
├── verify-report.md                  ✅  (PASS WITH WARNINGS — 9/9 reqs, 16/16 scenarios)
├── archive-report.md                 ✅  (this file)
└── specs/
    └── admin-expiring-documents/
        └── spec.md                   ✅  (delta spec, archived for audit trail)
```

### Mechanical move verification (MUST appear in phase result)

```
$ diff -r <pre-move recursive snapshot> openspec/changes/archive/2026-08-16-standardize-expiring-documents-table
DIFF-2-EMPTY-OK   (empty — byte-identity confirmed; no differences produced)
```

Source folder confirmed absent from `openspec/changes/` after the move. The `archive-report.md` is additive and excluded from the readback (it did not exist in the source snapshot).

---

## Review Budget / WU Tally (carried forward)

The proposal forecast ~470-580 lines (WU-A ~220-280 + WU-C ~250-300). Final tally:

- **WU-A (`9411f20`)**: **1407 changed lines** vs **400-line budget** → maintainer-approved ledger reset (`size:exception`). Carried as WARNING (ledger).
- **WU-C (`4e98ad3`)**: settled complete — no overrun.

Ledger settled; no outstanding budget exception. WU-B was folded into WU-A (no card view / view-mode composable / card component in scope).

---

## Carried Warnings (Final State from `verify-report.md` + launch prompt)

Per the orchestrator's launch prompt and `verify-report.md` WARNINGs section, the following are explicitly accepted at archive-time (none blocks archive; all are WARNINGs):

1. **No `apply-progress` artifact persisted** — Strict-TDD evidence reconstructed from the commit trail + test-file RED headers + tasks.md rather than a persisted TDD Cycle Evidence table (same as Fase 3 #1). TDD process itself evident on disk; not a substantive gap.
2. **Full suite has 2 pre-existing unrelated failures** — `POS/sales` `SalesListView.test.ts` + `app/router` `router.notifications.spec.ts` (both files untouched by this diff — `git diff main...HEAD --name-only` confirms). Out of scope per orchestrator; left unfixed.
3. **Recovery path used for WU-A and WU-C** — the dedicated sdd-apply sub-agent returned `sdd_task_result_empty` transport failures 3× for WU-A; the orchestrator switched to the general agent (with the sdd-apply skill loaded), which completed and committed WU-A (`9411f20`); WU-C also via the general agent (`4e98ad3`). Deliverables are correct and green; process/transport note.
4. **`pnpm dev` manual smoke DoD item unticked** (25/26) — runtime-only check (threshold refetch, sortable headers, debounced search, column-visibility dropdown, error retry, fullName render, no `listForPicker` call, no `paginateRows` slice). Same precedent as Fase 3 #1/#3 and Fase 2: manual runtime verification deferred to the user's local merge. The equivalent behaviors ARE covered by the 16 automated view/composable/adapter tests.
5. **WU-A ledger exception**: 1407 lines vs 400 budget — maintainer-approved reset; settled.

> **Additional carry (from launch prompt, NOT in scope)**: backend open questions relayed for the backend team: (1) `createdAt` sortBy stays latent (no column maps to it) — wire `documento` to it later? (2) `meta.limit` vs `pageSize` authority + confirmation that `totalPages = ceil(total/limit)`.

Per `sdd-archive` Strict-vs-OpenSpec Archive Policy, this is a **non-critical partial / intentional archive** — recorded as "intentional-with-warnings". Archive proceeds because:

- 0 CRITICAL issues.
- 0 blockers.
- All WARNINGs have documented acceptance (orchestrator launch-prompt final-state fact).
- 25/26 DoD tasks ticked; only the manual smoke DoD remains (a `pnpm dev` browser check, not implementation work).

---

## Task Reconciliation (Task Completion Gate)

The persisted `tasks.md` shows **25/26** ticked: all 14 WU tasks (WU-A 1.1–1.9, WU-C 2.1–2.5) `[x]` and 11/12 DoD items `[x]`. The single unticked item is the **manual `pnpm dev` smoke** DoD (line "pnpm dev smoke: …"), which is a runtime browser check with no code gate — carried per the Fase 3 #1/#3 and Fase 2 precedent, explicitly authorized by the orchestrator launch prompt. No stale unchecked implementation tasks block the cycle. Task 2.1 (wu12b spy port) was pulled forward into WU-A per the gatekeeper correction (`git show 9411f20` confirms the wu12b port landed in WU-A; WU-C `4e98ad3` only expanded the two test files).

---

## Contradictions and Final-State Resolutions

Per the Final-State Authority hierarchy (Section "Final-State Authority" of `sdd-archive/SKILL.md`):

- **Higher-ranked sources (orchestrator launch prompt + tasks artifact)**: WIN. 25/26 DoD tasks ticked (1 manual smoke carried), `useServerTable` byte-identical vs main, all REQ-1..REQ-9 implemented, WU-A ledger reset approved by maintainer.
- **Intermediate snapshot (`verify-report.md`)**: VALID history at its moment; final numbers carried from the launch prompt (922 focused / 4257 full / 2 pre-existing) match the verify snapshot — no post-verify numeric drift to reconcile.
- **`reviewGate`**: structurally absent — no review artifact was ever discovered for this candidate; archive proceeds under ordinary repository policy (per the Native Review Receipt Gate, absence is not a defect to investigate).

No unrankable contradictions. The implementation matches the delta spec 1:1; the only divergence is the manual smoke carry, which the orchestrator explicitly authorized.

---

## Source-of-Truth Specs Updated

The following main spec now reflects the standardized expiring documents dashboard behavior:

- `openspec/specs/admin-expiring-documents/spec.md` (CREATED, byte-identical from delta)

---

## Fase 3 Status — EXPIRING DOCUMENTS PARITY COMPLETE (2/3)

This is the **2nd of 3** Fase 3 standardization changes:

| Module | Branch | Archived | Cycle Verdict |
|--------|--------|----------|---------------|
| **Employees** | `feat/standardize-admin-employees-table` | ✅ (2026-08-14) | PASS WITH WARNINGS |
| **Expiring Documents** | `feat/standardize-expiring-documents-table` | ✅ (this archive) | PASS WITH WARNINGS |
| Pending Approvals | (existing `feat/pending-approvals-pagination` branch) | ⏳ (Fase 3 #3) | TBD |

Backend open questions (below) need resolution before related follow-ups ship. Frontend code is ready for backend confirmation.

---

## Open Follow-ups (Not in Spec Sync)

Carried from the verify-report WARNINGs + design Open Questions + launch-prompt relay:

- **Backend open questions (relay to backend team, NOT in scope)**:
  1. `createdAt` sortBy stays latent — wire `documento` to it later?
  2. `meta.limit` vs `pageSize` authority + confirm `totalPages = ceil(total/limit)`.
- **Manual `pnpm dev` smoke** — DoD item remains for the user to verify in browser at merge time (same precedent as Fase 3 #1/#3 and Fase 2 archives).
- **`apply-progress` artifact gap** — process-bookkeeping; not blocking; can be regenerated next cycle.
- **SUGGESTIONs from verify** (non-blocking): (1) two near-duplicate "empty result set" assertions in `wu12b-dashboard-views.spec.ts` could be deduped; (2) adapter tests live inside `useExpiringDocuments.spec.ts` rather than a dedicated `api/__tests__/employees.api.spec.ts` addition (documented deviation from design.md File Changes table; functionality identical).

---

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Propose | ✅ complete |
| Spec | ✅ complete |
| Design | ✅ complete |
| Tasks | ✅ complete (25/26 DoD [x]; manual smoke carried) |
| Apply | ✅ complete (2 WU commits on branch) |
| Verify | ✅ PASS WITH WARNINGS (0 CRITICAL, 0 blockers) |
| **Archive** | ✅ **complete (intentional-with-warnings)** |

The change has been fully planned, implemented, verified, and archived. Ready for the next change (Fase 3 #3 — Pending Approvals, or whichever the user picks).
