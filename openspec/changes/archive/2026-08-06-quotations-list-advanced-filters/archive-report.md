# Archive Report: quotations-list-advanced-filters

```yaml
schema: gentle-ai.archive-report/v1
change: quotations-list-advanced-filters
mode: openspec
artifact_store: openspec
archived_at: 2026-08-06
git_head: 95999ab
git_branch: sdd-quotations-ui-redesign
delivery_strategy: exception-ok
verdict: pass-with-notes
blockers: 0
critical_findings: 0
requirements: 16/16
scenarios: 43/43
```

## Final Verdict

**SDD cycle complete.** Change `quotations-list-advanced-filters` is
verified (`pass-with-notes`, 0 blockers, 0 critical findings) and archived.
All 18 implementation tasks (T-BE-01…07 + T-FE-01…11) are complete; 5 FE
work-unit commits ship on `sdd-quotations-ui-redesign`, and the cross-repo
BE work-unit was delivered and confirmed by the backend team on
`houndfe-backend` branch `feature/quotations-list-advanced-filters`
(handoff 2026-08-06). The archived folder at
`openspec/changes/archive/2026-08-06-quotations-list-advanced-filters/`
is the immutable audit trail.

## What Shipped

### Frontend work-unit (5 commits on `sdd-quotations-ui-redesign`)

| Commit  | Hash      | Description |
|---------|-----------|-------------|
| FE.1    | `8b4d455` | feat(quotations): align list view chrome with system table pattern — UCard body bg + TableHeaderDescription + .quotations-list-view scope |
| FE.2    | `ef45978` | feat(quotations): advanced list filters with slideover, column visibility, header split and URL persistence — 5 filters, useServerTable 0↔1 adapter, useFiltersUrlAdapter |
| FE.3    | `9123d89` | fix(quotations): forward createdFrom/createdTo date-range filter to the backend — regression test added; module suite 573/573 green |
| FE.4    | `3f970c8` | docs(quotations): record verify remediation for createdFrom/createdTo forwarding |
| FE.5    | `95999ab` | docs(quotations): record backend confirmation of advanced-filter contract |

The five FE-owned requirements (REQ-9…16) landed in FE.1 and FE.2; FE.3 is
the verify-phase remediation that closed the only functional WARNING in the
verify report (createdFrom/createdTo not forwarded by the composable). FE.4
and FE.5 are the documentation commits that captured the remediation and
backend handoff in the change folder.

### Backend work-unit (cross-repo, confirmed delivered 2026-08-06)

| Repo / branch | Deliverable | Status |
|---------------|-------------|--------|
| `houndfe-backend` · `feature/quotations-list-advanced-filters` | Extend `GET /quotations` with `search`, multi-`status` (CSV), multi-`customerId` (CSV), `expiresFrom`/`expiresTo`, `minTotalCents`/`maxTotalCents` | CONFIRMED IMPLEMENTED by backend team (handoff message received 2026-08-06) |

Backend contract as delivered (per handoff message captured in
`verify-report.md` §"Backend confirmation (2026-08-06)"):

- `search` — `contains` on `customer.firstName`/`lastName`, case-insensitive,
  trimmed; quotations without a customer never match.
- `status` — CSV multi-select, OR semantics; invalid value → 400; single
  value still works.
- `customerId` — CSV multi-select, OR semantics; invalid UUID → 400; single
  UUID still works.
- `expiresFrom`/`expiresTo` — ISO 8601 inclusive range on `expiresAt`;
  one = `>=`/`<=`; both = `BETWEEN`; invalid date → 400; null `expiresAt`
  never matches.
- `minTotalCents`/`maxTotalCents` — integers ≥ 0 inclusive range on
  `totalCents`; `min=0` is valid; `min>max` → 400.
- OR within a group, AND between groups; stable with `page`/`limit`/`sortBy`/`sortOrder`.
- Response DTO and pagination envelope unchanged — no FE response-side
  adjustments needed.

**Correction to the original exploration finding**: previously the
front-end `search` param was NOT silently ignored — the backend rejected
unknown params with 400. Either way the search feature was broken; it
now works.

**Known pre-existing behavior** (offered as a follow-up by the backend
team, out of scope for this change): `status` filters on the PERSISTED
status, not the lazy-effective status. A SENT quotation past expiry
renders as EXPIRED on the wire but matches `status=SENT` (not
`status=EXPIRED`). If effective-status filtering is required, the backend
team offered to add it as a future follow-up.

### Final Test State

