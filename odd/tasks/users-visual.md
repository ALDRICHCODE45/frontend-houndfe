# Users — design-system adaptation

Adapt Gestión de usuarios (`/admin/users`) to the canonical table workspace of docs/design-system.md §4 with its teleported menu, confirmation, create/edit slideover and the seller sales report drawer themed. No v0.
Branch: `feat/users-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Me gusta hermano, pasemos con usuarios por favor." Same treatment the user approved for Colaboradores: canonical table workspace, no v0.
S2. AdminUsersView: hf-page-header (title "Gestión de usuarios", subtitle = existing tenant description) outside one hf-table-surface; no AdminPageHeader, no bg-coco-neutral; users light/dark boundary; toolbar/pagination/row-menu portals; view toggle content-sized; cards restrained via owned hooks.
S3. Teleports opened from the list carry the form portal: delete ConfirmModal, UserUpsertSlideover and its two USelectMenu, the seller report drawer (via AppResponsiveDrawer portalClass) and its two date popovers. No change to columns, search, roles, actions, permissions, report data or PDF flow.

## Tasks

T1 | S2,S3 | inline: list workspace + adapter CSS + list portals + cards + confirm + upsert slideover, RED/GREEN | done | RED 5 contract -> GREEN users 287/17 | commit: see L2
T2 | S3 | inline: seller report drawer portalClass + date popovers, RED/GREEN | done | RED 2 contract -> GREEN users 287/17, lint exit0, build exit0 | commit: see L2
T3 | S1-S3 | inline checks: module suite, build, lint, native assess; user visual smoke | pending | commit: —

## Log

L1. User request verbatim: "Me gusta hermano, pasemos con usuarios por favor." Map: AdminUsersView wraps AdminPageHeader + AppDataTable in a UCard painted bg-coco-neutral; row UDropdownMenu, ConfirmModal, UserUpsertSlideover (2 USelectMenu), SellerSalesReportDrawer on AppResponsiveDrawer (supports portalClass) with SellerReportDateRangeFilter (2 UPopover); UserCard uses hover translate/shadow.
L2. T1+T2 (one work-unit commit, shared contract spec): styles/users-visual.css derived from the employees adapter (palette for users-visual / users-list-portal / users-form-portal, toolbar/pagination/card hooks); AdminUsersView canonical header outside hf-table-surface (title "Gestión de usuarios", subtitle = existing headerDescription), AdminPageHeader + bg-coco-neutral removed, list portals on AppDataTable + row menu, view toggle hook, delete ConfirmModal form portal; UserCard/UserCardGrid owned hooks; UserUpsertSlideover slideover + 2 USelectMenu form portal; SellerSalesReportDrawer portal-class through AppResponsiveDrawer; both date UPopover form portal. RED 7 contract -> GREEN users 287/17; lint on changed files exit 0; pnpm build exit 0.
