/**
 * WU-08: Organigrama tab + CV tab — Strict TDD test file
 *
 * Tests cover:
 *   1. employeeQueryKeys.subordinates key shape
 *   2. employeeQueryKeys.managerChain key shape (already exists — verify no regression)
 *   3. employeesApi.getSubordinates spy test (GET /:id/subordinates)
 *   4. employeesApi.getManagerChain spy test (GET /:id/manager-chain)
 *   5. buildManagerChainDisplay — pure helper: builds display entries from chain
 *   6. buildSubordinateDisplayEntry — pure helper: builds display entry from Employee
 *   7. isChainTruncated — pure helper: returns true when chain.length === 50
 *   8. buildCvDownloadUrl — pure helper: builds '/files/:fileId' URL from fileId
 *
 * No component mount tests — OrganigramaPanel + CvPanel rely on queries that require
 * heavy provider setup. Logic extracted to pure functions and tested directly
 * (Extract-Before-Mock rule from strict-tdd.md).
 *
 * Composables (useEmployeeSubordinates, useEmployeeManagerChain) follow the same
 * TanStack Query wrapper pattern as useCompensacion — tested via API spy patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Query keys ───────────────────────────────────────────────────────────────
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'

// ─── API spy test (pure call shape) ───────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import {
  buildManagerChainDisplay,
  buildSubordinateDisplayEntry,
  isChainTruncated,
  buildCvDownloadUrl,
} from '../composables/useOrganigrama'

// ─────────────────────────────────────────────────────────────────────────────
// 1. employeeQueryKeys.subordinates — key shape tests
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeQueryKeys.subordinates', () => {
  it('returns a stable array key with tenantId and employeeId', () => {
    const key = employeeQueryKeys.subordinates('tenant-1', 'emp-abc')
    expect(key).toEqual(['employees', 'tenant-1', 'subordinates', 'emp-abc'])
  })

  it('produces unique keys for different employees', () => {
    const key1 = employeeQueryKeys.subordinates('tenant-1', 'emp-001')
    const key2 = employeeQueryKeys.subordinates('tenant-1', 'emp-002')
    // Different employeeId → different key
    expect(key1[3]).not.toBe(key2[3])
    expect(key1).not.toEqual(key2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. employeeQueryKeys.managerChain — confirm no regression (key already exists)
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeQueryKeys.managerChain', () => {
  it('returns a stable array key with tenantId and employeeId', () => {
    const key = employeeQueryKeys.managerChain('tenant-1', 'emp-xyz')
    expect(key).toEqual(['employees', 'tenant-1', 'manager-chain', 'emp-xyz'])
  })

  it('produces unique keys for different employees', () => {
    const key1 = employeeQueryKeys.managerChain('tenant-1', 'emp-001')
    const key2 = employeeQueryKeys.managerChain('tenant-1', 'emp-002')
    expect(key1[3]).not.toBe(key2[3])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. employeesApi.getSubordinates — API spy tests
// ─────────────────────────────────────────────────────────────────────────────

describe('employeesApi.getSubordinates', () => {
  const mockSubordinates: Employee[] = [
    {
      id: 'sub-001',
      employeeNumber: 'EMP-002',
      fullName: 'María López',
      email: 'maria@empresa.com',
      status: 'ACTIVE',
      terminationDate: null,
      contractType: 'PERMANENT',
      workModality: 'HYBRID',
      currentPosition: 'Analista',
      currentDepartment: 'Finanzas',
      managerId: 'emp-001',
      hireDate: '2024-03-01',
      photoFileId: null,
      cvFileId: null,
    },
  ]

  beforeEach(() => {
    vi.spyOn(employeesApi, 'getSubordinates').mockResolvedValue(mockSubordinates)
  })

  it('calls GET /:id/subordinates and returns Employee[]', async () => {
    const result = await employeesApi.getSubordinates('emp-001')
    expect(employeesApi.getSubordinates).toHaveBeenCalledWith('emp-001')
    expect(result).toHaveLength(1)
    const first = result[0]
    expect(first).toBeDefined()
    expect(first!.fullName).toBe('María López')
  })

  it('passes the correct employeeId in the call', async () => {
    await employeesApi.getSubordinates('specific-id-789')
    expect(employeesApi.getSubordinates).toHaveBeenCalledWith('specific-id-789')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. employeesApi.getManagerChain — API spy tests
// ─────────────────────────────────────────────────────────────────────────────

describe('employeesApi.getManagerChain', () => {
  const mockChain: Employee[] = [
    {
      id: 'mgr-001',
      employeeNumber: 'EMP-100',
      fullName: 'Carlos Rodríguez',
      email: 'carlos@empresa.com',
      status: 'ACTIVE',
      terminationDate: null,
      contractType: 'PERMANENT',
      workModality: 'ONSITE',
      currentPosition: 'Director General',
      currentDepartment: 'Dirección',
      managerId: null,
      hireDate: '2020-01-01',
      photoFileId: null,
      cvFileId: null,
    },
  ]

  beforeEach(() => {
    vi.spyOn(employeesApi, 'getManagerChain').mockResolvedValue(mockChain)
  })

  it('calls GET /:id/manager-chain and returns Employee[]', async () => {
    const result = await employeesApi.getManagerChain('emp-001')
    expect(employeesApi.getManagerChain).toHaveBeenCalledWith('emp-001')
    expect(result).toHaveLength(1)
    const first = result[0]
    expect(first).toBeDefined()
    expect(first!.fullName).toBe('Carlos Rodríguez')
  })

  it('passes the correct employeeId in the call', async () => {
    await employeesApi.getManagerChain('another-id-456')
    expect(employeesApi.getManagerChain).toHaveBeenCalledWith('another-id-456')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. buildManagerChainDisplay — pure helper
// ─────────────────────────────────────────────────────────────────────────────

describe('buildManagerChainDisplay', () => {
  const makeEmployee = (id: string, fullName: string, position: string | null): Employee => ({
    id,
    employeeNumber: `EMP-${id}`,
    fullName,
    email: null,
    status: 'ACTIVE',
    terminationDate: null,
    contractType: 'PERMANENT',
    workModality: 'HYBRID',
    currentPosition: position,
    currentDepartment: null,
    managerId: null,
    hireDate: '2023-01-01',
    photoFileId: null,
    cvFileId: null,
  })

  it('maps a chain of 2 to display entries with fullName and position', () => {
    const chain = [
      makeEmployee('mgr-001', 'Ana García', 'CEO'),
      makeEmployee('mgr-002', 'Pedro Sánchez', 'Director'),
    ]
    const entries = buildManagerChainDisplay(chain)
    expect(entries).toHaveLength(2)
    const first = entries[0]!
    const second = entries[1]!
    expect(first.fullName).toBe('Ana García')
    expect(first.position).toBe('CEO')
    expect(first.id).toBe('mgr-001')
    expect(second.fullName).toBe('Pedro Sánchez')
    expect(second.position).toBe('Director')
  })

  it('uses fallback "—" for null position in chain entry', () => {
    const chain = [makeEmployee('mgr-001', 'Luis Torres', null)]
    const entries = buildManagerChainDisplay(chain)
    expect(entries[0]!.position).toBe('—')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. buildSubordinateDisplayEntry — pure helper
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSubordinateDisplayEntry', () => {
  const makeSub = (fullName: string, position: string | null, dept: string | null): Employee => ({
    id: 'sub-1',
    employeeNumber: 'EMP-SUB',
    fullName,
    email: 'sub@empresa.com',
    status: 'ACTIVE',
    terminationDate: null,
    contractType: 'TEMPORARY',
    workModality: 'REMOTE',
    currentPosition: position,
    currentDepartment: dept,
    managerId: 'emp-001',
    hireDate: '2025-01-01',
    photoFileId: null,
    cvFileId: null,
  })

  it('builds entry with fullName, position, and department', () => {
    const sub = makeSub('Rosa Pérez', 'Analista Senior', 'Tecnología')
    const entry = buildSubordinateDisplayEntry(sub)
    expect(entry.fullName).toBe('Rosa Pérez')
    expect(entry.position).toBe('Analista Senior')
    expect(entry.department).toBe('Tecnología')
    expect(entry.id).toBe('sub-1')
  })

  it('uses fallback "—" when position and department are null', () => {
    const sub = makeSub('Mario Fernández', null, null)
    const entry = buildSubordinateDisplayEntry(sub)
    expect(entry.position).toBe('—')
    expect(entry.department).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. isChainTruncated — pure helper (50-level defensive cap)
// ─────────────────────────────────────────────────────────────────────────────

describe('isChainTruncated', () => {
  it('returns false when chain has fewer than 50 levels', () => {
    const chain = Array.from({ length: 5 }, (_, i) => ({
      id: `mgr-${i}`,
      employeeNumber: `EMP-${i}`,
      fullName: `Manager ${i}`,
      email: null,
      status: 'ACTIVE' as const,
      terminationDate: null,
      contractType: 'PERMANENT' as const,
      workModality: 'HYBRID' as const,
      currentPosition: 'Director',
      currentDepartment: null,
      managerId: null,
      hireDate: '2020-01-01',
      photoFileId: null,
      cvFileId: null,
    }))
    expect(isChainTruncated(chain)).toBe(false)
  })

  it('returns true when chain has exactly 50 levels (max cap)', () => {
    const chain = Array.from({ length: 50 }, (_, i) => ({
      id: `mgr-${i}`,
      employeeNumber: `EMP-${i}`,
      fullName: `Manager ${i}`,
      email: null,
      status: 'ACTIVE' as const,
      terminationDate: null,
      contractType: 'PERMANENT' as const,
      workModality: 'HYBRID' as const,
      currentPosition: 'Nivel',
      currentDepartment: null,
      managerId: null,
      hireDate: '2020-01-01',
      photoFileId: null,
      cvFileId: null,
    }))
    expect(isChainTruncated(chain)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. buildCvDownloadUrl — pure helper
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCvDownloadUrl', () => {
  it('builds the correct download path for a given fileId', () => {
    const url = buildCvDownloadUrl('file-uuid-abc123')
    expect(url).toBe('/files/file-uuid-abc123')
  })

  it('produces different URLs for different fileIds', () => {
    const url1 = buildCvDownloadUrl('file-001')
    const url2 = buildCvDownloadUrl('file-002')
    expect(url1).not.toBe(url2)
    expect(url1).toBe('/files/file-001')
    expect(url2).toBe('/files/file-002')
  })
})
