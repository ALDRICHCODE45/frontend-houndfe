# Design: Standardize Expiring Documents Table

## Technical Approach

Approach A (true server-side) per proposal. Backend confirmed pagination/search/sort on `GET /admin/employees-documents/expiring` (evidence, not code). Rewrite `useExpiringDocuments` as closure-composition over shared `useServerTable` (untouched) mirroring `useEmployeesList` (Fase 3 #1): `selectedThreshold` (30|60|90) closes `queryKey`/`queryFn`. New adapter `getExpiringDocumentsPaginated` mirrors `users.api.ts` meta-reader precedent (`{ data, meta: { total, page, limit, totalPages } }`), not employees' flat `mapPaginated`. View reaches gold standard: toolbar, sorting via `SortableHeader`, search ≥2 chars, column visibility, `backendMessage > error.message > fallback`, `#filters` threshold selector, server-resolved `fullName` (drops `listForPicker`). REQ-1..REQ-9 covered.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Query key | Proposal floats extending `employeeDocumentQueryKeys.expiring` for params | Keep factory unchanged — `useServerTable` already appends `serverParams` (`[...base, {pageIndex,pageSize,sorting,globalFilter}]`); days stays in base key; wu12b key-shape tests keep passing |
| Threshold page-reset | `useServerTable` resets page only on sorting/search, NOT on closure-key change (REQ-1/REQ-7 pin `pageIndex`→0) | Composable adds `watch(selectedThreshold)` resetting `t.pagination.pageIndex = 0` |
| Row mapping | View needs `fullName`/`employeeNumber` on rows; `computeExpiringDocumentRow` lacks them | Composable maps `t.data` → `{ ...computeExpiringDocumentRow(item), fullName, employeeNumber }`; view cells read `row.original.fullName` — no view-side merge |
| Sort map as whitelist | `documento` must never sort; empty sorting must omit params | `EXPIRING_DOCUMENTS_SORT_MAP[sort.id]` lookup miss → omit `sortBy`/`sortOrder` (also covers empty `sorting` → `params.sorting` undefined) |
| `restante` → `expiresAt` | Days-remaining is client-derived, not a stored field | Monotonic with `expiresAt` for fixed now → sorting by `expiresAt` is equivalent; document in SORT_MAP comment |
| Response shape | Flat `mapPaginated` (employees) vs `meta` reader (users) | Meta reader — backend contract evidence says `{ data, meta }`; isolated adapter absorbs any drift |
| Error fallback | View hardcodes singular "No se **pudo** cargar…" | Spec pins plural `"No se pudieron cargar los documentos. Intenta de nuevo."` — adopt spec string |
| Old method | Keep `getExpiringDocuments` as sibling vs replace | REPLACE — only consumer is this view + wu12b (both migrated); no dead code |
| `paginateRows` re-export | Drop vs keep | Drop — view stops using it; `PendingApprovalsView` imports the util directly; canonical tests live in `pagination.utils.spec.ts` |
| `enabled` gate | Old code gated on `!!tenantId` | Drop (Fase 3 #1 precedent) — backend derives tenant from JWT |

## Data Flow

```
selectedThreshold ref ──closure──▶ queryKey/queryFn ──▶ useServerTable (pageIndex 0-based)
useServerTable ──▶ getExpiringDocumentsPaginated ──▶ GET /admin/employees-documents/expiring
  { daysUntilExpiry, page = pageIndex+1, limit = min(pageSize,100), search? (≥2), sortBy?, sortOrder? }
backend { data, meta:{total,page,limit,totalPages} } ──▶ mapExpiringDocumentsPaginated ──▶ PaginatedResponse
useServerTable ──isError/error──▶ documentsErrorMessage ──▶ AppDataTable :error/:error-message (Reintentar ─▶ refresh)
globalFilter (300ms debounce) ──▶ search (≥2 chars guard in adapter)
SortableHeader click ──▶ sorting ──▶ sortBy/sortOrder (SORT_MAP whitelist miss ─▶ omitted)
#filters USelect (30/60/90) ──▶ selectedThreshold ──▶ new cache slot + pageIndex→0
```

## File Changes

| File | Action | WU | Description |
|---|---|---|---|
| `src/features/admin/employees/api/employees.api.ts` | Modify | A | Replace `getExpiringDocuments` → `getExpiringDocumentsPaginated(ServerTableParams, daysUntilExpiry)`; add `mapExpiringDocumentsPaginated`, `ExpiringDocumentsBackendPage`, `ExpiringDocumentItem`, `EXPIRING_DOCUMENTS_SORT_MAP`; search ≥2 guard; limit clamp 100 |
| `src/features/admin/employees/composables/useExpiringDocuments.ts` | Modify | A | Compose `useServerTable`; `selectedThreshold` closure + page-reset watcher; `documents` mapper (adds `fullName`/`employeeNumber`); drop `paginateRows`/`PaginatedRows` re-export; keep pure helpers + `ExpiringDocumentRow` |
| `src/features/admin/employees/views/ExpiringDocumentsView.vue` | Modify | A | `show-toolbar`, v-models (sorting/global-filter/column-visibility/pagination), `enable-column-visibility`, 4 `SortableHeader` slots, `documentsErrorMessage`, `#filters` USelect, colaborador → `fullName` (avatar seed stays `employeeId`); drop `listForPicker` query + `page`/`pageSize`/`paged`/`showingFrom/To` bridge + header USelect |
| `src/core/shared/utils/pagination.utils.ts` | Modify | A | Header comment: `/expiring` no longer "full array"; keep `/pending-approvals` line; refresh `DEFAULT_TABLE_PAGE_SIZE` docstring (now pending-approvals only) |
| `src/features/admin/employees/__tests__/wu12b-dashboard-views.spec.ts` | Modify | C | Port spy → `getExpiringDocumentsPaginated` params object; drop `paginateRows` slice copies; keep key-shape/helpers/tenantId |
| `src/features/admin/employees/composables/__tests__/useExpiringDocuments.spec.ts` | Create | C | Adapter params, meta mapper, SORT_MAP, composable closure/options |
| `src/features/admin/employees/views/__tests__/ExpiringDocumentsView.test.ts` | Create | C | Error/search/sort/visibility/#filters/fullName view cases |
| `useEmployeeColumns.ts`, `useServerTable`, `AppDataTable`, `SortableHeader`, `query-keys.ts`, `employee.types.ts`, `PendingApprovalsView.vue` | Unchanged | — | REQ-9 invariants; `formatTimeOffDate` reused by row mapper |

**Work units (forecast)**: WU-A migration+adapter+columns+view wiring ~220–280 lines (7 files). WU-B folded (no card view). WU-C tests ~250–300 (3 files). Fase 3 #1 lesson: WU-A ran 1658 vs 400 budget — keep spec port OUT of WU-A, budget conservatively, maintainer ledger reset likely needed. `Decision needed before apply: No` · `Chained PRs recommended: No` (solo, conventional commits on branch) · `400-line budget risk: High`.

## Interfaces / Contracts

```ts
// employees.api.ts
export const EXPIRING_DOCUMENTS_SORT_MAP: Record<string, string> = {
  vencimiento: 'expiresAt', restante: 'expiresAt', // restante is derived; monotonic with expiresAt
  categoria: 'category', colaborador: 'employeeName',
}
export type ExpiringDocumentItem = EmployeeDocument & { fullName: string; employeeNumber: string }
export interface ExpiringDocumentsBackendPage {
  data: ExpiringDocumentItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
export function mapExpiringDocumentsPaginated(raw: ExpiringDocumentsBackendPage): PaginatedResponse<ExpiringDocumentItem>
// → { data, pagination: { pageIndex: meta.page-1, pageSize: meta.limit, totalCount: meta.total, pageCount: meta.totalPages } }
// employeesApi.getExpiringDocumentsPaginated(params: ServerTableParams, daysUntilExpiry: number): Promise<PaginatedResponse<ExpiringDocumentItem>>
// → params { daysUntilExpiry, page: params.pageIndex+1, limit: Math.min(params.pageSize, 100),
//           search? (globalFilter.length >= 2), sortBy?, sortOrder? } — NEVER tenantId
// sort = params.sorting?.[0]; sortBy = EXPIRING_DOCUMENTS_SORT_MAP[sort.id]; miss → omit both
```

```ts
// useExpiringDocuments.ts — closure composition; shared composable NOT modified
export type ExpiringThreshold = 30 | 60 | 90
export type ExpiringDocumentTableRow = ExpiringDocumentRow & { fullName: string; employeeNumber: string }

export function useExpiringDocuments(options: { defaultPageSize?: number; debounceMs?: number } = {}) {
  const { defaultPageSize = 10, debounceMs = 300 } = options
  const tenantId = computed(() => useAuthStore().currentTenantId)
  const selectedThreshold = ref<ExpiringThreshold>(30)
  const t = useServerTable<ExpiringDocumentItem>({
    queryKey: () => employeeDocumentQueryKeys.expiring(tenantId.value, selectedThreshold.value),
    queryFn: (params) => employeesApi.getExpiringDocumentsPaginated(params, selectedThreshold.value),
    defaultSorting: [{ id: 'vencimiento', desc: false }], defaultPageSize, debounceMs,
    pageSizeOptions: [10, 20, 50], persistKey: 'admin-expiring-documents', urlSync: false,
    // staleTime 30_000 + refetchOnWindowFocus: false = useServerTable defaults (kept)
  })
  watch(selectedThreshold, () => { t.pagination.value = { ...t.pagination.value, pageIndex: 0 } }) // REQ-1/7
  const documents = computed<ExpiringDocumentTableRow[]>(() =>
    t.data.value.map((item) => ({ ...computeExpiringDocumentRow(item), fullName: item.fullName, employeeNumber: item.employeeNumber })))
  return { selectedThreshold, documents, pagination: t.pagination, sorting: t.sorting,
    globalFilter: t.globalFilter, columnVisibility: t.columnVisibility, totalCount: t.totalCount,
    pageCount: t.pageCount, isLoading: t.isLoading, isFetching: t.isFetching, isError: t.isError,
    error: t.error, refresh: t.refresh, pageSizeOptions: t.pageSizeOptions,
    showingFrom: t.showingFrom, showingTo: t.showingTo }
}
// View: documentsErrorMessage = computed(backendMessage string|array[0] → error.message →
//   'No se pudieron cargar los documentos. Intenta de nuevo.'); emptyMessage keeps threshold interpolation
```

Columns: `documento` `createSimpleHeader('Documento')` + `enableSorting:false`/`enableHiding:false`; `categoria`/`colaborador`/`vencimiento`/`restante` + `enableSorting:true`/`enableHiding:true`; header slots `#vencimiento-header`/`#restante-header`/`#categoria-header`/`#colaborador-header` → `SortableHeader` (labels "Fecha de vencimiento"/"Tiempo restante"/"Categoría"/"Colaborador").

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (adapter) | REQ-6/REQ-2/REQ-3 | `mapExpiringDocumentsPaginated` meta→`PaginatedResponse`; URL params: `page=pageIndex+1`, `limit` clamp 100 (pageSize 250→100), `search` omitted <2 chars / passed ≥2, `sortBy`/`sortOrder` from map, empty sorting omits both, `documento` never maps; no tenantId |
| Unit (composable) | REQ-1/REQ-2/REQ-7 | `defaultSorting vencimiento asc`, `defaultPageSize 10`, `pageSizeOptions`, `persistKey`, `urlSync:false`; threshold watch resets `pageIndex`; queryKey carries days; row mapper adds `fullName`/`employeeNumber` |
| Unit (view) | REQ-3/4/5/7/8 | Mock `useExpiringDocuments`; stub `AppDataTable` (`data-error`/`data-error-message`/`data-column-visibility`, slots) + `SortableHeader` real. Error precedence (string/array/fallback) + retry→`refresh` + empty suppressed; search→`globalFilter`; 4 columns hideable, `documento` absent from dropdown; selector in `#filters` (not header) refetches; colaborador renders `fullName`; no `listForPicker` spy fires |
| Port | wu12b | Spy → params-object `toHaveBeenCalledWith`; drop `paginateRows` slice copies (canonical in `pagination.utils.spec.ts`); keep query-key/helpers/tenantId regression |

Gates: `pnpm test:unit` + authoritative `pnpm build`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure frontend data-layer refactor (composable + adapter + view props).

## Migration / Rollout

No data migration, no feature flag. Rollback: revert merge commit. Non-additive step is only the API replacement (`getExpiringDocuments` → `getExpiringDocumentsPaginated`), pinned by wu12b port + git history. Error computed additive (falls back to prior message when `error` null); visibility opt-in; selector relocation reversible; comment revert one line. Solo dev: conventional commits on branch, manual merge to main.

## Open Questions

- [ ] `meta.limit` vs `pageSize` authority + `totalPages = ceil(total/limit)` — confirm against backend answer before apply (relay).
- [ ] `createdAt` sortBy stays latent (no column maps to it) — confirm intent.
- [ ] `DEFAULT_TABLE_PAGE_SIZE` docstring now names only pending-approvals — keep export (PendingApprovalsView consumes it).
