import { describe, it, expect, vi, beforeEach } from 'vitest'
import { membershipsApi } from '../memberships.api'
import { http } from '@/core/shared/api/http'
import type { MembershipResponse } from '../../interfaces/membership.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

vi.mock('@/core/shared/api/http')

describe('membershipsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPaginated', () => {
    const mockMemberships: MembershipResponse[] = [
      {
        id: 'm1',
        userId: 'u1',
        tenantId: 't1',
        roleId: 'r1',
      },
      {
        id: 'm2',
        userId: 'u2',
        tenantId: 't1',
        roleId: 'r2',
      },
      {
        id: 'm3',
        userId: 'u3',
        tenantId: 't1',
        roleId: 'r1',
      },
    ]

    it('calls GET /admin/tenants/:tenantId/members', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
      }

      await membershipsApi.getPaginated('tenant-1', params)

      expect(http.get).toHaveBeenCalledWith('/admin/tenants/tenant-1/members')
    })

    it('calls backend with different tenantId parameter', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
      }

      await membershipsApi.getPaginated('tenant-2', params)

      expect(http.get).toHaveBeenCalledWith('/admin/tenants/tenant-2/members')
    })

    it('maps backend array to paginated response with correct structure', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('pagination')
      expect(result.pagination).toHaveProperty('pageIndex')
      expect(result.pagination).toHaveProperty('pageSize')
      expect(result.pagination).toHaveProperty('totalCount')
      expect(result.pagination).toHaveProperty('pageCount')
    })

    it('applies client-side pagination correctly', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 2,
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data).toHaveLength(2)
      expect(result.pagination.totalCount).toBe(3)
      expect(result.pagination.pageCount).toBe(2)
    })

    it('returns correct page 2 data', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 1,
        pageSize: 2,
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.id).toBe('m3')
      expect(result.pagination.pageIndex).toBe(1)
    })

    it('filters rows by globalFilter in userId', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'u2',
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.userId).toBe('u2')
    })

    it('filters rows by globalFilter in roleId', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'r2',
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.roleId).toBe('r2')
    })

    it('filters case-insensitively', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'U1',
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.userId).toBe('u1')
    })

    it('sorts by userId ascending', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        sorting: [{ id: 'userId', desc: false }],
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data[0]?.userId).toBe('u1')
      expect(result.data[1]?.userId).toBe('u2')
      expect(result.data[2]?.userId).toBe('u3')
    })

    it('sorts by userId descending', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        sorting: [{ id: 'userId', desc: true }],
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data[0]?.userId).toBe('u3')
      expect(result.data[1]?.userId).toBe('u2')
      expect(result.data[2]?.userId).toBe('u1')
    })

    it('returns empty array when no memberships match filter', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockMemberships })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'nonexistent',
      }

      const result = await membershipsApi.getPaginated('tenant-1', params)

      expect(result.data).toEqual([])
      expect(result.pagination.totalCount).toBe(0)
    })
  })

  describe('create', () => {
    it('calls POST /admin/tenants/:tenantId/members with payload', async () => {
      const payload = {
        userId: 'user-uuid',
        roleId: 'role-uuid',
      }

      const mockResponse: MembershipResponse = {
        id: 'new-membership-id',
        userId: 'user-uuid',
        tenantId: 'tenant-1',
        roleId: 'role-uuid',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      const result = await membershipsApi.create('tenant-1', payload)

      expect(http.post).toHaveBeenCalledWith('/admin/tenants/tenant-1/members', payload)
      expect(result).toEqual(mockResponse)
    })

    it('calls POST with different tenantId', async () => {
      const payload = {
        userId: 'user-uuid',
        roleId: 'role-uuid',
      }

      const mockResponse: MembershipResponse = {
        id: 'new-membership-id',
        userId: 'user-uuid',
        tenantId: 'tenant-2',
        roleId: 'role-uuid',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      await membershipsApi.create('tenant-2', payload)

      expect(http.post).toHaveBeenCalledWith('/admin/tenants/tenant-2/members', payload)
    })
  })

  describe('updateRole', () => {
    it('calls PATCH /admin/tenants/:tenantId/members/:membershipId with payload', async () => {
      const payload = {
        roleId: 'new-role-uuid',
      }

      const mockResponse: MembershipResponse = {
        id: 'membership-1',
        userId: 'user-uuid',
        tenantId: 'tenant-1',
        roleId: 'new-role-uuid',
      }

      vi.mocked(http.patch).mockResolvedValue({ data: mockResponse })

      const result = await membershipsApi.updateRole('tenant-1', 'membership-1', payload)

      expect(http.patch).toHaveBeenCalledWith(
        '/admin/tenants/tenant-1/members/membership-1',
        payload,
      )
      expect(result).toEqual(mockResponse)
    })

    it('calls PATCH with different tenantId and membershipId', async () => {
      const payload = {
        roleId: 'another-role',
      }

      const mockResponse: MembershipResponse = {
        id: 'membership-2',
        userId: 'user-uuid',
        tenantId: 'tenant-2',
        roleId: 'another-role',
      }

      vi.mocked(http.patch).mockResolvedValue({ data: mockResponse })

      await membershipsApi.updateRole('tenant-2', 'membership-2', payload)

      expect(http.patch).toHaveBeenCalledWith(
        '/admin/tenants/tenant-2/members/membership-2',
        payload,
      )
    })
  })

  describe('remove', () => {
    it('calls DELETE /admin/tenants/:tenantId/members/:membershipId', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await membershipsApi.remove('tenant-1', 'membership-1')

      expect(http.delete).toHaveBeenCalledWith('/admin/tenants/tenant-1/members/membership-1')
    })

    it('calls DELETE with different tenantId and membershipId', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await membershipsApi.remove('tenant-2', 'membership-2')

      expect(http.delete).toHaveBeenCalledWith('/admin/tenants/tenant-2/members/membership-2')
    })
  })
})

