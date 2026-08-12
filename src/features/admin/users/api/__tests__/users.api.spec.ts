import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usersApi } from '../users.api'
import { http } from '@/core/shared/api/http'
import type { ServerTableParams } from '@/core/shared/types/table.types'

vi.mock('@/core/shared/api/http')

describe('usersApi.getPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeBackendUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      email: 'ana@test.com',
      name: 'Ana Pérez',
      isActive: true,
      createdAt: '2026-05-26T20:24:00.000Z',
      roles: [{ id: 'r1', name: 'Administrador' }],
      ...overrides,
    }
  }

  function mockUsersEnvelope(users: Array<Record<string, unknown>>) {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        data: users,
        meta: { total: users.length, page: 1, limit: 10, totalPages: 1 },
      },
    })
  }

  it('calls GET /admin/users with page and limit params', async () => {
    mockUsersEnvelope([])

    const params: ServerTableParams = {
      pageIndex: 0,
      pageSize: 10,
    }

    await usersApi.getPaginated(params)

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10 },
    })
  })

  it('sends search when globalFilter has at least 2 chars', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'ana',
    })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10, search: 'ana' },
    })
  })

  it('omits search when globalFilter has a single char (avoids SEARCH_QUERY_TOO_SHORT)', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'a',
    })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10 },
    })
  })

  it('omits search when globalFilter is undefined', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({ pageIndex: 0, pageSize: 10 })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10 },
    })
  })

  it('sends sortBy/sortOrder for a whitelisted field', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'email', desc: true }],
    })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10, sortBy: 'email', sortOrder: 'desc' },
    })
  })

  it('defaults sortOrder to asc when the sort is not descending', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'name', desc: false }],
    })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' },
    })
  })

  it('omits sortBy when the field is not in the backend whitelist', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'isActive', desc: false }],
    })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10 },
    })
  })

  it('omits sorting when the table is unsorted', async () => {
    mockUsersEnvelope([])

    await usersApi.getPaginated({ pageIndex: 0, pageSize: 10 })

    expect(http.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 10 },
    })
  })

  it('maps roles from each list item and trusts backend meta for pagination', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        data: [
          makeBackendUser({ id: 'u1', roles: [{ id: 'r1', name: 'Administrador' }] }),
          makeBackendUser({
            id: 'u2',
            name: 'Bruno Díaz',
            email: 'bruno@test.com',
            roles: [
              { id: 'r2', name: 'Operador' },
              { id: 'r3', name: 'Cajero' },
            ],
          }),
        ],
        // Filtered total — must be trusted, not recomputed from this page.
        meta: { total: 7, page: 2, limit: 10, totalPages: 1 },
      },
    })

    const result = await usersApi.getPaginated({
      pageIndex: 1,
      pageSize: 10,
    })

    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({
      id: 'u1',
      email: 'ana@test.com',
      name: 'Ana Pérez',
      isActive: true,
      createdAt: '2026-05-26T20:24:00.000Z',
      roles: [{ id: 'r1', name: 'Administrador' }],
    })
    expect(result.data[1]?.roles).toEqual([
      { id: 'r2', name: 'Operador' },
      { id: 'r3', name: 'Cajero' },
    ])
    expect(result.pagination).toEqual({
      pageIndex: 1,
      pageSize: 10,
      totalCount: 7,
      pageCount: 1,
    })
  })

  it('does not locally filter or sort — rows pass through in backend order', async () => {
    mockUsersEnvelope([
      makeBackendUser({ id: 'u2', name: 'Bruno Díaz' }),
      makeBackendUser({ id: 'u1', name: 'Ana Pérez' }),
    ])

    const result = await usersApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'bruno',
      sorting: [{ id: 'name', desc: true }],
    })

    expect(result.data.map((row) => row.id)).toEqual(['u2', 'u1'])
  })
})
