# dashboard-visual

Adapt the admin sales dashboard (`BranchSalesSummaryView`, route `/dashboard`) to the
accepted v0 redesign, preserving every existing behavior, query, permission and data state.
Reference source (authoritative for composition, geometry and motion):
`docs/redesign/dashboard-v0-reference.md`.

## Specs

**S1 — Authorized scope.** The user asked: "quiero redisenar por completo el dashboard
administrativo que existe actualmente"; the accepted reference is the v0 chat
`https://v0.app/bdps-projects/chat/ps6ftjVkTIL`, whose exported source is committed verbatim in
`docs/redesign/dashboard-v0-reference.md`. Presentation only. Do not add, remove or reinterpret actions,
permissions, validation, calculations, filters, navigation or data states. No metric may be
computed, summed, rounded or compared in the browser. v0's demo fixtures, demo toolbar, demo state switcher, theme toggle button and
`public/*` assets are NOT adopted: the application already owns real queries, a real theme
toggle and real permissions.

**S2 — Motion is a first-class requirement.** The user said: "me gusta mucho las animaciones
que tiene, tanto de inicio, en las graficas, los skeletons en los estados de loading, etc...
todos los detalles los quiero, por favor. revisa bien el codigo, las graficas tienen
animaciones de carga, animaciones de hover, cuando hago hover aparecen datos, etc.. los
numeros aparecen con una animacion, etc.. por favor." Every motion listed in S7 is part of
the deliverable, not optional polish.

**S3 — No new dependency.** `docs/design-system.md` authorizes no new library. framer-motion
and recharts are NOT added. Charts stay on the installed `@unovis/vue`; number tweening uses
the installed `@vueuse/core`; entry, hover, indicator and stagger motion use CSS transitions
and animations declared in the feature stylesheet.

**S4 — Page composition** (reference sections `components/sales-dashboard.tsx` and
`app/globals.css`).
Page header lives on the page background, outside every surface: a gold-square eyebrow
`CONTROL DE VENTAS`, `h1` "Resumen de ventas" (30px/650/-1.1px), the existing subtitle
"Ventas, cobros y reembolsos de la sucursal en el periodo seleccionado.", and on the right the
period block: a calendar icon line `1 oct – 15 oct 2026 · Periodo seleccionado`, the preset
segmented control and the custom-range trigger. Content is a 1320px centered column with 24px
gaps. Page footer: `HoundFe / Resumen de ventas` and
`Todos los importes en MXN · Hora de Ciudad de México`. The existing single wrapping `UCard`
is replaced by independent 12px panels on the page background.

**S5 — Metrics.** Hero panel (min-height 201px, 28px/32px padding): icon tile, `h2`
"Ventas netas", 48px value with a 12px `MXN` suffix, a `Del <from> al <to> de <year>` line, and
a 120px area sparkline occupying 55% width with the first and last visible dates under it. Then
a 5-column grid (12px gap) of metric cards (20px padding, min-height 147px) for
"Ventas brutas", "Cobrado", "Deuda pendiente", "Cantidad de ventas", "Ticket promedio", each
with a Lucide icon, 12px label, 25px value and a 30px sparkline at 0.6 opacity. "Deuda
pendiente" paints label, value and a dot in the warning role. "Cantidad de ventas" renders as
an integer count, never currency. Then the refunds group: a `Reembolsos` heading with
`Separados de las ventas del periodo` and a 2-column band with "Reembolsos liquidados" and
"Obligaciones de reembolso pendientes" (warning role). Refunds have NO sparkline. All six
sparklines read the already-fetched daily timeseries, one metric each, in backend order.

**S6 — Trend panel** (reference section `components/sales-chart.tsx`).
Heading "Tendencia diaria" / "El comportamiento de tus ventas, día a día." with a chart icon. A six-tab metric selector in the existing backend order
("Ventas netas" default). Gradient area (0.16 → 0.01) + 2.5px line, horizontal-only dashed
gridlines, X axis with date labels, Y axis 58px wide formatted `$0` / `$2.5k` (plain integers
for "Cantidad de ventas"), a dashed vertical cursor on hover, a tooltip with the full date and
the exact value, and a 5px active dot. The keyboard contract is preserved: the chart region is
focusable, arrows move day by day and announce the value. Footer keeps the existing caption
`<metric> por día del <from> al <to> (Hasta excluyente)` and the `Ver datos en tabla` toggle
revealing the full date/value table.

