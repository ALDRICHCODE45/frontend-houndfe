# Employee detail — design-system adaptation

Adapt the collaborator detail (`/admin/colaboradores/:id`) to docs/design-system.md keeping its composition (profile card + 9 tabs) and flows; cap it at Caja's centered 1320px width.
Branch: `feat/employee-detail-visual`. Work-unit commits; push by the user.

## Specs

S1. Exact request: "me gusta mucho hermano, aprovado. a lo siguinet". User choices: "Adaptación (Recomendado)" — "Misma composición (perfil + 9 pestañas) y flujos; tema claro/oscuro en tarjeta de perfil, pestañas, las ~20 cards de los paneles y los ~18 modales/menús/selects, colores literales a roles semánticos." and "Sí, 1320px centrado (Recomendado)" — "Mismo criterio que el detalle de ruta que aprobaste."
S2. Shell: the detail opts into the employees theme boundary (light/dark), is centered with max width 1320px; breadcrumb and tab bar use semantic roles (active tab no longer `bg-white`).
S3. Every UCard of the profile card and the panels carries an owned section hook painting the surface and border roles (the global UCard theme paints literal colors).
S4. Every teleport opened from the detail carries the form portal marker: profile menu, emergency-contact modals, compensation modals + date popovers, documents upload/delete modals + select + date popover, time-off select (list portal), request/review modals + select + date popovers, organigram tooltip.
S5. Literal palette badges (profile modality chip, active dot, document categories, expiry chip) move to semantic owned hooks readable in both modes. No change to tabs, permissions, data, actions or validation.

## Tasks

T1 | S2,S5 | inline: detail shell (boundary, 1320px, breadcrumb, tabs) + profile card (section, menu portal, modality/dot hooks), RED/GREEN | done | RED 4 contract -> GREEN employees 976/37 | commit: see L3
T2 | S3-S5 | inline: panels' section hooks, portal markers and document badge hooks, RED/GREEN | done | RED 4 contract -> GREEN employees 980/37, build exit0 | commit: see L4
T3 | S1-S5 | inline checks: module suite, build, lint, native assess; user visual smoke (all tabs, light/dark, modals) | pending | commit: —

## Log

L1. User request verbatim: "me gusta mucho hermano, aprovado. a lo siguinet". Answers: "Adaptación (Recomendado)", "Sí, 1320px centrado (Recomendado)".
L2. Inventory: EmployeeProfileCard (1 UCard, 1 UDropdownMenu, literal modality chips + emerald active dot); panels UCards: Resumen 6, Personal 2, Laboral 2, Compensación 4, Organigrama 2, CV 1, Documentos 2; teleports: EmergencyContacts 2 UModal, Compensación 2 UModal + 2 DateFieldPopover, Organigrama 1 UTooltip, Documentos 2 UModal (one with existing ui.footer) + USelect + DateFieldPopover, Ausencias filter USelect + 2 UModal + USelect + 2 DateFieldPopover; Documentos literal category/expiry badges; tab bar active `bg-white text-primary`.
L3. T1: EmployeeDetailView root hf-theme hf-ui employees-visual employees-detail mx-auto max-w-[1320px]; tab bar uses employees-detail-tabs/-tab hooks (active via aria-selected, no bg-white); EmployeeProfileCard section hook, avatar ring + active dot hooks, modality chips reuse employees-modality hooks, action menu form portal; CSS detail block. RED 4 contract -> GREEN employees 976/37. Lint: one pre-existing error at EmployeeDetailView.vue:63 ('initials' unused, present on HEAD) left out of scope; touched code otherwise clean.
L4. T2: guarded script added employees-detail-section to all 19 panel UCards (Resumen 6, Personal 2, Laboral 2, Compensación 4, Organigrama 2, CV 1, Documentos 2) and owned portals to 17 panel teleports (form portal for modals/selects/date popovers/tooltip, list portal for the Ausencias year filter; Documentos modals merge content with their existing footer ui); document categories mapped to active/success/warning/neutral tones and the expiry chip to a warning hook. Also removed the unused 'initials' destructure in EmployeeDetailView (dead variable, flagged on the touched file). RED 4 contract -> GREEN employees 980/37; pnpm build exit 0. Lint: 4 pre-existing errors on HEAD in DocumentosPanel (UploadDocumentDtoSchema, uploadFormId unused) and PersonalPanel (props, getFullAddress unused) left out of scope.
