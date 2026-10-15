# Sistema settings (Notificaciones + Catálogo en línea) — design-system adaptation

Adapt the two Sistema settings screens to docs/design-system.md keeping their sections, fields and save flows: canonical page header outside the content, light/dark boundary with themed menus/dialogs, centered at Caja's 1320px width. Pedidos stays paused.
Branch: `feat/system-settings-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Bien hermano, ahora notificaciones y por ultimo catalogo en linea (las ordenes quedan pausadas hermano por ahora)". User choice: "Adaptación + encabezado canónico, 1320px (Recomendado)" — "Título y subtítulo arriba sobre el fondo (como el resto del sistema; Notificaciones hoy no tiene título), mismas secciones, campos y botón Guardar, tema claro/oscuro con menús y modales, centrado con el ancho de Caja."
S2. Notificaciones (/sistema/notificaciones): new hf-page-header ("Configuración de notificaciones" / "Elige quién recibe notificaciones y qué acciones las disparan."), the three section cards (master, recipients, actions) with owned surface hooks, save footer unchanged; recipient USelectMenu themed; mx-auto max-w-[1320px].
S3. Catálogo en línea: hf-page-header with the existing title/description outside the settings surface, same form/read view/footer, publish ConfirmModal and both price-list USelectMenu themed; mx-auto max-w-[1320px].

## Tasks

T1 | S2 | inline: Notificaciones header + boundary + sections + recipient menu, RED/GREEN | done | RED 4 contract -> GREEN notifications 259/15, lint exit0, build exit0 | commit: see L3
T2 | S3 | inline: Catálogo en línea header + boundary + modal + selects, RED/GREEN | done | RED 3 contract + 1 view -> GREEN catalog-settings 175/12, lint exit0, build exit0 | commit: see L4
T3 | S1-S3 | inline checks: suites, build, lint, native assess; user visual smoke | pending | commit: —

## Log

L1. User request verbatim: "Bien hermano, ahora notificaciones y por ultimo catalogo en linea (las ordenes quedan pausadas hermano por ahora)". Answer: "Adaptación + encabezado canónico, 1320px (Recomendado)".
L2. Map: NotificationConfigView has no page title (root 'flex flex-col gap-6 p-6'), three <section> cards with semantic utilities, sticky save footer; RecipientSelect USelectMenu (multiple); copy.ts has no page title (masterLabel "Notificaciones" names the master switch). TenantCatalogSettingsView is a UCard with icon header + form/read view + footer and a publish ConfirmModal; CatalogPriceContextsField has 2 USelectMenu.
L3. T1: styles/notifications-visual.css (palette for notifications-visual / notifications-form-portal + notifications-section surface hook); NotificationConfigView root hf-theme hf-ui notifications-visual mx-auto max-w-[1320px] with a new hf-page-header (copy pageTitle/pageSubtitle added to copy.ts), the 3 section cards + loading skeleton cards use the section hook, footer unchanged; RecipientSelect USelectMenu form portal. RED 4 contract -> GREEN notifications 259/15; lint changed files exit 0; pnpm build exit 0.
L4. T2: styles/catalog-settings-visual.css (palette for catalog-settings-visual / catalog-settings-form-portal + catalog-settings-surface hook); TenantCatalogSettingsView wraps everything in hf-theme hf-ui catalog-settings-visual mx-auto max-w-[1320px], the title/description moved out of the UCard #header into hf-page-header (store icon dropped with the card header), card body/footer unchanged, publish ConfirmModal form portal; CatalogPriceContextsField 2 USelectMenu form portal; view formatted with prettier. View spec 'header title and description are descendants of the card' replaced by 'title and description in the page header, outside the card' (requested change). RED 3 contract + 1 view -> GREEN catalog-settings 175/12; lint exit 0; pnpm build exit 0.
L5. Native assess ebff755e..f1bcc1c2: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
