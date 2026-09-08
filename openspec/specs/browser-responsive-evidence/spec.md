# Browser Responsive Evidence Specification

## Purpose

Define the future Playwright contract that proves rendered responsive behavior for inventoried surfaces. Browser evidence is authoritative for viewport geometry and interaction outcomes that the current Vitest/jsdom stack cannot establish (`R8`). The contract covers shared `AppDataTable` surfaces (`DT`), native tables (`NT`), and list/matrix hybrids (`HY`) without requiring one rendering strategy.

## Requirements

### Requirement: BRE-REQ-001 Surface, Route, Fixture, and Viewport Protocol

Every browser evidence target MUST declare a stable `surfaceId`, its route or mount entry, its deterministic fixture identifier, its effective rendering strategy, and the applicable archetype (`DT`, `NT`, or `HY`). Surface IDs MUST use the accepted inventory identifiers `DT-01`–`DT-15`, `NT-01`–`NT-07`, or `HY-01`–`HY-05`; a new or changed surface MUST receive an explicit identifier before evidence is accepted.

Every applicable target MUST run at exactly **320, 375, 768, and 1024 CSS px**. The target declaration MUST identify exclusions when a route, state, or assertion does not apply, rather than implying untested coverage.

#### Scenario: Shared table target is identified

#### Given

- A representative `AppDataTable` consumer is selected for browser verification.
- Its inventory identity is `DT-03`.

#### When

- The evidence run is configured.

#### Then

- Each record identifies `surfaceId: DT-03`, the route or mount entry, the deterministic fixture, the effective mode, and one of the exact matrix widths.
- The record can be traced to the sales-history archetype and applicable `R1`–`R8` risks.

#### Scenario: Native or hybrid target is identified

#### Given

- A representative native table or hybrid surface is selected.

#### When

- The evidence run is configured.

#### Then

- The record identifies its `NT-*` or `HY-*` surface ID and does not inherit `AppDataTable` assumptions that are not applicable.
- Its route, fixture, container owner, and exclusions are explicit.

#### Then (negative)

- A screenshot, a component filename, or an unassigned route MUST NOT serve as a surface identity.

### Requirement: BRE-REQ-002 Deterministic Fixtures and State Coverage

The evidence contract MUST provide deterministic fixtures for long unbroken and mixed-content values, including long names, email addresses, SKU/IDs, account numbers, CLABE, currency, dates, status chips, and multi-badge rows. Fixtures MUST also represent the applicable loading, fetching, empty, no-match, error, selection/bulk, filter, pagination, and overlay states. Critical identity, status/value, financial, permission, operational, and primary-action data MUST remain represented in stress fixtures.

The same fixture identifier and state MUST produce repeatable records across runs. A fixture MAY be supplied by a route, mount harness, or test data provider, but its observable data and state MUST be declared in the evidence record.

#### Scenario: Long-data stress fixture is repeatable

#### Given

- A table-like surface is tested at 320 and 375 CSS px.
- Its fixture includes an unbroken identifier, long email, CLABE, currency, date, status chip, and multiple badges.

#### When

- The fixture is mounted more than once.

#### Then

- The same values and state are rendered each time.
- The run can verify containment and essential-content reachability without relying on production data timing.

#### Scenario: Non-success states are covered

#### Given

- A surface supports loading, fetching, empty, no-match, and error states.

#### When

- The evidence harness mounts each applicable state.

#### Then

- Each state has a distinct declared fixture/state identity and its usable controls are asserted.
- Error recovery, selection, filters, pagination, and overlay actions are included when applicable.

#### Then (negative)

- Random data, live backend responses, or a single successful row state MUST NOT be treated as complete stress or state evidence.

### Requirement: BRE-REQ-003 Document and Local Geometry Assertions

Playwright evidence MUST measure CSS-pixel geometry in the rendered browser. For every matrix width, it MUST assert that the document's horizontal `scrollWidth` is no greater than its `clientWidth`. It MUST inspect bounding boxes for the surface, its owning container, essential content, controls, and any permitted scroll region.

