// Canonical client-side pagination utilities for the app.
//
// Single source of truth for slicing an in-memory array into pages. Some
// tenant-wide endpoints return the FULL, server-sorted array with NO server
// pagination (e.g. GET /admin/employees-documents/expiring and
// GET /admin/employees-time-off/pending-approvals), so their views paginate
// client-side. All such views import `paginateRows` from here.

/** 1-based index of the first page (UPagination is 1-indexed). */
export const FIRST_PAGE = 1

/**
 * Default page size for list/table views that paginate client-side.
 *
 * Shared so the "Documentos por vencer" table and the "Validaciones
 * pendientes" tray stay visually consistent. Change it here to change both.
 */
export const DEFAULT_TABLE_PAGE_SIZE = 10

export interface PaginatedRows<T> {
  /** The slice of rows for the requested page. */
  pageRows: T[]
  /** Total number of rows across all pages. */
  total: number
  /** Number of pages (0 when there are no rows). */
  pageCount: number
}

/**
 * Slice an in-memory array into a single page.
 *
 * Uses straight Array.slice semantics: a page beyond the range yields an empty
 * slice (callers decide whether to clamp or reset). A non-positive pageSize
 * falls back to a single page containing every row.
 *
 * PURE — deterministic, no side effects.
 */
export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginatedRows<T> {
  const total = rows.length
  const size = pageSize > 0 ? Math.floor(pageSize) : total
  const pageCount = size > 0 ? Math.ceil(total / size) : 0
  const start = Math.max(0, (page - 1) * size)
  const pageRows = size > 0 ? rows.slice(start, start + size) : [...rows]
  return { pageRows, total, pageCount }
}

/**
 * Resolve the page to show after a search/filter query changes.
 *
 * A searchable + client-paginated list must jump back to the first page
 * whenever the query changes; otherwise narrowing the result set can strand the
 * user on a now-out-of-range page that renders empty. Returns FIRST_PAGE on any
 * change, or the unchanged current page when the query is identical.
 *
 * Extracted as a pure seam so the "reset to page 1 on search" behavior is
 * unit-testable without mounting the view.
 *
 * PURE — deterministic, no side effects.
 */
export function pageAfterQueryChange(
  previousQuery: string,
  nextQuery: string,
  currentPage: number,
): number {
  return previousQuery === nextQuery ? currentPage : FIRST_PAGE
}

/**
 * Clamp a 1-based page into `[FIRST_PAGE, max(pageCount, FIRST_PAGE)]`; keeps a
 * client-paginated view recoverable when its rows shrink from a NON-search
 * source (a mutation refetch drops the total below the current page), with
 * `pageCount === 0` clamping to FIRST_PAGE. Idempotent (watcher-safe) and PURE.
 */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, FIRST_PAGE), Math.max(pageCount, FIRST_PAGE))
}
