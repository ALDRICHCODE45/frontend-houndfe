# Design: Responsive Table Contract — bounded correction plan

## 1. Correction intent and invariants

Verification failed with six CRITICAL evidence-contract defects. This plan corrects only the responsive browser evidence foundation; it does not remediate product/UI behavior, change `src/**`, install tooling, or alter the failed `verify-report.md`. The accepted strict surface RED remains valid and must remain visible:

- DT-01 action accessible-name failure ×4 (`semantic-or-name`).
- HY-04 query-error recovery failure ×4 (`state-usability`).
- HY-04 36×20 master-switch failure ×4 (`target-size`).

A genuine target RED is conformance evidence when the setup and reporter exit cleanly. A missing/ambiguous locator is a harness/fixture failure: it must stop that assertion, never bypass target-size, semantics, scroll, or state checks. `src/**` is forbidden for this correction.

The exact matrix remains 320×568, 375×667, 768×1024, and 1024×768. Every correction/final run uses a unique `RESPONSIVE_RUN_ID`. Coverage marks only assertions that produced a substantive record; unrelated target risks are not copied onto every record.

## 2. Corrected evidence contract

### Ownership and discovery

Each representative declares three distinct concepts: `owner` (the containing dashboard panel/card), `surface` (the rendered table/cards/actions region), and `relatedRegions` (toolbar, pagination, footer, accordion, recipients, or overlay as applicable). Records retain the named locators and measurements for all three. DT-01 resolves the actual rendered `#hound-dashboard-panel-main-panel`, then a unique `table-view` or `product-cards-grid`; HY-04 resolves the unique actions-card owner and separately resolves accordion, action rows, recipient region, and footer. No self-comparison can pass containment. If any named locator is absent or ambiguous, the adapter throws a setup failure and does not substitute classes, indexes, text translations, or a different target.

### DT-01

The real spec must invoke the shared full local-scroll contract: document overflow, exactly one declared scroll owner, owner containment, overflow metrics, discoverability instruction/affordance, and no second owner. It must exercise long/dense product data, `scrollLeft = 0` and maximum, identity/status-value/action reachability, sticky header and right-pinned action alignment at both extremes, target-size, accessible name, keyboard/focus, and the table/card equivalent path. Table mode must preserve the stored `products-view-mode`/preference values; card mode must prove the same essential identity, status/value, and action outcome. A missing named action is a strict surface RED, not a reason to skip the remaining applicable assertions.

### HY-04

The stacked no-scroll path must prove no document/local horizontal overflow and separately record its owner, accordion/action rows, recipient chips/removal action, and sticky Save footer. It must exercise state usability for loading, success, and error with honest exclusion or strict RED where the application lacks a distinct query-error recovery surface. It must measure all applicable enabled targets, names, keyboard/focus order and activation, including switch, recipient controls, accordion, and Save. Overlay/focus restoration is tested only when the recipient overlay is actually opened; otherwise its exclusion names the current correction/final verification follow-up. The loading path must always inspect strict-network violations before returning.

### Records, authorities, and risks

Each record has one assertion ID, the risk IDs substantively exercised by that assertion, and the correct authority: `browser-geometry` for viewport/overflow/containment/long-data/extremes/sticky/pinned/target geometry; `browser-interaction` for names, semantics, keyboard, focus, overlay, state usability, and preference/state behavior. Exclusions have explicit reason and follow-up and are not counted as exercised. A central assertion-to-risk/authority map rejects unsupported combinations and prevents blanket target-risk attribution.

### Global networking and discovery

The strict controller applies to every page lifecycle path, including early loading returns, and fails all undeclared same-origin API and external requests. Expected blocked startup externals remain an explicit exact-origin/path declaration, not host-substring filtering. Manifest counts are derived from the actual viewport/state case manifest and validated against the emitted discovery set; no arithmetic tautology remains. The harness uses non-empty fixture destructuring and removes the unused `assertOverflowContract` import. Stale WU-4d overlay follow-ups are replaced with correction/final-verification follow-ups.

## 3. Correction units and surfaces

All units are additive or narrow modifications under `e2e/responsive/**`, `playwright.responsive.config.ts`, and `package.json`; no `src/**`, generated declarations, unrelated lockfile, or planning artifact is an implementation surface.

### C1 — evidence identity, ownership, risk, and authority

- **MOD:** `e2e/responsive/targets/types.ts`, `e2e/responsive/evidence/schema.ts`, `e2e/responsive/evidence/session.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/specs/hy04-notifications.spec.ts`, `e2e/responsive/specs/harness.spec.ts`.
- **NEW:** none.
- Introduces distinct owner/surface/related-region evidence, assertion-specific risk/authority mapping, substantive-coverage validation, and manifest-derived discovery helpers. It does not change target behavior.

