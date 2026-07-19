/**
 * pagination.utils — shared client-side pagination helpers
 *
 * Pure-function tests (ZERO mounts, ZERO mocks — Extract-Before-Mock rule).
 *
 * These helpers back any list whose backend returns a FLAT, unpaginated array
 * (e.g. the tenant-wide "Documentos por vencer" table and the "Validaciones
 * pendientes" tray): the view slices the array client-side.
 *
 * Coverage:
 *   - paginateRows: empty input, single page (total <= pageSize), multi-page
 *     slice (total > pageSize), middle page, last partial page, out-of-range.
 *   - pageAfterQueryChange: reset-to-first-page on search change, keep page
 *     when the query is unchanged (the "reset to page 1 on search" seam,
 *     extracted so it is testable without mounting the view).
 *   - Shared constants FIRST_PAGE / DEFAULT_TABLE_PAGE_SIZE.
 */

import { describe, it, expect } from 'vitest'
import {
  paginateRows,
  pageAfterQueryChange,
  clampPage,
  FIRST_PAGE,
  DEFAULT_TABLE_PAGE_SIZE,
} from '../pagination.utils'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

describe('pagination constants', () => {
  it('FIRST_PAGE is 1 (pages are 1-based, matching UPagination)', () => {
    expect(FIRST_PAGE).toBe(1)
  })

  it('DEFAULT_TABLE_PAGE_SIZE is 10 (shared page size across list views)', () => {
    expect(DEFAULT_TABLE_PAGE_SIZE).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// paginateRows — client-side pagination slice
// ─────────────────────────────────────────────────────────────────────────────

describe('paginateRows — client-side pagination slice', () => {
  const makeRows = (n: number): { id: string }[] =>
    Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }))

  it('returns an empty slice and zero counts for empty input', () => {
    const result = paginateRows([], FIRST_PAGE, DEFAULT_TABLE_PAGE_SIZE)
    expect(result.pageRows).toEqual([])
    expect(result.total).toBe(0)
    expect(result.pageCount).toBe(0)
  })

  it('returns all rows on a single page when total <= pageSize', () => {
    const rows = makeRows(7)
    const result = paginateRows(rows, FIRST_PAGE, DEFAULT_TABLE_PAGE_SIZE)
    expect(result.pageRows).toHaveLength(7)
    expect(result.total).toBe(7)
    expect(result.pageCount).toBe(1)
  })

  it('slices the first page when total > pageSize', () => {
    const rows = makeRows(25)
    const result = paginateRows(rows, 1, 10)
    expect(result.pageRows).toHaveLength(10)
    expect(result.pageRows[0]).toEqual({ id: 'r1' })
    expect(result.pageRows[9]).toEqual({ id: 'r10' })
    expect(result.total).toBe(25)
    expect(result.pageCount).toBe(3)
  })

  it('slices a middle page correctly', () => {
    const rows = makeRows(25)
    const result = paginateRows(rows, 2, 10)
    expect(result.pageRows).toHaveLength(10)
    expect(result.pageRows[0]).toEqual({ id: 'r11' })
    expect(result.pageRows[9]).toEqual({ id: 'r20' })
  })

  it('returns the partial remainder on the last page', () => {
    const rows = makeRows(25)
    const result = paginateRows(rows, 3, 10)
    expect(result.pageRows).toHaveLength(5)
    expect(result.pageRows[0]).toEqual({ id: 'r21' })
    expect(result.pageRows[4]).toEqual({ id: 'r25' })
    expect(result.pageCount).toBe(3)
  })

  it('returns an empty slice when the page is beyond the range', () => {
    const rows = makeRows(5)
    const result = paginateRows(rows, 3, 10)
    expect(result.pageRows).toEqual([])
    expect(result.total).toBe(5)
    expect(result.pageCount).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pageAfterQueryChange — reset-to-first-page-on-search seam
// ─────────────────────────────────────────────────────────────────────────────

describe('pageAfterQueryChange — reset to first page when the search changes', () => {
  it('resets to FIRST_PAGE when the query changes', () => {
    expect(pageAfterQueryChange('', 'ana', 3)).toBe(FIRST_PAGE)
  })

  it('resets to FIRST_PAGE when the query is cleared', () => {
    expect(pageAfterQueryChange('ana', '', 4)).toBe(1)
  })

  it('keeps the current page when the query is unchanged', () => {
    expect(pageAfterQueryChange('ana', 'ana', 3)).toBe(3)
  })

  it('treats any different string as a change (raw, case-sensitive compare)', () => {
    expect(pageAfterQueryChange('Ana', 'ana', 2)).toBe(FIRST_PAGE)
  })
})

describe('clampPage — keep the active page inside the valid range', () => {
  it('clamps a 1-based page into [FIRST_PAGE, max(pageCount, FIRST_PAGE)]', () => {
    expect(clampPage(2, 3)).toBe(2) // within range → unchanged
    expect(clampPage(0, 3)).toBe(FIRST_PAGE) // below → first page
    expect(clampPage(3, 2)).toBe(2) // above → last page
    expect(clampPage(2, 0)).toBe(FIRST_PAGE) // no pages → first page
  })
})
