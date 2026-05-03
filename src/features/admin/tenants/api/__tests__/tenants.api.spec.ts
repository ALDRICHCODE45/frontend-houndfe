import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tenantsApi } from '../tenants.api'
import { http } from '@/core/shared/api/http'
import type { TenantResponse } from '../../interfaces/tenant.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

vi.mock('@/core/shared/api/http')

describe('tenantsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPaginated', () => {
    const mockTenants: TenantResponse[] = [
      {
        id: '1',
        name: 'Sucursal Norte',
        slug: 'norte',
        address: 'Av. Norte 123',
        phone: '123456',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Sucursal Sur',
        slug: 'sur',
        address: 'Av. Sur 456',
        isActive: false,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
      {
        id: '3',
        name: 'Sucursal Centro',
        slug: 'centro',
        isActive: true,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      },
    ]

    it('calls backend with includeInactive query param', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
      }

      await tenantsApi.getPaginated(params, true)

      expect(http.get).toHaveBeenCalledWith('/admin/tenants', {
        params: { includeInactive: true },
      })
    })

    it('calls backend with includeInactive=false when false', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
      }

      await tenantsApi.getPaginated(params, false)

      expect(http.get).toHaveBeenCalledWith('/admin/tenants', {
        params: { includeInactive: false },
      })
    })

    it('maps backend array to paginated response with correct structure', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('pagination')
      expect(result.pagination).toHaveProperty('pageIndex')
      expect(result.pagination).toHaveProperty('pageSize')
      expect(result.pagination).toHaveProperty('totalCount')
      expect(result.pagination).toHaveProperty('pageCount')
    })

    it('applies client-side pagination correctly', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 2,
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data).toHaveLength(2)
      expect(result.pagination.totalCount).toBe(3)
      expect(result.pagination.pageCount).toBe(2)
    })

    it('returns correct page 2 data', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 1,
        pageSize: 2,
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.id).toBe('3')
      expect(result.pagination.pageIndex).toBe(1)
    })

    it('filters rows by globalFilter in name', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'norte',
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.name).toBe('Sucursal Norte')
    })

    it('filters rows by globalFilter in slug', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'sur',
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.slug).toBe('sur')
    })

    it('filters case-insensitively', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'NORTE',
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]?.name).toBe('Sucursal Norte')
    })

    it('sorts by name ascending', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        sorting: [{ id: 'name', desc: false }],
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data[0]?.name).toBe('Sucursal Centro')
      expect(result.data[1]?.name).toBe('Sucursal Norte')
      expect(result.data[2]?.name).toBe('Sucursal Sur')
    })

    it('sorts by name descending', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        sorting: [{ id: 'name', desc: true }],
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data[0]?.name).toBe('Sucursal Sur')
      expect(result.data[1]?.name).toBe('Sucursal Norte')
      expect(result.data[2]?.name).toBe('Sucursal Centro')
    })

    it('returns empty array when no tenants match filter', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: mockTenants })

      const params: ServerTableParams = {
        pageIndex: 0,
        pageSize: 10,
        globalFilter: 'nonexistent',
      }

      const result = await tenantsApi.getPaginated(params, true)

      expect(result.data).toEqual([])
      expect(result.pagination.totalCount).toBe(0)
    })
  })

  describe('getById', () => {
    it('calls GET /admin/tenants/:id', async () => {
      const mockTenant: TenantResponse = {
        id: '1',
        name: 'Sucursal Norte',
        slug: 'norte',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      vi.mocked(http.get).mockResolvedValue({ data: mockTenant })

      const result = await tenantsApi.getById('1')

      expect(http.get).toHaveBeenCalledWith('/admin/tenants/1')
      expect(result).toEqual(mockTenant)
    })
  })

  describe('create', () => {
    it('calls POST /admin/tenants with payload', async () => {
      const payload = {
        name: 'Nueva Sucursal',
        slug: 'nueva',
        address: 'Av. Nueva 123',
      }

      const mockResponse: TenantResponse = {
        id: '99',
        ...payload,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockResponse })

      const result = await tenantsApi.create(payload)

      expect(http.post).toHaveBeenCalledWith('/admin/tenants', payload)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('update', () => {
    it('calls PATCH /admin/tenants/:id with payload', async () => {
      const payload = {
        name: 'Nombre Actualizado',
        isActive: false,
      }

      const mockResponse: TenantResponse = {
        id: '1',
        name: 'Nombre Actualizado',
        slug: 'norte',
        isActive: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      }

      vi.mocked(http.patch).mockResolvedValue({ data: mockResponse })

      const result = await tenantsApi.update('1', payload)

      expect(http.patch).toHaveBeenCalledWith('/admin/tenants/1', payload)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deactivate', () => {
    it('calls DELETE /admin/tenants/:id for soft-delete', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await tenantsApi.deactivate('1')

      expect(http.delete).toHaveBeenCalledWith('/admin/tenants/1')
    })
  })
})

describe('mapTenantError', () => {
  // Import will be added after implementation
  let mapTenantError: (codeOrMessage: string) => string

  beforeEach(async () => {
    const module = await import('../tenants.api')
    mapTenantError = module.mapTenantError
  })

  it('maps TENANT_ALREADY_EXISTS to user-facing message', () => {
    const result = mapTenantError('TENANT_ALREADY_EXISTS')
    expect(result).toBe('Ya existe una sucursal con ese slug o nombre')
  })

  it('maps TENANT_NOT_FOUND to user-facing message', () => {
    const result = mapTenantError('TENANT_NOT_FOUND')
    expect(result).toBe('Sucursal no encontrada')
  })

  it('maps SUPER_ADMIN_REQUIRED to user-facing message', () => {
    const result = mapTenantError('SUPER_ADMIN_REQUIRED')
    expect(result).toBe('Se requieren permisos de super administrador')
  })

  it('maps TENANT_INACTIVE to user-facing message', () => {
    const result = mapTenantError('TENANT_INACTIVE')
    expect(result).toBe('La sucursal está desactivada')
  })

  it('returns fallback message for unknown error code', () => {
    const result = mapTenantError('UNKNOWN_ERROR_CODE')
    expect(result).toBe('Ocurrió un error inesperado')
  })

  it('returns fallback message for empty string', () => {
    const result = mapTenantError('')
    expect(result).toBe('Ocurrió un error inesperado')
  })

  it('handles mixed case error codes', () => {
    const result = mapTenantError('tenant_already_exists')
    // Should still map if we normalize to uppercase internally
    expect(result).toBe('Ya existe una sucursal con ese slug o nombre')
  })
})
