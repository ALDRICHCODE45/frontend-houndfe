import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    accessToken: null,
    user: null,
    isAuthenticated: false,
    permissionsLoaded: false,
    hydrateFromStorage: vi.fn(),
    fetchMe: vi.fn(),
    fetchPermissions: vi.fn(),
    clearSession: vi.fn(),
    userCan: vi.fn().mockReturnValue(true),
    logout: vi.fn(),
  }),
}))

let routes: ReturnType<(typeof import('../index'))['default']['getRoutes']>

beforeAll(async () => {
  const module = await import('../index')
  routes = module.default.getRoutes()
})

describe('sales routes', () => {
  it('uses /pos/ventas for list and /pos/ventas/nueva for workspace', () => {
    expect(routes.find((r) => r.path === '/pos/ventas')?.name).toBe('pos-sales-list')
    expect(routes.find((r) => r.path === '/pos/ventas/nueva')?.name).toBe('pos-sales')
  })

  it('resolves detail route without conflicting with nueva', () => {
    const detailRoute = routes.find((r) => r.path === '/pos/ventas/:id')
    expect(detailRoute?.name).toBe('pos-sale-detail')

    const nuevaRoute = routes.find((r) => r.path === '/pos/ventas/nueva')
    expect(nuevaRoute).toBeDefined()
  })

  it('requires read sale permission on list and detail routes', () => {
    const listMeta = routes.find((r) => r.path === '/pos/ventas')?.meta as { permission?: [string, string] }
    const detailMeta = routes.find((r) => r.path === '/pos/ventas/:id')?.meta as {
      permission?: [string, string]
    }

    expect(listMeta.permission).toEqual(['read', 'Sale'])
    expect(detailMeta.permission).toEqual(['read', 'Sale'])
  })
})
