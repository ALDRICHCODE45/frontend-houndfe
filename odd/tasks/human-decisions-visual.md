# Solicitudes (chatbot human decisions) — design-system adaptation

Adapt the Chatbot "Solicitudes" inbox (`/pos/decisiones-pendientes`, HumanDecisionsListPanel shared with the offline demo) to the canonical table workspace of docs/design-system.md §4, with the detail drawer and both resolution confirmations themed. No v0.
Branch: `feat/human-decisions-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "si hermano, perfecto, me encanta, pero se nos olvido un rediseno, las solicitudes del chatbot." Same treatment the user approved for the other table screens.
S2. HumanDecisionsListPanel: hf-page-header ("Solicitudes" + existing description) outside one hf-table-surface; no TableHeaderDescription in the card, no bg-coco-neutral; human-decisions light/dark boundary on the panel root (covers the offline demo too); toolbar/pagination list portals; Estado USelect list portal; view toggle content-sized; mobile cards owned hooks.
S3. Detail AppResponsiveDrawer (via portalClass) and the two resolution ConfirmModals carry the form portal. No change to columns, filters, resolution flows, permissions or data. Every teleporting control is covered by a scanning contract.

## Tasks

T1 | S2,S3 | inline: panel workspace + adapter CSS + portals + drawer + confirmations + cards, RED/GREEN | done | RED 5 contract -> GREEN human-decisions 254/20, lint exit0, build exit0 | commit: see L2
T2 | S1-S3 | inline checks: module suite, build, lint, native assess; user visual smoke | done | user approved visually ("si hermano, me gusta mucho"); human-decisions 254/20, build exit0 | commit: see L4

## Log

L1. User request verbatim: "si hermano, perfecto, me encanta, pero se nos olvido un rediseno, las solicitudes del chatbot." Nav: Chatbot > Solicitudes -> /pos/decisiones-pendientes (HumanDecisionsView). Inventory: HumanDecisionsListPanel (UCard bg-coco-neutral + TableHeaderDescription "Solicitudes", AppDataTable, Estado USelect, ViewToggle, HumanDecisionCard/ResolvedHumanDecisionCard mobile cards), HumanDecisionDetailSlideover (AppResponsiveDrawer), HumanDecisionResolutionControls + ExpirationDecisionResolutionControls (ConfirmModal each). Panel test pins 'article header' contains 'Solicitudes' (updated as a requested change).
L2. T1: styles/human-decisions-visual.css derived from the tenants adapter (palette for the three markers, toolbar/pagination hooks with the switch/checkbox exemption, mobile card hook); HumanDecisionsListPanel root hf-theme hf-ui human-decisions-visual with hf-page-header ("Solicitudes" + existing description) outside hf-table-surface, TableHeaderDescription + bg-coco-neutral removed, list portals on AppDataTable + Estado USelect, view toggle hook (panel formatted with prettier); HumanDecisionDetailSlideover portal-class through AppResponsiveDrawer; both resolution ConfirmModals form portal; mobile cards owned hook. Scanning contract covers every component. Panel spec heading test moved from 'article header' to .hf-page-title/.hf-page-subtitle outside the card (requested change). RED 5 -> GREEN 254/20; lint exit 0; pnpm build exit 0.
L3. Native assess babe06a5..0f36d4fc: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
L4. User verbatim: "si hermano, me gusta mucho, commit, merge y yo push." Feature closed; fast-forward merged to main; push by the user. Remaining unmigrated: Pedidos (paused by the user).
