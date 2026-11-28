/**
 * customers-bulk-actions T1 (S3, handoff 33 «Selección»): the body shared by both bulk routes —
 * `{mode:"ids"}` or `{mode:"filter", filter, excludeIds}` with the GET /customers/listing params as
 * strings, never page/limit/sortBy/sortOrder.
 */
import { describe, expect, it } from 'vitest'
import {
  BULK_CSV_MAX,
  BULK_SELECTION_IDS_MAX,
  BULK_STATEMENTS_MAX,
  buildBulkSelectionFilter,
  bulkCapReason,
} from '../customerBulkSelection'

describe('buildBulkSelectionFilter', () => {
  it('keeps the search and the filters as strings, without paging or sort keys', () => {
    const filter = buildBulkSelectionFilter(
      ' ana ',
      { hasDebt: 'true', openDebtMin: '100', municipality: 'Monterrey,San Nicolás' },
      { canReadSales: true },
    )
    expect(filter).toEqual({
      search: 'ana',
      hasDebt: 'true',
      openDebtMin: '100',
      municipality: 'Monterrey,San Nicolás',
    })
    for (const key of ['page', 'limit', 'sortBy', 'sortOrder']) expect(filter).not.toHaveProperty(key)
    for (const value of Object.values(filter)) expect(typeof value).toBe('string')
  })

  it('drops the metric filters without read:Sale, like the listing', () => {
    expect(buildBulkSelectionFilter('', { hasDebt: 'true', city: 'Monterrey' }, { canReadSales: false })).toEqual({
      city: 'Monterrey',
    })
  })

  it('drops empty values, the empty search and the reserved keys', () => {
    const filters = JSON.parse('{"city":"","__proto__":"x","constructor":"y","prototype":"z","rfc":"A"}')
    const filter = buildBulkSelectionFilter('   ', filters, { canReadSales: true })
    expect(Object.keys(filter)).toEqual(['rfc'])
  })
})

describe('bulk caps', () => {
  it('matches the backend: 50 statements, 10,000 CSV rows, 1,000 ids', () => {
    expect(BULK_STATEMENTS_MAX).toBe(50)
    expect(BULK_CSV_MAX).toBe(10_000)
    expect(BULK_SELECTION_IDS_MAX).toBe(1_000)
  })

  it('explains the cap only above it', () => {
    expect(bulkCapReason('statements', 50)).toBeNull()
    expect(bulkCapReason('statements', 51)).toBe('Máximo 50 clientes por descarga')
    expect(bulkCapReason('csv', 10_000)).toBeNull()
    expect(bulkCapReason('csv', 10_001)).toBe('Máximo 10,000 clientes por exportación')
  })
})
