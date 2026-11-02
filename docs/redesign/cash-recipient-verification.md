# Cash recipient picker — bounded verification

The custody recipient trigger now has the accessible name `Persona destinataria` instead of the component default `Show popup`. The production change is one template attribute; permissions, amounts, validation and custody commands are unchanged.

## Evidence

- Focused native DOM regression: RED (14 passed / 1 failed), then all 15 tests passed. The initial test incorrectly expected a combobox; DOM inspection established a native button with `aria-haspopup="listbox"` before the genuine naming regression was recorded.
- Job 37: focused suite, full production build and `git diff --check` passed. Existing generated CSS and large-chunk build warnings remain.
- `.editorial-field-preview/check-cash-recipient.js`: four cases at 390/1440px, light/dark. Exact accessible name, keyboard selection, Escape dismissal and trigger focus restoration passed.
- Settled popup widths: 301px mobile, 875px desktop; horizontal containment passed. Backgrounds were white in light mode and `#192332` in dark mode, matching the inherited HF surface. No additional styling was needed.
- Captures: `odd/evidence/hf-ui-complete-audit/cash-recipient-fixture-{390|1440}-{light|dark}.png`. The mobile-dark capture was visually inspected.

## Isolation and limitations

The actual session history was empty. Browser checks therefore used a separate authenticated page with page-scoped GET fixtures for the session list/detail and assignable users. Current identity metadata and actual permissions were preserved. The illustrative SUBMITTED session is frontend test data, not proof of a persisted custody lifecycle.

Non-read API requests were blocked except authentication refresh. There were zero mutation attempts; the page closed in `finally`. No register/session was created and no handover, release, receipt or financial command was submitted.

Initial geometry was measured during animation; the accepted run waits for transitions. A post-edit run still saw old built assets; the accepted run followed the successful rebuild. These harness failures are not omitted from the evidence.

This is bounded simulated UI evidence, not backend integration or complete cash-route accessibility coverage. Loading/error/empty options, contrast, all target sizes and assistive-technology testing remain outside this slice.