### C2a — DT-01 table-focused contract

- **MOD:** `e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/targets/dt01-products.ts`, `e2e/responsive/assertions/geometry.ts`, `e2e/responsive/assertions/accessibility.ts`, `e2e/responsive/evidence/schema.ts` only where C1 types require it.
- **NEW:** none.
- Absorbs the current 102-line partial C2 diff and finishes zero-sized long-data rejection, real sticky header checks, left/right scroll extremes, essential identity/price/stock/status, table action/view/search/filter/pagination-target/keyboard/focus evidence, and both `products-view-mode` and `products-table-density` preference keys. Direct ceiling is 290; native ceiling is 400.

### C2b — DT-01 card/state-focused contract

- **MOD:** `e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/targets/dt01-products.ts`, `e2e/responsive/assertions/geometry.ts`, `e2e/responsive/assertions/accessibility.ts`, `e2e/responsive/assertions/states.ts`, `e2e/responsive/evidence/schema.ts` only where C1 types require it.
- **NEW:** none.
- Proves card no-scroll plus scroll/sticky exclusions, semantic equivalence with table, identity/status/value/action/long-name/SKU, substantive loading/fetching/empty/no-match/error/pagination records, and the final DT evidence audit. Direct ceiling is 280; native ceiling is 400.

### C3 — HY-04 state, recipient, footer, interaction, and network closure

- **MOD:** `e2e/responsive/specs/hy04-notifications.spec.ts`, `e2e/responsive/targets/hy04-notifications.ts`, `e2e/responsive/fixtures/network.ts`, `e2e/responsive/fixtures/test.ts`, `e2e/responsive/assertions/accessibility.ts`, `e2e/responsive/assertions/states.ts`, `e2e/responsive/evidence/schema.ts` only where C1 types require it.
- **NEW:** none.
- Proves stacked no-scroll ownership, loading/success/error state records, accordion/recipient/footer/switch evidence, applicable keyboard/focus/action checks, honest overlay exclusions, and strict networking before every return.

### C4 — conformance discovery, lint, scripts, and final truthfulness

- **MOD:** `e2e/responsive/specs/harness.spec.ts`, `e2e/responsive/specs/dt01-products.spec.ts`, `e2e/responsive/specs/hy04-notifications.spec.ts`, `playwright.responsive.config.ts`, `package.json`, `e2e/responsive/targets/types.ts` only for manifest completion.
- **NEW:** none.
- Removes tautological arithmetic and host-substring filtering, fixes oxlint errors, updates stale follow-ups, preserves strict non-zero target RED and zero setup/reporter errors, and exposes unique-run verification commands. OpenSpec CLI unavailability remains a warning and never an install dependency.

## 4. Ordering, delivery, and rollback

Order is C1 → C2a → C2b → C3 → C4. Delivery remains `ask-on-risk`; because each unit is below 400 native lines, the correction can be reviewed as a five-commit stacked-to-main chain if chaining is approved. C2 was interrupted after 102 direct lines and has no active attempt; C2a absorbs that partial diff and C2b starts only after C2a verifies. No unit may exceed its native ceiling; split again rather than use `size:exception`.

Rollback is unit-local: revert C4, C3, C2b, C2a, or C1 independently, removing only the listed evidence/spec/fixture/config/script changes. Full correction rollback returns to commit `cb53f732d4eaabc805182970bcd7fece7348f1` and retains the failed evidence as historical evidence. No rollback removes `src/**` or rewrites `verify-report.md`.

## 5. Traceability

C1 → BRE-REQ-001, BRE-REQ-007, BRE-REQ-008, TEB-REQ-005, RT-REQ-008.
C2a → RT-REQ-001, RT-REQ-003–004, RT-REQ-006–007, BRE-REQ-003–005, TEB-REQ-004.
C2b → RT-REQ-002, RT-REQ-005–007, BRE-REQ-002, BRE-REQ-005–006, TEB-REQ-004–005.
C3 → RT-REQ-005–007, BRE-REQ-002, BRE-REQ-005–006, TEB-REQ-004–005.
C4 → BRE-REQ-001, BRE-REQ-007–008, TEB-REQ-003–005 and strict-TDD conformance.

Validation must run unit tests, responsive type-check, harness, strict conformance, oxlint, and the headed wiring check with unique run IDs. `openspec validate ... --strict` is attempted only if already available; command-not-found is recorded as a warning, not repaired by installation.
