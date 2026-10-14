# Delivery routes manager detail — workspace redesign

Recompose the manager branch of `/pos/rutas-de-entrega/:id` (DeliveryRouteDetailView) into a rich workspace on docs/design-system.md, preserving every action, gate, dialog and state.
Branch: `feat/delivery-routes-manager-detail-visual`. Driver branch untouched. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Bien, adelante." (answer to "Lo que sigue en rutas de entrega es el detalle de ruta del encargado ... ¿Seguimos con eso?"). User choices: "Workspace completo (Recomendado)" — "Recomponer el detalle: encabezado rico, KPIs, paradas como lista rica con estado traducido, dirección y hora; timeline e info en columna lateral. Mismas acciones, permisos y modales." and "Directo (Recomendado)" — "Igual que las cards del repartidor: lo armo y vos validás visualmente."
S2. Composition (chosen preview): back link "← Rutas de entrega"; title "Ruta del 14 oct · Juan Pérez" with the status badge; meta line "#9ea3c7b1 · Creada 08:00 · Iniciada 09:40" (plus finish/cancel time when present); action buttons Editar / Iniciar / Cancelar / Eliminar in the header; KPI tiles "Entregadas", "Pendientes", "Omitidas", "En ruta"; progress bar "3 de 8 entregadas"; main column "Paradas" with rich rows (position, customer, folio, translated status badge, address, time, "Mover") and "Agregar parada" (draft); side column "Detalles" (Repartidor, Notas, Fechas) and "Actividad" (timeline).
S3. Preserve behavior: same gating (edit/start/cancel/delete/append/move/reorder), ConfirmModal flow, edit slideover, transfer modal, not-found / error / loading states, existing testids; no API, query or permission change.
S4. Theme: manager detail opts into the delivery-routes theme boundary (light/dark); ConfirmModal and the transfer UModal carry the owned portal marker.
S5. Stop status renders in Spanish with a status tone (today it shows the raw enum, e.g. "PENDING").

## Tasks

T1 | S2,S5 | inline: pure manager detail view model (title, meta, KPIs, stop rows), RED/GREEN | done | RED unresolved import -> GREEN utils 130/5 | commit: see L3
T2 | S2-S5 | inline: recompose manager branch + CSS + portal markers, RED/GREEN, existing detail spec green | done | RED 8 fail -> GREEN 1036/45, lint exit0, build exit0 | commit: see L4
T3 | S1-S5 | inline checks: module suite, build, lint, native assess; user visual smoke (light/dark, draft/active/completed) | pending | commit: —

## Log

L1. User request verbatim: "Bien, adelante." Answers: "Workspace completo (Recomendado)", "Directo (Recomendado)".
L2. Map: manager branch DeliveryRouteDetailView.vue:440-617 — header (short id, badge, driver, x/y), actions toolbar, append section (EligibleSalesPicker), DeliveryRouteReorderPanel (DRAFT), stops list showing raw stop.status, no timeline. ConfirmModal and TransferDeliveryRouteStopModal (UModal) teleport without a marker. DeliveryRouteTimeline is reusable. Existing spec views/__tests__/DeliveryRouteDetailView.spec.ts (1273 lines) pins testids.
L3. T1: utils/delivery-route-detail.utils.ts (buildManagerRouteDetail, DELIVERY_ROUTE_STOP_STATUS_TONES); shared formatRouteMoment / formatDurationMinutes / minutesBetween moved into delivery-route-list.utils.ts and reused by the driver mission util (its spec stays green). RED: spec failed to resolve the module; GREEN utils 130/5.
L4. T2: manager branch recomposed in DeliveryRouteDetailView.vue (root hf-theme hf-ui delivery-routes-visual delivery-routes-detail; back link, title/meta, actions in header with the same gates/testids, KPI tiles, progress bar, stops panel with translated status + time + current marker, append and reorder panels, side Detalles + Actividad with DeliveryRouteTimeline); ConfirmModal and TransferDeliveryRouteStopModal UModal carry the form portal marker; CSS panels repaint the surface role. Existing spec '0/3' assertion updated to the requested sentence "0 de 3 entregadas". Incident: a truncated 50KB read was written back over the detail spec, cutting it; restored from HEAD with git checkout and re-applied the edits by appending (final file 1376 lines = 1273 original + additions). RED 8 failing (7 new + updated progress) -> GREEN delivery-routes 1036/45; lint on touched files exit 0; pnpm build exit 0.
L5. Native assess 3c840881..142666ef: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
