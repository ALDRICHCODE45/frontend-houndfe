# Guided product workspace verification

The approved third direction is implemented in the operational creator/editor and
standalone editorial view. Publication remains explicitly unavailable.

## Observed evidence

- Operational regression: 48 tests across four suites; app `vue-tsc` and diff check passed.
- Editorial regression: 38 tests across five suites; app compiler passed.
- Current editorial access regression: 20 tests passed.
- Independent publication-consent verification: 32 tests passed.
- Independent embedded admission/isolation verification: 46 tests passed.
- Final isolated Chromium run: five scenario groups, 12 captures at 390/1440px,
  light/dark themes, no page errors; navigation targets >=44px and keyboard focus 2px.
- Browser checks cover retained inputs, separate operational/editorial forms and
  saves, hidden actor/tenant replacement, revocation, authoritative summaries and
  unavailable editorial access before product creation.
- Mobile fieldset regression: RED measured 662.625px inside a 358px form; adding
  `min-w-0` made both 358px. Final capture was visually inspected.
- Every final owned browser context, browser and Vite server closed successfully.
- Full `pnpm build` initially failed in a test selector (TS2339, `DOMWrapper.vm`).
  Selecting the form by component name, without casts, corrected the inference.
  The affected test suite, full build (including project-reference type checking),
  and diff check then passed together in job22. Vite retains a nonblocking
  warning about chunks larger than 500 kB.

## Reproduce the isolated browser checks

```sh
timeout 180s node .editorial-field-preview/verify-guided.mjs
```

The host mounts real Vue views, Nuxt UI, Pinia and VueQuery in an isolated router
shell. All API responses and session claims are synthetic. External resources and
WebSockets are blocked. No live backend, production grants or retired credentials
are used. Generated declaration output is disabled.

Timestamped reports and captures remain under `.editorial-field-preview/`.
Final observed report: `guided-verification-1793564438935.json` (job20).
Earlier failed fixture attempts and the mobile RED report remain preserved.

## Limits

This is not full DashboardLayout, production-router, live authentication/backend,
public catalog or deployment proof. External fonts/icons may fall back or be absent.
The editorial fixture uses a minimal document; it does not exercise every care or
attribute combination. Only navigation targets received the 44px assertion; this
is not a complete accessibility audit. Tables retain local horizontal scrolling.
The previously deferred full suite remains deferred. Plain-TS Vue test imports
were inconclusive; application compiler results do not type-check those tests.
Native review assessment was unavailable due its untracked-file declaration error;
no new native approval is claimed. Publishing, push, PR and deployment were not run.
