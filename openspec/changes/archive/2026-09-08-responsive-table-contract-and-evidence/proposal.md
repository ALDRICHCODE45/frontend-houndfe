# Proposal: Responsive Table Contract and Evidence

## Why

The repository has a mature shared table path, but responsive behavior is governed by scattered conventions rather than one enforceable contract. The accepted audit identifies 27 logical repeated-record surfaces, including 15 `AppDataTable` consumers, 7 native tables, and 5 list/matrix hybrids (Exploration §2). At narrow widths, persisted explicit table mode can defeat card substitution (R1), local scrolling is not consistently discoverable (R2), action target sizes are often below or unproven against 44×44 CSS px (R3), and native tables bypass shared containment (R4). Current Vitest/jsdom coverage cannot prove rendered geometry (R8).

Batch A is therefore valuable as the shared contract and verification foundation before leaf migrations. It should make future responsive changes measurable without assuming that every table becomes cards or that layout can be validated through class assertions alone.

## What Changes

- Define a shared responsive-table policy for the four required viewport widths: **320, 375, 768, and 1024 CSS px**.
- Define the decision contract for table mode, card/list substitution, and persisted `displayMode` precedence, explicitly addressing R1 and the historical AppDataTable drift described in Exploration §7.
- Define invariant rules for:
  - document-level overflow versus permitted local table scrolling (R2);
  - primary identity, status/value, and primary actions;
  - 44×44 CSS px interactive targets, keyboard activation, focus order, and overlay focus restoration (R3/R7);
  - native table semantics and equivalent card/list semantics;
  - long unbroken values and dense badges (R6);
  - toolbar, filters, pagination, bulk actions, loading, fetching, empty, no-match, and error states (R5);
  - sticky headers and pinned columns at both local-scroll extremes;
  - shell, sidebar, card, modal/slideover, sticky-footer, and viewport-height constraints (R7).
- Define a repeatable browser evidence contract using **Playwright**, to be added and used in a later implementation phase; this proposal does not install it or run it.
- Define canonical stress data and evidence output expectations so future checks exercise long names, email, SKU/IDs, account numbers, CLABE, currency, dates, status chips, and multi-badge rows.
- Clarify the boundary between jsdom tests and browser evidence: jsdom may verify props, classes, emitted events, state transitions, semantics represented in rendered markup, and accessibility labels; it must not be presented as proof of scroll width, clipping, sticky alignment, computed target size, or viewport geometry.
- Preserve feature columns, API sort identifiers, stored preferences, and existing behavior while contracts are established; leaf remediation remains separate.

## Out of Scope

- Migrating or remediating any leaf surface, including DT-01–DT-15, NT-01–NT-07, or HY-01–HY-05.
- Feature-column changes, universal column hiding, or a decision that all tables must become cards.
- Changes to AppDataTable, toolbars, pagination, bulk actions, card grids, native tables, overlays, or shell source code in this change beyond future-contract documentation/harness planning.
- API, DTO, query, cache, routing, navigation, CASL, backend, or data-model changes.
- Fixing the unrelated bulk-action callback issue where the callback currently receives `[]` (Exploration §4 and §9).
- Installing Playwright or any dependency, running tests/builds/dev servers, capturing runtime screenshots, or performing runtime measurements during this planning phase.
- Creating capability specs, design, or task artifacts as part of this proposal phase, or applying implementation changes now. Those artifacts remain authorized as later phases of the already-approved Batch A planning pipeline, subject to their phase gates and fresh apply authorization before any implementation.

## Capabilities (New/Modified)

### New: Responsive table policy

A shared, domain-aware policy defines responsive strategy selection, essential information/action preservation, local-scroll ownership and discoverability, semantic equivalence, overflow containment, and the 320/375/768/1024 evaluation matrix. It applies first to the shared `AppDataTable` contract and provides rules that later native-table and hybrid changes can consume.

### New: Browser responsive evidence contract

A Playwright-based harness contract defines how a surface is mounted, which viewport widths are tested, which selectors or semantic landmarks are measured, what evidence is emitted, and how failures distinguish page overflow, local overflow, clipping, target-size, sticky alignment, focus, and state usability defects. The contract must not depend on screenshots alone.

### Modified: Test/evidence boundary

Existing jsdom tests remain behavior-focused and are explicitly limited to what they can establish. Browser evidence becomes the authority for rendered geometry and viewport-dependent behavior, especially for R8 gaps identified in Exploration §9.

## Approach

1. **Anchor the policy in the accepted inventory.** Use the surface IDs and root-cause families from Exploration §3 and §5 as stable references. The first contract must cover the shared dependency graph in Exploration §4 without claiming that all archetypes share one visual solution.
2. **Define invariants before implementation hooks.** Specify measurable pass/fail assertions for page overflow, local-scroll containment/discoverability, essential content/actions, target geometry, keyboard/focus behavior, semantic roles/names, long-data handling, adjacent controls, sticky/pinned alignment, and overlays.
3. **Separate strategy by archetype.** Keep generic CRUD, transaction history, exception queues, operational dispatch, embedded editable pricing, transaction details, POS cart, settings matrices, and ordered lists distinct as recommended by Exploration §6. The policy governs invariants; it does not prescribe one rendering pattern.
4. **Specify Playwright evidence boundaries.** The future harness should run each applicable surface at 320/375/768/1024 CSS px, use CSS-pixel measurements, inspect `scrollWidth`/`clientWidth` and bounding rectangles, exercise horizontal-scroll extremes where permitted, and verify keyboard/focus behavior. It should record surface ID, route/fixture, viewport, assertion, and failure evidence.
5. **Use canonical stress fixtures.** Define deterministic fixtures for long unbroken and mixed-content values, dense badges, empty/no-match/error/loading states, and representative actions. Fixtures must preserve domain-critical financial, status, permission, and operational fields rather than hiding them generically.
6. **Preserve compatibility explicitly.** Document how persisted view modes and column preferences are treated by future changes, since stored user preferences may preserve a wide table on phones (Exploration §9). Do not silently invalidate existing preferences in Batch A.
7. **Keep later work dependency-aware.** Batch B consumes the shared policy for table-adjacent controls; Batch C consumes it for native embedded tables; subsequent domain batches consume both the policy and evidence contract as listed in Exploration §8.