**S7 — Motion inventory.** Header, metrics, trend and panels fade+rise (`opacity 0 → 1`,
`y 8–10px → 0`) staggered at 0, 50, 100 and 150ms, once per mount. Metric values tween to their
new value over 500ms, formatted on every frame, integers stay integers. The preset indicator
and the chart-tab indicator slide between options (~250ms / 200ms). Metric cards lift 2px on
hover, their border takes the action color and their sparkline goes to full opacity. Chart and
sparkline series draw in over 500ms. Operational rows fade in staggered 45ms apart. Refreshing
content drops to 0.6 opacity over 200ms. Retry buttons show a spinner and stay disabled while
retrying. `prefers-reduced-motion` removes every one of these: no tween, no draw-in, no
stagger, no slide.

**S8 — States, unchanged in meaning.** Each block keeps its own independent loading, refresh,
stale, error, empty and ready state, with the existing copy. Initial loading renders skeletons
inside the final geometry with the existing screen-reader messages. The refresh note is
"Actualizando el resumen…". The stale banner is "No pudimos actualizar el resumen; se muestran
los últimos datos disponibles." with "Reintentar". Error copy stays status-driven: 400 →
"El servidor rechazó el rango de fechas. Ajusta el periodo e inténtalo de nuevo.", 403 →
"No tienes permiso para consultar el resumen de ventas de esta sucursal.", fallback →
"No pudimos cargar el resumen de ventas. Reintenta en unos segundos." Empty keeps
"Sin actividad en el periodo" / "No se registraron ventas ni reembolsos para el rango
seleccionado." with the v0 inbox-icon composition. The invalid-range copy and the per-panel
loading/empty/error copy are unchanged. Permission gating stays `read:Sale` / `read:SaleRefund`
through `userCan`, and the operational grid must look intentional with 3, 2, 1 or 0 panels.

**S9 — Period controls.** The four presets "Hoy", "Últimos 7 días", "Este mes", "Mes anterior"
keep `getMexicoCityRangePreset` as the only boundary source, "Este mes" stays the initial
selection, and a manual edit still clears the selection while preserving the exact edited
strings. The two date fields move into the custom-range popover with their existing labels
"Desde (incluyente)" / "Hasta (excluyente)" and the helper "El rango incluye el día «Desde» y
excluye el día «Hasta»." Validation and query behavior are unchanged.

**S10 — Foundation and themes.** Use the `--hf-*` semantic roles through a feature-owned
`dashboard-visual` boundary; v0's literal hex values are the same palette and must not be
re-declared as literals. Light and dark are a pair, both verified. Teleported content (the
range popover) carries the feature theme boundary. Every `UCard` that survives gets a
feature-owned section hook. 12px panels, 6px controls, 44px minimum control height, tabular
numerals, Manrope.

**S11 — Responsive.** No horizontal page overflow at 390px, 834px or 1440px. The metric grid
collapses, the preset group scrolls horizontally, the operational grid stacks, and the chart
stays inside its panel.

## Tasks

| ID | Specs | Route | Status | Commit |
| -- | ----- | ----- | ------ | ------ |
| T0 | S1 | inline: branch, feature doc, v0 reference committed | done | 2766d27e |
| T1 | S4, S9, S10 | worker: page shell, header, period controls, feature stylesheet | done | 0968ea17 |
| T2 | S5, S7 | worker: hero, metric grid, sparklines, refunds band | done | 9604f050 |
| T3 | S6, S7 | worker: trend panel rebuilt on Unovis | done | 0f1de9da |
| T4 | S8, S7 | worker: operational panels and shared state blocks | done | 44970297 |
| T5 | S7, S11 | inline: reduced motion, responsive sweep, full checks | done | 25099ef4 |
| T6 | all | inline: close, docs, user visual smoke | in progress | — |

## Log

**L1 — user request (verbatim).**

> Listo hermano, estas son todas las capturas que pude tomar del rediseno del dashboard: [18 screenshots] y este es el chat: https://v0.app/bdps-projects/chat/ps6ftjVkTIL me gusta mucho las animaciones que tiene, tanto de inicio, en las graficas, los skeletons en los estados de loading, etc... todos los detalles los quiero, por favor. revisa bien el codigo, las graficas tienen animaciones de carga, animaciones de hover, cuando hago hover aparecen datos, etc.. los numeros aparecen con una animacion, etc.. por favor.

