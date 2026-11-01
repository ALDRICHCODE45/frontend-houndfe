# Product operational summary refinement

The summary is an operational reference, not an editorial publication preview.
It keeps the existing product, channel, price, cost, margin, stock and checklist
bindings. Operational and variant saves remain separate.

## Composition

- A contained 72 × 88px thumbnail sits beside product identity, rather than a
  full-width image above it. The image uses `object-fit: contain`, not cropping.
- Sale price has primary emphasis; cost, margin and stock form a secondary row.
- Operational completeness uses a quiet HF progress line and the existing list.
- The editorial/publication limitation remains visible, separated by a divider.
- Desktop uses a 320px rail; mobile keeps the summary in normal document flow.

## Verification

- Real-browser RED: a 341px image escaped its 112px container and overlapped the title.
- `verify-guided.mjs` now asserts thumbnail containment and heading separation.
- Job24 passed all five isolated browser groups, 37 operational tests,
  full `pnpm build` and `git diff --check`.
- Actual authenticated application checked at 390px and 1440px, light/dark:
  image and container both 88px tall, no image/title overlap or page overflow.
- Observed price $89.00, cost $53.40 and stock 60 remained unchanged.
- Mobile/dark and desktop/light captures were visually inspected. Four captures
  are under `odd/evidence/hf-ui-complete-audit/summary-after-*.png`.

This bounded result does not close the application-wide UI audit. Editorial
access is separately blocked by legacy vocabulary disposition. Native assessment
was unavailable; no native approval is claimed. Existing build warnings remain.
