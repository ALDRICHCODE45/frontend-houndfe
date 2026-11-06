/**
 * Shared `{ data, pagination }` list body (shipping handoff and newer modules).
 *
 * NOTE: `pagination.pageIndex` is 0-based in the response, while the `page`
 * query param of the request is 1-based (`?page=1` answers `pageIndex: 0`).
 */
export interface PagePagination {
  pageIndex: number
  pageSize: number
  totalCount: number
  pageCount: number
}

export interface PaginatedPage<T> {
  data: T[]
  pagination: PagePagination
}
