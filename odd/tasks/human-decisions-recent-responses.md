# Chatbot requests — recent responses

## Authorization and goal

Owner approved showing pending requests and a visibly separate read-only list of responses from the last seven days, measured from `resolvedAt`. This is visibility, not database deletion or customer-delivery evidence. Frontend owns its implementation independently; backend contract availability was the only dependency.

Backend handoff is green in source: native review `review-6d21f8328ea8e88a`, 371 DB-free tests and build type check passed. SQL integration and the normal running endpoint were not exercised by that handoff. Do not imply otherwise.

## Contract

- Existing `GET /human-decisions` requires `status=PENDING|RESOLVED`.
- RESOLVED: page starts at 1; limit 20/50; optional existing normalized search. Fixed `sortBy=resolvedAt&sortOrder=desc` (or both omitted); server adds id ascending.
- Server alone selects inclusive `[now - 604800000ms, now]` using one clock. No caller dates/window, no frontend expiry/filter calculation.
- Existing `{ data, pagination: { pageIndex, pageSize, totalCount, pageCount } }` envelope.
- Existing resolved row type: resolution action, ISO resolvedAt, resolvedBy `{ id, displayName }`; restockDays only for a positive estimate. Empty allowedActions. Existing detail remains readable beyond the window.
- PENDING behavior and existing mutation/CAS/idempotency semantics remain unchanged.

## Implementation units and component map

- [x] **FR-01 — Transport and independent resolved query.** Added narrow resolved transport/query and nested cache prefix; tests prove fixed parameters, normalization, tenant/page isolation, both-list invalidation and no optimistic insertion. Pending and mutation implementation unchanged.
- [x] **FR-02 — Read-only response cards and columns.** Actual response, reviewer and resolvedAt appear in both modes. Only detail opening; no resolution controls or delivery claim.
- [x] **FR-03 — Standard resolved list panel.** Existing card/table pattern, independent preference and full loading/error/empty/search/refresh/pagination contracts preserved.
- [x] **FR-04 — Compose both sections and update mocked contracts.** Same route/nav, separate Pendientes/Respondidas recientemente, independent controls, and unchanged slideover. Recent selection stays read-only even with stale PENDING detail; emitted resolve is also guarded. Strict mocked requests/counts updated, not browser-executed.
- [x] **FR-05 — Verify, review and build.** Independent feature tests 89/89, responsive type check and source review passed. Narrow search-copy correction verified (3/3 panel tests, lint/format); exact normal `pnpm build` passed once afterward. No user-server takeover or real backend/browser mutation.

One bounded frontend writer implements the units sequentially with test-first evidence, then an independent reviewer. Target each coherent unit around 200–390 authored changed lines; do not sacrifice coverage or minify to fit. Aggregate estimate 700–1000 lines including tests; no commit or PR is authorized, and any future delivery slicing is a separate decision.

## Boundaries

Preserve the approved slideover, current Chatbot/Solicitudes navigation, pending UCard/Tabla-Tarjetas work, literal pnpm fix, user-generated declarations, private environment settings and user-owned servers. No backend edits, database queries/migrations/fixtures, runtime credentials, outbound providers, dependency installs or commits. No synthetic resolved row injected into production state.

Do not run the current responsive Playwright configuration against port 4173: it would contend with the user's preview. Unit mocks and responsive type checks are authorized. Browser visual checks may remain explicitly unverified; normal build is not a login or backend proof.

The server window is authoritative on fetch/refresh/invalidation, not continuous wall-clock removal while the browser stays idle. Preserve row storage and do not add polling or date-selection controls.

## Evidence

Read-only mapping `mui00f5q-m-61rg` identified existing resolved types and nested-key invalidation reuse. Writer `mui0ai0d-o-f1oo` implemented FR-01–04 after navigation build closure. Native assessment was unassessable because of untracked scope, so independent verification was required; no frontend native receipt or closure is claimed.

Independent verifier `mui0ykk3-p-dbbb` passed 89/89 tests, responsive type check and diff check. Its sole remaining contract question was closed by reading the exact backend resolved-search predicate: productName only. The parent changed only the new panel placeholder to `Buscar por producto...`. Follow-up `mui1368s-q-tdik` independently confirmed that match and passed 3/3 panel tests, single-file ESLint/Prettier, exact `pnpm build` once and diff check. The only build notice was the existing >500 kB chunk warning (main index 889.28 kB).

