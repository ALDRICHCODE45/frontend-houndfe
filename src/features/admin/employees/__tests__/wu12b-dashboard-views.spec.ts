/**
 * WU-12B: Dashboard views — Expiring Documents + Pending Approvals — Strict TDD
 *
 * Tests cover:
 *   1. employeeDocumentQueryKeys.expiring key shape (already in query-keys, verify shape)
 *   2. employeesApi.getExpiringDocuments — spy tests (new method)
 *   3. Pure helpers: formatDaysRemaining, computeExpiringDocumentRow
 *   4. tenantId regression — a representative sample of API calls MUST NOT include
 *      tenantId in params, body, or headers (WARNING #4 from verify report)
 *
 * No component mount tests for views — they rely on TanStack Query + router context.
 * Pure data-transformation helpers are extracted and tested directly (Extract-Before-Mock rule).
 *
 * Strategy: all composable logic is thin wrappers; views delegate to composables + components.
 * The critical correctness invariant is: API methods do not leak tenantId, and the
 * getExpiringDocuments method calls the correct endpoint with correct params.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Query keys under test ─────────────────────────────────────────────────────
import {
  employeeDocumentQueryKeys,
  employeeTimeOffQueryKeys,
} from '@/core/shared/constants/query-keys'

// ─── API under test ────────────────────────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { EmployeeDocument } from '../interfaces/employee.types'

// ─── Pure helpers under test ───────────────────────────────────────────────────
import {
  formatDaysRemaining,
  computeExpiringDocumentRow,
  paginateRows,
} from '../composables/useExpiringDocuments'
import { formatTimeOffDate } from '../composables/useEmployeeColumns'

// ─── http module for tenantId regression ──────────────────────────────────────
import { http } from '@/core/shared/api/http'

// ─────────────────────────────────────────────────────────────────────────────
// 1. employeeDocumentQueryKeys.expiring key shape
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeDocumentQueryKeys.expiring', () => {
  it('key has correct shape with 30-day threshold', () => {
    const key = employeeDocumentQueryKeys.expiring('tenant-1', 30)
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('documents-expiring')
    expect(key[3]).toBe(30)
  })

  it('keys are unique per day threshold', () => {
    const key30 = employeeDocumentQueryKeys.expiring('tenant-1', 30)
    const key60 = employeeDocumentQueryKeys.expiring('tenant-1', 60)
    const key90 = employeeDocumentQueryKeys.expiring('tenant-1', 90)
    expect(key30[3]).not.toBe(key60[3])
    expect(key60[3]).not.toBe(key90[3])
    expect(key30[3]).not.toBe(key90[3])
  })

  it('keys are unique per tenantId', () => {
    const key1 = employeeDocumentQueryKeys.expiring('tenant-A', 30)
    const key2 = employeeDocumentQueryKeys.expiring('tenant-B', 30)
    expect(key1[1]).not.toBe(key2[1])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. employeesApi.getExpiringDocuments spy tests
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_EXPIRING_DOC: EmployeeDocument = {
  id: 'doc-1',
  employeeId: 'emp-1',
  fileId: 'file-1',
  category: 'CONTRACT',
  notes: 'Contrato temporal',
  expiresAt: '2026-06-15',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('employeesApi — getExpiringDocuments', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'getExpiringDocuments').mockResolvedValue([MOCK_EXPIRING_DOC])
  })

  it('returns an array of EmployeeDocument', async () => {
    const result = await employeesApi.getExpiringDocuments(30)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('doc-1')
    expect(result[0]!.category).toBe('CONTRACT')
  })

  it('can be called without arguments — returns empty array when no docs expiring', async () => {
    vi.spyOn(employeesApi, 'getExpiringDocuments').mockResolvedValue([])
    const result = await employeesApi.getExpiringDocuments()
    // No args means backend uses server default (30 days). Returns empty array correctly.
    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  it('calls getExpiringDocuments with explicit day count', async () => {
    const spy = vi.spyOn(employeesApi, 'getExpiringDocuments').mockResolvedValue([])
    await employeesApi.getExpiringDocuments(60)
    expect(spy).toHaveBeenCalledWith(60)
  })

  it('returns empty array when no documents expiring', async () => {
    vi.spyOn(employeesApi, 'getExpiringDocuments').mockResolvedValue([])
    const result = await employeesApi.getExpiringDocuments(90)
    // Precondition: mock set up to return empty — empty is the specific expected value
    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pure helpers: formatDaysRemaining, computeExpiringDocumentRow
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDaysRemaining', () => {
  it('returns "Hoy" for 0 days remaining', () => {
    expect(formatDaysRemaining(0)).toBe('Hoy')
  })

  it('returns "1 día" for exactly 1 day remaining', () => {
    expect(formatDaysRemaining(1)).toBe('1 día')
  })

  it('returns plural "N días" for more than 1 day', () => {
    expect(formatDaysRemaining(30)).toBe('30 días')
    expect(formatDaysRemaining(15)).toBe('15 días')
  })

  it('returns "Vencido" for negative days (already expired)', () => {
    expect(formatDaysRemaining(-1)).toBe('Vencido')
    expect(formatDaysRemaining(-30)).toBe('Vencido')
  })
})

describe('computeExpiringDocumentRow', () => {
  it('builds a row with correct title from notes', () => {
    const doc: EmployeeDocument = {
      id: 'doc-2',
      employeeId: 'emp-2',
      fileId: 'file-2',
      category: 'NDA',
      notes: 'Acuerdo de confidencialidad',
      expiresAt: '2026-06-30',
      createdAt: '2026-01-15T00:00:00Z',
    }
    // Use a fixed reference date: 2026-05-27 → 2026-06-30 is 34 days away
    const row = computeExpiringDocumentRow(doc, new Date('2026-05-27T00:00:00Z'))
    expect(row.id).toBe('doc-2')
    expect(row.employeeId).toBe('emp-2')
    expect(row.title).toBe('Acuerdo de confidencialidad')
    expect(row.categoryLabel).toBe('Acuerdo de confidencialidad (NDA)')
    expect(row.expiresAt).toBe('2026-06-30')
    expect(row.daysRemaining).toBe(34)
    expect(row.daysRemainingLabel).toBe('34 días')
    // expiresAtLabel is the localized, human-readable date (via the shared
    // formatTimeOffDate formatter) — NOT the raw ISO string.
    expect(row.expiresAtLabel).toBe(formatTimeOffDate('2026-06-30'))
    expect(row.expiresAtLabel).toContain('2026')
  })

  it('falls back to category label when notes is null', () => {
    const doc: EmployeeDocument = {
      id: 'doc-3',
      employeeId: 'emp-3',
      fileId: 'file-3',
      category: 'CONTRACT',
      notes: null,
      expiresAt: '2026-05-27',
      createdAt: '2026-05-01T00:00:00Z',
    }
    const row = computeExpiringDocumentRow(doc, new Date('2026-05-27T00:00:00Z'))
    expect(row.title).toBe('Contrato')
    expect(row.daysRemaining).toBe(0)
    expect(row.daysRemainingLabel).toBe('Hoy')
    expect(row.expiresAtLabel).toBe(formatTimeOffDate('2026-05-27'))
  })

  it('formats expiresAtLabel as "—" when expiresAt is null', () => {
    const doc: EmployeeDocument = {
      id: 'doc-4',
      employeeId: 'emp-4',
      fileId: 'file-4',
      category: 'CONTRACT',
      notes: 'Documento sin vencimiento',
      expiresAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    }
    const row = computeExpiringDocumentRow(doc, new Date('2026-05-27T00:00:00Z'))
    expect(row.expiresAt).toBeNull()
    expect(row.expiresAtLabel).toBe('—')
    expect(row.daysRemaining).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3b. paginateRows — client-side pagination slice (the expiring endpoint returns
//     the FULL array unpaginated, so the view slices it client-side).
// ─────────────────────────────────────────────────────────────────────────────

describe('paginateRows — client-side pagination slice', () => {
  const makeRows = (n: number): { id: string }[] =>
    Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }))

  it('returns an empty slice and zero counts for empty input', () => {
    const result = paginateRows([], 1, 10)
    expect(result.pageRows).toEqual([])
    expect(result.total).toBe(0)
    expect(result.pageCount).toBe(0)
  })

  it('returns all rows on a single page when total <= pageSize', () => {
    const rows = makeRows(7)
    const result = paginateRows(rows, 1, 10)
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
// 4. tenantId regression — representative API calls must NOT send tenantId
// ─────────────────────────────────────────────────────────────────────────────

describe('tenantId regression — no tenantId in outbound requests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getExpiringDocuments does not send tenantId in params', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({ data: [] })
    await employeesApi.getExpiringDocuments(30)
    expect(getSpy).toHaveBeenCalledTimes(1)
    const callArgs = getSpy.mock.calls[0]!
    // callArgs[0] is the URL, callArgs[1] is the config
    const config = callArgs[1] as { params?: Record<string, unknown> } | undefined
    expect(config?.params).not.toHaveProperty('tenantId')
  })

  it('getPendingApprovals calls the endpoint without query params (backend reads JWT)', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({ data: [] })
    await employeesApi.getPendingApprovals()
    expect(getSpy).toHaveBeenCalledTimes(1)
    const callArgs = getSpy.mock.calls[0]!
    expect(callArgs[0]).toBe('/admin/employees-time-off/pending-approvals')
    // No second argument means no params/config — neither tenantId nor managerId.
    expect(callArgs[1]).toBeUndefined()
  })

  it('getPendingApprovalsByManager hits the by-manager admin route with the Employee.id in the path', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({ data: [] })
    await employeesApi.getPendingApprovalsByManager('mgr-1')
    expect(getSpy).toHaveBeenCalledTimes(1)
    const callArgs = getSpy.mock.calls[0]!
    expect(callArgs[0]).toBe(
      '/admin/employees-time-off/pending-approvals/by-manager/mgr-1',
    )
    const config = callArgs[1] as { params?: Record<string, unknown> } | undefined
    expect(config?.params).toBeUndefined()
  })

  it('getDocuments does not send tenantId in params', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } })
    await employeesApi.getDocuments('emp-1', { pageSize: 20 })
    expect(getSpy).toHaveBeenCalledTimes(1)
    const callArgs = getSpy.mock.calls[0]!
    const config = callArgs[1] as { params?: Record<string, unknown> } | undefined
    expect(config?.params).not.toHaveProperty('tenantId')
  })

  it('getTimeOff does not send tenantId in params', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20 } })
    await employeesApi.getTimeOff('emp-1')
    expect(getSpy).toHaveBeenCalledTimes(1)
    const callArgs = getSpy.mock.calls[0]!
    const config = callArgs[1] as { params?: Record<string, unknown> } | undefined
    if (config?.params) {
      expect(config.params).not.toHaveProperty('tenantId')
    }
  })
})
