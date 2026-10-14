# Roles — design-system adaptation

Adapt Gestión de roles (`/admin/roles`) to the canonical table workspace of docs/design-system.md §4 with its row menu, delete confirmation and both slideovers (create/edit, permissions) themed. No v0.
Branch: `feat/roles-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Bien hermano, me gusta, ahora lo que sigue por favor. Roles me parece". Same treatment the user approved for Colaboradores and Usuarios.
S2. AdminRolesView: hf-page-header (title "Gestión de roles", subtitle = existing description) outside one hf-table-surface; no AdminPageHeader, no bg-coco-neutral; roles light/dark boundary; toolbar/pagination/row-menu list portals; view toggle content-sized; cards restrained via owned hooks.
S3. Delete ConfirmModal, RoleUpsertSlideover and RolePermissionsSlideover (keeping its !max-w-2xl width) carry the form portal. No change to columns, search, permissions catalog, gating or mutations.

## Tasks

T1 | S2,S3 | inline: list workspace + adapter CSS + portals + cards + both slideovers, RED/GREEN | done | RED 5 contract -> GREEN roles 122/7, build exit0 | commit: see L2
T2 | S1-S3 | inline checks: module suite, build, lint, native assess; user visual smoke | pending | commit: —

## Log

L1. User request verbatim: "Bien hermano, me gusta, ahora lo que sigue por favor. Roles me parece". Map: AdminRolesView wraps AdminPageHeader + AppDataTable in a UCard painted bg-coco-neutral; row UDropdownMenu, ConfirmModal, RoleUpsertSlideover (USlideover), RolePermissionsSlideover (USlideover with ui.content '!max-w-2xl', semantic inner utilities); RoleCard hover translate/shadow. Existing view test pins admin-page-header (updated as a requested change).
L2. T1: styles/roles-visual.css derived from the users adapter; AdminRolesView canonical header outside hf-table-surface (title "Gestión de roles", subtitle = existing headerDescription), AdminPageHeader + bg-coco-neutral removed, list portals on AppDataTable + row menu, view toggle hook, delete ConfirmModal form portal; RoleCard/RoleCardGrid owned hooks; RoleUpsertSlideover form portal; RolePermissionsSlideover keeps '!max-w-2xl' and adds the form portal. Header view test updated to the canonical header (requested change). RED 5 contract -> GREEN roles 122/7; pnpm build exit 0. Lint: the only finding is a pre-existing '// @ts-nocheck' at line 1 of AdminRolesView.test.ts (present on HEAD), left out of scope.
L3. Native assess 4df64c15..f389f143: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
