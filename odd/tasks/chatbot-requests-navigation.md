# Chatbot — Requests navigation

## Goal

Owner requests a dedicated Chatbot sidebar section with a shorter name for the Human Decisions inbox. Use Spanish `Chatbot → Solicitudes`, including command-palette/breadcrumb labels and the existing list-card heading.

## Decision and scope

Retain `/pos/decisiones-pendientes` and route name `pos-human-decisions` for existing links. Registry groups drive sidebar, palette and breadcrumbs independently of URL segments; changing the URL is not necessary for this request. No empty speculative child entries, new permissions, router rewrites or feature-folder move.

Move the existing registry child out of POS into a Chatbot group after POS. Keep `read:HumanDecision`; update-only users remain denied, and groups without accessible children remain hidden. Keep current UCard/Table-Tarjetas presentation and the approved slideover. Recent responses are a separate API-dependent integration.

## Tasks and routing

- [x] **CN-01 — Map navigation consumers and permission contracts.** Read-only Explore `muhzn87o-j-j8j9` confirmed registry-derived sidebar/palette/breadcrumbs, current route compatibility, and first-accessible-child landing semantics. Its final recommendation to wait for the backend is obsolete: owner explicitly removed global cross-project writer serialization.
- [x] **CN-02 — Move the registry entry and shorten labels with regression coverage.** Writer `muhzrmbm-k-625x` completed the registry/label/test slice. RED: five navigation/breadcrumb failures and one heading failure. GREEN: 61 navigation/breadcrumb/router tests and 11 panel tests; type check and exact lint/format passed.
- [x] **CN-03 — Verify, independently review and build.** Native assessment was unassessable due untracked scope; verifier `muhzzv9u-l-ucb7` independently reran 61 + 11 tests and diff check: scoped PASS. Verifier `mui024on-n-yz4l` then ran exact `pnpm build` once: exit 0, type check and Vite successful (4,066 modules, 16.53s). Existing chunk-size warning only. Git status and both generated declaration hashes were unchanged by this build. No user server was touched.

## Planned edit surfaces

- `src/app/navigation/navigation.registry.ts`
- `src/features/POS/human-decisions/components/HumanDecisionsListPanel.vue` (heading only)
- `src/app/navigation/__tests__/navigation.humanDecisions.spec.ts`
- `src/app/composables/__tests__/useBreadcrumb.spec.ts`
- `src/features/POS/human-decisions/components/__tests__/HumanDecisionsListPanel.spec.ts`
- `e2e/responsive/specs/human-decisions-live-http.spec.ts` (heading expectation only)
- This task document.

Preserve other uncommitted presentation/configuration work, generated declarations, private local config and user-owned servers. No backend, DB, fixtures, authentication, provider, dependency installation or commits. No actual Playwright invocation against the user's port 4173.

## Delivery and evidence

Forecast under 200 authored changed lines; one coherent slice, ask-on-risk for scope growth. Parent owns independent frontend workflow; intercom only for actual API dependencies. Rollback only this navigation/label patch, never unrelated changes. Updated production artifacts were built; the owner can reload their existing preview. Browser appearance, login and live E2E were not independently exercised for this slice; no native receipt or closure claimed.

### CN-02 implementation evidence

- Moved the existing inbox leaf into `Chatbot → Solicitudes` immediately after POS, using `i-lucide-bot`. Kept its ID, URL, inbox icon and `read:HumanDecision` permission; no router or landing-function changes.
- Panel delta against the pre-existing UI patch is only the `TableHeaderDescription` title. Panel test and live HTTP E2E deltas are only their heading expectations; card, view toggle, mobile behavior and existing URLs remain intact.
- RED: two focused test invocations observed five navigation/breadcrumb failures (56 passed) and one heading failure (10 passed) before implementation.
- GREEN: the same navigation/breadcrumb/router command passed 61 tests; panel command passed 11 tests. A further navigation run passed 61 tests after adding the read-only landing assertion and formatting.
- `pnpm exec vue-tsc --build` and scoped ESLint passed. Initial scoped Prettier check found only the changed navigation test; formatted that file only. Final formatting/lint checks are recorded in the writer handoff.
- Coverage includes a single Chatbot child, absence from POS, palette/breadcrumb labels, granted/denied/update-only visibility, unchanged route contracts and read-only landing URL.
- No production build, browser, Playwright, live API, backend, dependency mutation, commit or native approval performed. Rollback boundary is this registry/heading/test patch only, not the pre-existing presentation or generated-declaration changes. Parent retains checkbox ownership.
