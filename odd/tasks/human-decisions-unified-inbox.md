# Unified chatbot requests inbox

## Authorization and outcome

Owner reviewed the two-table interface and explicitly authorized coordination with backend to replace it with one table. Accepted design: one Solicitudes card/table, Estado badges Pendiente/Respondida, Todas (default) / Pendientes / Respondidas recientemente filter, pending first and recent responses after them. Preserve Table/Cards, response provenance, existing URL/navigation, read permissions and approved detail slideover. Resolved rows remain read-only and visible for seven days from resolvedAt; this is not deletion or customer-delivery evidence.

Each parent owns its own repository. Backend implements its contract independently; no global writer serialization. Frontend may implement against the agreed wire contract while backend checks run, but joint readiness requires its completion handoff. No real DB/fixtures/provider/server lifecycle changes or commits are authorized.

## Confirmed wire contract

Backend parent confirmed via intercom 42970d1e-d7b1-46d7-88d3-e3f5b32479a3:

- `GET /human-decisions?status=ALL&page=1&limit=20`, optional productName-only search. Existing 20/50 sizes.
- ALL MUST omit both sortBy and sortOrder; any explicit sort with ALL returns 400.
- Fixed composite order: PENDING by createdAt ASC, id ASC; then RESOLVED by resolvedAt DESC, id ASC.
- A single total, offset and page from the entire selected dataset. Never concatenate independently paginated requests in frontend.
- Resolved membership is inclusive `[now - 604800000ms, now]`, excluding future dates; pending has no seven-day cutoff. Server owns the clock/window.
- Status on each row remains PENDING or RESOLVED; audit fields, allowedActions and pagination envelope unchanged.
- Existing PENDING and RESOLVED request contracts/sorting, permissions and omitted-status 400 remain unchanged.
- Backend source/check readiness arrived in handoff `28551c37-962c-46c4-b373-48c10e8ec0bb`, with no wire-contract change. Backend reports global count/offset slices in one RepeatableRead transaction and one clock; 422/422 DB-free tests, production type check and nine-file lint/format/diff passed. Native backend review `review-1bcdc4f6b803a007` approved and acknowledged closed. SQL integration, actual PostgreSQL isolation and normal endpoint runtime were not exercised.

## Tasks and routing

- [x] **UI-01 — Agree contract and map the refactor.** Backend owns mixed pagination. Read-only mapper `mui2k1m3-r-e2l2` confirmed reusable list/inbox chain and exact affected consumers. Its final contract blocker was superseded by the confirmed handoff above. Mapping delegation required by 4+ files.
- [x] **UI-02 — Unify transport, query/filter state and cache contracts.** ALL defaults, state-scoped tenant keys, page resets and server-owned counts/order implemented and tested. Captured-key correction below closes inactive-cache contamination without mutation/CAS changes.
- [x] **UI-03 — Replace dual panels with one mixed table/cards view.** One Solicitudes panel with Estado filter/badges and compact response provenance; pending/resolved cards reused. Copied ID/status selection plus canonical-detail/permission guards protect both controls and resolve events across filter/page changes.
- [x] **UI-04 — Migrate demo/tests and remove obsolete dedicated-list code.** Synthetic demo retains responses and supports local filtering without HTTP. Strict mocks and useful coverage migrated; parent removed exactly six obsolete files and writer removed obsolete exports. Resolved card/formatter retained, product-only search copy corrected.
- [x] **UI-05 — Verify, independently review and build.** Backend source/check handoff confirmed. Independent verifier passed 102 shared/feature tests, responsive types and diff checks, closed the cache blocker, then ran exact `pnpm build` once successfully. No browser/SQL/runtime acceptance inferred.

Forecast approximately 900–1500 authored changed lines including removal of superseded code/tests. The 400-line guidance is advisory per coherent unit, not permission to minify or drop tests. Delivery strategy: ask-on-risk for any later requested commits/PR; no commits, push or PR now.

## Boundaries and verification

Use Vue Composition API, existing Nuxt UI/tokens, Spanish UI and English technical artifacts. Preserve the owner-approved slideover and resolution mutation/attempt/permission logic, router/navigation, pnpm-workspace fix, shared serverTable infrastructure, generated declarations, private environment configuration and user-owned preview/backend processes. No install, broad clean/reset, unrelated formatting or cross-project source writes.

Test exact request shapes for ALL/PENDING/RESOLVED; filter resets page; independent tenant/filter/page/search keys; canonical invalidation; no client sorting/cutoff/merge; mixed-row selection including cached PENDING detail for a resolved row; filter change while detail remains open; response provenance; cards/table behavior; demo no-HTTP and strict mock CAS/retry/conflict contracts.

