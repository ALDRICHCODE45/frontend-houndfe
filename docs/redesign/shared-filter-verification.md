# Shared HF filter controls

Enum, async, date-range, numeric-range and multi-text primitives now own HF
control hooks. Popup hooks merge with optional feature portal classes; omitting
`portalClass` still leaves the native `ui` prop undefined. The App boundary or
an explicit isolated boundary supplies the tokens. Error rings keep their
semantic role rather than inheriting the neutral field ring.

Enum and async triggers use their visible field label as their accessible name,
not the library default `Show popup`. Models, selection events, null handling,
date conversion and loading behavior retain their existing owners.

Date popups are bounded to the viewport minus 32px (540px on desktop). Mobile
presets scroll horizontally; the calendar remains contained in the popup.

## Observed verification

- Filter suite: 84 tests across seven suites passed; full build and diff check
  passed in job27. Before label correction, two native-control tests failed.
- Actual quotation enum menus: 390/1440px, light/dark, all four options 44px,
  correct HF foreground/surface pairs and horizontal containment.
- Actual mobile async search, selection/removal and nested Escape passed.
- Date regression RED: 541.453px popup overflowed a 390px viewport.
- Date GREEN: four viewport/theme cases, 358px mobile and 540px desktop popup,
  contained calendar and Escape retaining the parent filter panel.
- Mobile dark enum and mobile light date screenshots were visually inspected.
- Run `.editorial-field-preview/check-date-popup.js` with Playwright MCP's
  `browser_run_code_unsafe` filename input against an already authenticated local
  development session. It does not select dates or write stored data.

Initial browser attempts encountered transition/selector timing failures; those
are not counted as successful coverage. The date-check file initially had an
expression-parser error from its trailing semicolon; correcting the wrapper did
not change assertions. All these limits remain in the audit log.

This is a bounded primitive migration, not every consumer/state or complete
contrast/accessibility acceptance. Native assessment was unavailable; no native
approval is claimed. The full application audit and existing build warnings
remain open.
