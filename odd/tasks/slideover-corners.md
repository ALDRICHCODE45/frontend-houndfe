# Slideover corners look broken («esquinas partidas»)

## Specs
- S1 Owner (2026-11-27, verbatim): «una cosa que estoy notando y es algo rara es que en varios slideOvers del sistema pasa esto: [captura] y es que las esquinas del slideOver estan como "partidas" como que les faltan las "puntas" no se si lo alcanzas a ver, eso pasa en varios slideOvers del sistema, revisalo por favor.»
- S2 Root cause (explore mwzlnb85-u-96kx): Nuxt UI USlideover `content` gets `rounded-lg` when `inset` (12px under `.hf-ui`) or `rounded-t-2xl` sheets on mobile (16px), but NO `overflow-hidden`; `vite.config.ts:114-219` has no `slideover` entry (only `card` gets `rounded-lg overflow-hidden` ~:198). Opaque square-cornered first/last children (custom header/footer bars `bg-default`, shared `.hf-ui .hf-save-bar` `hf-form.css:890`, `.order-header` `purchase-orders-visual.css:14`, `DataTableFilters.vue:257,353`, `CustomerCollectionSlideover.vue:719`) paint over the curve. ~26 inset slideovers affected.
- S3 Fix in one place: slideover content clips its children (e.g. `slideover: { slots: { content: 'overflow-hidden' } }` in vite.config.ts), without cutting content: every slideover whose own scroll was on the panel must get an inner scroller first. Guard test.

## Tasks
- [x] T1 S2-S3 Root fix + per-slideover scroll audit + guard — worker
- [x] T2 Full suite, preview, owner check, merge — parent

## Log
- L1 Owner S1 (2026-11-27); diagnosis S2. Owner chose a separate branch after the ideas merge.
- L2 T1 (worker mwzlzoho-v-yi7i): `vite.config.ts` Nuxt UI `slideover.slots.content: 'overflow-hidden'` (merges with `:ui.content`, so mobile rounded-t-2xl sheets too). Audit of 40 slideovers: none scrolls on the panel; Nuxt overlays portal (no `:portal="false"`); inline menus only in CategorySelect/SatKeySelect inside an already-scrolling body. DataTableToolbar mobile Filtros sheet capped (`max-h-[calc(100svh-2rem)] min-h-0`) so the footer is not clipped. Guards: hf-slideover-corners.spec.ts (config, inset mount, mobile sheet mount, source scan) + DataTableFilters.corners.spec.ts. RED 4 + toolbar → GREEN; core/shared 1528; all slideover families 9877; related 2119; type-check clean. Needs browser check (jsdom does not paint).
- L3 Full suite 1165 files / 19225 tests green (9414661f); build OK; preview :4173. Waiting for owner check.
- L4 Owner (2026-11-27): «merge.» Merged to local main.
