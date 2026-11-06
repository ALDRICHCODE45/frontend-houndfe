import { describe, expect, expectTypeOf, it } from 'vitest'
import type { PaginatedPage, PagePagination } from '../paginated-page.types'

describe('PaginatedPage — shared { data, pagination } list body', () => {
  it('types data by its item and pagination with four numeric fields', () => {
    const page: PaginatedPage<{ name: string }> = {
      data: [{ name: 'Caja chica' }],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    }
    expectTypeOf(page.data).toEqualTypeOf<{ name: string }[]>()
    expectTypeOf(page.pagination).toEqualTypeOf<PagePagination>()
    expectTypeOf<PagePagination>().toEqualTypeOf<{
      pageIndex: number
      pageSize: number
      totalCount: number
      pageCount: number
    }>()
    expect(page.pagination.pageIndex).toBe(0)
  })
})