Updated `dist/` is ready for the owner's existing preview to reload. Git status and both generated declaration hashes were unchanged by the final build. No preview process was touched. Browser appearance, live Playwright, SQL and normal backend runtime remain unverified for this slice; no data was deleted or delivered to a customer.

### Writer closure checks (parent owns FR-05 and all checkboxes)

- `pnpm exec vitest run src/features/POS/human-decisions` — 15 files / 89 tests passed after heading triangulation.
- `pnpm exec vue-tsc --build` — passed, no output.
- `pnpm run type-check:responsive` — passed.
- `pnpm exec eslint` with the explicit 18 changed TypeScript/Vue paths — passed, no warnings.
- Prettier was applied only to allowlisted changed files. Final formatting and whitespace checks are reported in the writer handoff.
- No production build, server, browser/Playwright, SQL integration, backend runtime, native review or customer-delivery verification was attempted. Parent owns independent verification and the one final normal build.
- Implementation stays split by transport/cache, response presentation, panel and view/mock composition; no mutation/slideover source, navigation, backend or environment edits. Existing dirty files and declarations were not restored.

### FR-04 writer evidence

- RED: `pnpm exec vitest run src/features/POS/human-decisions/views/__tests__/HumanDecisionsView.spec.ts` — 3 failed/1 passed: missing recent panel and page context.
- GREEN: `pnpm exec vitest run src/features/POS/human-decisions/views/__tests__/HumanDecisionsView.spec.ts src/features/POS/human-decisions/components/__tests__/HumanDecisionsListPanel.spec.ts` — 15 passed before heading triangulation. View tests prove stale PENDING detail cannot authorize a recent selection or emitted resolve event; reopening pending restores existing permissions. Separate pagination/search/refresh are verified.
- Heading triangulation RED: both panel specs produced 3 failures because shared TableHeaderDescription hardcodes h1. Production sections now use h2 under the page h1; default pending/offline heading stays unchanged. No shared header change outside scope.
- Strict HTTP spec now declares exact RESOLVED GET sequences and counts, including post-resolution/conflict refresh. Existing external-request fence needed no change; no real Playwright/server run was performed.

### FR-03 writer evidence

- RED: `pnpm exec vitest run src/features/POS/human-decisions/components/__tests__/ResolvedHumanDecisionsListPanel.spec.ts` failed on missing panel import.
- GREEN: same command — 3 passed. Covered mobile/desktop defaults, mode persistence isolated from pending preference, controlled pagination/search, refresh/open events, state/empty forwarding and table response/reviewer accessors.
- Corrected a test assumption: clicking an already-selected view tab does not write a preference; exercise an actual mode transition before asserting persistence.

### FR-02 writer evidence

- RED: focused column/card specs each failed on their not-yet-created module import.
- GREEN: `pnpm exec vitest run src/features/POS/human-decisions/components/__tests__/ResolvedHumanDecisionCard.spec.ts src/features/POS/human-decisions/composables/__tests__/useResolvedHumanDecisionColumns.spec.ts` — 5 passed, positive/negative copy and response provenance covered; cards emit only detail opening.
- Date, branch and SKU formatters reused. Approved response wording is shared between new cards/columns; the existing slideover formatter is private to its SFC, so its exact wording is retained without modifying that protected file.

### FR-01 writer evidence

- RED: `pnpm exec vitest run src/features/POS/human-decisions/api/__tests__/human-decision.api.test.ts` failed on missing `listResolved` (5 passed/1 failed). Resolved query spec initially failed on its missing composable import.
- GREEN: `pnpm exec vitest run src/features/POS/human-decisions/api/__tests__/human-decision.api.test.ts src/features/POS/human-decisions/composables/__tests__/resolved-human-decision.queries.test.ts src/features/POS/human-decisions/composables/__tests__/useResolveHumanDecision.test.ts` — 18 tests passed.
- Live QueryClient observers prove success and both stale-state conflicts refresh pending/recent lists, leave another tenant untouched, and never optimistically insert a response. Mutation implementation unchanged. Mapper/query coverage includes fixed order, normalization, pagination, independent pending state and tenant cache slots.
- Test correction: preserving old tenant cache for an isolation assertion requires nonzero GC retention; changed that test's gcTime from zero to Infinity and explicitly cleared its client.