Run feature Vitest, app and responsive type checks, exact changed-file lint/format, diff check. Existing Playwright configuration owns port 4173 and MUST NOT run against the user's preview. Browser and normal endpoint acceptance remain separate unless specifically authorized with a safe execution plan.

## Required cache-binding correction

Independent review `mui3vm08-v-676y` passed the 96-test feature suite, responsive types and diff check, but found an uncovered blocker: shared useServerTable reads live parameters at query execution, and the feature callback reads live status. Canonical conflict refetch includes retained inactive keys, so old filter/page keys can receive the current request's response and remain incorrectly fresh for 30 seconds.

- [x] **UI-04A — Bind requests to the executing query key.** Three RED failures reproduced contamination; captured parameters and status corrected it. Regressions cover one composable's retained filter/page/search/size keys, both conflicts, cached payload identity and fresh-cache reuse. Independent review closed the blocker. Canonical refresh, inactive cache retention, one-argument callback compatibility and mutation/slideover source remain unchanged.

This necessary correction narrowly extends the earlier shared-source exclusion to `src/core/shared/composables/useServerTable.ts`, its existing `__tests__/useServerTable.test.ts`, and the ServerTableConfig callback type in `src/core/shared/types/table.types.ts` if required. Feature changes stay in its list composable and query/mutation tests. No shared UI redesign or other feature cleanup is authorized. Full shared-composable regressions and app/response type checks are required before independent re-review and the final build.

## Evidence

### Writer checkpoint — UI-02

- Revised UI-04 routing: writer migrates references and useful tests but never deletes, truncates, tombstones or renames obsolete files. Parent owns exact confirmed feature-owned obsolete-file deletion while writer is paused; writer then resumes closure checks. Parent retains checkbox ownership.
- RED: `pnpm exec vitest run src/features/POS/human-decisions/composables/__tests__/human-decision.queries.test.ts` — 5 failed / 6 passed, observing old PENDING/sorting behavior for ALL and RESOLVED plus absent unified filter behavior.
- Intermediate GREEN attempt: same command — 1 failed / 10 passed because the test harness used `gcTime: 0` while asserting retained inactive filter keys. Set explicit retention for that cache-isolation test; production cache policy unchanged.
- GREEN/triangulation: `pnpm exec vitest run src/features/POS/human-decisions/composables/__tests__/human-decision.queries.test.ts src/features/POS/human-decisions/api/__tests__/human-decision.api.test.ts src/features/POS/human-decisions/composables/__tests__/useResolveHumanDecision.test.ts` — 3 files / 28 tests passed. Exact ALL omission, fixed single-state params, page reset, mixed server ordering/counts, and canonical invalidation across all filters/tenant isolation covered. Mutation source unchanged.
- Closure checks deferred until obsolete-file cleanup. No backend runtime, browser, build or native approval claim.

### Writer checkpoint — UI-03 and UI-04 migration

- UI-03 RED: `pnpm exec vitest run src/features/POS/human-decisions/components/__tests__/HumanDecisionsListPanel.spec.ts src/features/POS/human-decisions/components/__tests__/HumanDecisionCard.spec.ts src/features/POS/human-decisions/components/__tests__/ResolvedHumanDecisionCard.spec.ts src/features/POS/human-decisions/views/__tests__/HumanDecisionsView.spec.ts` — 16 failed / 17 passed: missing Estado filter/badges/compact response and ID+status selection; resolved/unknown selection incorrectly permitted controls. The same command after implementation passed 4 files / 33 tests. Initial RED also emitted existing Nuxt button/router injection warnings; GREEN did not.
- UI-04 demo RED: `pnpm exec vitest run src/features/POS/human-decisions/views/__tests__/HumanDecisionsOfflineDemoView.spec.ts` — 5 failed / 1 passed (old string-only event and broad search). GREEN: same command passed 6 tests, including retained resolved rows, local status filtering, product-only normalized search, fixed time and no HTTP calls.
- UI-03 structure: the single list panel owns rendering, filter events and row ID/status events; existing pending/resolved cards render their discriminated rows. View retains a copied selection snapshot, checks matching detail ID, PENDING detail and existing update permission before either enabling controls or forwarding resolve. Filter/page changes never upgrade resolved/unknown selections. Protected slideover/inbox/mutation/attempt source unchanged.
- UI-04 strict E2E mocks now require one initial ALL request without sort and one refreshed mixed page, retaining UUID/body/retry/CAS/conflict checks. Offline E2E expectations retain answered rows. Playwright execution is explicitly unauthorized; no E2E RED/GREEN or browser result is claimed.
- Migrated resolved-query coverage includes Unicode normalization, unsupported-limit fallback, tenant/page/search separation and manual refresh; resolved-column wording tests now live with unified columns. Dedicated obsolete files remain intact for parent deletion.
- Focused regression command: `pnpm exec vitest run src/features/POS/human-decisions/composables/__tests__/human-decision.queries.test.ts src/features/POS/human-decisions/composables/__tests__/useHumanDecisionColumns.spec.ts src/features/POS/human-decisions/composables/__tests__/useHumanDecisionsInbox.test.ts src/features/POS/human-decisions/composables/__tests__/useResolveHumanDecision.test.ts src/features/POS/human-decisions/views/__tests__/HumanDecisionsOfflineDemoView.spec.ts src/features/POS/human-decisions/views/__tests__/HumanDecisionsView.spec.ts src/features/POS/human-decisions/components/__tests__/HumanDecisionsListPanel.spec.ts src/features/POS/human-decisions/components/__tests__/HumanDecisionCard.spec.ts src/features/POS/human-decisions/components/__tests__/ResolvedHumanDecisionCard.spec.ts src/features/POS/human-decisions/api/__tests__/human-decision.api.test.ts` — 10 files / 79 tests passed.

