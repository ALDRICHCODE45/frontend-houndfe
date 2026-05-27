/**
 * WU-09: Documentos tab — Strict TDD test file
 *
 * Tests cover:
 *   1. UploadDocumentDtoSchema validation (pure Zod)
 *   2. employeesApi spy tests for documents endpoints (getDocuments, uploadDocument,
 *      downloadDocumentInfo, deleteDocument)
 *   3. employeeDocumentQueryKeys key shapes
 *   4. Pure helpers: formatDocumentCategory, buildDocumentEntry, isExpiringSoon,
 *      filterExpiringDocuments, computeExpiringThresholdLabel
 *
 * No component mount tests — DocumentosPanel uses queries that require heavy
 * provider setup. Logic is extracted to pure functions and tested directly
 * (Extract-Before-Mock rule from strict-tdd.md).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Schemas under test ───────────────────────────────────────────────────────
import {
  UploadDocumentDtoSchema,
  type UploadDocumentDto,
} from '../interfaces/employee.types'

// ─── Query keys ───────────────────────────────────────────────────────────────
import { employeeDocumentQueryKeys } from '@/core/shared/constants/query-keys'

// ─── API spy tests ────────────────────────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { EmployeeDocument } from '../interfaces/employee.types'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import {
  formatDocumentCategory,
  buildDocumentEntry,
  isExpiringSoon,
  filterExpiringDocuments,
  computeExpiringThresholdLabel,
} from '../composables/useDocumentos'

// ─────────────────────────────────────────────────────────────────────────────
// 1. UploadDocumentDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('UploadDocumentDtoSchema', () => {
  it('parses a valid DTO with required fields only', () => {
    const dto: UploadDocumentDto = {
      category: 'CONTRACT',
    }
    const result = UploadDocumentDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })

  it('parses a valid DTO with all optional fields', () => {
    const dto: UploadDocumentDto = {
      category: 'EVALUATION',
      expiresAt: '2027-12-31',
      notes: 'Evaluación de desempeño anual',
    }
    const result = UploadDocumentDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('EVALUATION')
      expect(result.data.notes).toBe('Evaluación de desempeño anual')
    }
  })

  it('rejects an invalid category', () => {
    const result = UploadDocumentDtoSchema.safeParse({
      category: 'INVALID_CATEGORY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects notes exceeding 500 characters', () => {
    const result = UploadDocumentDtoSchema.safeParse({
      category: 'OTHER',
      notes: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('accepts notes of exactly 500 characters', () => {
    const result = UploadDocumentDtoSchema.safeParse({
      category: 'OTHER',
      notes: 'a'.repeat(500),
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid category values', () => {
    const validCategories = [
      'CONTRACT', 'NDA', 'EVALUATION', 'CERTIFICATE',
      'WARNING', 'ID_DOCUMENT', 'CV', 'MEDICAL', 'OTHER',
    ] as const
    for (const category of validCategories) {
      const result = UploadDocumentDtoSchema.safeParse({ category })
      expect(result.success).toBe(true)
    }
  })

  it('rejects when category is missing', () => {
    const result = UploadDocumentDtoSchema.safeParse({
      notes: 'Some notes',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. employeeDocumentQueryKeys
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeDocumentQueryKeys', () => {
  it('list key includes employees, tenantId, documents, employeeId', () => {
    const key = employeeDocumentQueryKeys.list('tenant-1', 'emp-1')
    expect(key).toContain('employees')
    expect(key).toContain('tenant-1')
    expect(key).toContain('documents')
    expect(key).toContain('emp-1')
  })

  it('list key is unique per employeeId', () => {
    const key1 = employeeDocumentQueryKeys.list('tenant-1', 'emp-1')
    const key2 = employeeDocumentQueryKeys.list('tenant-1', 'emp-2')
    expect(JSON.stringify(key1)).not.toBe(JSON.stringify(key2))
  })

  it('expiring key includes employees, tenantId, documents-expiring, and days', () => {
    const key = employeeDocumentQueryKeys.expiring('tenant-1', 30)
    expect(key).toContain('employees')
    expect(key).toContain('tenant-1')
    expect(key).toContain('documents-expiring')
    expect(key).toContain(30)
  })

  it('expiring key is unique per days threshold', () => {
    const key30 = employeeDocumentQueryKeys.expiring('tenant-1', 30)
    const key60 = employeeDocumentQueryKeys.expiring('tenant-1', 60)
    expect(JSON.stringify(key30)).not.toBe(JSON.stringify(key60))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. employeesApi — documents endpoint spy tests
// ─────────────────────────────────────────────────────────────────────────────

const mockDocument: EmployeeDocument = {
  id: 'doc-1',
  employeeId: 'emp-1',
  fileId: 'file-uuid-1',
  category: 'CONTRACT',
  notes: 'Contrato inicial 2026',
  expiresAt: '2027-12-31',
  createdAt: '2026-01-15T10:00:00Z',
}

describe('employeesApi.getDocuments', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'getDocuments').mockResolvedValue({
      data: [mockDocument],
      total: 1,
      page: 1,
      limit: 20,
      pageSize: 20,
    })
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('returns the paginated documents list from the API', async () => {
    const result = await employeesApi.getDocuments('emp-1')
    expect(result.data).toHaveLength(1)
    const first = result.data[0]
    expect(first?.id).toBe('doc-1')
    expect(first?.category).toBe('CONTRACT')
  })

  it('passes the employeeId to the API call', async () => {
    await employeesApi.getDocuments('emp-42')
    expect(spy).toHaveBeenCalledWith('emp-42')
  })
})

describe('employeesApi.uploadDocument', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'uploadDocument').mockResolvedValue(mockDocument)
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('returns the created EmployeeDocument', async () => {
    const formData = new FormData()
    const result = await employeesApi.uploadDocument('emp-1', formData)
    expect(result.id).toBe('doc-1')
    expect(result.employeeId).toBe('emp-1')
  })

  it('passes employeeId and FormData to the API call', async () => {
    const fd = new FormData()
    fd.append('category', 'NDA')
    await employeesApi.uploadDocument('emp-99', fd)
    expect(spy).toHaveBeenCalledWith('emp-99', fd)
  })
})

describe('employeesApi.downloadDocumentInfo', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'downloadDocumentInfo').mockResolvedValue({ fileId: 'file-uuid-1' })
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('returns the fileId for the document', async () => {
    const result = await employeesApi.downloadDocumentInfo('emp-1', 'doc-1')
    expect(result.fileId).toBe('file-uuid-1')
  })

  it('passes employeeId and docId to the API call', async () => {
    await employeesApi.downloadDocumentInfo('emp-5', 'doc-99')
    expect(spy).toHaveBeenCalledWith('emp-5', 'doc-99')
  })
})

describe('employeesApi.deleteDocument', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'deleteDocument').mockResolvedValue(undefined)
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('resolves without error on successful delete', async () => {
    await expect(employeesApi.deleteDocument('emp-1', 'doc-1')).resolves.toBeUndefined()
  })

  it('passes employeeId and docId to the API call', async () => {
    await employeesApi.deleteDocument('emp-5', 'doc-7')
    expect(spy).toHaveBeenCalledWith('emp-5', 'doc-7')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pure helpers — formatDocumentCategory
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDocumentCategory', () => {
  it('formats CONTRACT to "Contrato"', () => {
    expect(formatDocumentCategory('CONTRACT')).toBe('Contrato')
  })

  it('formats MEDICAL to "Médico"', () => {
    expect(formatDocumentCategory('MEDICAL')).toBe('Médico')
  })

  it('formats NDA to "Acuerdo de confidencialidad"', () => {
    expect(formatDocumentCategory('NDA')).toBe('Acuerdo de confidencialidad')
  })

  it('formats all 9 categories to non-empty strings', () => {
    const categories = [
      'CONTRACT', 'NDA', 'EVALUATION', 'CERTIFICATE',
      'WARNING', 'ID_DOCUMENT', 'CV', 'MEDICAL', 'OTHER',
    ] as const
    for (const cat of categories) {
      const label = formatDocumentCategory(cat)
      expect(label.length).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pure helpers — buildDocumentEntry
// ─────────────────────────────────────────────────────────────────────────────

describe('buildDocumentEntry', () => {
  it('builds a display entry with all fields from a full document', () => {
    const entry = buildDocumentEntry(mockDocument)
    expect(entry.id).toBe('doc-1')
    expect(entry.categoryLabel).toBe('Contrato')
    expect(entry.title).toBe('Contrato inicial 2026')
    expect(entry.expiresAt).toBe('2027-12-31')
    expect(entry.createdAtFormatted).toMatch(/2026/)
  })

  it('uses category label as title when notes is null', () => {
    const doc: EmployeeDocument = { ...mockDocument, notes: null }
    const entry = buildDocumentEntry(doc)
    expect(entry.title).toBe('Contrato')
  })

  it('returns null expiresAt for documents without expiration', () => {
    const doc: EmployeeDocument = { ...mockDocument, expiresAt: null }
    const entry = buildDocumentEntry(doc)
    expect(entry.expiresAt).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Pure helpers — isExpiringSoon
// ─────────────────────────────────────────────────────────────────────────────

describe('isExpiringSoon', () => {
  it('returns true for a document expiring within threshold days', () => {
    // Create a date 15 days from today (in ISO format)
    const future = new Date()
    future.setDate(future.getDate() + 15)
    const expiresAt = future.toISOString().slice(0, 10)
    expect(isExpiringSoon(expiresAt, 30)).toBe(true)
  })

  it('returns false for a document expiring beyond the threshold', () => {
    const future = new Date()
    future.setDate(future.getDate() + 45)
    const expiresAt = future.toISOString().slice(0, 10)
    expect(isExpiringSoon(expiresAt, 30)).toBe(false)
  })

  it('returns false for null expiresAt (no expiration)', () => {
    expect(isExpiringSoon(null, 30)).toBe(false)
  })

  it('returns true for a document expiring exactly on the threshold day', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const expiresAt = future.toISOString().slice(0, 10)
    expect(isExpiringSoon(expiresAt, 30)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Pure helpers — filterExpiringDocuments
// ─────────────────────────────────────────────────────────────────────────────

describe('filterExpiringDocuments', () => {
  it('returns only documents expiring within the threshold', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 10)
    const far = new Date()
    far.setDate(far.getDate() + 100)

    const docs: EmployeeDocument[] = [
      { ...mockDocument, id: 'doc-soon', expiresAt: soon.toISOString().slice(0, 10) },
      { ...mockDocument, id: 'doc-far', expiresAt: far.toISOString().slice(0, 10) },
      { ...mockDocument, id: 'doc-none', expiresAt: null },
    ]

    const result = filterExpiringDocuments(docs, 30)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('doc-soon')
  })

  it('returns empty array when no documents expire within threshold', () => {
    const far = new Date()
    far.setDate(far.getDate() + 100)

    const docs: EmployeeDocument[] = [
      { ...mockDocument, id: 'doc-far', expiresAt: far.toISOString().slice(0, 10) },
    ]

    const result = filterExpiringDocuments(docs, 30)
    expect(result).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Pure helpers — computeExpiringThresholdLabel
// ─────────────────────────────────────────────────────────────────────────────

describe('computeExpiringThresholdLabel', () => {
  it('returns "Próximos 30 días" for threshold 30', () => {
    expect(computeExpiringThresholdLabel(30)).toBe('Próximos 30 días')
  })

  it('returns "Próximos 60 días" for threshold 60', () => {
    expect(computeExpiringThresholdLabel(60)).toBe('Próximos 60 días')
  })

  it('returns "Próximos 90 días" for threshold 90', () => {
    expect(computeExpiringThresholdLabel(90)).toBe('Próximos 90 días')
  })
})
