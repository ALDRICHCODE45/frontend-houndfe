# catalog-animal-filters T2 live check (S1–S3)
Vite on :5199 (stopped), API http://localhost:3003, /catalogo/centro, headless Chromium 1440 and 390. Nothing was submitted.

Limitation: the dev API has no `animal.target` facet for «centro» (price contexts PUBLICO/Mayoreo do not require
published editorial data → `facets.attributes` absent, `facet=` answers 400 FACET_NOT_AVAILABLE). mock.mjs augments the
real products response with the facet from the owner's data (tasks L2, +8 extra fish for the «Ver más» scenario) and a
«Control de desechos» category; product lists are the real ones, truncated to the mocked totals.

Scripts: default.mjs (S1), flow.mjs (S2), s3.mjs, s4.mjs, s5.mjs, overflow.mjs, reveal.mjs, reveal2.mjs. `PATCH=1` injects
`.catalog-animal{grid-template-columns:minmax(0,1fr)}` to show the behaviour with the phone overflow defect fixed.
Screens in shots/ (design-0x.png = design canvases).