## Impact

- **Shared UI architecture:** Establishes contracts around `AppDataTable`, `DataTableToolbar`, `DataTablePagination`, `DataTableBulkActions`, view-mode composables, table preferences/URL sync, and the dashboard shell (Exploration §4).
- **Future verification:** Adds a planned browser-level verification lane for geometry and interaction evidence while retaining Vitest/jsdom for component behavior.
- **Feature teams:** Gives leaf migrations a common acceptance matrix and stable terminology, while requiring domain review for essential columns/actions.
- **Accessibility and UX:** Makes touch size, keyboard behavior, focus restoration, semantic equivalence, and discoverable local scrolling explicit rather than inferred from CSS classes.
- **Operations/support:** Reduces ambiguity when responsive regressions occur by associating evidence with stable surface and root-cause IDs.
- **No current runtime impact:** This proposal makes no source, dependency, configuration, or application behavior changes.

## Risks/Unknowns

- The exact browser mounting/authentication/fixture strategy for every route is not yet known; the harness may need focused representative surfaces before full inventory coverage.
- Essential columns and actions are domain-specific; a generic policy could over-hide financial, status, permission, or operational information (Exploration §9).
- Nuxt UI default geometry for many `size="xs"` controls remains unknown until browser measurement; `size-7` is visibly 28px but must still be checked in context.
- Sticky and pinned behavior may differ at scroll extremes and across shell/sidebar boundaries, particularly at 1024 CSS px where the shell changes behavior.
- Existing stored view modes and column preferences can create backward-compatibility cases; policy precedence must avoid surprising users or silently discarding preferences.
- Native tables and hybrids have different state ownership, semantics, and overlay constraints, so one harness abstraction may be too broad.
- Browser evidence can become brittle if it relies on implementation classes rather than stable semantic selectors and surface IDs.
- Playwright introduces future dependency and execution cost; the first harness slice should remain below the agreed 400 changed-line review budget or pause under ask-on-risk.

## First Slice Scope

The first implementation slice is the **browser contract/harness foundation**, not leaf remediation:

- Document the policy and measurable acceptance matrix for 320/375/768/1024 CSS px.
- Establish stable surface identifiers and a representative fixture/route contract for future evidence.
- Add the minimal Playwright configuration and reusable assertions needed to prove:
  - no page-level horizontal overflow;
  - permitted local-scroll ownership and discoverability;
  - measured 44×44 target floors for selected interactive controls;
  - semantic/accessibility-name presence and keyboard/focus checks;
  - long-data containment and state usability;
  - sticky/pinned alignment where the selected representative supports it.
- Include at least one shared `AppDataTable` representative and one native or hybrid representative to validate that the contract distinguishes archetypes; do not migrate their production rendering as part of this batch.
- Record limitations and coverage exclusions, including that jsdom does not prove layout.

The first slice does **not** include the Batch B shared-control fixes or the Batch C native-table primitive. Those are consumers of this contract.

## Rollback Plan

Because this proposal is planning-only, rollback is deletion or supersession of the single proposal artifact before apply. If the future harness is implemented and proves unsuitable, remove or disable the Playwright evidence lane and revert only its configuration, fixtures, and harness files; preserve existing jsdom tests and application behavior. Any policy clarification should be versioned in the next SDD artifact rather than silently changing leaf implementations. No table migration or preference/data migration is authorized by this proposal.

## Success Criteria

- `openspec/changes/responsive-table-contract-and-evidence/` contains this proposal only during this phase; no source/config/package file is changed.
- The future policy has explicit pass/fail checks for all nine evaluation criteria in Exploration §1 at exactly 320, 375, 768, and 1024 CSS px.
- The future Playwright evidence contract identifies each run by surface ID, viewport, route/fixture, assertion, and result, and measures rendered geometry instead of relying on jsdom or screenshots alone.
- The future harness can distinguish forbidden document overflow from permitted discoverable local table scrolling and can test both local-scroll extremes where applicable.
- The future acceptance checks measure interactive bounding boxes against 44×44 CSS px and exercise keyboard activation, visible focus, logical order, and overlay focus restoration.
- The contract requires semantic validation for native tables and appropriate list/article/button semantics and accessible names for substitutions.
- The contract includes deterministic long-data and non-success-state fixtures and verifies that critical identity, status/value, and primary action content remains visible or predictably reachable.
- The contract records known gaps rather than claiming complete inventory coverage; leaf batches can cite DT/NT/HY IDs and R1–R8 when consuming it.
- No acceptance statement treats Vitest/jsdom class or event assertions as proof of layout geometry.
