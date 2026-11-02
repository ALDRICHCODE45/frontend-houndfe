# Seller picker accessibility verification

Bounded A4/A6 change: seller rows are native buttons with pending-disabled semantics and visible HF focus. Search and close controls have accessible names. The native USlideover header owns the title/description association. Assignment, permission and query logic are unchanged.

## Evidence

- Three installed-DOM tests failed before repair: selection rendered a DIV, dialog title/description targets were missing, and search/close lacked explicit names.
- New and existing portal suites: 18 tests passed, including assignment argument, close emission, pending protection and unchanged optional portal overrides.
- Job 34: full build and whitespace checks passed. Existing generated-CSS/large-chunk warnings remain.
- Actual `/pos/ventas/84949bb3-3819-4d01-a24b-f5d9b464b9a0`: four 390/1440 light/dark cases opened the body seller entry, reached the first native user button via Tab from search, measured a 2px focus outline and 60/76px row heights, and closed using its accessible name. Dialog widths 358/448px remained contained.
- `odd/evidence/hf-ui-complete-audit/seller-{390|1440}-{light|dark}.png`; mobile-dark screenshot inspected.
- No real user assignment or sale mutation was performed. Activation/submission behavior is proven only by the mocked assignment regression, not a live write.

## Failed attempts and limits

Job 33 failed before tests because a direct reka-ui import was unavailable from the application root. The repair uses the existing Nuxt component API instead; no dependency was added. Browser setup initially assumed a `main` element and a concatenated accessible name; both selectors were corrected against observed DOM without changing production code.

Full contrast, assistive-technology and every error/loading state are not claimed. One active LSP probe was inconclusive; focused tests and the full build passed, without suppressing diagnostics or weakening imports. This unit does not close the sales route or global audit.
