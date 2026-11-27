# Slideover corners look broken («esquinas partidas»)

## Specs
- S1 Owner (2026-11-27, verbatim): «una cosa que estoy notando y es algo rara es que en varios slideOvers del sistema pasa esto: [captura] y es que las esquinas del slideOver estan como "partidas" como que les faltan las "puntas" no se si lo alcanzas a ver, eso pasa en varios slideOvers del sistema, revisalo por favor.»
- S2 Root cause (explore mwzlnb85-u-96kx): Nuxt UI USlideover `content` gets `rounded-lg` when `inset` (12px under `.hf-ui`) or `rounded-t-2xl` sheets on mobile (16px), but NO `overflow-hidden`; `vite.config.ts:114-219` has no `slideover` entry (only `card` gets `rounded-lg overflow-hidden` ~:198). Opaque square-cornered first/last children (custom header/footer bars `bg-default`, shared `.hf-ui .hf-save-bar` `hf-form.css:890`, `.order-header` `purchase-orders-visual.css:14`, `DataTableFilters.vue:257,353`, `CustomerCollectionSlideover.vue:719`) paint over the curve. ~26 inset slideovers affected.
- S3 Fix in one place: slideover content clips its children (e.g. `slideover: { slots: { content: 'overflow-hidden' } }` in vite.config.ts), without cutting content: every slideover whose own scroll was on the panel must get an inner scroller first. Guard test.

## Tasks
- [ ] T1 S2-S3 Root fix + per-slideover scroll audit + guard — worker
- [ ] T2 Full suite, preview, owner check, merge — parent

## Log
- L1 Owner S1 (2026-11-27); diagnosis S2. Owner chose a separate branch after the ideas merge.
