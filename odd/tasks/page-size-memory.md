# Page size: 5 to 50 in steps of 5, remembered across reloads (all tables)

## Specs
- S1 Owner (2026-11-26, verbatim): «estoy viendo algo que de hecho queria contarte desde hace mucho, y es el tema de la seleccion de items por pagina, puedo elegir entre 10, 20, etc.. 1. Quiero que pueda elgir de 5 en 5 hasta el 50, y quiero que cuando recargue no se borre mi seleccion, que me siga mostrando la cantidad de items que elgi, me sigues?? esto para todas las tablas que aplique por favor.»
- S2 Options everywhere a page size can be chosen: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50 (one shared constant; today `AppDataTable.vue:246` and `DataTablePagination.vue:18` default to [5, 10, 20, 50] and some views/composables pass their own lists).
- S3 The chosen size survives a reload, per table (each table remembers its own choice, keyed like its existing layout persistence `persistKey`), per user/tenant if the existing table preferences are. A page size in the URL (if a table syncs it) wins over the stored one; an invalid stored value falls back to the table's default. Changing the size goes back to page 1 as today.

## Tasks
- [x] T1 S1-S3 Shared options + persistence in the table infrastructure, applied to every table that offers a page size — worker
- [ ] T1b S2-S3 Remaining tables outside T1's surfaces: customers listing ([20,50,100]), pending refunds, backorders (URL `limit` + listQuery PAGE_SIZE_OPTIONS), delivery zones / zone validations ([20,50,100], parent-owned pagination), customer page pagers (history, quotations, payments) — worker
- [ ] T2 Full suite, preview, owner check, merge — parent

## Log
- L1 Owner request S1 (2026-11-26). Decision (parent): remember per table, not one global size, because tables differ in density (default stays per table).
- L2 T1 (worker mwycl3m5-l-gtu5): `TABLE_PAGE_SIZE_OPTIONS` 5..50 + `nearestPageSize` (core/shared/constants/table-page-size.ts); `useTablePageSize` + storage `table-page-size-<persistKey>` (own entry, not cleared by «Restablecer columnas»; no user/tenant scoping, same as table preferences); useServerTable starts at the stored size (first request uses it), URL pageSize wins and is not written to storage, resetFilters keeps the size; AppDataTable/DataTablePagination default to the shared list. Remember now: admin roles/users/tenants/members/payment methods/payment details/employees/expiring documents/pending approvals, pos delivery routes, products, quotations, promotions, sales list. Employees own [10,20,50] lists removed. RED 6 tests + 3 suites; GREEN core/shared+admin 248 files / 3518, sales+customers+products 352 / 6484, related 139 / 2199; type-check clean.
