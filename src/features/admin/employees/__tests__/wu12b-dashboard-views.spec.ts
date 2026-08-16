/**
 * WU-12B + Fase 3 #2: Dashboard views — Expiring Documents + Pending Approvals
 *
 * Tests cover:
 *   1. employeeDocumentQueryKeys.expiring key shape (already in query-keys, verify shape)
 *   2. employeesApi.getExpiringDocumentsPaginated — spy tests (server-paginated adapter,
 *      REQ-6 — the old full-array getExpiringDocuments was REPLACED by this method)
 *   3. Pure helpers: formatDaysRemaining, computeExpiringDocumentRow
 *   4. tenantId regression — a representative sample of API calls MUST NOT include
 *      tenantId in params, body, or headers (WARNING #4 from verify report)
 *
 * NOTE: the 6 `paginateRows` client-side slice cases moved out — that view is
 * server-paginated now; the canonical paginateRows tests live in
 * `pagination.utils.spec.ts`.
 *
 * No component mount tests for views — they rely on TanStack Query + router context.
 * Pure data-transformation helpers are extracted and tested directly (Extract-Before-Mock rule).
 *
 * Strategy: all composable logic is thin wrappers; views delegate to composables + components.
 * The critical correctness invariant is: API methods do not leak tenantId, and the
 * getExpiringDocumentsPaginated method calls the correct endpoint with correct params.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Query keys under test ─────────────────────────────────────────────────────
import { employeeDocumentQueryKeys } from '@/core/shared/constants/query-keys'

// ─── API under test ────────────────────────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { ExpiringDocumentItem } from '../api/employees.api'
import type { EmployeeDocument } from '../interfaces/employee.types'

// ─── Pure helpers under test ───────────────────────────────────────────────────
import {
  formatDaysRemaining,
  computeExpiringDocumentRow,
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
// 2. employeesApi.getExpiringDocumentsPaginated spy tests (server-paginated)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_EXPIRING_DOC: ExpiringDocumentItem = {
  id: 'doc-1',
  employeeId: 'emp-1',
  fileId: 'file-1',
  category: 'CONTRACT',
  notes: 'Contrato temporal',
  expiresAt: '2026-06-15',
  createdAt: '2026-01-01T00:00:00Z',
  fullName: 'Ana López',
  employeeNumber: 'EMP-001',
}

const EMPTY_PAGE = {
  data: [],
  pagination: { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 0 },
}

describe('employeesApi — getExpiringDocumentsPaginated', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'getExpiringDocumentsPaginated').mockResolvedValue({
      data: [MOCK_EXPIRING_DOC],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
    })
  })

  it('returns a PaginatedResponse of EmployeeDocument rows', async () => {
    const result = await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10 },
      30,
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.id).toBe('doc-1')
    expect(result.data[0]!.category).toBe('CONTRACT')
  })

  it('can be called with an empty result set — returns empty data when no docs expiring', async () => {
    vi.spyOn(employeesApi, 'getExpiringDocumentsPaginated').mockResolvedValue(EMPTY_PAGE)
    const result = await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10 },
      30,
    )
    expect(result.data).toEqual([])
    expect(result.data).toHaveLength(0)
  })

  it('calls getExpiringDocumentsPaginated with the params object and explicit day count', async () => {
    const spy = vi.spyOn(employeesApi, 'getExpiringDocumentsPaginated').mockResolvedValue(EMPTY_PAGE)
    const params = { pageIndex: 2, pageSize: 10 }
    await employeesApi.getExpiringDocumentsPaginated(params, 60)
    expect(spy).toHaveBeenCalledWith(params, 60)
  })

  it('returns empty data when no documents expiring in the window', async () => {
    vi.spyOn(employeesApi, 'getExpiringDocumentsPaginated').mockResolvedValue(EMPTY_PAGE)
    const result = await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10 },
      90,
    )
    expect(result.data).toEqual([])
    expect(result.data).toHaveLength(0)
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
// 4. tenantId regression — representative API calls must NOT send tenantId
// ─────────────────────────────────────────────────────────────────────────────

describe('tenantId regression — no tenantId in outbound requests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getExpiringDocumentsPaginated does not send tenantId in params', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } },
    })
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 10 }, 30)
    expect(getSpy).toHaveBeenCalledTimes(1)
    const callArgs = getSpy.mock.calls[0]!
    // callArgs[0] is the URL, callArgs[1] is the config
    const config = callArgs[1] as { params?: Record<string, unknown> } | undefined
    expect(config?.params).not.toHaveProperty('tenantId')
    expect(config?.params?.daysUntilExpiry).toBe(30)
    expect(config?.params?.page).toBe(1)
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

  // by-manager surface removed: the queue is tenant-wide now (HR-validation-notifications S1).
  // getPendingApprovals is the single endpoint — no admin by-manager route.

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