describe('mapMembershipError', () => {
  // Import will be added after implementation
  let mapMembershipError: (codeOrMessage: string) => string

  beforeEach(async () => {
    const module = await import('../memberships.api')
    mapMembershipError = module.mapMembershipError
  })

  it('maps ROLE_TENANT_MISMATCH to user-facing message', () => {
    const result = mapMembershipError('ROLE_TENANT_MISMATCH')
    expect(result).toBe('El rol seleccionado no pertenece a esta sucursal')
  })

  it('maps TENANT_MEMBERSHIP_EXISTS to user-facing message', () => {
    const result = mapMembershipError('TENANT_MEMBERSHIP_EXISTS')
    expect(result).toBe('El usuario ya es miembro de esta sucursal')
  })

  it('maps TENANT_MEMBERSHIP_NOT_FOUND to user-facing message', () => {
    const result = mapMembershipError('TENANT_MEMBERSHIP_NOT_FOUND')
    expect(result).toBe('Membresía no encontrada')
  })

  it('maps TENANT_ACCESS_DENIED to user-facing message', () => {
    const result = mapMembershipError('TENANT_ACCESS_DENIED')
    expect(result).toBe('No tenés permisos para gestionar esta sucursal')
  })

  it('maps TENANT_NOT_FOUND to user-facing message', () => {
    const result = mapMembershipError('TENANT_NOT_FOUND')
    expect(result).toBe('Sucursal no encontrada')
  })

  it('returns fallback message for unknown error code', () => {
    const result = mapMembershipError('UNKNOWN_ERROR_CODE')
    expect(result).toBe('Ocurrió un error inesperado')
  })

  it('returns fallback message for empty string', () => {
    const result = mapMembershipError('')
    expect(result).toBe('Ocurrió un error inesperado')
  })

  it('handles mixed case error codes', () => {
    const result = mapMembershipError('role_tenant_mismatch')
    expect(result).toBe('El rol seleccionado no pertenece a esta sucursal')
  })
})