When local horizontal scrolling is permitted, the evidence MUST identify one scroll owner, compare its `scrollWidth` and `clientWidth`, verify that its bounding box is contained by its owner, and verify a discoverable scroll affordance or instruction. When local scrolling is not permitted, the relevant region MUST have no horizontal overflow. Geometry assertions MUST distinguish document overflow from permitted local overflow (`R2`, `R4`, `R7`).

#### Scenario: Page-level overflow is rejected

#### Given

- A surface is mounted at one exact matrix width.

#### When

- Playwright measures the document and the surface bounding boxes.

#### Then

- The document `scrollWidth <= clientWidth` assertion passes.
- The surface and its containing shell/card/overlay remain within the available horizontal bounds.

#### Scenario: Local table scrolling is accepted only when owned

#### Given

- A table strategy intentionally uses local horizontal scrolling.

#### When

- Playwright measures the candidate scroll region and its owner.

#### Then

- The candidate region is the declared scroll owner.
- Its `scrollWidth > clientWidth` is recorded as permitted local overflow.
- The owner remains contained and a discoverable affordance or instruction is present.

#### Then (negative)

- A page-level `scrollWidth > clientWidth`, an ancestor-only `overflow-x-hidden`, or an unowned overflow region MUST fail the assertion.

### Requirement: BRE-REQ-004 Both Horizontal Scroll Extremes and Sticky Alignment

For every permitted local scroll region, browser evidence MUST inspect both `scrollLeft = 0` and the maximum scroll position. At both extremes it MUST assert the visibility/reachability of essential identity, status/value, and primary actions, and MUST verify sticky headers and pinned columns remain aligned with their associated content when those features exist (`R2`, `R7`).

#### Scenario: Left and right extremes are verified

#### Given

- A `DT` or `NT` surface has additional horizontal content and a sticky or pinned element.

#### When

- The harness evaluates the local region at its minimum and maximum horizontal scroll positions.

#### Then

- Both scroll positions are recorded.
- Essential fields and actions remain visible or predictably reachable at both positions.
- Sticky and pinned bounding boxes remain aligned and usable.

#### Scenario: Non-scrolling surface declares the exception

#### Given

- A card or stacked hybrid has no permitted horizontal scroll region.

#### When

- The harness evaluates the surface.

#### Then

- The record marks local-extreme assertions as not applicable with a reason.
- The no-document-overflow and bounding-box assertions still run.

#### Then (negative)

- Checking only the initial left position MUST NOT count as proof of sticky or pinned behavior.

### Requirement: BRE-REQ-005 Interactive Geometry and Keyboard Evidence

Browser evidence MUST measure every applicable actionable target's rendered bounding box and assert a minimum of **44 by 44 CSS px** in width and height (`R3`). It MUST assert accessible names, keyboard activation, visible focus, and logical focus order for table actions, row actions, pagination, filters, view toggles, bulk controls, switches, and any drag/reorder alternative.

For modals and slideovers, it MUST assert focus entry, keyboard reachability, and focus restoration to the invoking control when the overlay closes (`R7`).

#### Scenario: Target floor and keyboard action are proven

#### Given

- A surface exposes a row action and a pagination or filter control at 320 CSS px.

#### When

- Playwright measures their bounding boxes, focuses them by keyboard, and activates them with the keyboard.

#### Then

- Every measured actionable target is at least 44 by 44 CSS px.
- Each control has an accessible name, visible focus, and the expected state or navigation result.
- Focus order follows the rendered semantic order.

#### Scenario: Overlay focus lifecycle is proven

#### Given

- A filter sheet, modal, or slideover opens from a named trigger.

#### When

- The harness opens and closes the overlay using keyboard-accessible controls.

#### Then

- Focus enters the overlay, moves through its usable controls, and returns to the invoking trigger when available.
- Sticky content does not obscure the focused element.

#### Then (negative)

- A DOM class indicating a compact size, an unmeasured icon, or a screenshot of a control MUST NOT prove the 44 by 44 CSS-pixel floor.

### Requirement: BRE-REQ-006 Semantic and Accessibility Assertions

