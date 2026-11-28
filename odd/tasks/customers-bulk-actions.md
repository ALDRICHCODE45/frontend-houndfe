# Customers bulk actions — statements ZIP and CSV export (owner ideas batch T5)

API source of truth: odd/handoff/33-customers-bulk-actions.md (verbatim). Decisions: odd/tasks/owner-ideas-batch.md S3, L3, L4.

## Specs
- S1 Owner (2026-11-27): «Acciones masivas en Clientes» — «Seleccionar varios clientes → «Estados de cuenta PDF» y «Exportar CSV».» Design: design/customers-module/01-tabla-y-filtros.html (selection + bulk bar).
- S2 Owner decisions: caps OK (50 statements, 10,000 CSV rows); ZIP with one PDF per customer; customers without movements included; «Nonono, perdon, exportar datos de clientes debe ser un permiso nuevo especial.» → CSV needs export:Customer; audit table later.
- S3 Selection: row checkboxes (page) + «Seleccionar los N del filtro» → `{mode:"filter", filter, excludeIds}`; otherwise `{mode:"ids"}`. Bulk bar (design/system.md `.hf-bulk-bar`): «Estados de cuenta PDF» (read:Sale; period picker like the single statement: este mes / mes anterior / últimos 3 meses / elegir fechas ≤ 366 días) and «Exportar CSV» (export:Customer). Errors per handoff flow (404 missingIds → offer retry without them; 429 wait retryAfterSeconds; 503 timeout copy; 400 TOO_LARGE / EMPTY → explain caps and refresh). Cancel aborts the request.

## Tasks
- [x] T1 S1-S3 Selection + bulk bar + both downloads + permission gating — worker
- [ ] T2 Full suite, preview, owner check, merge — parent

## Log
- L1 Backend handoff 053429df copied (odd/handoff/33-customers-bulk-actions.md).
- L2 Backend handoff 34 (1319f193): GET /sales/drafts rows now include customer + shippingAddress (odd/handoff/34-drafts-customer-summary.md); no FE change needed (row wins in mergeDraftListWithCache).
- L3 T1 (worker mwzqq9h1-w-2ppn): selection column (HfRowMark) + bulk bar on the customers table; ids mode (≤ 1000, kept across pages) or «Seleccionar los N clientes del filtro» → filter mode with excludeIds (≤ 1000; `buildBulkSelectionFilter` reuses listing params minus page/limit/sort and reserved keys); cleared on search/filter/view change. «Estados de cuenta PDF» (read:Sale + read:Customer, ≤ 50, period picker reused) and «Exportar CSV» (gate reads permission codes: export:Customer or manage:all/super admin — CASL `userCan('export')` drops unknown actions and `manage:Customer` must NOT grant export); authenticated Blob downloads with Content-Disposition filename (`downloadFile.ts`), cancel, retry, «Reintentar sin ellos» on 404 missingIds, 429 countdown, 503/TOO_LARGE/EMPTY copy. AppDataTable gains `selectionCount` + `clear-selection` + totals scope. Roles i18n «Exportar clientes». Mobile: existing card selection pattern. RED observed; GREEN customers 812, DataTable 324, roles 128, related 2857; lint, type-check clean. Not browser-checked. Risk: item 2 (export permission gating).
