# Delivery routes manager table

Rebuild the manager listing of `/pos/rutas-de-entrega` on the canonical table workspace (docs/design-system.md §4) and add the missing capabilities.
Branch: `feat/delivery-routes-table`. Driver branch (`DriverRouteCard` list) and `DeliveryRouteDetailView` stay untouched. Work-unit commits per task; push/merge decided by the user.

## Specs

S1. Exact request: "hay que seguir con rutas de entrega hermano, pero esa tabla de por si ya esta mal hecha, le faltan muchas cosas, hay que hacerla bien, siguiendo tu system design por favor."
S2. Open detail + real search and sort (user selected "Abrir detalle + búsqueda y orden reales": "Clic en la fila abre la ruta; la búsqueda (repartidor, cliente, folio de venta) y el orden funcionan de verdad (en el cliente, el backend ya manda la lista completa)."). The full list is fetched once and cached; search/sort/pagination never refetch per keystroke.
S3. Status filter (user selected "Filtro por estado": "Pestañas o filtro Borrador / Activa / Completada / Cancelada, con conteos.").
S4. More columns (user selected "Más columnas": "Fecha de creación (del timeline), inicio/fin, clientes de las paradas, barra de progreso, notas.").
S5. Complete row actions (user selected "Acciones completas en la fila": "Ver, Editar, Iniciar, Cancelar, Eliminar con las mismas reglas y confirmaciones que ya tiene el detalle."). Gates equal DeliveryRouteDetailView: Edit DRAFT+update; Start DRAFT+≥1 stop+update; Cancel DRAFT|ACTIVE+update; Delete DRAFT+0 stops+delete. Existing confirm copy, mutations, toasts and 409 handling are reused.
S6. Card view (user selected "Sí, con tarjetas": "Mismos datos y acciones que la tabla, preferencia guardada como en los demás módulos.").
S7. Identifier (user selected "Derivado en el front (Recomendado)": "Ej.: “Ruta del 13 oct · Juan Pérez” con el UUID corto como dato secundario. Sin tocar backend.").
S8. Design system: heading outside `hf-table-surface`, feature-owned light/dark stylesheet, theme markers on every teleported surface, no prototype controls, behavior of create flow and driver branch preserved.

## Tasks

T1 | S2,S3,S4,S7 | inline: pure list utils (display name, created date, customers, search, status filter + counts, sort, paginate) + cached full-list table composable, RED/GREEN | done | RED utils module missing + 4 composable fails -> GREEN module 969/41 exit0 | commit: 26518eba
T2 | S5 | inline: gated row-action builder mirroring detail gates (Ver/Editar/Iniciar/Cancelar/Eliminar), RED/GREEN | done | RED 7 fail -> GREEN module 976/41 exit0 | commit: 3765eeb1
T3 | S2-S8 | inline: list view on canonical workspace (header, tabs with counts, columns, row click, actions + confirm/edit wiring, card grid + view toggle, stylesheet/portals), RED/GREEN | done | RED 14 fail -> GREEN module 988/41 exit0, build exit0 | commit: 3086848c
T4 | S1-S8 | inline checks: focused + module suites, build, lint; native assess; user visual smoke | in progress (waiting user visual smoke) | commit: —

## Log

L1. User request verbatim: "hay que seguir con rutas de entrega hermano, pero esa tabla de por si ya esta mal hecha, le faltan muchas cosas, hay que hacerla bien, siguiendo tu system design por favor."
L2. Findings before planning: manager rows cannot open detail; `paginateDeliveryRoutes` ignores globalFilter and sorting; default sort `updatedAt` does not exist on the DTO; identifier is a truncated UUID; DTO has no createdAt (derive from timeline ROUTE_CREATED); only Start in row kebab; no status filter, cards, or page header. `useServerTable` appends params to the query key, so the full list must be cached separately to avoid refetching per keystroke.
L3. User answers: capabilities = all four options; cards = "Sí, con tarjetas"; identifier = "Derivado en el front (Recomendado)".
L4. T1 done: RED (utils module missing, 4 new composable tests failing) -> GREEN delivery-routes 969 tests/41 files exit 0. Query key now listPrefix + status tab (prefix invalidation contract kept; test updated). Full list cached via queryClient.fetchQuery under listPrefix/'full-list' (staleTime 30s). Pre-existing @ts-nocheck lint error and spec formatting left untouched. Commit 26518eba.
L5. T2 done: buildDeliveryRouteListActions (view always; edit DRAFT+update; start DRAFT+stops+update; cancel DRAFT|ACTIVE+update; delete empty DRAFT+delete), copy actions.view 'Ver detalle'. RED 7 failing -> GREEN 976/41 exit 0. Pre-existing prettier failures in touched files left. Commit 3765eeb1.
L6. T3 done: view rebuilt; RED 14 failing (start-confirm, create/409 and driver tests kept passing) -> GREEN 988/41 exit 0; pnpm build exit 0; eslint 0. Old START-only kebab tests rewritten to the requested full-menu contract. AppDataTable has no row-click event, so the derived route name is the link to the detail (plus "Ver detalle" in the menu) instead of changing the shared table. formatRouteDateTime added with its test without an observed RED. View/spec prettier failures pre-existing at HEAD left. Commit 3086848c.
L7. T4: module suite 988/41 exit 0, pnpm build exit 0, eslint 0 on touched files (pre-existing @ts-nocheck error in useDeliveryRoutesTable.spec.ts untouched). Native assess c8142965..c94731ef: medium, reviewDue false, no independent verifier required. Pending: user visual smoke (light/dark, tabs, cards, menus, confirmations, edit slideover).