Playwright evidence MUST assert rendered semantics in addition to geometry. Native table targets MUST expose valid table, header, row, and cell relationships with an accessible name or caption. Card/list/stacked substitutions MUST expose the appropriate list, listitem, article, or button semantics, accessible names, essential values, and equivalent actions. Search, filters, pagination, bulk actions, loading, fetching, empty, no-match, and error states MUST expose usable names and state-specific feedback where applicable.

#### Scenario: Native table semantics are checked

#### Given

- An `NT` surface renders a native table.

#### When

- Playwright inspects roles, names, headers, rows, and action controls.

#### Then

- The table has an accessible name or caption.
- Header associations and row/cell relationships are exposed.
- Each actionable operation has an accessible name and remains keyboard reachable.

#### Scenario: Card substitution has equivalent semantics

#### Given

- A `DT` surface renders a card/list substitution at a narrow viewport.

#### When

- Playwright inspects the rendered record and activates its primary action.

#### Then

- The record exposes appropriate list/article/button semantics and an accessible name.
- Essential identity, status/value, and primary action semantics are present and the action outcome matches table mode.

#### Then (negative)

- A visually similar screenshot or a present text node without its associated role/name/action MUST NOT satisfy semantic equivalence.

### Requirement: BRE-REQ-007 Evidence Record and Failure Classification

Each assertion result MUST emit an evidence record containing, at minimum: run identifier, `surfaceId`, route or mount entry, fixture/state identifier, viewport width, effective mode/archetype, assertion identifier, pass/fail result, relevant measured values, and failure details when failed. Geometry records MUST retain the measured `scrollWidth`, `clientWidth`, and bounding-box values that support the result. Records SHOULD include the scroll extreme and overlay/focus context when applicable.

Failures MUST distinguish at least: document overflow, uncontained local overflow, missing scroll discoverability, essential-content loss, long-data clipping, target-size failure, semantic/name failure, keyboard/focus failure, sticky/pinned misalignment, and shell/overlay containment failure.

#### Scenario: Passing evidence is auditable

#### Given

- A `DT-01` run passes at 320 CSS px.

#### When

- The harness writes its evidence output.

#### Then

- The record identifies the target, route, fixture, exact viewport, assertion, result, and supporting measurements.
- A reviewer can distinguish a permitted local scroll from a document overflow pass.

#### Scenario: Failure identifies the defect class

#### Given

- A native table clips a long unbroken value inside a modal at 375 CSS px.

#### When

- The relevant assertions fail.

#### Then

- The record marks the failure as long-data/overlay containment or the more specific applicable class.
- The measured bounding boxes and scroll metrics are retained for diagnosis.

#### Then (negative)

- A single undifferentiated "responsive failed" result MUST NOT be the only evidence output.

### Requirement: BRE-REQ-008 Representative Coverage and Honest Exclusions

The first conforming harness slice MUST exercise at least one shared `AppDataTable` representative and at least one native-table or hybrid representative, and MUST execute the applicable representatives at all four exact viewport widths. The coverage report MUST state which of `DT`, `NT`, and `HY` families and which `R1`–`R8` assertions remain unverified. It MUST not claim complete 27-surface coverage from representative runs.

#### Scenario: Shared and bypass paths are distinguished

#### Given

- The initial browser evidence slice includes one `DT` surface and one `NT` or `HY` surface.

#### When

- The slice runs at 320, 375, 768, and 1024 CSS px.

#### Then

- Both representatives produce evidence records under their own surface IDs and applicable assertions.
- The report distinguishes shared `AppDataTable` behavior from native or hybrid behavior.

#### Scenario: Coverage limitations are recorded

#### Given

- Only representative surfaces are mounted in the first slice.

#### When

- The coverage summary is produced.

#### Then

- Untested surface IDs, states, archetypes, and root-cause assertions are listed as exclusions or follow-up coverage.

#### Then (negative)

- Representative evidence MUST NOT be described as proof that all `DT-01`–`DT-15`, `NT-01`–`NT-07`, and `HY-01`–`HY-05` surfaces comply.
