# Debt dialog accessibility verification

Bounded A4/A6 change: five template attributes add native dialog title/description, accessible close/removal names and payment-tile pressed state. Layout, financial calculations, validation, idempotency, payloads and submission handlers are unchanged.

## Evidence

- RED: two new control tests failed before names/pressed state were added; 18 existing cases passed.
- RED: the additional installed-dialog association test failed before native title/description props were added; 20 other cases passed.
- Job 36: payment and portal regression suites, full build and whitespace checks passed. Native USlideover generates hidden title/description associations even with custom content, preserving the existing layout.
- `.editorial-field-preview/check-debt-accessibility.js` passed four cases at 390/1440px, light/dark: title/description association, selection/removal announcements, named close and horizontal containment (358/512px dialog widths).
- **Simulated UI evidence:** the separate browser tab intercepted one sale GET response to expose a partial-debt state. Non-read API requests were blocked, except normal session refresh. Zero mutation attempts occurred, and the tab closed in `finally`. No financial submission was clicked or persisted debt created. This is not live backend payment proof.
- Captures: `odd/evidence/hf-ui-complete-audit/debt-fixture-{390|1440}-{light|dark}.png`; mobile-dark inspected.

## Limits

No complete screen-reader, contrast, numeric-stepper target, loading or financial integration audit is claimed. Existing generated CSS and large-chunk build warnings remain. The native assessment is unavailable because of undeclared untracked files; no review approval is inferred. The separate editorial access suite also passed 20 tests without source changes.