Earlier in the same session the user asked for the v0 brief:

> quiero redisenar por completo el dashboard administrativo que existe actualmente [...] Quiero algo distinto, lo actual no me gusta la verdad, quiero mas movimiento, quiero mas interaccion, esos pequenos detalles que hacen la diferencia en ux/ui, algo moderno, algo limpio, minimalista

**L2 — backend.** The user anticipated backend work ("puede ser que necesitemos algo del
backend"). The accepted reference needs none: v0 dropped the three optional proposals
(period-over-period delta, metric→chart linking, "Ver todas" navigation), so every value on
screen already comes from `/analytics/sales/summary`, `/analytics/sales/timeseries` and the
existing sales/refund queries. No backend request is opened.

**L4 — slice boundaries.** Each task commits as its own work unit, around 400 authored lines.
`2766d27e` is documentation: its 2390 lines are the verbatim v0 reference, external material
read as one reference rather than reviewed line by line, plus the specs above. `0968ea17` is
~370 authored lines of code. T2, T3 and T4 own disjoint files so they stay separately
reviewable: T2 and T3 therefore get their own stylesheets (`dashboard-metrics.css`,
`dashboard-trend.css`) instead of sharing `dashboard-visual.css`.

**L5 — shell gutter defect found in T1 readback.** The worker copied the reference's
`padding: 52px 40px 76px` and `background: var(--hf-page)` onto the page root. The dashboard
shell body already pads routed pages (`p-4 sm:p-6` in `vite.config.ts`) and already paints the
page plane through `.hf-shell-workspace`, so that stacked into doubled gutters and a color seam
inside the shell padding — the same defect `docs/design-system.md` records for Venta. Fixed
before the commit: the root is transparent and adds only the remainder (12px/0/14px, 28px/16px/52px
from `sm`), pinned by a stylesheet contract.

**L6 — axis tick defect found in T3 readback.** The worker inlined the Y-axis label as
`$${tick / 100_000}k`. The cents-to-thousands conversion is right, but a chart tick is whatever
the library picks for the current domain, so a non-round tick printed a long decimal tail
(`$1.23456k`). Fixed test-first: `formatBranchSalesTimeseriesAxisTick` in
`branchSalesTimeseries.utils.ts` now rounds to one decimal and drops a fractional count tick,
with unit tests covering 0, round, non-round and count ticks. Two RED tests were observed
before the implementation.

**L7 — panel grid defect found in T5 sweep.** T4 wrote
`grid-template-columns: repeat(min(2, var(--dashboard-panel-count)), minmax(0, 1fr))` for the
narrow tier. `repeat()` takes a literal integer and browsers do not resolve a math function as
its track count, so the declaration would be dropped and tablet would keep the desktop column
count. Fixed test-first: the view renders `data-panel-count` and the narrow tier selects on it;
two RED tests were observed before the fix.

**L8 — T5 checks.** 302 analytics tests pass; `vue-tsc --build` exits 0; `vite build` succeeds.
All four feature stylesheets carry a `prefers-reduced-motion` branch and `1190px` / `700px`
tiers. The only consumers outside `src/features/analytics` are the router's route registration
and its spec, both unchanged. Lint is unchanged debt: `oxlint src/features/analytics` reports 35
pre-existing errors against 36 on `origin/main`, all in test files and none introduced here.

**L9 — pre-existing suite flake, not a regression.** Running `src/app` together with
`src/features/analytics` times out `router.humanDecisions.spec.ts` ("resolves exact route,
dashboard layout and read:HumanDecision with no extra gates", 5000ms). A differential check
reproduced the identical failure on `origin/main` in a scratch worktree, and the spec passes when
`src/app` runs alone (316/316) and alongside analytics on its own (306/306). It is a test
isolation/load problem that predates this feature; it is recorded, not fixed here.

**L3 — library decision.** v0 ships framer-motion + recharts. `docs/design-system.md`
authorizes no new library, so the adaptation keeps `@unovis/vue` for charts, `@vueuse/core`
for number tweening, and CSS for entry/hover/indicator/stagger motion (S3).
