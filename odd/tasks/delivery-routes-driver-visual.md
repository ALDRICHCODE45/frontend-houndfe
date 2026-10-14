# Delivery routes driver views — visual adaptation

Adapt the driver surfaces of `/pos/rutas-de-entrega` (active-route list and the route-tracking cockpit) to docs/design-system.md without changing composition or behavior.
Branch: `feat/delivery-routes-driver-visual`. Manager detail view is a later slice. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Si hermano, me gusta mucho, adaptaste tambien la vista del repartidor?? me refiero a toda la vista, la del seguimiento de la ruta tambien."
S2. User choices: "Adaptación (Recomendado)" — "Misma composición y flujo que ya tienen (el cockpit es una pantalla móvil especializada, ya rediseñada), solo el sistema visual: tokens, tema claro/oscuro, portales, botones. Sin v0." and "Repartidor primero" — "Lista \"Mis rutas activas\" + cockpit de seguimiento de la ruta."
S3. Driver list and cockpit opt into the delivery-routes theme boundary (light/dark); teleported drawer (mobile UDrawer and desktop USlideover), header menu and check-in ConfirmModal carry an owned portal marker while keeping their existing `ui` behavior classes.
S4. Legacy coco gold/navy paint is replaced by semantic roles: primary check-in actions use the shared action pairing; current/next stop emphasis uses active (pending) and warning (in progress) roles; progress fill uses success. No change to copy, events, gating, sequencing, breakpoints or sticky regions.

## Tasks

T1 | S3,S4 | inline: theme boundary + portal markers + semantic paint across driver list and cockpit, RED/GREEN | in progress | commit: —
T2 | S1-S4 | inline checks: module suite, build, lint, native assess; user visual smoke (mobile + desktop, light/dark) | pending | commit: —

## Log

L1. User request verbatim: "Si hermano, me gusta mucho, adaptaste tambien la vista del repartidor?? me refiero a toda la vista, la del seguimiento de la ruta tambien."
L2. User answers: merge table now ("Sí, mergeá ya (Recomendado)"), "Adaptación (Recomendado)", "Repartidor primero". Table merged to main at 9b0b5c32.
L3. Map: cockpit uses semantic utilities (bg-default/border-default/text-muted) that follow hf-ui aliases once a root opts in; legacy coco gold/navy in DriverCockpitDrawer (2 CTAs), DriverCockpitFooter (CTA), DriverOperationalStops (current emphasis), DriverRouteSummary (progress fill), DriverStopCard (current border, sequence, next badge, CTA). Teleports: UDrawer/USlideover (drawerUi/slideoverUi), header UDropdownMenu, ConfirmModal. Existing specs assert coco classes in DriverOperationalStops and DriverCockpitFooter; they move to the owned hooks.
