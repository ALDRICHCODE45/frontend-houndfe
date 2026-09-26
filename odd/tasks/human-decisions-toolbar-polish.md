# Requests toolbar control consistency

## Owner request and evidence

Owner supplied `Screenshot_2026-09-26-02-33-03_5360x2520.png` and requested two corrections: Estado must use the system's select component, and Tabla/Tarjetas must not leave excess empty width after Tarjetas.

Parent inspected the screenshot and both source components: HumanDecisionsListPanel renders a native select; shared ViewToggle has a full-width root with content-width buttons. Fix this toolbar locally, not the shared toggle's behavior throughout the application.

## Scope and tasks

- [x] **TP-01 — Match existing select and toolbar conventions.** Mapper `mui4z6q3-y-silp` confirmed SalesListView uses USelect with label/value items and scalar model updates. Installed Select.vue supports explicit id/aria label and portaled options. Wrap this ViewToggle instance in `w-max max-w-full flex-none`; desktop actions are flex, mobile actions already wrap. Only panel, panel unit tests and offline E2E select selectors need changes; shared controls and live HTTP spec stay unchanged.
- [x] **TP-02 — Correct the two controls with regression coverage.** Writer `mui54ym5-z-75r9` replaced the native select with controlled USelect and locally contained this toggle's width. Values/events, responsive wrapping, 44px targets, label and mode preferences preserved. Three RED failures became 15 passing panel tests; full feature suite passed 100 tests.
- [x] **TP-03 — Verify and build.** Independent verifier `mui5bykk-10-coxo` returned scoped PASS: installed select contract/source checks, 21 panel/demo tests, responsive types and pre/post-build diff checks passed. Exact `pnpm build` passed once, including app types; updated artifacts are ready for the existing preview.

Forecast below 250 authored changed lines including tests; no commits or PR requested. Delivery strategy ask-on-risk only if delivery is later requested. Keep the existing Vue Composition API, Nuxt UI tokens and Spanish UI.

## Boundaries

No changes to shared ViewToggle, AppDataTable, other pages, API/query/cache/mutations, backend, slideover, permissions or routes. Do not introduce a new select, design system or generic sizing API. Use existing project components. Avoid relying on the order of conflicting Tailwind width classes; contain width locally instead.

Preserve prior uncommitted implementation, generated declarations, private environment settings and user-owned processes. No install, DB/fixtures/provider/runtime requests, commits or broad cleanup. No Playwright against the user's port 4173; screenshots establish the reported issue, not post-change browser verification. Final visual acceptance remains manual unless a safe browser check is separately authorized.

## Evidence

The unified inbox baseline passed 102 shared/feature tests and its final normal build. This follow-up is presentation-only; backend contract and captured-query cache fix are unchanged.

### Independent closure

Native assessment was unassessable because of untracked scope; independent verification was required, with no native approval claimed. Verifier confirmed controlled scalar USelect updates, invalid-value rejection, label/ARIA association and local intrinsic containment without competing width classes. Its 21 tests across panel/demo suites and responsive type check passed. Exact normal build ran once: 4,068 modules, 15.64s; existing >500 kB warning (main JS 889.28 kB) only. `dist/` rebuilt; Git status and both generated declaration hashes were unchanged. No preview process was touched.

Browser geometry and long-label appearance remain unverified. Owner can reload the existing preview for manual visual acceptance; no browser, backend runtime or native-review proof is inferred from the build.

### Bounded writer evidence

- Replaced only this toolbar's native Estado control with typed USelect items and controlled scalar updates. Invalid/null values do not emit. Kept explicit label/id, Spanish labels and the 44px minimum-height contract.
- Wrapped only this ViewToggle in `w-max max-w-full flex-none`; shared controls, saved/manual mode fallback and query/cache/read-only logic are unchanged.
- RED: focused `HumanDecisionsListPanel.spec.ts` run observed 3 intended failures (missing USelect contract and local wrapper), with 12 passing tests.
- GREEN: the same focused Vitest command passed all 15 tests. Coverage includes all three valid values, invalid payload rejection, controlled parent updates, accessible label and local wrapper/target classes. JSDOM class checks do not establish computed geometry.
- `pnpm exec vitest run src/features/POS/human-decisions`: 13 files, 100 tests passed.
- `pnpm exec vue-tsc --build` and `pnpm run type-check:responsive`: passed.
- Exact three-file ESLint: passed. Initial four-file Prettier check flagged only the offline E2E spec; formatted that allowlisted file. Final exact-file ESLint, four-file Prettier check and `git diff --check` all passed.
- Offline E2E selectors now use the system combobox and portaled options. Added scoped compact-tablist geometry and 44px toolbar targets, retaining 320/375/1024 overflow checks and checking the long selected status too.
- Playwright, browser geometry, screenshots and visual states were **not verified**: no browser/server was started and the owner's preview on 4173 was not touched. Production build and independent review remain parent-owned. No commits or native approval.
- Pre-existing unrelated modifications and generated declarations were preserved; no manual generated-file restore or edit was performed. Checkboxes remain parent-owned.