### Parent cleanup boundary

At this checkpoint the writer paused for parent-owned deletion of these six files (all inspected; later removed exactly as recorded under writer closure):

- `src/features/POS/human-decisions/composables/useResolvedHumanDecisionsListTable.ts` — no production caller; its only caller is its dedicated test. Unified list covers ALL/PENDING/RESOLVED.
- `src/features/POS/human-decisions/composables/__tests__/resolved-human-decision.queries.test.ts` — useful mapper/cache/refresh assertions migrated to `human-decision.queries.test.ts`; two-list independence is obsolete.
- `src/features/POS/human-decisions/components/ResolvedHumanDecisionsListPanel.vue` — no production caller; only its dedicated test imports it. Unified panel discriminates both existing cards.
- `src/features/POS/human-decisions/components/__tests__/ResolvedHumanDecisionsListPanel.spec.ts` — state/model/provenance/detail/persistence coverage migrated to unified panel and retained resolved-card tests; separate heading/storage behavior is obsolete.
- `src/features/POS/human-decisions/composables/useResolvedHumanDecisionColumns.ts` — only obsolete panel and dedicated test import it. Retained resolved card now imports the formatter from presentation utilities.
- `src/features/POS/human-decisions/composables/__tests__/useResolvedHumanDecisionColumns.spec.ts` — response-wording and non-sortable column coverage migrated to `useHumanDecisionColumns.spec.ts`; separate reviewer/time columns are intentionally replaced by one response cell.

CodeGraph reference inspection followed by scoped reference search across `src` and `e2e` found no retained consumer of these six files. Existing `listResolved`, `resolvedListPrefix`, `ResolvedHumanDecisionListParams` and `ResolvedHumanDecisionListResponse` remain only to avoid breaking those intact obsolete files before parent cleanup; no new compatibility shim was introduced. Writer will remove those existing exports and update the API list comment after parent cleanup, then run full-feature tests, app/responsive type checks, exact-path lint/format and diff checks. Retain `ResolvedHumanDecisionCard.vue`, its tests and the migrated formatter.

Prettier write was run only on the 22 writer-edited allowed paths (21 source/test paths plus this task); final checks remain deferred. Prior unrelated modified/untracked files remain preserved. No backend/runtime/browser/build/native acceptance or model-profile claim.

### Writer closure after parent cleanup

- Parent reported reading and independently reference-checking all six candidates, validating canonical worktree and regular non-symlink paths, and unlinking exactly those six files. Retained resolved card/tests/formatter preserved. Writer performed no file deletion.
- Removed the now-unused `listResolved`, `resolvedListPrefix`, `ResolvedHumanDecisionListParams` and `ResolvedHumanDecisionListResponse` exports and updated the unified API list comment. No additional behavioral change or compatibility shim.
- `pnpm exec vitest run src/features/POS/human-decisions` — 13 files / 96 tests passed.
- `pnpm exec vue-tsc --build` — passed (exit 0).
- `pnpm run type-check:responsive` — passed (exit 0).
- `pnpm exec eslint` with the exact 22 remaining writer-changed TS/Vue paths — passed (exit 0; no output).
- `pnpm exec prettier --check` with those exact 22 TS/Vue paths plus this task document — passed; all matched files use Prettier code style.
- `git diff --check` — passed. Working-tree inspection shows no new generated paths; pre-existing modified `auto-imports.d.ts` and `components.d.ts` remain preserved, with no reset or manual edits by writer.
- Parent retains checkbox ownership, independent review and final ordinary build. No Playwright/browser/server/real HTTP/backend/DB/build/native acceptance claimed.