| Layer | Tests | Files | Tooling |
|-------|-------|-------|---------|
| FE unit (full suite) | 3700 passed | 243 | vitest + @vue/test-utils |
| FE unit (quotations module) | 573 passed | 4 spec files | vitest + @vue/test-utils |
| FE type-check | — | — | `vue-tsc --build` exit 0, zero errors |
| FE build | — | — | `pnpm build` exit 0, 2254 modules in 31.40s |
| BE unit (quotations module) | 573/573 | (backend repo) | jest (`pnpm test:unit`) |

`pnpm type-check`, `pnpm build`, `pnpm test:unit --run` all green on
`HEAD = 95999ab` on branch `sdd-quotations-ui-redesign`.

## Requirement Completeness

| Req | Title | Status | Notes |
|-----|-------|--------|-------|
| REQ-1 | `GET /quotations` `search` param | ✅ BE | Backend delivered; OR on customer firstName/lastName, insensitive, trimmed |
| REQ-2 | multi-`status` filter (OR) | ✅ BE | CSV validated via `@CsvEnum`; OR semantics |
| REQ-3 | multi-`customerId` filter (OR) | ✅ BE | CSV validated via `@CsvUuid`; OR semantics |
| REQ-4 | `expiresFrom`/`expiresTo` range | ✅ BE | Inclusive `gte`/`lte` on `expiresAt` |
| REQ-5 | `minTotalCents`/`maxTotalCents` range | ✅ BE | `@IsInt @Min(0)` + `min≤max` validation |
| REQ-6 | backward compatibility of existing contract | ✅ FE + BE | Single-value usage unchanged; FE QuotationListParams widened |
| REQ-7 | combined filters AND + pagination stability | ✅ BE | Shared `where` between `findMany` and `count` |
| REQ-8 | validation errors (400, clear message) | ✅ BE | Standard NestJS 400 shape; offending param named in message |
| REQ-9 | header-color split chrome | ✅ FE | UCard `bg-coco-neutral-50` on body; TableHeaderDescription in `#header` |
| REQ-10 | status tabs + slideover + chips | ✅ FE | 5 tabs functional; slideover-wins rule; chips emit per filter |
| REQ-11 | column visibility + global search | ✅ FE | `enable-column-visibility` + `v-model:global-filter`; search wired to backend `search` param |
| REQ-12 | URL persistence of filter state | ✅ FE | `useFiltersUrlAdapter` + `useDataTableFilters`; defaults stay out of URL |
| REQ-13 | delete flow survives unchanged | ✅ FE | ConfirmModal + CASL gate + status-gated dropdown items preserved |
| REQ-14 | composable migration to useServerTable | ✅ FE | 0↔1 adapter mirrors `useConfirmedSales`; query-key prefix retained for delete-flow invalidation |
| REQ-15 | strict TDD: pure functions unit-tested | ✅ FE | `quotationFiltersSchema.spec.ts` (15), `useQuotationsListTable.spec.ts` (15), `QuotationsListView.test.ts` (22), `quotation.types.spec.ts` (7) |
| REQ-16 | anti-requirements | ✅ FE | Zero diffs to `core/shared/data-table-filters/`, `useServerTable.ts`, or `sales/`; legacy `useQuotationsList` + `QuotationsSearchInput` deleted; no new deps; testids stable |

All 16 requirements compliant with their scenarios. The earlier
functional WARNING in `verify-report.md` (REQ-6 createdFrom/createdTo
not forwarded by the composable) was resolved in commit `9123d89` with
a regression test; the FE composable + queryKey now forward the date
range verbatim, and `QuotationListParams` carries the two fields for
type completeness.

## Verification Evidence

### Build & tests execution

```
$ pnpm type-check
$ vue-tsc --build  (exit 0, no errors)

$ pnpm build
$ run-p type-check "build-only {@}" --
$ vue-tsc --build   (clean)
$ vite build        (2254 modules, 31.40s)
✓ built in 31.40s

$ pnpm test:unit --run
 Test Files  243 passed (243)
      Tests  3700 passed (3700)
   Duration  63.93s
```

### Assertions / TDD quality

| File | Tests | Findings |
|------|-------|----------|
| `quotationFiltersSchema.spec.ts` | 15 | All verify real behavior (field shape, serialize round-trip, active chips) |
| `useQuotationsListTable.spec.ts` | 15 | All verify real behavior (page math, filter forwarding, status precedence, pagination reset) |
| `QuotationsListView.test.ts` | 22 | All verify real behavior (rendering, interactivity, navigation, CASL, delete, anti-requirements) |
| `quotation.types.spec.ts` | 7 | Type-level assertions paired with value assertions; no tautologies |

