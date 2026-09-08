# Test Evidence Boundary Specification

## Purpose

Define the evidence boundary between behavior-focused Vitest/jsdom tests and browser-level responsive proof. Existing unit tests remain valuable for component behavior, markup, state, and accessibility metadata, but they cannot establish rendered viewport geometry (`R8`). Playwright geometry and interaction evidence is required for the responsive policy's layout assertions across `DT`, `NT`, and `HY` surfaces.

## Requirements

### Requirement: TEB-REQ-001 jsdom Scope Is Behavior and Markup

Vitest/jsdom tests MAY verify component props, emitted events, state transitions, mode and preference handling, rendered markup, semantic attributes represented in the DOM, accessible labels/names present in markup, and behavior of loading, fetching, empty, no-match, error, filter, pagination, bulk, and overlay state models. Such tests SHOULD remain the primary fast feedback for behavior that does not require a real layout engine.

#### Scenario: jsdom verifies mode state

#### Given

- A table component receives a persisted display mode and column preference.

#### When

- A Vitest/jsdom test mounts the component and triggers a mode or state transition.

#### Then

- The test MAY assert rendered mode markup, emitted events, state transitions, preference compatibility, and accessible labels represented in the markup.

#### Scenario: jsdom verifies non-success behavior

#### Given

- A component is configured with loading, empty, no-match, fetching, or error state.

#### When

- The state is rendered in jsdom.

#### Then

- The test MAY assert state-specific text, retry events, disabled state, selection behavior, and control presence in the rendered markup.

### Requirement: TEB-REQ-002 jsdom Cannot Prove Viewport Geometry

Vitest/jsdom tests SHALL NOT count as proof for any rendered geometry or viewport-dependent assertion in the responsive policy. Specifically, jsdom class, prop, event, or markup assertions SHALL NOT prove document or local `scrollWidth`/`clientWidth`, horizontal overflow containment, clipping, wrapping, computed target size, bounding-box dimensions, sticky alignment, pinned-column behavior, shell/sidebar gutters, modal/slideover widths, sticky-footer visibility, or viewport-height constraints.

#### Scenario: Unit test is insufficient for overflow

#### Given

- An `AppDataTable` test asserts an `overflow-auto` class and a mocked breakpoint at 320 CSS px.

#### When

- The responsive acceptance result is reviewed.

#### Then

- The unit test is credited for markup or state behavior only.
- Browser evidence is required for document `scrollWidth`/`clientWidth`, local scroll ownership, and rendered containment.

#### Scenario: Unit test is insufficient for target size

#### Given

- A jsdom test finds a row action with a compact-size class or accessible label.

#### When

- The 44 by 44 CSS-pixel requirement is reviewed.

#### Then

- The test is credited for markup/name behavior only.
- A real-browser bounding-box measurement is required for width and height.

#### Then (negative)

- A passing jsdom suite MUST NOT be reported as proof that a surface passes any exact 320/375/768/1024 viewport geometry check.

### Requirement: TEB-REQ-003 Screenshots Are Supplementary Evidence

Screenshots MAY document visual appearance, density, clipping symptoms, local-scroll affordances, or state presentation, but screenshots alone SHALL NOT count as proof of responsive compliance. A screenshot MUST be supplemented by browser measurements and semantic/interaction assertions when used for an acceptance decision.

Screenshots SHALL NOT be treated as proof of exact `scrollWidth`/`clientWidth`, bounding-box target size, hidden overflow, focus order, keyboard activation, accessible name, semantic equivalence, sticky/pinned alignment, or overlay focus restoration.

#### Scenario: Screenshot accompanies browser measurements

#### Given

- A 375 CSS px screenshot shows a table with a visible horizontal-scroll cue.

#### When

- The evidence is reviewed for local-scroll compliance.

#### Then

- The screenshot MAY corroborate the visual cue.
- Browser evidence still measures document and local-region geometry, checks both scroll extremes when applicable, and verifies semantics and keyboard/focus behavior.

#### Scenario: Screenshot suggests clipping

#### Given

- A screenshot appears to clip a long CLABE or status badge.

#### When

- The responsive defect is triaged.

#### Then

- The result is confirmed with browser bounding boxes, scroll metrics, and the relevant semantic/content assertion.
- The defect is associated with its surface ID and applicable `R1`–`R8` root-cause references.

#### Then (negative)

- A screenshot-only pass or failure MUST NOT determine whether the page overflowed, a local scroll was permitted, a target met 44 by 44 CSS px, or focus was restored.

### Requirement: TEB-REQ-004 Browser Evidence Is Required for Responsive Acceptance

A responsive acceptance result MUST combine behavior evidence appropriate to the implementation with Playwright browser evidence for rendered geometry and viewport-dependent interaction. For every applicable `DT`, `NT`, or `HY` surface, the acceptance record MUST cover the exact widths 320, 375, 768, and 1024 CSS px, or explicitly record a justified exclusion. The browser record MUST identify the route/fixture and surface ID and MUST retain measurements for document overflow, permitted local overflow, bounding boxes, scroll extremes, and applicable focus/semantic assertions.

#### Scenario: Combined evidence accepts a shared table

#### Given

- A shared `AppDataTable` representative has passing jsdom behavior tests and passing Playwright runs at all four widths.

#### When

- The responsive contract is reviewed.

#### Then

- jsdom evidence supports behavior, markup, and state claims.
- Playwright evidence supports rendered geometry, target sizes, scroll ownership, semantics, and keyboard/focus claims.
- The acceptance record cites the representative's `DT-*` surface ID and fixture.

#### Scenario: Native or hybrid behavior is not inferred from shared tests

#### Given

- A native table or hybrid surface has no shared `AppDataTable` implementation.

#### When

- Its responsive result is reviewed.

#### Then

- Its own browser route/fixture and `NT-*` or `HY-*` surface ID are evaluated.
- Shared-component jsdom coverage MAY be cited only for behavior it actually exercises.

#### Then (negative)

- Passing shared-component tests, passing markup tests, or an unmeasured screenshot MUST NOT substitute for browser evidence of a native or hybrid surface's rendered geometry.

### Requirement: TEB-REQ-005 Evidence Claims Must Preserve Boundaries

Reports, test names, fixtures, and acceptance summaries MUST distinguish behavior assertions from geometry assertions and MUST identify the authority for each claim. A unit-test result MAY be labeled as jsdom behavior/markup/state evidence; a Playwright result MAY be labeled as browser geometry and viewport interaction evidence. Neither evidence type MAY claim coverage outside its exercised surface, state, viewport, or root-cause assertion.

#### Scenario: Evidence report labels authority

#### Given

- A future report contains unit and browser results for `DT-01` and `HY-01`.

#### When

- A reviewer reads the report.

#### Then

- Each result identifies its test environment, surface ID, route/fixture, exact viewport when applicable, assertion class, and measured or behavioral evidence.
- The report distinguishes `R8` geometry proof from jsdom behavior proof.

#### Scenario: Unmeasured coverage is transparent

#### Given

- A surface has jsdom coverage but its 1024 CSS px browser run is not available.

#### When

- The acceptance summary is produced.

#### Then

- The 1024 geometry result is marked unverified or excluded with a reason.
- The jsdom result remains credited only for its exercised behavior.

#### Then (negative)

- Reports MUST NOT convert a class assertion, mocked width, event assertion, or screenshot into a claim of measured responsive compliance.
