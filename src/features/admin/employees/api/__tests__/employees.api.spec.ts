/**
 * WU-A — employees.api adapter specs (REQ-1, REQ-2)
 *
 * Pinned after the useServerTable migration:
 *  - EmployeesListParams.page is renamed to `pageIndex` (0-based)
 *  - `list` sends `page = (pageIndex ?? 0) + 1` (backend is 1-indexed)
 *  - No sort param is sent (sorting descoped)
 *  - Status filter is lowercase (`active` | `terminated` | `all`)
 *  - No `tenantId` is ever sent (regression guard)
 *  - `managerId` and `search` are passed through when provided
 *  - `mapPaginated` is unchanged (1-indexed backend page → 0-indexed pageIndex)
 *
 * RED — written before the production change to employees.api.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  employeesApi,
  mapPaginated,
} from '@/features/admin/employees/api/employees.api'
import { http } from '@/core/shared/api/http'
import type { Employee } from '@/features/admin/employees/interfaces/employee.types'

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: '1',
    employeeNumber: 'EMP-001',
    fullName: 'Ana García',
    email: 'ana@example.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'ONSITE',
    currentPosition: 'Desarrolladora',
    currentDepartment: 'Tecnología',
    managerId: null,
    hireDate: '2023-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  }
}

// ─── mapPaginated — unchanged contract (regression guard) ────────────────────

describe('mapPaginated — pagination adapter (unchanged)', () => {
  it('still computes pageCount = ceil(total / pageSize)', () => {
    const result = mapPaginated({
      data: [makeEmployee()],
      total: 25,
      page: 1,
      limit: 10,
      pageSize: 10,
    })
    expect(result.pagination.pageCount).toBe(3)
  })

  it('still converts 1-indexed backend page to 0-indexed pageIndex', () => {
    const result = mapPaginated({
      data: [makeEmployee()],
      total: 100,
      page: 2,
      limit: 10,
      pageSize: 10,
    })
    expect(result.pagination.pageIndex).toBe(1)
  })
})

// ─── EmployeesListParams — shape pinned by WU-A ──────────────────────────────

describe('EmployeesListParams — pageIndex (0-based) contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts pageIndex: 0 and sends page: 1 to the backend', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [makeEmployee()], total: 1, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', pageIndex: 0, pageSize: 10 })

    const call = spy.mock.calls[0]
    expect(call).toBeDefined()
    const params = call![1]?.params ?? {}
    expect(params.page).toBe(1)
  })

  it('accepts pageIndex: 2 and sends page: 3 (backend is 1-indexed)', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 3, limit: 20, pageSize: 20 },
    })

    await employeesApi.list({ status: 'active', pageIndex: 2, pageSize: 20 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect(params.page).toBe(3)
    expect(params.pageSize).toBe(20)
  })

  it('defaults pageIndex to 0 (sends page: 1) when undefined', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect(params.page).toBe(1)
  })

  it('does NOT send any sort param (sorting descoped pending backend)', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect('sortBy' in params).toBe(false)
    expect('sortOrder' in params).toBe(false)
    expect('sort' in params).toBe(false)
  })

  it('sends lowercase status filter', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'active', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect(params.status).toBe('active')
  })

  it('never sends tenantId (regression guard)', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect('tenantId' in params).toBe(false)
  })

  it('passes managerId through when provided', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', managerId: 'mgr-123', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect(params.managerId).toBe('mgr-123')
  })

  it('omits managerId when undefined', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect('managerId' in params).toBe(false)
  })

  it('passes search through when provided', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', search: 'juan', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect(params.search).toBe('juan')
  })

  it('omits search when empty string', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, limit: 10, pageSize: 10 },
    })

    await employeesApi.list({ status: 'all', search: '', pageIndex: 0, pageSize: 10 })

    const params = spy.mock.calls[0]![1]?.params ?? {}
    expect('search' in params).toBe(false)
  })
})