### UI-04A correction evidence — captured query identity

- RED: `pnpm exec vitest run src/core/shared/composables/__tests__/useServerTable.test.ts src/features/POS/human-decisions/composables/__tests__/useResolveHumanDecision.test.ts` — 3 failed / 13 passed. The shared regression received pageIndex 2 / size 50 / food / descending name for every retained key, including the initial page. Both actual mutation conflict regressions received RESOLVED / page 4 / hay for all 12 retained inbox keys instead of their own requests.
- One actual list composable visits ALL, PENDING and RESOLVED with different searches, pages and sizes. Both supported refresh codes (`VERSION_CONFLICT`, `ALREADY_RESOLVED`) trigger the actual mutation. Tests inspect requests and every retained cache payload, including row status and pagination, then return to a fresh PENDING/search key without refetching that key. Existing idempotency-conflict and tenant-isolation tests remain intact.
- Shared useServerTable now reads parameters from the executing query's appended key segment. ServerTableConfig supplies a minimal typed second argument `{ queryKey: readonly unknown[] }`; ordinary one-argument callbacks remain assignable and are exercised with the real QueryClient. The feature validates and reads status from that same captured key, never falling back to live status. Mutation source, canonical refresh, retention, staleTime, server ordering/window and tenant key isolation are unchanged.
- Intermediate focused run after the fix: 2 failed / 14 passed solely because the synthetic row ID serialized equivalent objects with different property order. Fixed the fixture to serialize fields in a stable order. Focused GREEN: the same command passed 2 files / 16 tests.
- `pnpm exec vitest run src/core/shared/composables/__tests__ src/features/POS/human-decisions` — 14 files / 102 tests passed, including a final rerun after fixture correction and formatting.
- `pnpm exec vue-tsc --build` initially caught the new PENDING fixture inheriting resolved version 2. Corrected it to version 1; rerun passed (exit 0). `pnpm run type-check:responsive` passed.
- `pnpm exec eslint src/core/shared/composables/useServerTable.ts src/core/shared/composables/__tests__/useServerTable.test.ts src/core/shared/types/table.types.ts src/features/POS/human-decisions/composables/useHumanDecisionsListTable.ts src/features/POS/human-decisions/composables/__tests__/useResolveHumanDecision.test.ts` passed.
- Formatter writes were restricted to those five TypeScript files. `pnpm exec prettier --check src/core/shared/composables/useServerTable.ts src/core/shared/composables/__tests__/useServerTable.test.ts src/core/shared/types/table.types.ts src/features/POS/human-decisions/composables/useHumanDecisionsListTable.ts src/features/POS/human-decisions/composables/__tests__/useResolveHumanDecision.test.ts odd/tasks/human-decisions-unified-inbox.md` passed. `git diff --check` passed.
- Working-tree status contains no newly reported generated paths. Existing modified declarations remain modified; no manual declaration edits/restoration occurred. No commits, deletions, browser/E2E, production build, real HTTP, SQL, backend or native-review acceptance is claimed. Parent retains task-checkbox and independent-review ownership.

### Independent closure and final build

- Native frontend assessment remained unassessable because of untracked scope; independent verification was required. No native frontend approval or receipt is claimed.
- Verifier `mui4cpcs-x-zfg6` returned scoped PASS and closed the prior cache blocker. It independently ran the shared/feature suite: 102 tests / 14 files passed; responsive type check and pre/post-build diff checks passed.
- It then ran exact `pnpm build` once: successful app type check and production build, emitting updated `dist/`. The existing large-chunk warning remains (index 889.28 kB).
- Before/after Git status matched and both declaration hashes were unchanged. No manual source/doc edits or preview-server interaction by verifier; existing owner modifications preserved.
- Owner can reload the existing preview for the unified interface. Backend runtime, SQL and browser/E2E remain unverified; no data deletion, provider delivery, production deployment or commit was performed.

Previous two-panel implementation evidence remains available for comparison. Its tests/build evidence is in `human-decisions-recent-responses.md`. This document supersedes that presentation decision, not its read-only or seven-day constraints.
