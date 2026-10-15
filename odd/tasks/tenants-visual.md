# Sucursales — design-system adaptation

Adapt Gestión de sucursales (`/admin/tenants`) and Miembros del tenant (`/admin/tenants/:id/miembros`) to the canonical table workspace of docs/design-system.md §4, with their row menus, confirmations and slideovers themed. No v0.
Branch: `feat/tenants-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Bien hermano, pasemos a lo siguiente, sucursales por favor." Same treatment the user approved for Usuarios and Roles.
S2. Both views: hf-page-header (existing titles and descriptions) outside one hf-table-surface; no AdminPageHeader, no bg-coco-neutral; tenants light/dark boundary; toolbar/pagination/row-menu list portals; view toggle content-sized; cards restrained via owned hooks. Members keeps its subtitle loading skeleton while the tenant name loads and its "No tienes acceso" block inside the surface.
S3. ConfirmModals, TenantUpsertSlideover and MembershipUpsertSlideover (+ 2 USelectMenu) carry the form portal. No change to columns, filters, gating, super-admin rules or mutations.

## Tasks

T1 | S2,S3 | inline: both views + adapter CSS + portals + cards + slideovers, RED/GREEN | done | RED 6 contract -> GREEN tenants 297/23, build exit0 | commit: see L2
T2 | S1-S3 | inline checks: module suite, build, lint, native assess; user visual smoke | pending | commit: —

## Log

L1. User request verbatim: "Bien hermano, pasemos a lo siguiente, sucursales por favor." Map: AdminTenantsView and AdminTenantMembersView wrap AdminPageHeader + AppDataTable in a UCard painted bg-coco-neutral; members header uses AdminPageHeader loading (USkeleton) while the tenant name loads; row UDropdownMenu, ConfirmModal each; TenantUpsertSlideover, MembershipUpsertSlideover (2 USelectMenu); TenantCard/MemberCard hover translate/shadow. Both view tests pin admin-page-header (updated as a requested change).
L2. T1: styles/tenants-visual.css derived from the users adapter; AdminTenantsView and AdminTenantMembersView canonical header outside hf-table-surface (titles "Gestión de sucursales" / "Miembros del tenant", existing descriptions; members keeps a USkeleton subtitle while isLoadingTenantName and the "No tienes acceso" block inside the surface), AdminPageHeader + bg-coco-neutral removed, list portals on AppDataTable + row menus, view toggle hooks, ConfirmModals form portal; TenantCard/MemberCard + grids owned hooks; TenantUpsertSlideover and MembershipUpsertSlideover (+2 USelectMenu) form portal. Tests: both admin-page-header assertions updated to the canonical header; AdminTenantMembersView.spec 'no duplicated outer header' asserted no h1 at all, now asserts exactly one h1.hf-page-title and the title once (same intent, requested header change). RED 6 contract -> GREEN tenants 297/23; pnpm build exit 0. Lint: 7 pre-existing errors on HEAD in touched files (no-explicit-any x4 in AdminTenantMembersView.spec, @ts-nocheck x2 in the view tests, unused CreateTenantFormValues in AdminTenantsView) left out of scope.
L3. Native assess cc9065cc..f388031a: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
