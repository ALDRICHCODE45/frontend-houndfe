# Employees dashboards — design-system adaptation

Adapt "Documentos por vencer" (`/admin/colaboradores/documentos-vencer`) and "Validaciones pendientes" (`/admin/colaboradores/aprobaciones-pendientes`) to the canonical table workspace (docs/design-system.md §4), closing the Colaboradores module. No v0.
Branch: `feat/employees-dashboards-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "Me parece perfecto hermano, me gusta. lo que sigue" (after "Después quedan \"Documentos por vencer\" y \"Aprobaciones pendientes\" para cerrar el módulo."). Same treatment the user approved for the list: canonical table workspace, no v0.
S2. Each view: hf-page-header / hf-page-title / hf-page-subtitle outside one hf-table-surface; no AdminPageHeader, no bg-coco-neutral; employees light/dark boundary; toolbar/pagination portals and nested selects marked.
S3. Pending approvals: review UModal carries the form portal and its inner UCard the section hook; PendingApprovalCard uses an owned card hook; view toggle content-sized. No change to filters, threshold, review flow, permissions or data.

## Tasks

T1 | S2 | inline: Documentos por vencer canonical workspace, RED/GREEN | done | RED 2 contract -> GREEN | commit: see L2
T2 | S2,S3 | inline: Validaciones pendientes canonical workspace + review modal + cards, RED/GREEN | done | RED 2 contract -> GREEN employees 984/37, lint exit0, build exit0 | commit: see L2
T3 | S1-S3 | inline checks: module suite, build, lint, native assess; user visual smoke | pending | commit: —

## Log

L1. User request verbatim: "Me parece perfecto hermano, me gusta. lo que sigue". Both views wrap AdminPageHeader + AppDataTable in a UCard painted bg-coco-neutral; ExpiringDocuments has a threshold USelect in #filters; PendingApprovals has ViewToggle, PendingApprovalCard tray and a review UModal with an inner UCard. Existing view tests pin AdminPageHeader (updated as a requested change).
L2. T1+T2 (one work-unit commit, shared contract spec): both views root hf-theme hf-ui employees-visual with hf-page-header outside hf-table-surface, AdminPageHeader and bg-coco-neutral removed, list portals on AppDataTable; expiry-window USelect list portal; PendingApprovals view toggle hook, review UModal form portal + inner UCard section hook, PendingApprovalCard owned employees-approval-card hook. Existing header tests updated to the canonical header (requested change; the expiring selector test now asserts against .hf-page-header instead of a removed stub). RED 4 contract -> GREEN employees 984/37; lint on changed files exit 0; pnpm build exit 0.
L3. Native assess 691dd560..7a55e767: medium, reviewDue false (under_budget), no independent verifier. Pending: user visual smoke.
