# Product selector verification

Bounded A4 unit: CategorySelect and SatKeySelect use HF roles, minimum control heights, accessible list/active-option relationships and keyboard/focus handling. Category action events remain distinct from value selection. SAT async search, key values, loading and error relationships remain intact.

## Checks

- Job 31: integrated selector, slideover, catalog and confirmation regression — 121 tests across eight suites passed; whitespace clean.
- Actual slideover inspection found SAT descriptions constrained to a 147.5px mobile/184.5px desktop field. The new full-row DOM test failed before changing the location/SAT grid to one column.
- Job 32: three focused selector/slideover suites, full build and whitespace checks passed after the layout fix. Existing build warnings remain.
- `.editorial-field-preview/check-slideover-selectors.js`: eight actual-browser cases after reloading the latest bundle, two selector families at 390/1440px and light/dark. Filtered keyboard selection, active descendant, restored trigger focus, nested Escape retaining the parent, SAT clearing and horizontal containment passed. No records were saved.
- SAT menu now measures 311px mobile/385px desktop. Mobile-light screenshot inspected; long labels still ellipsize and the list remains scrollable. Evidence: `slideover-{category-select|sat-select}-{390|1440}-{light|dark}.png` under `odd/evidence/hf-ui-complete-audit/`; before image retained as `slideover-sat-before-390-light.png`.
- Earlier full-editor settled selector screenshots remain separate evidence, not substitutes for slideover checks.

## Harness failures and limits

The first browser attempt selected the intentionally retained first Create action, not a category; its modal was canceled without saving. The second attempt awaited a Vue animation promise canceled during reactive updates. The corrected helper selects a real category and waits for rendered opacity; neither failure was counted as product regression evidence.

This unit does not close every loading/error/disabled visual state, assistive-technology behavior, contrast measurement or application route. Existing Vue-module resolution diagnostics in the test editor are not standalone test-typecheck proof; focused runtime tests and full build passed without weakening imports or suppressing diagnostics.
