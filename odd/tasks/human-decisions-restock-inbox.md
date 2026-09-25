# Human decisions RESTOCK inbox

## Goal

Implement the approved RESTOCK human-decision contract in the frontend as a permission-gated POS inbox. Reviewers must be able to page through pending decisions, inspect a sanitized typed snapshot, and record exactly one server-authoritative RESTOCK response without implying stock mutation or customer delivery.

## Authority and boundaries

- The user authorized local frontend implementation on an isolated feature branch/worktree, starting with HD1.
- Branch: `feat/human-decisions-restock-inbox`.
- Worktree: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-human-decisions-restock`.
- Approved contract: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-chatbot-human-decisions/docs/human-decisions-contract-v1.md`.
- Do not modify backend or chatbot repositories.
- No push, pull request, deployment, live-service calls, branch deletion, merge, reset, clean, rebase, force operation, provider call, or database operation is authorized.
- Preserve the principal worktree and its protected untracked OpenSpec artifacts.
- Technical artifacts remain English; user-facing UI copy remains Spanish.
- Any contract objection or required contract change must be raised before implementation continues.
- Each implementation unit is capped at 390 authored diff lines, including tests and documentation. Target 320–340 lines to preserve review margin.

## Contract invariants

- Human decision type is exactly `RESTOCK`; status is exactly `PENDING | RESOLVED`.
- PENDING has `resolution: null`, version 1, and only the exact allowed action codes authorized by the backend. RESOLVED has a typed non-null resolution, version 2, and no allowed actions.
- `PROVIDE_RESTOCK_ESTIMATE` requires an integer `restockDays` from 1 through 365 natural days.
- `REPORT_RESTOCK_ESTIMATE_UNAVAILABLE` forbids `restockDays` and means only that no ETA is currently available.
- Every logical resolve attempt uses one UUID `resolutionRequestId`; transport retries reuse it. `expectedVersion` is server-authoritative.
- Resolve success and exact replay return the same full detail projection with HTTP 200. A 409 triggers detail/list refetch and a read-only already-handled state.
- Frontend never computes an ETA date, mutates stock/sales, renders arbitrary HTML/JSON, derives permissions from action codes, or claims the customer was notified.
- Success copy is exactly honest about local responsibility: `Respuesta registrada`.
- Backend channel outcomes and one-hour application freshness are outside the frontend v1 projection.
- List pagination uses a one-based request page, zero-based response `pageIndex`, default 20, and allowed page sizes 20/50.
- Route/list/detail require `read:HumanDecision`; resolve additionally requires `update:HumanDecision`. Register `HumanDecision` in both subject registries and pin that invariant with tests.

## Allowed implementation surfaces

- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/authorization/**`
- `src/features/admin/roles/i18n/permissions.ts`
- future RESTOCK inbox files under `src/features/POS/human-decisions/**`
- `src/core/shared/constants/query-keys.ts`
- `src/app/router/**`
- `src/app/navigation/**`
- directly related responsive E2E files under `e2e/responsive/**`
- `odd/tasks/human-decisions-restock-inbox.md`

Any file outside these surfaces requires reassessment before writing.

## Tasks

- [x] **HD1 — Register HumanDecision permissions and pin the subject registry.** Added the exact subject to the compile-time and runtime authorization registries, exposed generic Spanish read/update-only role copy, preserved unknown/malformed subject rejection, and pinned the lock-step invariant with focused tests. **Verified:** 2 focused files / 158 tests, type-check, exact-file ESLint, and `git diff --check` passed; an independent verifier returned PASS after tooling-generated `auto-imports.d.ts` drift was restored. Exact-file Prettier still reports inherited HEAD drift in the two roles i18n files, with no warning intersecting HD1 lines. Native review was unavailable with `package-local-binary-missing`. **Commit:** `8078ea4` (`feat(auth): register human decision permissions`).
- [x] **HD2A — Add typed RESTOCK read transport.** Added discriminated PENDING/RESOLVED projections, required nullable snapshot fields with a both-or-neither stock-observation pair, exact action/error/list parameter and resolve-payload types, and list/detail-only API adapters. Bot-only fields and resolve transport remain absent. **Verified:** focused API contract 1 file / 3 tests, type-check, exact-file Prettier/ESLint, `git diff --check`, LSP diagnostics, and independent verifier PASS. Tooling-generated `auto-imports.d.ts` drift was restored. Native review was unavailable with `package-local-binary-missing`. **Commit:** `fb7a940` (`feat(human-decisions): add RESTOCK read transport`).
- [x] **HD2B — Add tenant-scoped RESTOCK read state.** Added typed all/list-prefix/list/detail query keys, a fixed-PENDING server-table adapter with one-based requests and 20/50 limits, and lazy tenant-scoped detail state that stays idle without an id. **Verified:** focused query 1 file / 6 tests, type-check, exact-file Prettier/ESLint, `git diff --check`, LSP diagnostics, and independent verifier PASS. Tooling-generated `auto-imports.d.ts` drift was restored. Native review was unavailable with `package-local-binary-missing`. **Commit:** `71a4c11` (`feat(human-decisions): add RESTOCK read queries`).
- [x] **HD3A — Add the permission-gated POS inbox shell.** Added the exact `/pos/decisiones-pendientes` lazy route, POS navigation entry after Ventas, semantic full-width shell copy, and strict `read:HumanDecision` gating; update-only and unrelated grants remain denied. **Verified:** focused router/navigation 2 files / 12 tests, type-check, exact-file Prettier/ESLint, `git diff --check`, and independent verifier PASS. Generated declaration drift was restored; the classic TypeScript LSP's Vue SFC import report was marked false-positive after `vue-tsc` and lazy-loader tests passed. Native review was unavailable with `package-local-binary-missing`. **Commit:** `e0e4480` (`feat(human-decisions): add inbox route shell`).
- [ ] **HD3B1 — Add typed pending-decision presenters.** Add compact desktop columns and a mobile decision card with safe plain-text title/summary, product/branch context, requested quantity, created time, and an accessible open-detail action; add focused presenter tests. No query/view wiring.
- [ ] **HD3B2 — Add the responsive pending list states.** Compose the server-paginated table and mobile cards into the routed view with loading/error/empty/refresh/search/pagination states and focused view tests. No resolve action.
- [ ] **HD3C — Add read-only decision detail.** Add a typed RESTOCK detail slideover that renders the sanitized snapshot and PENDING/RESOLVED status without resolve actions, bot receipt fields, raw JSON, or HTML; add focused accessibility/state tests.
- [ ] **HD4 — Add RESTOCK detail actions and resolve.** Add the resolve API/mutation to the existing slideover, explicit estimate/unavailable confirmation, integer 1..365 validation, UUID attempt identity, no optimistic success, permission/action intersection, honest success copy, and 409 refetch/read-only handling with focused tests.
- [ ] **HD5 — Verify the integrated responsive workflow.** Add bounded routed browser evidence for desktop/tablet/375/320 widths, permission behavior, list/detail/resolve, validation, 409 recovery, keyboard/focus, 44px targets, overflow, and honest copy. Run cumulative type/build/unit/responsive checks without live services.

SHIPPING_APPROVAL remains out of scope until RESTOCK passes the same complete verification gates and receives separate authorization.

## Verification contract

Minimum per-unit checks:

```sh
pnpm test:unit --run <focused specs>
pnpm type-check
pnpm exec prettier --check <changed supported files>
pnpm exec eslint <changed source files>
git diff --check
```

Run broader authorization/POS suites when the touched surface requires them. HD5 additionally requires the production build, responsive type-check, and focused routed Playwright at all approved widths. Report inherited failures separately; never suppress or relabel them as passing.

## Evidence

- Branch point: `bed98c03bbcad0468e8c3cd2cb2bcc55c247f447` (`main`).
- The principal worktree remained untouched; implementation is isolated in the registered sibling worktree.
- Contract received final frontend approval before implementation authorization.
- HD1 TDD RED produced 11 focused failures and compile-time `HumanDecision` union errors before implementation; GREEN passed 2 files / 158 tests.
- HD1 authored diff was 187 additions across five authorized files, below the 390-line unit cap. Backend independently confirmed the exact `HumanDecision`, `read:HumanDecision`, and `update:HumanDecision` names and the Manager read+update / Cashier read-only policy.
- HD1 independent verification passed focused tests, type-check, exact-file ESLint, and diff-check. The two exact-file Prettier warnings are inherited from HEAD. Native assessment/review were unavailable because the verified package-local binary is missing.
- Before HD2 source writes, the transport/read-state forecast exceeded one 390-line review unit. HD2 was split into independently compiling HD2A transport and HD2B query-state units; resolve transport moved to HD4 where its error/invalidation behavior is implemented and tested end to end.
- HD2A TDD RED produced nine missing-module/type errors before implementation. GREEN passed 1 focused file / 3 tests; the complete unit was 299 additions across three new files, below the 390-line cap. Type-check, exact-file Prettier/ESLint, diff-check, LSP diagnostics, and independent verification passed.
- HD2B TDD RED failed only on the missing query-key export and composables. GREEN passed 1 focused file / 6 tests; the complete unit was 307 additions across four authorized files. Type-check, exact-file Prettier/ESLint, diff-check, LSP diagnostics, and independent verification passed.
- Before HD3 source writes, the authorized offline UI was split into route/shell, responsive list, and read-only detail units so each can stay below 390 authored diff lines. Routed 1024/375/320 browser evidence remains a separate HD5 slice; HD4 adds actions to the already verified detail surface.
- HD3A focused GREEN passed 2 files / 12 tests. The complete unit was 264 additions across five authorized files; type-check, exact-file Prettier/ESLint, diff-check, and independent verification passed.
- The HD3B responsive-list forecast exceeded one review unit after route delivery, so presentational table/card code and routed list-state composition were split into HD3B1/HD3B2 before source writes.