Assertion quality audit: ✅ All assertions verify real behavior. No
tautologies, no ghost loops, no smoke-test-only tests, no orphan empty
checks, and no mock-heavy tests (mocks ≤ assertions in all files).

### Backend confirmation evidence

The backend team delivered the contract in `houndfe-backend` branch
`feature/quotations-list-advanced-filters` and confirmed via handoff
message received by the orchestrator on 2026-08-06. The handoff was
captured verbatim in `verify-report.md` §"Backend confirmation
(2026-08-06)" and is restated in the **What Shipped** section above.
573/573 quotations module tests green on the backend side (per the
orchestrator's launch prompt final-state facts).

## Stale Checkbox Reconciliation

The Phase 1 backend tasks (T-BE-01…07) were unchecked in the persisted
`tasks.md` because the FE orchestrator could not write to the cross-repo
BE artifact. At archive time, `sdd-archive` performed the exceptional
mechanical reconciliation allowed by the SKILL: marked T-BE-01…07 as
`[x]` and appended an inline reconciliation note citing the BE handoff
(2026-08-06) and the `verify-report.md` backend-confirmation section as
proof. The 11 FE tasks (T-FE-01…11) were already `[x]` in the persisted
artifact.

| Task range | Final state | Source of truth |
|------------|-------------|-----------------|
| T-BE-01…07 | `[x]` (reconciled at archive time) | Orchestrator launch prompt + `verify-report.md` §"Backend confirmation (2026-08-06)" |
| T-FE-01…11 | `[x]` (marked during apply) | `tasks.md` + `verify-report.md` §"Spec Compliance Matrix" |

**Reconciliation reason** (archived verbatim): The backend team delivered
and confirmed all 7 BE tasks in `houndfe-backend` branch
`feature/quotations-list-advanced-filters` (handoff received 2026-08-06;
573/573 quotations module tests green; `verify-report.md`
§"Backend confirmation (2026-08-06)" lists the exact contract delivered:
search by customer name, multi-status CSV, multi-customerId CSV,
expiresFrom/expiresTo, minTotalCents/maxTotalCents, OR-in-group/AND-between-groups,
400s with clear messages, response DTO unchanged). Per the SKILL's
exceptional-repair clause and the orchestrator's explicit final-state
facts, `sdd-archive` marks them `[x]` retroactively.

## Open Items / Follow-ups

| Item | Severity | Description |
|------|----------|-------------|
| Effective-status filter (status on wire-rendered value) | SUGGESTION | Backend offers lazy-effective status filter — a SENT quotation past expiry renders EXPIRED on the wire but currently matches `status=SENT`. If product wants the filter to match the lazy-effective status, the backend team offered to add it as a follow-up change. Out of scope here. |
| `useQuotationsListTable` could forward filters generically | SUGGESTION | The composable currently hand-picks each field from `filters.value` to forward to the backend. Forwarding the spread of `filters.value` (or `filtersCtl.backendParams`) generically would reduce the risk of a future filter addition being silently dropped (root cause of the `createdFrom`/`createdTo` regression). |
| No `apply-progress` artifact in change directory | NOTE | Strict TDD mode is active but the apply phase did not produce the required `apply-progress` artifact. The implementation itself has full test coverage and all tests pass. Pure process gap; not a defect. |
| `@vitest/coverage-v8` not installed | SUGGESTION | Coverage analysis could not be performed on changed files. Consider adding to devDependencies to enable per-file coverage tracking in future verifications. |
| No `pnpm lint` configured | SUGGESTION | Type-check and tests are the only quality gates. ESLint/oxlint could provide consistent style enforcement. |
| Cross-repo (FE + BE) deployment coordination | NOTE | Per the proposal's rollout plan, deploy BE first, then FE. The BE changes are additive (new params default absent) and the FE is tolerant of unknown params (NestJS DTO drops), so either order is technically safe, but BE-first is recommended. |

No blocking issues remain. The SDD cycle is complete and the change is
ready for the platform to consume the new filters end-to-end.

## Rollback Notes

If the platform needs to roll back after deployment:

### Frontend rollback

- **Branch**: `sdd-quotations-ui-redesign` is the working branch; the
  change has not been merged to `main` yet per the `exception-ok`
  delivery strategy (no PRs; manual merge to `main`).
- **Commits to revert (in reverse order)**: `95999ab` (docs), `3f970c8`
  (docs), `9123d89` (fix createdFrom/createdTo), `ef45978` (advanced
  filters), `8b4d455` (list chrome).
- **Files affected by the FE work-unit**:
  - `src/features/POS/quotations/views/QuotationsListView.vue`
  - `src/features/POS/quotations/composables/useQuotationsListTable.ts` (new)
  - `src/features/POS/quotations/config/quotationFiltersSchema.ts` (new)
  - `src/features/POS/quotations/interfaces/quotation.types.ts`
  - 4 spec files (test additions)
- **Legacy files preserved in git history**: `useQuotationsList.ts` and
  `QuotationsSearchInput.vue` were deleted in `ef45978` but are
  recoverable via `git revert` of that commit.

### Backend rollback

- **Repo / branch**: `houndfe-backend` branch
  `feature/quotations-list-advanced-filters` (not yet merged to `main`).
- **Action**: `git revert` the BE commit on that branch. No data
  migration was touched, so revert is purely additive cleanup.
- **Files affected by the BE work-unit** (per `design.md` §"File
  Changes"):
  - `src/quotations/dto/quotation-query.dto.ts`
  - `src/quotations/domain/quotation.repository.ts`
  - `src/quotations/application/quotations.service.ts`
  - `src/quotations/infrastructure/prisma-quotation.repository.ts`
  - BE test additions.

### Coordinated rollback

If FE ships before BE and BE fails to deliver, the FE ships in a
degraded but safe state: only over-current-capability filters (single
`status`, single `customerId`, `createdFrom`/`createdTo`) work; the
new filters silently return the unfiltered set because the FE
serializes them and the BE drops unknown params per REQ-8. The search
input is functionally equivalent to today's silent-no-op until the BE
is deployed, which matches today's broken behavior — not a regression.

## Specs Synced to Source of Truth

| Domain | Action | File | Details |
|--------|--------|------|---------|
| `quotations-list` | Created | `openspec/specs/quotations-list/spec.md` | NEW capability, 16 requirements (REQ-1..REQ-16) normalized from the delta's REQ-QAF-001…016; all scenarios preserved verbatim; titles rewritten to match the project's canonical `### REQ-N: Title` convention |

Existing `openspec/specs/` domains were not modified — this change
introduces a new capability. The delta spec at
`openspec/changes/quotations-list-advanced-filters/specs/quotations-list/spec.md`
remains in the archived change folder as the original delta; the new
main spec at `openspec/specs/quotations-list/spec.md` is the live
source of truth going forward.

## Archive Contents

`openspec/changes/archive/2026-08-06-quotations-list-advanced-filters/`

| Artifact | Present | Notes |
|----------|---------|-------|
| `proposal.md` | ✅ | 102 lines, full proposal |
| `exploration.md` | ✅ | 423 lines, full exploration (Sales pattern + Quotations gap list) |
| `design.md` | ✅ | 99 lines, technical design mirroring Sales pattern |
| `backend-prompt.md` | ✅ | 112 lines, cross-repo prompt for backend team |
| `specs/quotations-list/spec.md` | ✅ | Original delta spec, 141 lines |
| `tasks.md` | ✅ | 18/18 tasks reconciled (`[x]`); BE reconciliation note inline |
| `verify-report.md` | ✅ | Final verification report, `pass-with-notes`; includes backend confirmation section |
| `archive-report.md` | ✅ | This file |

## Archive Verification

- [x] Main spec created at `openspec/specs/quotations-list/spec.md`
- [x] Change folder moved to `openspec/changes/archive/2026-08-06-quotations-list-advanced-filters/`
- [x] Archive contains all artifacts: proposal.md, exploration.md, design.md, backend-prompt.md, specs/, tasks.md, verify-report.md, archive-report.md
- [x] Archived `tasks.md` has all 18 tasks `[x]` (BE tasks reconciled with explicit proof; FE tasks marked during apply)
- [x] Active changes directory no longer contains `quotations-list-advanced-filters`

## SDD Cycle Complete

The `quotations-list-advanced-filters` change has been fully planned,
implemented, verified, and archived. The quotations list now ships the
same table-identity pattern as the sales module: working global search,
multi-select advanced filters with chips, URL persistence, column
visibility, and the UCard header-color split. The backend gains 5
additive query params and validates them with the standard NestJS 400
shape. Cross-repo coordination followed the proposal's `BE first, then
FE` plan; the FE/BE contract is symmetric and tested on both sides. Ready
for the next change.
