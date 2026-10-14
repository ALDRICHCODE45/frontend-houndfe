# Employees list — design-system adaptation

Adapt the Colaboradores listing (`/admin/colaboradores`) to the canonical table workspace of docs/design-system.md §4, with its teleported menus, dialogs and slideovers themed. No v0; detail, expiring documents and pending approvals are later slices.
Branch: `feat/employees-list-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Pusheado hermano, pasemos al rediseno de lo siguiente". User choices: module "Colaboradores (RR.HH.)" and scope "Lista primero (Recomendado)" — "Lista de colaboradores al workspace canónico de tabla (header fuera de la superficie, tabla/cards, menús y modales de baja/reactivación con tema). Sin v0, como dice el design system para tablas. Detalle y pantallas de seguimiento después."
S2. Canonical table workspace: `hf-page-header` / `hf-page-title` / `hf-page-subtitle` outside one `hf-table-surface`; no `bg-coco-neutral` paint; light/dark palette owned by an employees adapter CSS; toolbar, view toggle, pagination and cards follow the Promotions precedent.
S3. Every teleport launched from the listing carries an owned marker: AppDataTable toolbar/pagination portals, row and card action menus (list portal); bulk ConfirmModals, BatchTerminateModal, TerminateEmployeeDialog, ReactivateEmployeeDialog, Create/Edit slideovers and their nested selects including ManagerPicker (form portal).
S4. Literal palette badges (work modality blue/orange/slate) move to semantic owned hooks readable in both modes. No change to columns, values, filters, selection, batch rules, permissions, navigation or persisted view mode.

## Tasks

T1 | S2,S4 | inline: list workspace + adapter CSS + list portals + card hooks + modality hooks, RED/GREEN | done | RED 7 contract + 1 header -> GREEN employees 968/37, lint exit0 | commit: see L3
T2 | S3 | inline: dialogs and slideovers form portals (incl. nested selects), RED/GREEN | pending | commit: —
T3 | S1-S4 | inline checks: module suite, build, lint, native assess; user visual smoke (table/cards, light/dark, dialogs, slideovers) | pending | commit: —

## Log

L1. User request verbatim: "Pusheado hermano, pasemos al rediseno de lo siguiente". Answers: "Colaboradores (RR.HH.)", "Lista primero (Recomendado)".
L2. Map: EmployeesListView wraps AdminPageHeader + AppDataTable inside a UCard painted bg-coco-neutral-50/950; no portal markers; inline modality badge literal classes (blue/orange/slate); row UDropdownMenu and EmployeeCard UDropdownMenu teleport unmarked; dialogs TerminateEmployeeDialog / ReactivateEmployeeDialog / BatchTerminateModal own UModal; Create/Edit slideovers own USlideover + USelect/USelectMenu; ManagerPicker USelectMenu. Precedent: PromotionsView + promotions-visual.css + styles/__tests__/promotions-visual.spec.ts.
L3. T1: styles/employees-visual.css (palette bridge for employees-visual / employees-list-portal / employees-form-portal, toolbar/pagination/card/modality hooks), EmployeesListView canonical header outside hf-table-surface (AdminPageHeader removed, bg-coco-neutral removed, root paddings kept for the existing mobile density contract), list portal on AppDataTable + row menu + EmployeeCard menu, modality badges use employees-modality--remote/hybrid/onsite. Existing header test updated to the canonical header (requested change). RED: 7 contract specs + 1 header spec failing -> GREEN employees 968/37; lint touched files exit 0.
