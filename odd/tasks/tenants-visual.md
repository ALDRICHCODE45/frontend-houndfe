# Sucursales — design-system adaptation

Adapt Gestión de sucursales (`/admin/tenants`) and Miembros del tenant (`/admin/tenants/:id/miembros`) to the canonical table workspace of docs/design-system.md §4, with their row menus, confirmations and slideovers themed. No v0.
Branch: `feat/tenants-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Bien hermano, pasemos a lo siguiente, sucursales por favor." Same treatment the user approved for Usuarios and Roles.
S2. Both views: hf-page-header (existing titles and descriptions) outside one hf-table-surface; no AdminPageHeader, no bg-coco-neutral; tenants light/dark boundary; toolbar/pagination/row-menu list portals; view toggle content-sized; cards restrained via owned hooks. Members keeps its subtitle loading skeleton while the tenant name loads and its "No tienes acceso" block inside the surface.
S4. User request: "lo unico que hay que corregir es el filtro de \"mostrar inactivos\" vamos a cambiarlo a un swithch por favor." The "Mostrar inactivos" filter is a USwitch and the toolbar 44px control rule does not stretch switches/checkboxes.
S3. ConfirmModals, TenantUpsertSlideover and MembershipUpsertSlideover (+ 2 USelectMenu) carry the form portal. No change to columns, filters, gating, super-admin rules or mutations.

## Tasks

T1 | S2,S3 | inline: both views + adapter CSS + portals + cards + slideovers, RED/GREEN | done | RED 6 contract -> GREEN tenants 297/23, build exit0 | commit: see L2
T3 | S4 | inline: Mostrar inactivos switch + toolbar rule exemption, RED/GREEN | done | RED 4 -> GREEN tenants 298/23, build exit0 | commit: see L5
T2 | S1-S4 | inline checks: module suite, build, lint, native assess; user visual smoke | done | user approved visually ("Bien hermano, me gusta"); tenants 298/23 (scoped), build exit0 | commit: see L6

## Log

L1. User request verbatim: "Bien hermano, pasemos a lo siguiente, sucursales por favor." Map: AdminTenantsView and AdminTenantMembersView wrap AdminPageHeader + AppDataTable in a UCard painted bg-coco-neutral; members header uses AdminPageHeader loading (USkeleton) while the tenant name loads; row UDropdownMenu, ConfirmModal each; TenantUpsertSlideover, MembershipUpsertSlideover (2 USelectMenu); TenantCard/MemberCard hover translate/shadow. Both view tests pin admin-page-header (updated as a requested change).
L2. T1: styles/tenants-visual.css derived from the users adapter; AdminTenantsView and AdminTenantMembersView canonical header outside hf-table-surface (titles "Gestión de sucursales" / "Miembros del tenant", existing descriptions; members keeps a USkeleton subtitle while isLoadingTenantName and the "No tienes acceso" block inside the surface), AdminPageHeader + bg-coco-neutral removed, list portals on AppDataTable + row menus, view toggle hooks, ConfirmModals form portal; TenantCard/MemberCard + grids owned hooks; TenantUpsertSlideover and MembershipUpsertSlideover (+2 USelectMenu) form portal. Tests: both admin-page-header assertions updated to the canonical header; AdminTenantMembersView.spec 'no duplicated outer header' asserted no h1 at all, now asserts exactly one h1.hf-page-title and the title once (same intent, requested header change). RED 6 contract -> GREEN tenants 297/23; pnpm build exit 0. Lint: 7 pre-existing errors on HEAD in touched files (no-explicit-any x4 in AdminTenantMembersView.spec, @ts-nocheck x2 in the view tests, unused CreateTenantFormValues in AdminTenantsView) left out of scope.
L3. Native assess cc9065cc..f388031a: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
L4. User verbatim: "Bien hermnao: /home/aldrich_coder45/Pictures/Screenshots/Screenshot_2026-10-14-18-51-04_5360x2520.png pero lo unico que hay que corregir es el filtro de \"mostrar inactivos\" vamos a cambiarlo a un swithch por favor." Screenshot showed the checkbox stretched: the copied toolbar rule '.tenants-visual .hf-toolbar :where(button, input, [data-slot=root])' gave the checkbox button min-height 44px (regression from T1).
L5. T3: UCheckbox -> USwitch (same v-model/label); toolbar rule now :not([role='switch'], [role='checkbox']). The same rule exists in other adapters but none has a switch/checkbox in its toolbar; left unchanged. Three view tests moved from role=checkbox to role=switch (requested change) + contract spec. RED 4 -> GREEN tenants 298/23; pnpm build exit 0.
L6. User verbatim: "Bien hermano, me gusta, commit, merge y yo pusheo". pi-lens again reported 385/420 from its unscoped run (stale copies under artifacts/** and .worktrees/**, reproduced earlier); scoped tenants suite 298/23. Feature closed; fast-forward merged to main; push by the user.
